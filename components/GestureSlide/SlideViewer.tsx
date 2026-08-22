"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface SlideData {
  id: string;
  type: "pdf_page" | "image" | "demo";
  dataUrl?: string;
  pageNumber?: number;
  title?: string;
  subtitle?: string;
  bullets?: string[];
  emoji?: string;
  gradient?: string;
}

// Built-in starter presentation deck
const DEMO_SLIDES: SlideData[] = [
  {
    id: "demo-1",
    type: "demo",
    title: "GestureSlide AI Presenter",
    subtitle: "Hands-Free Presentations Powered by MediaPipe & Computer Vision",
    emoji: "🚀",
    gradient: "from-cyan-600/30 via-blue-600/20 to-purple-600/30",
    bullets: [
      "No remote clickers or hardware needed",
      "Control slides using simple natural hand gestures",
      "100% database-free, runs completely in your browser",
      "Point index finger up or give a thumbs-up to test!",
    ],
  },
  {
    id: "demo-2",
    type: "demo",
    title: "Gesture Controls Guide",
    subtitle: "Intuitive Gestures Mapped to Presentation Actions",
    emoji: "🖐️",
    gradient: "from-blue-600/30 via-indigo-600/20 to-cyan-600/30",
    bullets: [
      "👍 Thumbs Up ➔ Next Slide",
      "☝️ Index Finger Up ➔ Previous Slide",
      "✊ Fist (Hold 0.5s) ➔ Toggle Fullscreen Mode",
      "🤏 Pinch (Thumb + Index) ➔ Toggle Blank Screen",
      "🙌 Two Palms ➔ Pause / Resume Recognition",
    ],
  },
  {
    id: "demo-3",
    type: "demo",
    title: "Local & Wireless Camera Support",
    subtitle: "Multiple Video Input Sources",
    emoji: "📱",
    gradient: "from-emerald-600/30 via-teal-600/20 to-cyan-600/30",
    bullets: [
      "Integrated Laptop Webcam or USB HD Camera",
      "Smartphone as Wireless HD Webcam over WiFi",
      "Sub-20ms real-time hand skeleton tracking",
      "Zero internet lag with local WebSockets",
    ],
  },
  {
    id: "demo-4",
    type: "demo",
    title: "Upload Your Own Slides",
    subtitle: "Supports PDF Presentations & Slide Images",
    emoji: "📁",
    gradient: "from-purple-600/30 via-fuchsia-600/20 to-pink-600/30",
    bullets: [
      "Click 'Upload PDF / Slides' at the top",
      "Export PowerPoint / Keynote to PDF for perfect rendering",
      "All slides rendered in crystal-clear high definition",
      "Zero files saved to cloud servers — 100% private",
    ],
  },
  {
    id: "demo-5",
    type: "demo",
    title: "Ready to Present!",
    subtitle: "Switch to Fullscreen and Wow Your Audience",
    emoji: "🎉",
    gradient: "from-amber-600/30 via-orange-600/20 to-rose-600/30",
    bullets: [
      "Make a Fist gesture ✊ to jump into Fullscreen Presenter Mode",
      "Live floating camera PiP tracks your hands while presenting",
      "Enjoy seamless, hands-free speaking!",
    ],
  },
];

interface SlideViewerProps {
  currentGesture?: {
    gesture: string;
    action: string;
    emoji: string;
    timestamp: number;
    paused?: boolean;
  } | null;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  cameraFrame?: string | null;
}

