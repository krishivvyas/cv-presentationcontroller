"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/controller");
  }, [router]);

  return (
    <main className="w-screen h-screen overflow-hidden bg-[#090a0f] flex flex-col items-center justify-center">
      <div className="relative mb-6">
        <div className="w-16 h-16 border-4 border-cyan-400/30 rounded-full" />
        <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin absolute inset-0" />
      </div>
      <p className="text-sm text-slate-500">Redirecting to GestureSlide...</p>
    </main>
  );
}
