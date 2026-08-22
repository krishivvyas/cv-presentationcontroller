# cv-presentationcontroller

Hands-Free Presentation Controller powered by MediaPipe and Next.js. Control your presentations (PowerPoint, Google Slides, Keynote, etc.) with intuitive hand gestures — **100% free and open-source**.

## Features

- **6 Intuitive Gestures**: Swipe left/right, fist, open palm, thumbs up, and pinch.
- **Real-time Dashboard**: Beautiful Next.js UI with live camera preview, gesture indicator, and history log.
- **Phone Camera Support**: Use your phone as a wireless camera over WiFi — no webcam needed.
- **Customizable**: Adjust sensitivity, cooldown, and toggle settings directly from the dashboard.
- **Cross-Platform**: Works with any presentation software that accepts standard keyboard shortcuts.
- **Completely Free**: Every library, framework, and tool used is free and open-source.

## Tech Stack (All Free & Open-Source)

| Component | Technology | License |
|---|---|---|
| Hand Tracking | [MediaPipe](https://github.com/google-ai-edge/mediapipe) | Apache 2.0 |
| Computer Vision | [OpenCV](https://opencv.org/) | Apache 2.0 |
| Numerical Computing | [NumPy](https://numpy.org/) | BSD |
| Keyboard Simulation | [pynput](https://github.com/moses-palmer/pynput) | LGPL-3.0 |
| WebSocket Server | [websockets](https://github.com/python-websockets/websockets) | BSD |
| Frontend Framework | [Next.js](https://nextjs.org/) | MIT |
| UI Library | [React](https://react.dev/) | MIT |
| Animations | [Framer Motion](https://www.framer.com/motion/) | MIT |
| CSS Framework | [Tailwind CSS](https://tailwindcss.com/) | MIT |
| Language | [TypeScript](https://www.typescriptlang.org/) | Apache 2.0 |
| Runtime | [Python 3](https://www.python.org/) / [Node.js](https://nodejs.org/) | PSF / MIT |

> 💰 **Zero cost.** No API keys, no subscriptions, no paid services. Everything runs locally on your machine.

## Installation

### 1. Python Dependencies

```bash
pip install -r requirements.txt
```

### 2. Node.js Dependencies

```bash
npm install
```

## How to Run

### Option A — Using Webcam

**Terminal 1:**
```bash
python gesture_controller.py
```

**Terminal 2:**
```bash
npm run dev
```

Open **http://localhost:3000/controller** in your browser.

---

### Option B — Using Phone Camera (WiFi)

Both your PC and phone must be on the **same WiFi network or hotspot**.

**Terminal 1:**
```bash
python gesture_controller.py --phone
```

**Terminal 2:**
```bash
npm run dev
```

1. Note the **IP address** shown in the terminal (e.g. `192.168.1.5`)
2. On your phone browser, open: `http://<YOUR-PC-IP>:3000/camera`
3. Enter the PC IP address and tap **Connect & Start Camera**
4. Open **http://localhost:3000/controller** on your PC for the dashboard

> 💡 Find your PC's IP by running `ipconfig` (Windows) or `ifconfig` (Mac/Linux) in terminal.

## Gesture Mappings

| Gesture | Action | Key Simulated |
|---|---|---|
| ☝️ Swipe Right | Next Slide | `→` |
| ☝️ Swipe Left | Previous Slide | `←` |
| ✊ Fist (hold 0.5s) | Start/Stop Presentation | `F5` / `Esc` |
| 🖐️ Open Palm | Pause/Resume Recognition | — |
| 👍 Thumbs Up | Toggle Laser Pointer | — |
| 🤏 Pinch | Toggle Blank Screen | `B` |

## License

This project is open-source. All dependencies are free and permissively licensed (MIT, Apache 2.0, BSD, LGPL-3.0).
