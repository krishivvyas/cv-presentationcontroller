"""
GestureSlide — Hands-Free Presentation Controller
===================================================
Detects hand gestures via MediaPipe and simulates keyboard shortcuts
to control any presentation app (PowerPoint, Google Slides, Keynote, etc.).
Streams gesture state to a Next.js dashboard via WebSocket.

Supports two camera modes:
  python gesture_controller.py          # Use local webcam
  python gesture_controller.py --phone  # Use phone camera via WiFi
"""

import cv2
import time
import math
import json
import asyncio
import threading
import base64
import sys
import socket
import numpy as np
from collections import deque
from enum import Enum
from dataclasses import dataclass, asdict

import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from pynput.keyboard import Controller as KeyboardCtrl, Key
import websockets
from websockets.asyncio.server import serve


# ─── Gesture Enum ────────────────────────────────────────────────────────────

class Gesture(Enum):
    NONE = "none"
    SWIPE_RIGHT = "swipe_right"
    SWIPE_LEFT = "swipe_left"
    FIST = "fist"
    PALM = "palm"
    THUMBS_UP = "thumbs_up"
    PINCH = "pinch"


# ─── Gesture Event ───────────────────────────────────────────────────────────

@dataclass
class GestureEvent:
    gesture: str
    action: str
    emoji: str
    timestamp: float
    confidence: float = 1.0
    paused: bool = False
    laser_mode: bool = False
    presentation_active: bool = False

    def to_json(self):
        d = asdict(self)
        d["type"] = "gesture"
        return json.dumps(d)


@dataclass
class FrameEvent:
    image: str

    def to_json(self):
        return json.dumps({"type": "frame", "image": self.image})


# ─── Hand Skeleton Connections ───────────────────────────────────────────────

HAND_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 4),          # thumb
    (0, 5), (5, 6), (6, 7), (7, 8),          # index
    (5, 9), (9, 10), (10, 11), (11, 12),     # middle
    (9, 13), (13, 14), (14, 15), (15, 16),   # ring
    (13, 17), (17, 18), (18, 19), (19, 20),  # pinky
    (0, 17)                                   # palm base
]

GESTURE_INFO = {
    Gesture.SWIPE_RIGHT: ("👉", "Next Slide"),
    Gesture.SWIPE_LEFT: ("👈", "Previous Slide"),
    Gesture.FIST: ("✊", "Toggle Presentation"),
    Gesture.PALM: ("🖐️", "Pause/Resume Recognition"),
    Gesture.THUMBS_UP: ("👍", "Toggle Laser Pointer"),
    Gesture.PINCH: ("🤏", "Toggle Blank Screen"),
    Gesture.NONE: ("⏳", "Waiting for gesture..."),
}


# ─── Gesture Detector ────────────────────────────────────────────────────────

