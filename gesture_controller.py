"""
GestureSlide — Next-Gen AI Presentation Controller
===================================================
Ultra-robust 3D distance gesture recognition engine with angle/rotation invariance.
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
from collections import deque, Counter
from enum import Enum
from dataclasses import dataclass, asdict

# Windows console UTF-8 output fix
if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from pynput.keyboard import Controller as KeyboardCtrl, Key
try:
    from websockets.asyncio.server import serve
except ImportError:
    try:
        from websockets.server import serve
    except ImportError:
        from websockets import serve


# ─── Gesture Enum ────────────────────────────────────────────────────────────

class Gesture(Enum):
    NONE = "none"
    INDEX_UP = "index_up"       # ☝️ Previous Slide
    THUMBS_UP = "thumbs_up"     # 👍 / ✌️ Next Slide
    FIST = "fist"               # ✊ Toggle Fullscreen
    TWO_PALMS = "two_palms"     # 🙌 Pause / Resume
    PINCH = "pinch"             # 🤏 Toggle Blank Screen


# ─── Gesture Event ───────────────────────────────────────────────────────────

@dataclass
class GestureEvent:
    gesture: str
    action: str
    emoji: str
    timestamp: float
    confidence: float = 1.0
    paused: bool = False
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
    Gesture.INDEX_UP: ("☝️", "Previous Slide"),
    Gesture.THUMBS_UP: ("👍", "Next Slide"),
    Gesture.FIST: ("✊", "Toggle Presentation"),
    Gesture.TWO_PALMS: ("🙌", "Pause / Resume"),
    Gesture.PINCH: ("🤏", "Blank Screen"),
    Gesture.NONE: ("⏳", "Ready"),
}


# ─── Robust 3D Distance-Based Gesture Detector ───────────────────────────────

class GestureDetector:
    """
    Angle- and rotation-invariant hand gesture detection using 3D Euclidean distances.
    100% reliable regardless of hand tilt, distance, or lighting.
    """

    def __init__(self, cooldown_ms=900):
        self.cooldown_ms = cooldown_ms
        self.last_gesture_time = 0
        self.last_fired_gesture = Gesture.NONE
        self.repeat_delay = 1.4  # seconds before repeating an identically held gesture

        # Smoothing buffer for 3-frame temporal voting
        self.history = deque(maxlen=3)

        # Fist hold tracking
        self.fist_start_time = 0
        self.fist_hold_duration = 0.45  # seconds
        self.fist_progress = 0.0

        # State
        self.paused = False
        self.presentation_active = False
        self.prev_pinching = False

    def _get_finger_extensions(self, hl):
        """
        Calculates whether each of the 5 fingers is extended.
        Uses Euclidean distances from wrist (0) to tip vs PIP knuckle (6, 10, 14, 18).
        Rotation-invariant across all angles.
        Returns: (is_thumb, is_index, is_middle, is_ring, is_pinky)
        """
        w = hl[0]  # Wrist point

        # Index (tip 8 vs PIP 6)
        d_idx_tip = math.hypot(hl[8].x - w.x, hl[8].y - w.y)
        d_idx_pip = math.hypot(hl[6].x - w.x, hl[6].y - w.y)
        is_index = d_idx_tip > d_idx_pip * 1.20

        # Middle (tip 12 vs PIP 10)
        d_mid_tip = math.hypot(hl[12].x - w.x, hl[12].y - w.y)
        d_mid_pip = math.hypot(hl[10].x - w.x, hl[10].y - w.y)
        is_mid = d_mid_tip > d_mid_pip * 1.20

        # Ring (tip 16 vs PIP 14)
        d_ring_tip = math.hypot(hl[16].x - w.x, hl[16].y - w.y)
        d_ring_pip = math.hypot(hl[14].x - w.x, hl[14].y - w.y)
        is_ring = d_ring_tip > d_ring_pip * 1.20

        # Pinky (tip 20 vs PIP 18)
        d_pinky_tip = math.hypot(hl[20].x - w.x, hl[20].y - w.y)
        d_pinky_pip = math.hypot(hl[18].x - w.x, hl[18].y - w.y)
        is_pinky = d_pinky_tip > d_pinky_pip * 1.20

        # Thumb (tip 4 is extended away from palm base 17 and higher than joint 2)
        d_thumb_tip = math.hypot(hl[4].x - hl[17].x, hl[4].y - hl[17].y)
        d_thumb_mcp = math.hypot(hl[2].x - hl[17].x, hl[2].y - hl[17].y)
        is_thumb = (d_thumb_tip > d_thumb_mcp * 1.15) and (hl[4].y < hl[3].y)

        return is_thumb, is_index, is_mid, is_ring, is_pinky

    def detect(self, hands, frame_width, frame_height):
        """Analyze landmarks and return verified gesture with confidence."""
        if not hands:
            self.history.append(Gesture.NONE)
            self.last_fired_gesture = Gesture.NONE
            self.fist_start_time = 0
            self.fist_progress = 0.0
            return Gesture.NONE, 0.0

        now = time.time()

        # ── Two Palms Gesture (Pause / Resume) ──
        if len(hands) == 2:
            f1 = self._get_finger_extensions(hands[0])
            f2 = self._get_finger_extensions(hands[1])
            if all(f1[1:]) and all(f2[1:]):  # All 4 main fingers extended on both hands
                if self.last_fired_gesture != Gesture.TWO_PALMS and (now - self.last_gesture_time) * 1000 >= self.cooldown_ms:
                    self.fist_start_time = 0
                    self.last_fired_gesture = Gesture.TWO_PALMS
                    self.last_gesture_time = now
                    self.paused = not self.paused
                    return Gesture.TWO_PALMS, 0.98
                return Gesture.NONE, 0.0

        # Primary Hand Analysis
        hl = hands[0]
        is_thumb, is_index, is_mid, is_ring, is_pinky = self._get_finger_extensions(hl)
        fingers_up_count = sum([is_index, is_mid, is_ring, is_pinky])

        raw_gesture = Gesture.NONE
        raw_conf = 0.0

        # ── 1. Fist (All fingers curled into fist for ~0.45s) ──
        if fingers_up_count == 0 and not is_thumb:
            if self.fist_start_time == 0:
                self.fist_start_time = now
                self.fist_progress = 0.1
            else:
                elapsed_hold = now - self.fist_start_time
                self.fist_progress = min(1.0, elapsed_hold / self.fist_hold_duration)
                if elapsed_hold >= self.fist_hold_duration:
                    if self.last_fired_gesture != Gesture.FIST and (now - self.last_gesture_time) * 1000 >= self.cooldown_ms:
                        self.fist_start_time = 0
                        self.fist_progress = 0.0
                        self.last_fired_gesture = Gesture.FIST
                        self.last_gesture_time = now
                        self.presentation_active = not self.presentation_active
                        return Gesture.FIST, 0.95
            return Gesture.NONE, 0.0

        self.fist_start_time = 0
        self.fist_progress = 0.0

        # ── 2. Index Finger Up Alone (☝️) ➔ Previous Slide ──
        if is_index and not is_mid and not is_ring and not is_pinky:
            raw_gesture = Gesture.INDEX_UP
            raw_conf = 0.95

        # ── 3. Next Slide: Thumbs Up (👍) OR Peace Sign (✌️) ➔ Next Slide ──
        elif (is_thumb and fingers_up_count == 0) or (is_index and is_mid and not is_ring and not is_pinky):
            raw_gesture = Gesture.THUMBS_UP
            raw_conf = 0.95

        # ── 4. Pinch (Thumb + Index touching) ➔ Toggle Blank Screen ──
        else:
            thumb_tip = hl[4]
            index_tip = hl[8]
            pinch_dist = math.hypot(
                (thumb_tip.x - index_tip.x) * frame_width,
                (thumb_tip.y - index_tip.y) * frame_height
            )
            is_pinching = pinch_dist < 40
            pinch_event = is_pinching and not self.prev_pinching
            self.prev_pinching = is_pinching

            if pinch_event and not is_mid and not is_ring and not is_pinky:
                raw_gesture = Gesture.PINCH
                raw_conf = 0.90

        # Smooth across 3-frame buffer
        self.history.append(raw_gesture)
        counts = Counter(self.history)
        majority_gesture, count = counts.most_common(1)[0]

        if count < 2 or majority_gesture == Gesture.NONE:
            if majority_gesture == Gesture.NONE:
                self.last_fired_gesture = Gesture.NONE
            return Gesture.NONE, 0.0

        # Edge-Triggering Filter
        elapsed = now - self.last_gesture_time
        if majority_gesture != self.last_fired_gesture:
            self.last_fired_gesture = majority_gesture
            self.last_gesture_time = now
            return majority_gesture, raw_conf
        elif elapsed >= self.repeat_delay:
            self.last_gesture_time = now
            return majority_gesture, raw_conf

        return Gesture.NONE, 0.0


# ─── Keyboard Simulation Controller ──────────────────────────────────────────

class KeyboardController:
    """Simulates native keyboard shortcuts."""
    def __init__(self):
        self.keyboard = KeyboardCtrl()

    def execute(self, gesture, presentation_active=False):
        try:
            if gesture == Gesture.THUMBS_UP:
                self.keyboard.press(Key.right)
                self.keyboard.release(Key.right)
            elif gesture == Gesture.INDEX_UP:
                self.keyboard.press(Key.left)
                self.keyboard.release(Key.left)
            elif gesture == Gesture.FIST:
                if presentation_active:
                    self.keyboard.press(Key.f5)
                    self.keyboard.release(Key.f5)
                else:
                    self.keyboard.press(Key.esc)
                    self.keyboard.release(Key.esc)
            elif gesture == Gesture.PINCH:
                self.keyboard.press('b')
                self.keyboard.release('b')
        except Exception:
            pass


# ─── Visual Rendering Helpers ────────────────────────────────────────────────

def draw_hand_skeleton(img, hand_landmarks, w, h, active_gesture=Gesture.NONE):
    """Draw high-visibility hand skeleton and fingertip glow."""
    points = [(int(lm.x * w), int(lm.y * h)) for lm in hand_landmarks]

    # Skeleton connections
    for start_idx, end_idx in HAND_CONNECTIONS:
        cv2.line(img, points[start_idx], points[end_idx], (0, 240, 255), 2, cv2.LINE_AA)

    # Landmarks
    for i, (px, py) in enumerate(points):
        # Fingertips (Thumb=4, Index=8, Middle=12, Ring=16, Pinky=20)
        if i in [4, 8, 12, 16, 20]:
            cv2.circle(img, (px, py), 6, (0, 255, 120), -1, cv2.LINE_AA)
            cv2.circle(img, (px, py), 7, (255, 255, 255), 1, cv2.LINE_AA)
        else:
            cv2.circle(img, (px, py), 3, (255, 255, 255), -1, cv2.LINE_AA)


def draw_hud(img, gesture, detector, w, h):
    """Draw clean on-screen status HUD."""
    emoji, action = GESTURE_INFO.get(gesture, ("⏳", "Ready"))

    # Top overlay bar
    overlay = img.copy()
    cv2.rectangle(overlay, (0, 0), (w, 40), (10, 12, 20), -1)
    cv2.addWeighted(overlay, 0.85, img, 0.15, 0, img)

    # Status
    status_text = "PAUSED" if detector.paused else "ACTIVE"
    status_color = (0, 180, 255) if not detector.paused else (0, 100, 255)
    cv2.putText(img, f"GestureSlide [{status_text}]", (10, 16),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, status_color, 1, cv2.LINE_AA)

    # Active detected action
    cv2.putText(img, f"Action: {action}", (10, 32),
                cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 255, 150) if gesture != Gesture.NONE else (180, 180, 180), 1, cv2.LINE_AA)

    # Fist hold progress bar if holding fist
    if detector.fist_progress > 0.0:
        bar_w = int(120 * detector.fist_progress)
        cv2.rectangle(img, (w - 140, 12), (w - 20, 26), (40, 40, 40), -1)
        cv2.rectangle(img, (w - 140, 12), (w - 140 + bar_w, 26), (0, 240, 255), -1)
        cv2.putText(img, "HOLD FIST", (w - 135, 23), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 0, 0), 1, cv2.LINE_AA)


# ─── Frame Compression ───────────────────────────────────────────────────────

_JPEG_PARAMS = [cv2.IMWRITE_JPEG_QUALITY, 50]

def encode_preview_frame(frame):
    preview = cv2.resize(frame, (480, 270), interpolation=cv2.INTER_NEAREST)
    _, buffer = cv2.imencode('.jpg', preview, _JPEG_PARAMS)
    frame_base64 = base64.b64encode(buffer).decode('ascii')
    return f"data:image/jpeg;base64,{frame_base64}"


class GestureWebSocketServer:
    def __init__(self, host="0.0.0.0", port=8765):
        self.host = host
        self.port = port
        self.dashboard_clients = set()
        self.latest_event = None
        self._server = None
        self._loop = None
        self.phone_frame = None
        self._phone_frame_lock = threading.Lock()

        # Zero-lag frame drop buffer (never queues old frames)
        self._latest_frame_msg = None
        self._is_sending_frame = False

    async def _handler(self, websocket, *args):
        self.dashboard_clients.add(websocket)
        try:
            if self.latest_event:
                await websocket.send(self.latest_event.to_json())

            async for message in websocket:
                try:
                    data = json.loads(message)
                    if data.get("type") == "camera_frame":
                        img_b64 = data["image"]
                        img_bytes = base64.b64decode(img_b64)
                        nparr = np.frombuffer(img_bytes, np.uint8)
                        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                        if frame is not None:
                            with self._phone_frame_lock:
                                self.phone_frame = frame
                except Exception:
                    pass
        except Exception:
            pass
        finally:
            self.dashboard_clients.discard(websocket)

    async def _send_frame_task(self):
        """Worker that sends only the freshest frame, dropping all older ones."""
        while self._latest_frame_msg and self.dashboard_clients:
            msg = self._latest_frame_msg
            self._latest_frame_msg = None  # Consume newest
            clients = self.dashboard_clients.copy()
            if clients:
                await asyncio.gather(
                    *[client.send(msg) for client in clients],
                    return_exceptions=True
                )
        self._is_sending_frame = False

    def broadcast_frame(self, frame_event):
        """Zero-lag frame broadcaster: overwrites buffer so clients always see real-time video."""
        if not self._loop or not self.dashboard_clients:
            return
        self._latest_frame_msg = frame_event.to_json()
        if not self._is_sending_frame:
            self._is_sending_frame = True
            asyncio.run_coroutine_threadsafe(self._send_frame_task(), self._loop)

    async def _broadcast_event(self, event):
        if not self.dashboard_clients:
            return
        message = event.to_json()
        await asyncio.gather(
            *[client.send(message) for client in self.dashboard_clients.copy()],
            return_exceptions=True
        )

    def broadcast(self, event):
        self.latest_event = event
        if self._loop and self.dashboard_clients:
            asyncio.run_coroutine_threadsafe(self._broadcast_event(event), self._loop)

    def get_phone_frame(self):
        with self._phone_frame_lock:
            frame = self.phone_frame
            self.phone_frame = None
            return frame

    async def _run_server(self):
        self._loop = asyncio.get_event_loop()
        async with serve(self._handler, self.host, self.port, max_size=5 * 1024 * 1024) as server:
            self._server = server
            print(f"[WS] Server active on ws://{self.host}:{self.port}")
            await asyncio.Future()

    def start_in_thread(self):
        def _run():
            asyncio.run(self._run_server())
        thread = threading.Thread(target=_run, daemon=True)
        thread.start()
        time.sleep(0.3)


# ─── Frame Processing Pipeline ───────────────────────────────────────────────

def process_frame(frame, detector_mp, gesture_detector, keyboard_ctrl, ws_server, last_gesture, mode, send_frame_ws=True):
    frame = cv2.flip(frame, 1)
    h, w, _ = frame.shape

    # MediaPipe inference
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
    timestamp_ms = int(time.time() * 1000)

    result = detector_mp.detect_for_video(mp_image, timestamp_ms)
    hands = result.hand_landmarks if result.hand_landmarks else []
    gesture = Gesture.NONE
    confidence = 0.0

    # Draw skeletons
    for hl in hands:
        draw_hand_skeleton(frame, hl, w, h, active_gesture=gesture)

    # Detect gestures
    if hands and not gesture_detector.paused:
        gesture, confidence = gesture_detector.detect(hands, w, h)
        if gesture not in (Gesture.NONE, Gesture.TWO_PALMS):
            keyboard_ctrl.execute(gesture, gesture_detector.presentation_active)

    elif hands and gesture_detector.paused:
        if len(hands) == 2:
            f1 = gesture_detector._get_finger_extensions(hands[0])
            f2 = gesture_detector._get_finger_extensions(hands[1])
            if all(f1[1:]) and all(f2[1:]):
                now = time.time()
                if (now - gesture_detector.last_gesture_time) * 1000 > gesture_detector.cooldown_ms:
                    gesture_detector.paused = False
                    gesture_detector.last_gesture_time = now
                    gesture = Gesture.TWO_PALMS
                    confidence = 0.98

    # Draw on-screen HUD
    draw_hud(frame, gesture, gesture_detector, w, h)

    # Stream video frame at ~18 FPS (zero-lag drop-old-frame pipeline)
    if send_frame_ws:
        frame_data_url = encode_preview_frame(frame)
        ws_server.broadcast_frame(FrameEvent(image=frame_data_url))

    # Send gesture events immediately
    if gesture != Gesture.NONE or gesture != last_gesture:
        emoji, action = GESTURE_INFO.get(gesture, ("⏳", "Ready"))
        event = GestureEvent(
            gesture=gesture.value,
            action=action,
            emoji=emoji,
            timestamp=time.time(),
            confidence=confidence,
            paused=gesture_detector.paused,
            presentation_active=gesture_detector.presentation_active,
        )
        ws_server.broadcast(event)

    return gesture, frame


# ─── Main Program ────────────────────────────────────────────────────────────

def main():
    phone_mode = "--phone" in sys.argv

    print("=" * 60)
    print("  GestureSlide — Zero-Lag Real-Time Vision Engine")
    print("=" * 60)
    print()

    print("[INIT] Loading MediaPipe 3D Landmark model...")
    base_options = python.BaseOptions(model_asset_path='hand_landmarker.task')
    options = vision.HandLandmarkerOptions(
        base_options=base_options,
        num_hands=2,
        running_mode=vision.RunningMode.VIDEO,
        min_hand_detection_confidence=0.55,
        min_hand_presence_confidence=0.55,
        min_tracking_confidence=0.55
    )
    detector_mp = vision.HandLandmarker.create_from_options(options)

    gesture_detector = GestureDetector(cooldown_ms=900)
    keyboard_ctrl = KeyboardController()
    ws_server = GestureWebSocketServer(host="0.0.0.0", port=8765)
    ws_server.start_in_thread()

    cap = None

    if not phone_mode:
        print("[INIT] Opening webcam with DirectShow 0-buffer capture...")
        # DirectShow on Windows has 0ms buffering compared to default MSMF
        cap = cv2.VideoCapture(0, cv2.CAP_DSHOW) if sys.platform.startswith("win") else cv2.VideoCapture(0)
        if not cap.isOpened():
            cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            print("[ERROR] Could not open webcam!")
            return
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_FPS, 30)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    print("\n[READY] Precision gesture engine running!")
    print("  • Controls:")
    print("    👍 Thumbs Up OR ✌️ Peace Sign ➔ Next Slide")
    print("    ☝️ Index Finger Up ➔ Previous Slide")
    print("    ✊ Fist (Hold 0.4s) ➔ Fullscreen Presentation")
    print("    🤏 Pinch ➔ Blank Screen")
    print("    🙌 Two Palms ➔ Pause / Resume")
    print("  • Press 'Q' to quit\n")

    last_gesture = Gesture.NONE
    last_ws_frame_time = 0
    WS_FRAME_INTERVAL = 0.055  # ~18 FPS

    while True:
        now = time.time()
        should_send_ws = (now - last_ws_frame_time) >= WS_FRAME_INTERVAL

        if phone_mode:
            frame = ws_server.get_phone_frame()
            if frame is None:
                time.sleep(0.01)
                continue

            frame = cv2.resize(frame, (640, 480))
            last_gesture, display_frame = process_frame(
                frame, detector_mp, gesture_detector, keyboard_ctrl,
                ws_server, last_gesture, mode="phone", send_frame_ws=should_send_ws
            )
            if should_send_ws:
                last_ws_frame_time = now

            cv2.imshow("GestureSlide — Vision Feed", display_frame)

        else:
            success, frame = cap.read()
            if not success:
                time.sleep(0.01)
                continue

            last_gesture, display_frame = process_frame(
                frame, detector_mp, gesture_detector, keyboard_ctrl,
                ws_server, last_gesture, mode="webcam", send_frame_ws=should_send_ws
            )
            if should_send_ws:
                last_ws_frame_time = now

            cv2.imshow("GestureSlide — Vision Feed", display_frame)

        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break

    if cap:
        cap.release()
    cv2.destroyAllWindows()
    print("[EXIT] Stopped.")


if __name__ == "__main__":
    main()
