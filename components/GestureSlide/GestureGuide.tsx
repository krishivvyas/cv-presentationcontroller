"use client";

const GESTURES = [
  {
    id: "index_up",
    emoji: "☝️",
    name: "Index Up",
    action: "Prev Slide",
    key: "←",
  },
  {
    id: "thumbs_up",
    emoji: "👍",
    name: "Thumbs Up",
    action: "Next Slide",
    key: "→",
  },
  {
    id: "fist",
    emoji: "✊",
    name: "Fist Hold",
    action: "Start / Stop",
    key: "F5 / Esc",
  },
  {
    id: "palm",
    emoji: "🖐️",
    name: "Open Palm",
    action: "Pause / Resume",
    key: "—",
  },
  {
    id: "pinch",
    emoji: "🤏",
    name: "Pinch",
    action: "Blank Screen",
    key: "B",
  },
];

export default function GestureGuide({
  activeGesture,
}: {
  activeGesture: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d0e16]/60 backdrop-blur-xl p-4">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
        Gesture Guide
      </h3>

      <div className="grid grid-cols-2 gap-2">
        {GESTURES.map((g) => {
          const isActive = g.id === activeGesture;
          return (
            <div
              key={g.id}
              className={`relative rounded-xl px-3 py-2.5 border transition-all duration-300 ${
                isActive
                  ? "border-cyan-500/40 bg-cyan-500/10 shadow-md shadow-cyan-500/10"
                  : "border-white/5 bg-white/[0.02] hover:bg-white/5 hover:border-white/10"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-xl transition-transform duration-200 ${
                    isActive ? "scale-110" : ""
                  }`}
                >
                  {g.emoji}
                </span>
                <div className="min-w-0">
                  <p
                    className={`text-xs font-semibold truncate ${
                      isActive ? "text-cyan-400" : "text-slate-300"
                    }`}
                  >
                    {g.name}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {g.action}
                  </p>
                </div>
              </div>

              {/* Key badge */}
              <div className="absolute top-1.5 right-1.5">
                <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-white/5 text-slate-600 border border-white/5">
                  {g.key}
                </span>
              </div>

              {/* Active glow */}
              {isActive && (
                <div className="absolute inset-0 rounded-xl border border-cyan-400/20 animate-pulse pointer-events-none" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