class GestureDetector:
    """Detects hand gestures from MediaPipe landmarks."""

    def __init__(self, swipe_threshold=0.12, cooldown_ms=800):
        self.swipe_threshold = swipe_threshold
        self.cooldown_ms = cooldown_ms

        # Swipe tracking
        self.index_x_history = deque(maxlen=8)
        self.last_gesture_time = 0

        # Fist hold tracking
        self.fist_start_time = 0
        self.fist_hold_duration = 0.5  # seconds

        # State
        self.paused = False
        self.presentation_active = False
        self.laser_mode = False
        self.prev_pinching = False

    def _fingers_up(self, hl):
        """Detect which fingers are extended. Returns list of 5 ints (0 or 1)."""
        fingers = []

        # Thumb: compare tip distance to pinky base vs knuckle distance
        thumb_dist = math.hypot(hl[4].x - hl[17].x, hl[4].y - hl[17].y)
        ref_dist = math.hypot(hl[2].x - hl[17].x, hl[2].y - hl[17].y)
        fingers.append(1 if thumb_dist > ref_dist * 1.25 else 0)

        # Index, Middle, Ring, Pinky: tip above PIP joint
        for tip in [8, 12, 16, 20]:
            fingers.append(1 if hl[tip].y < hl[tip - 2].y else 0)

        return fingers

    def detect(self, hand_landmarks, frame_width, frame_height):
        """
        Analyze hand landmarks and return detected gesture.
        Returns (Gesture, confidence).
        """
        if not hand_landmarks:
            self.index_x_history.clear()
            return Gesture.NONE, 0.0

        hl = hand_landmarks
        fingers = self._fingers_up(hl)
        now = time.time()

        # Check cooldown
        elapsed_ms = (now - self.last_gesture_time) * 1000
        if elapsed_ms < self.cooldown_ms:
            # Still in cooldown, but track swipe history
            if fingers[1] == 1 and fingers[2] == 0:
                self.index_x_history.append(hl[8].x)
            return Gesture.NONE, 0.0

        num_up = sum(fingers)

        # ── Open Palm (all 5 fingers up) ──
        if num_up == 5:
            self.index_x_history.clear()
            self.fist_start_time = 0
            self.last_gesture_time = now
            self.paused = not self.paused
            return Gesture.PALM, 0.95

        # ── Fist (no fingers up) — needs hold for 0.5s ──
        if num_up == 0:
            self.index_x_history.clear()
            if self.fist_start_time == 0:
                self.fist_start_time = now
            elif now - self.fist_start_time >= self.fist_hold_duration:
                self.fist_start_time = 0
                self.last_gesture_time = now
                self.presentation_active = not self.presentation_active
                return Gesture.FIST, 0.9
            return Gesture.NONE, 0.0

        self.fist_start_time = 0

        # ── Thumbs Up (only thumb extended) ──
        if fingers == [1, 0, 0, 0, 0]:
            self.index_x_history.clear()
            self.last_gesture_time = now
            self.laser_mode = not self.laser_mode
            return Gesture.THUMBS_UP, 0.85

        # ── Pinch (thumb + index close together) ──
        thumb_tip = hl[4]
        index_tip = hl[8]
        pinch_dist = math.hypot(
            (thumb_tip.x - index_tip.x) * frame_width,
            (thumb_tip.y - index_tip.y) * frame_height
        )
        is_pinching = pinch_dist < 40
        pinch_event = is_pinching and not self.prev_pinching
        self.prev_pinching = is_pinching

        if pinch_event and fingers[2] == 0 and fingers[3] == 0 and fingers[4] == 0:
            self.index_x_history.clear()
            self.last_gesture_time = now
            return Gesture.PINCH, 0.85

        # ── Swipe Detection (index finger pointing) ──
        if fingers[1] == 1 and fingers[2] == 0 and fingers[3] == 0:
            self.index_x_history.append(hl[8].x)

            if len(self.index_x_history) >= 5:
                # Calculate velocity from oldest to newest
                dx = self.index_x_history[-1] - self.index_x_history[0]

                if dx > self.swipe_threshold:
                    self.index_x_history.clear()
                    self.last_gesture_time = now
                    # Note: camera is mirrored, so positive dx = swipe left in real world
                    return Gesture.SWIPE_LEFT, min(1.0, abs(dx) / 0.3)

                elif dx < -self.swipe_threshold:
                    self.index_x_history.clear()
                    self.last_gesture_time = now
                    return Gesture.SWIPE_RIGHT, min(1.0, abs(dx) / 0.3)

        return Gesture.NONE, 0.0


# ─── Keyboard Controller ────────────────────────────────────────────────────

class KeyboardController:
    """Simulates keyboard shortcuts for presentation control."""

    def __init__(self):
        self.keyboard = KeyboardCtrl()
        self.key_map = {
            Gesture.SWIPE_RIGHT: Key.right,
            Gesture.SWIPE_LEFT: Key.left,
            Gesture.FIST: None,         # Handled specially (F5 / Esc toggle)
            Gesture.PINCH: 'b',         # Blank screen toggle
        }

    def execute(self, gesture, presentation_active=False):
        """Execute keyboard action for the given gesture."""
        if gesture == Gesture.FIST:
            if presentation_active:
                self.keyboard.press(Key.f5)
                self.keyboard.release(Key.f5)
            else:
                self.keyboard.press(Key.esc)
                self.keyboard.release(Key.esc)
        elif gesture == Gesture.PINCH:
            self.keyboard.press('b')
            self.keyboard.release('b')
        elif gesture in self.key_map and self.key_map[gesture] is not None:
            key = self.key_map[gesture]
            self.keyboard.press(key)
            self.keyboard.release(key)


# ─── Drawing Helpers ─────────────────────────────────────────────────────────

