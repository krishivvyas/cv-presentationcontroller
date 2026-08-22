import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "🎯 GestureSlide — Hands-Free Presentation Controller",
  description:
    "Control your presentations with hand gestures. Swipe, fist, pinch — no clicker needed.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body 
        className="antialiased bg-[#090a0f] text-slate-100 overflow-hidden select-none"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
