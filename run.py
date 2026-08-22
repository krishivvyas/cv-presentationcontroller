"""
GestureSlide One-Command Launcher
=================================
Runs both the Next.js frontend and the MediaPipe Python vision backend together in a single terminal.
Automatically launches your browser to the presentation dashboard.

Usage:
  python run.py          # Local webcam mode
  python run.py --phone  # Wireless phone camera mode
"""

import os
import sys
import time
import subprocess
import webbrowser
from pathlib import Path

# Fix Windows console encoding if needed
if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

def main():
    # Resolve directory paths
    base_dir = Path(__file__).resolve().parent
    if (base_dir / "cv-presentationcontroller").is_dir():
        app_dir = base_dir / "cv-presentationcontroller"
        venv_python = base_dir / ".venv" / "Scripts" / "python.exe"
    else:
        app_dir = base_dir
        venv_python = base_dir.parent / ".venv" / "Scripts" / "python.exe"

    if not venv_python.exists():
        venv_python = Path(sys.executable)

    print("=" * 65)
    print("  [+] GestureSlide - 1-Click Unified Launcher")
    print("=" * 65)
    print()

    # Determine command arguments (e.g. --phone)
    phone_mode = "--phone" in sys.argv
    mode_str = "Phone Camera (WiFi)" if phone_mode else "Webcam Mode"
    print(f"  [1/3] Mode: {mode_str}")

    # 1. Start Next.js frontend dev server
    print("  [2/3] Starting Next.js Web Dashboard...")
    is_windows = sys.platform.startswith("win")
    npm_cmd = "npm.cmd" if is_windows else "npm"

    next_process = subprocess.Popen(
        [npm_cmd, "run", "dev"],
        cwd=str(app_dir),
        shell=is_windows,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    # 2. Wait a brief moment and open browser
    def open_browser():
        time.sleep(4)
        dashboard_url = "https://localhost:3000/controller"
        print(f"  [3/3] Opening browser at {dashboard_url}")
        try:
            webbrowser.open(dashboard_url)
        except Exception:
            pass

    import threading
    threading.Thread(target=open_browser, daemon=True).start()

    # 3. Start Python gesture controller in current process
    py_args = [str(venv_python), str(app_dir / "gesture_controller.py")]
    if phone_mode:
        py_args.append("--phone")

    print("\n  [>>] Starting MediaPipe Vision Backend...")
    print("  (Press 'Q' in the camera window or Ctrl+C to quit)")
    print("-" * 65)

    controller_process = None
    try:
        controller_process = subprocess.Popen(
            py_args,
            cwd=str(app_dir),
        )
        controller_process.wait()
    except KeyboardInterrupt:
        print("\n[STOP] Stopping GestureSlide services...")
    finally:
        # Graceful cleanup
        if controller_process and controller_process.poll() is None:
            controller_process.terminate()
        if next_process and next_process.poll() is None:
            if is_windows:
                subprocess.call(["taskkill", "/F", "/T", "/PID", str(next_process.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            else:
                next_process.terminate()
        print("[EXIT] All services stopped cleanly.")

if __name__ == "__main__":
    main()
