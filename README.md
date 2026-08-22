# GestureSlide — Hands-Free Presentation Controller

GestureSlide is an open-source presentation controller that uses computer vision (Google MediaPipe and OpenCV) to let you control slide decks with hand gestures. It runs locally without external database services or cloud APIs.

It includes a Next.js dashboard with an in-browser PDF/image slide viewer, real-time hand tracking preview, and optional smartphone camera support over local WiFi.

---

## Features

- **Local & Offline**: Runs entirely on your local machine with zero database dependencies.
- **Gesture Control**: Navigate slides, enter full-screen presentation mode, or blank the screen using hand gestures.
- **In-Browser Slide Viewer**: Upload PDF files or image slide decks directly into the dashboard.
- **Low Latency**: Uses WebSockets for local communication between the Python vision engine and Next.js frontend.
- **Dual Camera Input**: Supports built-in/USB webcams and wireless phone cameras over local WiFi.

---

## Gesture Mapping

| Gesture | Action | Shortcut | Description |
|---|---|---|---|
| Thumbs Up / Peace Sign | Next Slide | Right Arrow | Extend thumb or make peace sign |
| Index Finger Up | Previous Slide | Left Arrow | Extend index finger alone |
| Closed Fist | Toggle Fullscreen | F5 / Esc | Hold closed fist for 0.4 seconds |
| Pinch (Thumb + Index) | Blank Screen | B | Touch thumb tip and index tip |
| Two Open Palms | Pause / Resume | — | Show both open palms |

---

## Prerequisites

- Python 3.9 or higher
- Node.js 18 or higher

---

## Installation

1. Navigate to the project folder:
   ```bash
   cd cv-presentationcontroller
   ```

2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Install Node.js dependencies:
   ```bash
   npm install
   ```

---

## Running the Application

### Single Command (Recommended)

Run the unified launcher from the project directory:

```bash
python run.py
```

Or run `start.bat` on Windows.

This command will:
1. Start the Next.js development server on `http://localhost:3000`.
2. Start the Python vision engine and WebSocket server.
3. Automatically open your default browser to `http://localhost:3000/controller`.

---

### Using Phone Camera over WiFi

To use a smartphone as a wireless camera:

```bash
python run.py --phone
```

1. Ensure your PC and phone are connected to the same WiFi network.
2. Scan the terminal QR code or open `http://<PC-IP-ADDRESS>:3000/camera` on your phone.
3. Tap **Connect & Start Camera**.

---

## Project Structure

```
CV Presenter/
├── run.py                              # Root application launcher
├── start.bat                           # Windows batch launcher
└── cv-presentationcontroller/
    ├── hand_landmarker.task            # MediaPipe 3D landmark model asset
    ├── gesture_controller.py           # Python vision engine & WebSocket server
    ├── requirements.txt                # Python dependencies
    ├── package.json                    # Node.js dependencies
    ├── run.py                          # Application launcher module
    ├── app/
    │   ├── controller/                 # Next.js controller page
    │   └── camera/                     # Mobile camera stream page
    └── components/GestureSlide/
        ├── Dashboard.tsx               # Main layout & WebSocket subscriber
        ├── SlideViewer.tsx             # PDF and image slide renderer
        ├── GestureIndicator.tsx        # Active gesture display
        └── GestureGuide.tsx            # On-screen gesture reference
```

---

## Technology Stack

- **Computer Vision**: OpenCV, MediaPipe Tasks
- **System Input**: pynput
- **Frontend**: Next.js 15, React 19, Tailwind CSS, Framer Motion
- **Document Rendering**: pdfjs-dist
- **Communication**: WebSockets

---

## License

MIT License. Free and open-source.