def draw_hand_skeleton(img, hand_landmarks, w, h):
    """Draw the 21-point hand skeleton overlay."""
    points = [(int(lm.x * w), int(lm.y * h)) for lm in hand_landmarks]

    for start_idx, end_idx in HAND_CONNECTIONS:
        cv2.line(img, points[start_idx], points[end_idx], (0, 243, 255), 2)

    for i, (px, py) in enumerate(points):
        color = (0, 0, 255) if i in [4, 8, 12, 16, 20] else (255, 255, 255)
        cv2.circle(img, (px, py), 5, color, -1)
        cv2.circle(img, (px, py), 5, (0, 0, 0), 1)


def draw_laser_pointer(img, index_tip, w, h):
    """Draw a red laser dot at the index finger tip."""
    cx, cy = int(index_tip.x * w), int(index_tip.y * h)

    # Outer glow
    for radius, alpha in [(20, 0.15), (12, 0.3), (6, 0.6)]:
        overlay = img.copy()
        cv2.circle(overlay, (cx, cy), radius, (0, 0, 255), -1)
        cv2.addWeighted(overlay, alpha, img, 1 - alpha, 0, img)

    # Bright core
    cv2.circle(img, (cx, cy), 4, (0, 0, 255), -1)
    cv2.circle(img, (cx, cy), 2, (200, 200, 255), -1)


