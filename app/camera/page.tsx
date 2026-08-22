"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export default function CameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamingRef = useRef(false);

  const [status, setStatus] = useState<"connecting" | "connected" | "streaming" | "error">("connecting");
  const [fps, setFps] = useState(0);
  const [serverIp, setServerIp] = useState("");
  const [showIpInput, setShowIpInput] = useState(true);
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");

  const startCamera = useCallback(async (facing: "environment" | "user") => {
    try {
      // Stop existing tracks
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error("Camera error:", err);
      setStatus("error");
    }
  }, []);

  const connectAndStream = useCallback((ip: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`ws://${ip}:8765`);
    setStatus("connecting");

    ws.onopen = () => {
      setStatus("connected");
      wsRef.current = ws;

      // Start camera then stream
      startCamera(cameraFacing).then(() => {
        setStatus("streaming");
        streamingRef.current = true;

        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (!canvas || !video) return;

        const ctx = canvas.getContext("2d")!;
        let frameCount = 0;
        let lastFpsTime = performance.now();

        function sendFrame() {
          if (!streamingRef.current || ws.readyState !== WebSocket.OPEN) return;

          if (video && video.readyState >= 2) {
            canvas!.width = video.videoWidth;
            canvas!.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);

            canvas!.toBlob(
              (blob) => {
                if (blob && ws.readyState === WebSocket.OPEN) {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    const base64 = (reader.result as string).split(",")[1];
                    ws.send(
                      JSON.stringify({
                        type: "camera_frame",
                        image: base64,
                        width: canvas!.width,
                        height: canvas!.height,
                      })
                    );

                    frameCount++;
                    const now = performance.now();
                    if (now - lastFpsTime >= 1000) {
                      setFps(frameCount);
                      frameCount = 0;
                      lastFpsTime = now;
                    }
                  };
                  reader.readAsDataURL(blob);
                }
              },
              "image/jpeg",
              0.6
            );
          }

          setTimeout(sendFrame, 66); // ~15fps to save bandwidth
        }

        sendFrame();
      });
    };

    ws.onclose = () => {
      streamingRef.current = false;
      setStatus("connecting");
      // Auto-reconnect
      setTimeout(() => connectAndStream(ip), 3000);
    };

    ws.onerror = () => {
      setStatus("error");
      ws.close();
    };
  }, [startCamera, cameraFacing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      streamingRef.current = false;
      wsRef.current?.close();
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const handleConnect = () => {
    if (!serverIp.trim()) return;
    setShowIpInput(false);
    connectAndStream(serverIp.trim());
  };

  const toggleCamera = () => {
    const newFacing = cameraFacing === "environment" ? "user" : "environment";
    setCameraFacing(newFacing);
    startCamera(newFacing);
  };

  const statusColors = {
    connecting: "bg-amber-500",
    connected: "bg-blue-500",
    streaming: "bg-emerald-500",
    error: "bg-red-500",
  };

  const statusLabels = {
    connecting: "Connecting...",
    connected: "Connected — Starting camera...",
    streaming: `Streaming (${fps} fps)`,
    error: "Connection failed",
  };

  return (
    <div className="min-h-[100dvh] bg-[#090a0f] text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0d0e16]/90 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-sm">
            📱
          </div>
          <div>
            <h1 className="text-sm font-bold">GestureSlide Camera</h1>
            <p className="text-[9px] text-slate-500">Phone → PC Wireless</p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${statusColors[status]} ${status === "streaming" ? "animate-pulse" : ""}`} />
          <span className="text-[10px] text-slate-400">{statusLabels[status]}</span>
        </div>
      </header>

      {/* IP Input Screen */}
      {showIpInput ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-full max-w-sm">
            <div className="text-center mb-8">
              <div className="text-5xl mb-4">🔗</div>
              <h2 className="text-xl font-bold mb-2">Connect to PC</h2>
              <p className="text-sm text-slate-400">
                Enter your PC&apos;s IP address. Both devices must be on the same WiFi or hotspot.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">PC IP Address</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 192.168.1.5"
                  value={serverIp}
                  onChange={(e) => setServerIp(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-center text-lg font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
                />
              </div>

              <button
                onClick={handleConnect}
                disabled={!serverIp.trim()}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-cyan-500/20 active:scale-[0.98] transition-all"
              >
                Connect & Start Camera
              </button>
            </div>

            <div className="mt-8 p-4 rounded-xl bg-white/[0.03] border border-white/5">
              <p className="text-[10px] text-slate-500 text-center">
                💡 Find your PC&apos;s IP by running <code className="text-cyan-500">ipconfig</code> in terminal.
                Look for the IPv4 address under your active WiFi adapter.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Camera View */
        <div className="flex-1 relative overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Overlay Controls */}
          <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4 z-10">
            {/* Flip Camera */}
            <button
              onClick={toggleCamera}
              className="w-14 h-14 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center text-2xl active:scale-90 transition-transform"
            >
              🔄
            </button>

            {/* Disconnect */}
            <button
              onClick={() => {
                streamingRef.current = false;
                wsRef.current?.close();
                if (videoRef.current?.srcObject) {
                  (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
                }
                setShowIpInput(true);
                setStatus("connecting");
              }}
              className="w-14 h-14 rounded-full bg-red-500/30 backdrop-blur-sm border border-red-500/40 flex items-center justify-center text-2xl active:scale-90 transition-transform"
            >
              ✕
            </button>
          </div>

          {/* FPS overlay */}
          <div className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-black/60 text-[10px] font-mono text-emerald-400">
            {fps} FPS
          </div>
        </div>
      )}
    </div>
  );
}
