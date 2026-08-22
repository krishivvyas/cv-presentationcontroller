"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import GestureIndicator from "./GestureIndicator";
import GestureGuide from "./GestureGuide";
import HistoryLog, { HistoryEntry } from "./HistoryLog";
import SettingsPanel from "./SettingsPanel";
import SlideViewer from "./SlideViewer";

export interface GestureEvent {
  gesture: string;
  action: string;
  emoji: string;
  timestamp: number;
  confidence: number;
  paused: boolean;
  presentation_active: boolean;
}

export type ViewLayoutMode = "split" | "slides" | "camera";

export default function Dashboard() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cameraImgRef = useRef<HTMLImageElement | null>(null);
  const pipImgRef = useRef<HTMLImageElement | null>(null);
  const [hasReceivedFirstFrame, setHasReceivedFirstFrame] = useState(false);

  const [connected, setConnected] = useState(false);
  const [currentGesture, setCurrentGesture] = useState<GestureEvent | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<ViewLayoutMode>("split");

  const [settings, setSettings] = useState({
    cooldown: 800,
    showSkeleton: true,
    soundFeedback: false,
    mirrorCamera: true,
  });

  // ── WebSocket Connection with Direct DOM Streaming ──
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket("ws://localhost:8765");

    ws.onopen = () => {
      setConnected(true);
      console.log("[WS] High-performance connection established");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "frame") {
          // Zero-cost DOM update (bypasses React reconciliation for 60fps smoothness)
          if (cameraImgRef.current) {
            cameraImgRef.current.src = data.image;
          }
          if (pipImgRef.current) {
            pipImgRef.current.src = data.image;
          }
          if (!hasReceivedFirstFrame) {
            setHasReceivedFirstFrame(true);
          }
        } else if (data.type === "gesture") {
          const gestureData = data as GestureEvent;
          setCurrentGesture(gestureData);

          // Add to history only if actionable
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
              return updated.slice(0, 40);
            });
          }
        }
      } catch (e) {
        console.error("[WS] Parse error:", e);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      setHasReceivedFirstFrame(false);
      reconnectTimerRef.current = setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [hasReceivedFirstFrame]);

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

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  return (
    <div className="relative w-screen h-screen bg-[#090a0f] overflow-hidden flex flex-col">
      {/* ── Header Bar ── */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-[#0d0e16]/80 backdrop-blur-xl z-30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-lg shadow-lg shadow-cyan-500/20">
            🎯
          </div>
          <div>
            <h1 className="text-base font-bold tracking-wide text-white">
              GestureSlide
            </h1>
            <p className="text-[10px] text-slate-500 -mt-0.5">
              High-Speed AI Presentation Engine
            </p>
          </div>
        </div>

        {/* Layout Switcher Tabs */}
        <div className="hidden md:flex items-center bg-white/[0.04] p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setLayoutMode("split")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              layoutMode === "split"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            📑 Split Mode
          </button>
          <button
            onClick={() => setLayoutMode("slides")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              layoutMode === "slides"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            📊 Slides Focus
          </button>
          <button
            onClick={() => setLayoutMode("camera")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              layoutMode === "camera"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            📷 Camera Focus
          </button>
        </div>

        <div className="flex items-center gap-3">
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
            <span className="hidden sm:inline">
              {connected ? "AI Engine Connected" : "Disconnected"}
            </span>
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
            title="Settings"
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex gap-4 p-4 min-h-0 overflow-hidden">
        {/* Slide Viewer Section */}
        {(layoutMode === "split" || layoutMode === "slides") && (
          <div
            className={`${
              layoutMode === "slides" ? "flex-1" : "flex-[1.5]"
            } flex flex-col min-w-0 min-h-0`}
          >
            <SlideViewer
              currentGesture={currentGesture}
              isFullscreen={isFullscreen}
              onToggleFullscreen={toggleFullscreen}
            />
          </div>
        )}

        {/* Camera and Telemetry Panels */}
        {(layoutMode === "split" || layoutMode === "camera") && (
          <div
            className={`${
              layoutMode === "camera" ? "flex-1" : "w-[380px] lg:w-[420px]"
            } flex flex-col gap-4 shrink-0 min-h-0 overflow-y-auto pr-0.5 custom-scrollbar`}
          >
            {/* Camera Preview Box with Direct Ref */}
            <div className="relative h-56 rounded-2xl overflow-hidden border border-white/10 bg-[#0d0e16] shrink-0">
              <img
                ref={cameraImgRef}
                alt="Camera feed"
                className={`absolute inset-0 w-full h-full object-cover ${
                  hasReceivedFirstFrame ? "block opacity-90" : "hidden"
                }`}
              />

              {!hasReceivedFirstFrame && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 p-4 text-center">
                  <div className="text-3xl mb-2">📷</div>
                  <p className="text-xs font-medium text-slate-400">
                    Waiting for Python vision feed...
                  </p>
                  <p className="text-[11px] text-slate-600 mt-1 font-mono">
                    python run.py
                  </p>
                </div>
              )}

              {/* Live Status Label */}
              <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5">
                <div className="px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[9px] font-bold text-cyan-400 border border-cyan-500/30 tracking-wider">
                  LIVE VISION
                </div>
                {connected && (
                  <div className="px-2 py-0.5 rounded bg-emerald-500/20 backdrop-blur-sm text-[9px] font-semibold text-emerald-400 border border-emerald-500/30">
                    SKELETON ON
                  </div>
                )}
              </div>

              {/* Hint */}
              <div className="absolute bottom-2 left-2 right-2 z-10">
                <div className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-sm text-[10px] text-slate-300 border border-white/5 text-center">
                  👍 Next Slide • ☝️ Prev Slide • ✊ Fullscreen
                </div>
              </div>
            </div>

            {/* Current Gesture Indicator */}
            <GestureIndicator gesture={currentGesture} />

            {/* Gesture Guide Cheatsheet */}
            <GestureGuide activeGesture={currentGesture?.gesture || "none"} />

            {/* History Log */}
            <HistoryLog entries={history} />
          </div>
        )}
      </div>

      {/* ── Settings Modal ── */}
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={handleSettingsChange}
      />
    </div>
  );
}
