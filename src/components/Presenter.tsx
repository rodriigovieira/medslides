"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { Deck } from "@/lib/deck";
import {
  playSlideMotion,
  snapshotSlide,
  stopSlideMotion,
  type SlideRects,
} from "@/lib/motion";
import { SlideStage } from "./Motion";
import { SlideView } from "./SlideView";

/**
 * One presenter for both contexts. On a phone the slide fills the width, you
 * advance by tapping a side or swiping, and the chrome is icon-sized and
 * inside the safe area — the desktop build put keyboard hints like "Sair (Esc)"
 * on a touch device and ran the buttons off the edge of the screen.
 */
export function Presenter({ deck, onExit }: { deck: Deck; onExit: () => void }) {
  const [index, setIndex] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const hideTimer = useRef<number | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  /** Where the outgoing slide's shared elements were, measured just before the swap. */
  const leaving = useRef<SlideRects | null>(null);

  const total = deck.slides.length;
  const slide = deck.slides[index];

  // Auto-hide the controls while presenting; any interaction brings them back.
  const wakeChrome = useCallback(() => {
    setChromeVisible(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setChromeVisible(false), 2800);
  }, []);

  const move = useCallback(
    (delta: number) => {
      // Cancel first, then measure. Cancelling snaps anything mid-flight to the
      // finished slide it was heading for, which is both what a presenter who
      // taps twice quickly wants to see and the only position worth handing to
      // the next transition — a rect sampled halfway through the last one would
      // make the next element fly in from nowhere.
      stopSlideMotion(stageRef.current);
      leaving.current = snapshotSlide(stageRef.current);
      setIndex((i) => Math.min(total - 1, Math.max(0, i + delta)));
      wakeChrome();
    },
    [total, wakeChrome],
  );

  // Layout effect, not effect: this measures the arriving slide and starts its
  // animations in the frame React committed it, so nothing is ever painted in
  // the wrong place first. On the first slide `leaving` is null and it is a
  // build with no move.
  useLayoutEffect(() => {
    playSlideMotion(stageRef.current, leaving.current);
    leaving.current = null;
  }, [index]);

  // Arms the first auto-hide. Every later wake comes from an interaction
  // handler, so nothing sets state synchronously inside an effect.
  useEffect(() => {
    const timer = window.setTimeout(() => setChromeVisible(false), 2800);
    hideTimer.current = timer;
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        move(1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        move(-1);
      } else if (e.key === "Escape") {
        onExit();
      } else if (e.key.toLowerCase() === "n") {
        setShowNotes((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, onExit]);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // Horizontal swipes navigate; vertical ones are left to the notes sheet.
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
      move(dx < 0 ? 1 : -1);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#0a141e] select-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseMove={wakeChrome}
    >
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {/* Portrait phones get the full width; taller viewports cap by height
            so the slide never overflows behind the controls. */}
        <div
          ref={stageRef}
          className="w-full px-0 sm:px-6 md:max-w-[min(100%,calc((100vh-11rem)*16/9))]"
        >
          <SlideStage>
            <SlideView
              slide={slide}
              index={index}
              total={total}
              references={deck.references}
            />
          </SlideStage>
        </div>

        {/* Tap zones — the whole left/right thirds, so no aiming required. */}
        <button
          aria-label="Slide anterior"
          onClick={() => move(-1)}
          className="absolute inset-y-0 left-0 w-1/3 cursor-w-resize focus:outline-none"
        />
        <button
          aria-label="Próximo slide"
          onClick={() => move(1)}
          className="absolute inset-y-0 right-0 w-1/3 cursor-e-resize focus:outline-none"
        />
      </div>

      {showNotes && (
        <div
          className="max-h-[38vh] overflow-y-auto border-t border-paper/15 bg-[#0e1b28] px-5 py-4"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          <p className="text-xs font-medium uppercase tracking-wider text-paper/45">
            Notas
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-paper/80">
            {slide.notes || "—"}
          </p>
        </div>
      )}

      <div
        className={`flex items-center justify-between gap-2 px-3 pt-2 transition-opacity duration-300 ${
          chromeVisible || showNotes ? "opacity-100" : "opacity-0"
        }`}
        style={{ paddingBottom: "calc(0.6rem + env(safe-area-inset-bottom))" }}
      >
        <IconButton label="Sair" onClick={onExit}>
          <path d="M6 6l8 8M14 6l-8 8" />
        </IconButton>

        <div className="flex items-center gap-2">
          <IconButton
            label="Anterior"
            onClick={() => move(-1)}
            disabled={index === 0}
          >
            <path d="M12 4l-6 6 6 6" />
          </IconButton>
          <span className="min-w-16 text-center text-sm tabular-nums text-paper/70">
            {index + 1} / {total}
          </span>
          <IconButton
            label="Próximo"
            onClick={() => move(1)}
            disabled={index === total - 1}
          >
            <path d="M8 4l6 6-6 6" />
          </IconButton>
        </div>

        <IconButton
          label="Notas"
          onClick={() => setShowNotes((v) => !v)}
          active={showNotes}
        >
          <path d="M5 5h10M5 10h10M5 15h6" />
        </IconButton>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      // 44px minimum: the previous text buttons were below the touch target
      // size and overflowed the viewport on a phone.
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition disabled:opacity-25 ${
        active
          ? "border-paper/60 bg-paper/15 text-paper"
          : "border-paper/20 text-paper/75 active:bg-paper/10"
      }`}
    >
      <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden>
        <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          {children}
        </g>
      </svg>
    </button>
  );
}
