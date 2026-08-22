import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "🎯 GestureSlide — Hands-Free Presentation Controller",
  description:
    "Control your presentations with hand gestures. Swipe, fist, pinch — no clicker needed.",
};

export default function ControllerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
