"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import GestureIndicator from "./GestureIndicator";
import GestureGuide from "./GestureGuide";
import HistoryLog, { HistoryEntry } from "./HistoryLog";
import SettingsPanel from "./SettingsPanel";

interface GestureEvent {
  gesture: string;
  action: string;
  emoji: string;
  timestamp: number;
  confidence: number;
  paused: boolean;
  presentation_active: boolean;
}

export default function Dashboard() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [connected, setConnected] = useState(false);
  const [latestFrame, setLatestFrame] = useState<string | null>(null);
  const [currentGesture, setCurrentGesture] = useState<GestureEvent | null>(
    null
  );
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
    cooldown: 800,
    showSkeleton: true,
    soundFeedback: false,
    mirrorCamera: true,
  });

  // ── WebSocket Connection ──
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket("ws://localhost:8765");

    ws.onopen = () => {
      setConnected(true);
      console.log("[WS] Connected to GestureSlide backend");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "frame") {
          setLatestFrame(data.image);
        } else if (data.type === "gesture") {
          const gestureData = data as GestureEvent;
          setCurrentGesture(gestureData);

          // Add to history if it's an actionable gesture
          if (gestureData.gesture !== "none") {
            setHistory((prev) => {
              const entry: HistoryEntry = {
                id: `${gestureData.timestamp}-${gestureData.gesture}`,
                gesture: gestureData.gesture,
                action: gestureData.action,
                emoji: gestureData.emoji,
                timestamp: gestureData.timestamp,
                confidence: gestureData.confidence,
              };
              const updated = [entry, ...prev];
              return updated.slice(0, 50); // Keep max 50
            });
          }
        }
      } catch (e) {
        console.error("[WS] Parse error:", e);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      console.log("[WS] Disconnected. Reconnecting in 3s...");
      reconnectTimerRef.current = setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, []);

  // ── Initialize ──
  useEffect(() => {
    connectWebSocket();

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connectWebSocket]);

  // ── Send config to backend ──
  const sendConfig = useCallback(
    (config: typeof settings) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "config", ...config }));
      }
    },
    []
  );

  const handleSettingsChange = useCallback(
    (newSettings: typeof settings) => {
      setSettings(newSettings);
      sendConfig(newSettings);
    },
    [sendConfig]
  );

  return (
    <div className="relative w-screen h-screen bg-[#090a0f] overflow-hidden flex flex-col">
      {/* ── Header Bar ── */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-[#0d0e16]/80 backdrop-blur-xl z-50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-lg shadow-lg shadow-cyan-500/20">
            🎯
          </div>
          <div>
            <h1 className="text-base font-bold tracking-wide text-white">
              GestureSlide
            </h1>
            <p className="text-[10px] text-slate-500 -mt-0.5">
              Hands-Free Presentation Controller
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Connection Status */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
              connected
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-red-500/30 bg-red-500/10 text-red-400"
            }`}
          >
            <span className="relative flex h-2 w-2">
              {connected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  connected ? "bg-emerald-500" : "bg-red-500"
                }`}
              />
            </span>
            {connected ? "Backend Connected" : "Disconnected"}
          </div>

          {/* Paused / Active indicator */}
          {currentGesture && (
            <div
              className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                currentGesture.paused
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                  : "border-cyan-500/30 bg-cyan-500/10 text-cyan-400"
              }`}
            >
              {currentGesture.paused ? "⏸ Paused" : "▶ Active"}
            </div>
          )}

          {/* Settings button */}
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:border-cyan-500/40 hover:bg-cyan-500/10 transition-all duration-200"
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* ── Main Content ── */}
      <div className="flex-1 flex gap-4 p-4 min-h-0">
        {/* Left: Camera Preview */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <div className="relative flex-1 rounded-2xl overflow-hidden border border-white/10 bg-[#0d0e16] min-h-0">
            {/* Camera Feed */}
            {latestFrame ? (
              <img
                src={latestFrame}
                alt="Camera feed"
                className={`absolute inset-0 w-full h-full object-cover opacity-90`}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
                <div className="text-4xl mb-3">📷</div>
                <p className="text-sm">Waiting for Python backend...</p>
                <p className="text-xs text-slate-600 mt-1">
                  Ensure python gesture_controller.py is running
                </p>
              </div>
            )}

            {/* Camera overlay labels */}
            <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
              <div className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-sm text-[10px] font-semibold text-cyan-400 border border-cyan-500/20">
                LIVE PREVIEW
              </div>
              {currentGesture?.presentation_active && (
                <div className="px-2.5 py-1 rounded-lg bg-emerald-500/20 backdrop-blur-sm text-[10px] font-semibold text-emerald-400 border border-emerald-500/20 animate-pulse">
                  PRESENTING
                </div>
              )}
            </div>

            {/* Gesture detection zone hint */}
            <div className="absolute bottom-3 left-3 right-3 z-10">
              <div className="px-3 py-2 rounded-xl bg-black/50 backdrop-blur-sm text-[11px] text-slate-400 border border-white/5">
                💡 Keep your hand centered in frame • Point index finger to navigate slides
              </div>
            </div>
          </div>
        </div>

        {/* Right: Info Panels */}
        <div className="w-[380px] flex flex-col gap-4 shrink-0 min-h-0">
          {/* Current Gesture Indicator */}
          <GestureIndicator gesture={currentGesture} />

          {/* Gesture Guide */}
          <GestureGuide
            activeGesture={currentGesture?.gesture || "none"}
          />

          {/* History Log */}
          <HistoryLog entries={history} />
        </div>
      </div>

      {/* ── Settings Panel ── */}
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={handleSettingsChange}
      />
    </div>
  );
}
