"use client";

import { useEffect, useRef } from "react";

export interface HistoryEntry {
  id: string;
  gesture: string;
  action: string;
  emoji: string;
  timestamp: number;
  confidence: number;
}

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export default function HistoryLog({ entries }: { entries: HistoryEntry[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [entries.length]);

  return (
    <div className="flex-1 rounded-2xl border border-white/10 bg-[#0d0e16]/60 backdrop-blur-xl flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
          📋 Gesture History
        </h3>
        <span className="text-[10px] text-slate-600 font-mono">
          {entries.length} events
        </span>
      </div>

      {/* Entries */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 p-2">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-600">
            <div className="text-2xl mb-2">📝</div>
            <p className="text-xs">No gestures detected yet</p>
            <p className="text-[10px] text-slate-700 mt-0.5">
              Actions will appear here in real-time
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {entries.map((entry, idx) => (
              <div
                key={entry.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-300 hover:bg-white/5 ${
                  idx === 0 ? "history-entry-enter bg-white/[0.03]" : ""
                }`}
              >
                {/* Timestamp */}
                <span className="text-[10px] font-mono text-slate-600 shrink-0 w-16">
                  {formatTime(entry.timestamp)}
                </span>

                {/* Emoji */}
                <span className="text-base shrink-0">{entry.emoji}</span>

                {/* Action text */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 truncate">
                    {entry.action}
                  </p>
                </div>

                {/* Confidence dot */}
                <div
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    entry.confidence > 0.8
                      ? "bg-emerald-500"
                      : entry.confidence > 0.5
                      ? "bg-amber-500"
                      : "bg-red-500"
                  }`}
                  title={`Confidence: ${Math.round(entry.confidence * 100)}%`}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