export default function SlideViewer({
  currentGesture,
  isFullscreen,
  onToggleFullscreen,
  cameraFrame,
}: SlideViewerProps) {
  const [slides, setSlides] = useState<SlideData[]>(DEMO_SLIDES);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fileName, setFileName] = useState<string>("Sample AI Presentation");
  const [isLoading, setIsLoading] = useState(false);
  const [renderProgress, setRenderProgress] = useState<string>("");
  const [isBlankScreen, setIsBlankScreen] = useState(false);
  const [lastHandledTimestamp, setLastHandledTimestamp] = useState<number>(0);
  const [direction, setDirection] = useState<number>(1);
  const [showPipCamera, setShowPipCamera] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfDocRef = useRef<any>(null);

  const lastTransitionTimeRef = useRef<number>(0);

  // ── Navigation callbacks (with throttle to prevent double-skips) ──
  const nextSlide = useCallback(() => {
    const now = Date.now();
    if (now - lastTransitionTimeRef.current < 450) return;
    lastTransitionTimeRef.current = now;

    setCurrentIndex((prev) => {
      if (prev < slides.length - 1) {
        setDirection(1);
        return prev + 1;
      }
      return prev;
    });
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    const now = Date.now();
    if (now - lastTransitionTimeRef.current < 450) return;
    lastTransitionTimeRef.current = now;

    setCurrentIndex((prev) => {
      if (prev > 0) {
        setDirection(-1);
        return prev - 1;
      }
      return prev;
    });
  }, []);

  const goToSlide = useCallback((index: number) => {
    setCurrentIndex((prev) => {
      setDirection(index > prev ? 1 : -1);
      return Math.max(0, Math.min(index, slides.length - 1));
    });
  }, [slides.length]);

  // ── Handle incoming gesture triggers ──
  useEffect(() => {
    if (!currentGesture || currentGesture.paused) return;
    if (currentGesture.timestamp <= lastHandledTimestamp) return;

    setLastHandledTimestamp(currentGesture.timestamp);

    switch (currentGesture.gesture) {
      case "thumbs_up":
        nextSlide();
        break;
      case "index_up":
        prevSlide();
        break;
      case "fist":
        onToggleFullscreen();
        break;
      case "pinch":
        setIsBlankScreen((prev) => !prev);
        break;
      default:
        break;
    }
  }, [currentGesture, lastHandledTimestamp, nextSlide, prevSlide, onToggleFullscreen]);

  // ── Keyboard Navigation Fallback ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        nextSlide();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prevSlide();
      } else if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        setIsBlankScreen((prev) => !prev);
      } else if (e.key === "F5") {
        e.preventDefault();
        onToggleFullscreen();
      } else if (e.key === "Escape" && isFullscreen) {
        onToggleFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextSlide, prevSlide, isFullscreen, onToggleFullscreen]);

  // Helper to render a specific page to a dataURL
  const renderPageToDataUrl = async (pdf: any, pageNum: number): Promise<string> => {
    const page = await pdf.getPage(pageNum);
    // Render at 2x scale for crisp slide quality
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL("image/jpeg", 0.9);
  };

  // If a slide is active but its dataUrl isn't generated yet, render it immediately
  useEffect(() => {
    const currentSlide = slides[currentIndex];
    if (
      currentSlide?.type === "pdf_page" &&
      currentSlide.pageNumber &&
      !currentSlide.dataUrl &&
      pdfDocRef.current
    ) {
      renderPageToDataUrl(pdfDocRef.current, currentSlide.pageNumber).then((url) => {
        if (url) {
          setSlides((prev) =>
            prev.map((s, idx) => (idx === currentIndex ? { ...s, dataUrl: url } : s))
          );
        }
      });
    }
  }, [currentIndex, slides]);

  // ── Handle File Upload (PDF or Images) ──
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setIsLoading(true);
    setRenderProgress("Parsing document...");
    setFileName(file.name);

    try {
      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        const pdfjsLib = await import("pdfjs-dist");
        // Robust worker URL
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || "3.11.174"}/pdf.worker.min.js`;

        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(arrayBuffer),
        });
        const pdf = await loadingTask.promise;
        pdfDocRef.current = pdf;

        const numPages = pdf.numPages;
        const initialSlides: SlideData[] = [];

        for (let i = 1; i <= numPages; i++) {
          initialSlides.push({
            id: `pdf-page-${i}`,
            type: "pdf_page",
            pageNumber: i,
            title: `Slide ${i}`,
          });
        }

        // Render the first slide immediately so user sees it right away
        setRenderProgress(`Rendering slide 1 of ${numPages}...`);
        const firstPageDataUrl = await renderPageToDataUrl(pdf, 1);
        initialSlides[0].dataUrl = firstPageDataUrl;

        setSlides(initialSlides);
        setCurrentIndex(0);
        setIsLoading(false);

        // Pre-render remaining pages in background
        (async () => {
          for (let i = 2; i <= numPages; i++) {
            try {
              const dataUrl = await renderPageToDataUrl(pdf, i);
              setSlides((prev) =>
                prev.map((s) => (s.pageNumber === i ? { ...s, dataUrl } : s))
              );
            } catch (err) {
              console.warn(`Could not pre-render page ${i}`, err);
            }
          }
        })();

      } else if (file.type.startsWith("image/")) {
        // Single or multiple image slides
        const imageSlides: SlideData[] = [];
        for (let i = 0; i < files.length; i++) {
          const imgFile = files[i];
          const url = URL.createObjectURL(imgFile);
          imageSlides.push({
            id: `img-${i}`,
            type: "image",
            dataUrl: url,
            title: imgFile.name,
          });
        }
        setSlides(imageSlides);
        setCurrentIndex(0);
        setIsLoading(false);
      } else {
        alert("Please upload a PDF file (.pdf) or image slide deck (.png, .jpg). For PowerPoint files, export them as PDF first!");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Failed to load presentation:", error);
      alert("Could not render the uploaded file. Please make sure it is a valid PDF or image file.");
      setIsLoading(false);
    }
  };

  const handleResetToDemo = () => {
    pdfDocRef.current = null;
    setSlides(DEMO_SLIDES);
    setCurrentIndex(0);
    setFileName("Sample AI Presentation");
    setIsBlankScreen(false);
  };

  const activeSlide = slides[currentIndex];

  // Slide transition variants
  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 80 : -80,
      opacity: 0,
      scale: 0.98,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        x: { type: "spring" as const, stiffness: 320, damping: 32 },
        opacity: { duration: 0.18 },
      },
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -80 : 80,
      opacity: 0,
      scale: 0.98,
      transition: { duration: 0.12 },
    }),
  };

  return (
    <div
      className={`relative w-full h-full flex flex-col bg-[#090a0f] select-none ${
        isFullscreen ? "fixed inset-0 z-50 p-4 bg-black" : "rounded-2xl border border-white/10 overflow-hidden"
      }`}
    >
      {/* ── Top Presentation Toolbar ── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0d0e16]/90 border-b border-white/10 shrink-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-sm shrink-0">
            📊
          </div>
          <div className="truncate min-w-0">
            <span className="text-xs font-semibold text-white truncate max-w-[180px] sm:max-w-[280px] inline-block align-middle">
              {fileName}
            </span>
            <span className="ml-2 text-[10px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full font-mono">
              Slide {currentIndex + 1} / {slides.length}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Upload Button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".pdf,image/*"
            multiple
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 hover:text-white border border-cyan-500/30 text-xs font-medium transition-all flex items-center gap-1.5"
            title="Upload PDF or Presentation images"
          >
            <span>📁</span>
            <span className="hidden sm:inline">Upload PDF / Slides</span>
            <span className="sm:hidden">Upload</span>
          </button>

          {slides !== DEMO_SLIDES && (
            <button
              onClick={handleResetToDemo}
              className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 text-xs transition-all"
              title="Reset to Sample AI Deck"
            >
              Demo Deck
            </button>
          )}

          {/* Blank Screen Toggle */}
          <button
            onClick={() => setIsBlankScreen(!isBlankScreen)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all flex items-center gap-1 ${
              isBlankScreen
                ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
            }`}
            title="Blank Screen (Pinch gesture or 'B' key)"
          >
            <span>⬛</span>
            <span className="hidden sm:inline">Blank</span>
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={onToggleFullscreen}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all flex items-center gap-1.5 ${
              isFullscreen
                ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400"
                : "bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20"
            }`}
            title="Toggle Fullscreen Presenter Mode (Fist gesture or F5)"
          >
            <span>{isFullscreen ? "🗗" : "⛶"}</span>
            <span className="hidden sm:inline">{isFullscreen ? "Exit Fullscreen" : "Present Fullscreen"}</span>
          </button>
        </div>
      </div>

      {/* ── Slide Display Viewport ── */}
      <div className="relative flex-1 min-h-0 bg-[#05060a] flex items-center justify-center p-3 sm:p-6 overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center text-slate-400 gap-3">
            <div className="w-10 h-10 border-3 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
            <p className="text-xs font-medium text-cyan-300">{renderProgress || "Loading presentation..."}</p>
          </div>
        ) : (
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Blank Screen Overlay */}
            <AnimatePresence>
              {isBlankScreen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black z-30 flex flex-col items-center justify-center text-slate-600"
                >
                  <p className="text-lg font-mono tracking-widest text-slate-500">SCREEN BLANKED</p>
                  <p className="text-xs text-slate-600 mt-2">Pinch 🤏 gesture or press 'B' to restore</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Active Slide Display */}
            <AnimatePresence custom={direction} mode="wait">
              {activeSlide?.type === "pdf_page" ? (
                <motion.div
                  key={`pdf-${currentIndex}`}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="w-full h-full flex items-center justify-center"
                >
                  {activeSlide.dataUrl ? (
                    <img
                      src={activeSlide.dataUrl}
                      alt={`Slide ${activeSlide.pageNumber}`}
                      className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-white/10 bg-white"
                      style={{ maxHeight: isFullscreen ? "calc(100vh - 100px)" : "calc(100vh - 220px)" }}
                    />
                  ) : (
                    <div className="w-full max-w-2xl aspect-[16/9] rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                      <p className="text-xs text-slate-400">Rendering Slide {activeSlide.pageNumber}...</p>
                    </div>
                  )}
                </motion.div>
              ) : activeSlide?.type === "image" ? (
                <motion.div
                  key={`img-${currentIndex}`}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="w-full h-full flex items-center justify-center"
                >
                  <img
                    src={activeSlide.dataUrl}
                    alt={activeSlide.title || "Slide"}
                    className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-white/10"
                    style={{ maxHeight: isFullscreen ? "calc(100vh - 100px)" : "calc(100vh - 220px)" }}
                  />
                </motion.div>
              ) : (
                /* Demo Slide Rich Presentation Card */
                <motion.div
                  key={`demo-${currentIndex}`}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className={`w-full max-w-4xl aspect-[16/9] rounded-2xl p-8 sm:p-12 flex flex-col justify-between shadow-2xl border border-white/10 bg-gradient-to-br ${activeSlide?.gradient || "from-cyan-900/20 to-blue-900/20"} backdrop-blur-xl relative overflow-hidden`}
                >
                  {/* Background Ambient Glow */}
                  <div className="absolute -right-20 -top-20 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

                  {/* Header */}
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-4xl">{activeSlide?.emoji}</span>
                      <span className="text-xs uppercase tracking-widest text-cyan-400 font-mono font-semibold bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
                        Slide {currentIndex + 1} of {slides.length}
                      </span>
                    </div>
                    <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight mb-2">
                      {activeSlide?.title}
                    </h2>
                    <p className="text-sm sm:text-base text-slate-300 font-normal">
                      {activeSlide?.subtitle}
                    </p>
                  </div>

                  {/* Body Bullets */}
                  <div className="relative z-10 my-4 space-y-3">
                    {activeSlide?.bullets?.map((bullet, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.08 + idx * 0.06 }}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/5 backdrop-blur-md"
                      >
                        <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400" />
                        <span className="text-sm sm:text-base text-slate-200">{bullet}</span>
                      </motion.div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="relative z-10 flex items-center justify-between pt-4 border-t border-white/10 text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <span>Gesture Control Active</span>
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                    <span>GestureSlide AI</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation Overlay Buttons (Left / Right arrows) */}
            <button
              onClick={prevSlide}
              disabled={currentIndex === 0}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-10 sm:w-12 h-10 sm:h-12 rounded-full bg-black/70 hover:bg-black/90 text-white border border-white/10 disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center text-lg backdrop-blur-sm transition-all shadow-xl z-20 active:scale-90"
              title="Previous Slide (Index Finger Up ☝️)"
            >
              ◀
            </button>

            <button
              onClick={nextSlide}
              disabled={currentIndex === slides.length - 1}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-10 sm:w-12 h-10 sm:h-12 rounded-full bg-black/70 hover:bg-black/90 text-white border border-white/10 disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center text-lg backdrop-blur-sm transition-all shadow-xl z-20 active:scale-90"
              title="Next Slide (Thumbs Up 👍)"
            >
              ▶
            </button>
          </div>
        )}

        {/* ── Floating Camera PiP in Fullscreen mode ── */}
        {isFullscreen && showPipCamera && cameraFrame && (
          <motion.div
            drag
            dragConstraints={{ left: -300, right: 300, top: -300, bottom: 300 }}
            className="absolute bottom-6 right-6 w-64 aspect-[4/3] rounded-xl overflow-hidden border-2 border-cyan-500/40 bg-black/80 shadow-2xl backdrop-blur-md z-40 cursor-grab active:cursor-grabbing"
          >
            <img
              src={cameraFrame}
              alt="Camera feed"
              className="w-full h-full object-cover"
            />
            {/* Gesture Overlay HUD */}
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 text-[9px] font-mono text-cyan-400 border border-cyan-500/30">
              {currentGesture?.gesture && currentGesture.gesture !== "none"
                ? `${currentGesture.emoji} ${currentGesture.action}`
                : "TRACKING"}
            </div>
            {/* Close PiP */}
            <button
              onClick={() => setShowPipCamera(false)}
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] flex items-center justify-center hover:bg-red-500/60"
              title="Hide Camera PiP"
            >
              ✕
            </button>
          </motion.div>
        )}

        {/* Fullscreen restore PiP camera toggle */}
        {isFullscreen && !showPipCamera && cameraFrame && (
          <button
            onClick={() => setShowPipCamera(true)}
            className="absolute bottom-6 right-6 px-3 py-1.5 rounded-lg bg-black/70 border border-white/20 text-xs text-cyan-400 hover:bg-black/90 z-40"
          >
            📷 Show Camera
          </button>
        )}
      </div>

      {/* ── Bottom Thumbnail Strip / Progress Bar ── */}
      <div className="px-4 py-2.5 bg-[#0d0e16]/90 border-t border-white/10 flex items-center justify-between shrink-0 z-20">
        {/* Slide navigation bullets / thumbnails */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-[65%] py-1">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goToSlide(idx)}
              className={`h-2 rounded-full transition-all duration-200 ${
                idx === currentIndex
                  ? "w-8 bg-cyan-400 shadow-sm shadow-cyan-400/50"
                  : "w-2 bg-white/20 hover:bg-white/40"
              }`}
              title={`Go to Slide ${idx + 1}`}
            />
          ))}
        </div>

        {/* Slide Counter & Hints */}
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="hidden sm:inline text-[11px] text-slate-500">
            ☝️ Prev • 👍 Next • ✊ Fullscreen • 🤏 Blank
          </span>
          <span className="font-mono text-cyan-400 font-medium">
            {currentIndex + 1} / {slides.length}
          </span>
        </div>
      </div>
    </div>
  );
}
