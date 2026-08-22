"use client";

import { useEffect, useState } from "react";

interface GestureEvent {
  gesture: string;
  action: string;
  emoji: string;
  timestamp: number;
  confidence: number;
  paused: boolean;
  laser_mode?: boolean;
  presentation_active: boolean;
}

const GESTURE_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  swipe_right: {
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/40",
    text: "text-cyan-400",
    glow: "shadow-cyan-500/30",
  },
  swipe_left: {
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/40",
    text: "text-cyan-400",
    glow: "shadow-cyan-500/30",
  },
  fist: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/40",
    text: "text-emerald-400",
    glow: "shadow-emerald-500/30",
  },
  palm: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/40",
    text: "text-amber-400",
    glow: "shadow-amber-500/30",
  },
  thumbs_up: {
    bg: "bg-purple-500/10",
    border: "border-purple-500/40",
    text: "text-purple-400",
    glow: "shadow-purple-500/30",
  },
  pinch: {
    bg: "bg-rose-500/10",
    border: "border-rose-500/40",
    text: "text-rose-400",
    glow: "shadow-rose-500/30",
  },
  none: {
    bg: "bg-white/5",
    border: "border-white/10",
    text: "text-slate-500",
    glow: "",
  },
};

export default function GestureIndicator({
  gesture,
}: {
  gesture: GestureEvent | null;
}) {
  const [pulse, setPulse] = useState(false);
  const [prevGesture, setPrevGesture] = useState("none");

  const currentGesture = gesture?.gesture || "none";
  const colors = GESTURE_COLORS[currentGesture] || GESTURE_COLORS.none;

  useEffect(() => {
    if (currentGesture !== "none" && currentGesture !== prevGesture) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 600);
      setPrevGesture(currentGesture);
      return () => clearTimeout(timer);
    }
    if (currentGesture === "none") {
      setPrevGesture("none");
    }
  }, [currentGesture, prevGesture]);

  const confidence = gesture?.confidence || 0;
  const confidencePercent = Math.round(confidence * 100);

  return (
    <div
      className={`relative rounded-2xl border p-5 transition-all duration-300 ${colors.bg} ${colors.border} ${
        pulse ? `shadow-lg ${colors.glow} gesture-pulse` : ""
      }`}
    >
      {/* Pulse ring effect */}
      {pulse && (
        <div className="absolute inset-0 rounded-2xl border-2 border-current opacity-50 animate-ping pointer-events-none" />
      )}

      <div className="flex items-center gap-4">
        {/* Emoji */}
        <div
          className={`text-5xl transition-transform duration-300 ${
            pulse ? "scale-125" : "scale-100"
          }`}
        >
          {gesture?.emoji || "⏳"}
        </div>

        <div className="flex-1 min-w-0">
          {/* Gesture Name */}
          <h2
            className={`text-lg font-bold tracking-wide transition-all duration-200 ${colors.text} ${
              currentGesture !== "none" ? "neon-text-glow" : ""
            }`}
          >
            {currentGesture !== "none"
              ? currentGesture
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (l) => l.toUpperCase())
              : "Waiting..."}
          </h2>

          {/* Action */}
          <p className="text-sm text-slate-400 mt-0.5">
            {gesture?.action || "Show your hand to begin"}
          </p>

          {/* Confidence bar */}
          {currentGesture !== "none" && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    confidence > 0.8
                      ? "bg-emerald-500"
                      : confidence > 0.5
                      ? "bg-amber-500"
                      : "bg-red-500"
                  }`}
                  style={{ width: `${confidencePercent}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {confidencePercent}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Paused overlay */}
      {gesture?.paused && (
        <div className="absolute inset-0 rounded-2xl bg-amber-500/5 border-2 border-amber-500/30 flex items-center justify-center backdrop-blur-sm">
          <div className="text-center">
            <div className="text-3xl mb-1">⏸</div>
            <p className="text-sm font-semibold text-amber-400">
              Recognition Paused
            </p>
            <p className="text-[10px] text-amber-500/70 mt-0.5">
              Show open palm to resume
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
