"use client";

import dynamic from "next/dynamic";

const Dashboard = dynamic(
  () => import("@/components/GestureSlide/Dashboard"),
  {
    ssr: false,
    loading: () => (
      <div className="w-screen h-screen bg-[#090a0f] flex flex-col items-center justify-center text-slate-300">
        <div className="relative mb-6">
          <div className="w-16 h-16 border-4 border-cyan-400/30 rounded-full" />
          <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin absolute inset-0" />
        </div>
        <h2 className="text-xl font-semibold tracking-wide text-white mb-2">
          Loading GestureSlide...
        </h2>
        <p className="text-sm text-slate-500">
          Initializing gesture recognition engine
        </p>
      </div>
    ),
  }
);

export default function ControllerPage() {
  return (
    <main className="w-screen h-screen overflow-hidden bg-[#090a0f]">
      <Dashboard />
    </main>
  );
}
