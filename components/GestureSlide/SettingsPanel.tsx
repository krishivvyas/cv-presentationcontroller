"use client";

import { useEffect, useRef } from "react";

interface Settings {
  cooldown: number;
  showSkeleton: boolean;
  soundFeedback: boolean;
  mirrorCamera: boolean;
}

export default function SettingsPanel({
  isOpen,
  onClose,
  settings,
  onChange,
}: {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onChange: (s: Settings) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        isOpen &&
        panelRef.current &&
        !panelRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    // Delay to avoid closing on the button click that opened it
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-[90] transition-opacity duration-300 ${
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`fixed top-0 right-0 h-full w-[360px] bg-[#0d0e16]/95 backdrop-blur-2xl border-l border-white/10 z-[100] transition-transform duration-300 ease-out flex flex-col ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
          <div>
            <h2 className="text-base font-bold text-white">Settings</h2>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Configure gesture recognition
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:border-red-500/40 hover:bg-red-500/10 transition-all"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">


          {/* Cooldown */}
          <div>
            <label className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-300">
                Action Cooldown
              </span>
              <span className="text-xs font-mono text-cyan-400">
                {settings.cooldown}ms
              </span>
            </label>
            <input
              type="range"
              min="300"
              max="2000"
              step="100"
              value={settings.cooldown}
              onChange={(e) =>
                onChange({
                  ...settings,
                  cooldown: parseInt(e.target.value),
                })
              }
              className="w-full h-1.5 rounded-full appearance-none bg-white/10 accent-cyan-500 cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-slate-600 mt-1">
              <span>Faster (may double-trigger)</span>
              <span>Slower (more stable)</span>
            </div>
          </div>

          <hr className="border-white/5" />

          {/* Toggle switches */}
          <div className="space-y-4">
            <ToggleSwitch
              label="Show Hand Skeleton"
              description="Display hand landmark overlay on camera"
              checked={settings.showSkeleton}
              onChange={(v) => onChange({ ...settings, showSkeleton: v })}
            />

            <ToggleSwitch
              label="Sound Feedback"
              description="Play a click sound on gesture detection"
              checked={settings.soundFeedback}
              onChange={(v) => onChange({ ...settings, soundFeedback: v })}
            />

            <ToggleSwitch
              label="Mirror Camera"
              description="Flip the camera preview horizontally"
              checked={settings.mirrorCamera}
              onChange={(v) => onChange({ ...settings, mirrorCamera: v })}
            />
          </div>

          <hr className="border-white/5" />

          {/* Key Mappings Info */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
              Key Mappings
            </h4>
            <div className="space-y-2">
              {[
                { gesture: "Thumbs Up", key: "→ Arrow Right" },
                { gesture: "Index Up", key: "← Arrow Left" },
                { gesture: "Fist (start)", key: "F5" },
                { gesture: "Fist (stop)", key: "Escape" },
                { gesture: "Pinch", key: "B (blank screen)" },
              ].map((m) => (
                <div
                  key={m.gesture}
                  className="flex items-center justify-between py-1.5"
                >
                  <span className="text-xs text-slate-400">{m.gesture}</span>
                  <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] font-mono text-slate-500 border border-white/5">
                    {m.key}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10">
          <p className="text-[10px] text-slate-600 text-center">
            Changes apply in real-time • Requires Python backend
          </p>
        </div>
      </div>
    </>
  );
}

function ToggleSwitch({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-slate-300">{label}</p>
        <p className="text-[10px] text-slate-600">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
          checked ? "bg-cyan-500" : "bg-white/10"
        }`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-200 ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