def draw_status_bar(img, gesture, detector, w, h, mode="webcam"):
    """Draw an informational HUD on the frame."""
    emoji, action = GESTURE_INFO.get(gesture, ("⏳", "Unknown"))

    # Background bar
    overlay = img.copy()
    cv2.rectangle(overlay, (0, 0), (w, 55), (20, 20, 30), -1)
    cv2.addWeighted(overlay, 0.7, img, 0.3, 0, img)

    # Status text
    status = "PAUSED" if detector.paused else "ACTIVE"
    status_color = (0, 200, 255) if not detector.paused else (0, 100, 200)
    mode_label = "PHONE" if mode == "phone" else "WEBCAM"
    cv2.putText(img, f"GestureSlide [{mode_label}] | {status}", (15, 22),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, status_color, 1, cv2.LINE_AA)

    # Current gesture
    cv2.putText(img, f"Gesture: {action}", (15, 45),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1, cv2.LINE_AA)

    # Laser mode indicator
    if detector.laser_mode:
        cv2.putText(img, "LASER ON", (w - 150, 22),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1, cv2.LINE_AA)

    # Presentation indicator
    pres_text = "PRESENTING" if detector.presentation_active else "STANDBY"
    pres_color = (0, 255, 100) if detector.presentation_active else (120, 120, 120)
    cv2.putText(img, pres_text, (w - 150, 45),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, pres_color, 1, cv2.LINE_AA)

    # Bottom hints
    cv2.putText(img, "Q: Quit | Gestures: Swipe/Fist/Palm/ThumbsUp/Pinch",
                (15, h - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.4,
                (100, 100, 100), 1, cv2.LINE_AA)


# ─── Utility ─────────────────────────────────────────────────────────────────

def get_local_ip():
    """Get the machine's local network IP address."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def encode_frame_to_data_url(frame):
    """Encode a CV2 frame to a base64 data URL for WebSocket streaming."""
    _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 60])
    frame_base64 = base64.b64encode(buffer).decode('utf-8')
    return f"data:image/jpeg;base64,{frame_base64}"


# ─── WebSocket Server ────────────────────────────────────────────────────────

class GestureWebSocketServer:
    """Broadcasts gesture events to connected frontend clients.
    Also receives camera frames from phone clients."""

    def __init__(self, host="0.0.0.0", port=8765):
        self.host = host
        self.port = port
        self.dashboard_clients = set()  # Next.js dashboard viewers
        self.latest_event = None
        self._server = None
        self._loop = None
        self.phone_frame = None        # Latest frame from phone camera
        self._phone_frame_lock = threading.Lock()

    async def _handler(self, websocket):
        """Handle a WebSocket connection."""
        self.dashboard_clients.add(websocket)
        client_type = "dashboard"
        print(f"[WS] Client connected ({len(self.dashboard_clients)} total)")

        try:
            # Send current state on connect
            if self.latest_event:
                await websocket.send(self.latest_event.to_json())

            # Listen for messages from clients
            async for message in websocket:
                try:
                    data = json.loads(message)

                    if data.get("type") == "camera_frame":
                        # Phone camera frame
                        client_type = "phone"
                        img_b64 = data["image"]
                        img_bytes = base64.b64decode(img_b64)
                        nparr = np.frombuffer(img_bytes, np.uint8)
                        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

                        if frame is not None:
                            with self._phone_frame_lock:
                                self.phone_frame = frame

                    elif data.get("type") == "config":
                        print(f"[WS] Config received: {data}")

                except json.JSONDecodeError:
                    pass
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self.dashboard_clients.discard(websocket)
            print(f"[WS] {client_type} disconnected ({len(self.dashboard_clients)} total)")

    async def _broadcast(self, event):
        """Send event to all connected dashboard clients."""
        if not self.dashboard_clients:
            return
        message = event.to_json()
        await asyncio.gather(
            *[client.send(message) for client in self.dashboard_clients.copy()],
            return_exceptions=True
        )

    def broadcast(self, event):
        """Thread-safe broadcast from the main loop."""
        self.latest_event = event
        if self._loop and self.dashboard_clients:
            asyncio.run_coroutine_threadsafe(self._broadcast(event), self._loop)

    def get_phone_frame(self):
        """Get the latest phone camera frame (thread-safe)."""
        with self._phone_frame_lock:
            frame = self.phone_frame
            self.phone_frame = None
            return frame

    async def _run_server(self):
        """Start the WebSocket server."""
        self._loop = asyncio.get_event_loop()
        async with serve(self._handler, self.host, self.port, max_size=10 * 1024 * 1024) as server:
            self._server = server
            print(f"[WS] Server started on ws://{self.host}:{self.port}")
            await asyncio.Future()  # Run forever

    def start_in_thread(self):
        """Run the WebSocket server in a background thread."""
        def _run():
            asyncio.run(self._run_server())

        thread = threading.Thread(target=_run, daemon=True)
        thread.start()
        time.sleep(0.5)  # Give the server time to start


# ─── Process a single frame ─────────────────────────────────────────────────

def process_frame(frame, detector_mp, gesture_detector, keyboard_ctrl, ws_server, last_gesture, mode):
    """Process a single frame: detect gestures, draw overlays, broadcast."""

    frame = cv2.flip(frame, 1)  # Mirror
    h, w, _ = frame.shape

    # Convert and detect
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
    timestamp_ms = int(time.time() * 1000)

    result = detector_mp.detect_for_video(mp_image, timestamp_ms)

    hands = result.hand_landmarks if result.hand_landmarks else []
    gesture = Gesture.NONE
    confidence = 0.0

    # Draw hand skeleton
    for hl in hands:
        draw_hand_skeleton(frame, hl, w, h)

    # Detect gesture
    if hands and not gesture_detector.paused:
        gesture, confidence = gesture_detector.detect(hands[0], w, h)

        # Execute keyboard action for actionable gestures
        if gesture not in (Gesture.NONE, Gesture.PALM, Gesture.THUMBS_UP):
            keyboard_ctrl.execute(gesture, gesture_detector.presentation_active)

        # Draw laser pointer if enabled
        if gesture_detector.laser_mode and hands:
            draw_laser_pointer(frame, hands[0][8], w, h)

    elif hands and gesture_detector.paused:
        # Still check for palm gesture to unpause
        hl = hands[0]
        fingers = gesture_detector._fingers_up(hl)
        if sum(fingers) == 5:
            now = time.time()
            elapsed_ms = (now - gesture_detector.last_gesture_time) * 1000
            if elapsed_ms >= gesture_detector.cooldown_ms:
                gesture_detector.paused = False
                gesture_detector.last_gesture_time = now
                gesture = Gesture.PALM
                confidence = 0.95

    # Draw HUD
    draw_status_bar(frame, gesture, gesture_detector, w, h, mode=mode)

    # Encode & broadcast frame
    frame_data_url = encode_frame_to_data_url(frame)
    ws_server.broadcast(FrameEvent(image=frame_data_url))

    # Broadcast gesture event
    if gesture != Gesture.NONE or gesture != last_gesture:
        emoji, action = GESTURE_INFO.get(gesture, ("⏳", "Unknown"))
        event = GestureEvent(
            gesture=gesture.value,
            action=action,
            emoji=emoji,
            timestamp=time.time(),
            confidence=confidence,
            paused=gesture_detector.paused,
            laser_mode=gesture_detector.laser_mode,
            presentation_active=gesture_detector.presentation_active,
        )
        ws_server.broadcast(event)

    return gesture, frame


# ─── Main Application ────────────────────────────────────────────────────────

def main():
    phone_mode = "--phone" in sys.argv
    local_ip = get_local_ip()

    print("=" * 60)
    print("  GestureSlide — Hands-Free Presentation Controller")
    print("=" * 60)
    print()

    if phone_mode:
        print(f"  📱 PHONE CAMERA MODE")
        print(f"  Your PC IP: {local_ip}")
        print(f"  On your phone, open: http://{local_ip}:3000/camera")
        print(f"  Enter IP: {local_ip}")
    else:
        print(f"  📷 WEBCAM MODE  (use --phone for phone camera)")

    print()

    # Initialize MediaPipe Hand Landmarker
    print("[INIT] Loading MediaPipe Hand Landmarker model...")
    base_options = python.BaseOptions(model_asset_path='hand_landmarker.task')
    options = vision.HandLandmarkerOptions(
        base_options=base_options,
        num_hands=1,
        running_mode=vision.RunningMode.VIDEO,
        min_hand_detection_confidence=0.5,
        min_hand_presence_confidence=0.5,
        min_tracking_confidence=0.5
    )
    detector_mp = vision.HandLandmarker.create_from_options(options)

    # Initialize components
    gesture_detector = GestureDetector(swipe_threshold=0.12, cooldown_ms=800)
    keyboard_ctrl = KeyboardController()
    ws_server = GestureWebSocketServer(host="0.0.0.0", port=8765)

    # Start WebSocket server
    print("[INIT] Starting WebSocket server...")
    ws_server.start_in_thread()

    cap = None

    if not phone_mode:
        # Initialize webcam
        print("[INIT] Opening webcam...")
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            print("[ERROR] Could not open webcam!")
            print("  Try --phone mode to use your phone camera instead.")
            return
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    print()
    print("[READY] GestureSlide is running!")
    print(f"  • Dashboard: http://localhost:3000/controller")
    if phone_mode:
        print(f"  • Phone camera: http://{local_ip}:3000/camera")
        print(f"  • Waiting for phone to connect...")
    else:
        print(f"  • Open your presentation app (PowerPoint, Google Slides, etc.)")
    print(f"  • Press 'Q' in the camera window to quit")
    print()

    last_gesture = Gesture.NONE

    while True:
        if phone_mode:
            # Get frame from phone via WebSocket
            frame = ws_server.get_phone_frame()
            if frame is None:
                # No frame yet, show waiting screen
                waiting = np.zeros((480, 640, 3), dtype=np.uint8)
                cv2.putText(waiting, "Waiting for phone camera...", (100, 220),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 200, 255), 2, cv2.LINE_AA)
                cv2.putText(waiting, f"Open http://{local_ip}:3000/camera on phone", (70, 260),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (150, 150, 150), 1, cv2.LINE_AA)
                cv2.imshow("GestureSlide — Phone Camera", waiting)
                key = cv2.waitKey(100) & 0xFF
                if key == ord('q'):
                    break
                continue

            frame = cv2.resize(frame, (640, 480))
            last_gesture, display_frame = process_frame(
                frame, detector_mp, gesture_detector, keyboard_ctrl,
                ws_server, last_gesture, mode="phone"
            )
            cv2.imshow("GestureSlide — Phone Camera", display_frame)

        else:
            # Get frame from local webcam
            success, frame = cap.read()
            if not success:
                print("[ERROR] Could not read frame from webcam.")
                break

            frame = cv2.resize(frame, (1280, 720))
            last_gesture, display_frame = process_frame(
                frame, detector_mp, gesture_detector, keyboard_ctrl,
                ws_server, last_gesture, mode="webcam"
            )
            cv2.imshow("GestureSlide — Presentation Controller", display_frame)

        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            print("\n[EXIT] GestureSlide shutting down...")
            break

    if cap:
        cap.release()
    cv2.destroyAllWindows()
    print("[EXIT] Done.")


if __name__ == "__main__":
    main()
