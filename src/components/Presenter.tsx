"use client";

import { useCallback, useEffect, useState } from "react";
import type { Deck } from "@/lib/deck";
import { SlideView } from "./SlideView";

export function Presenter({ deck, onExit }: { deck: Deck; onExit: () => void }) {
  const [index, setIndex] = useState(0);
  const [showNotes, setShowNotes] = useState(false);

  const move = useCallback(
    (delta: number) =>
      setIndex((i) => Math.min(deck.slides.length - 1, Math.max(0, i + delta))),
    [deck.slides.length],
  );

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

  const slide = deck.slides[index];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink">
      <div className="flex flex-1 items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-[min(100%,calc((100vh-13rem)*16/9))] shadow-2xl">
          <SlideView slide={slide} index={index} total={deck.slides.length} />
        </div>
      </div>

      {showNotes && slide.notes && (
        <div className="mx-auto mb-2 max-w-4xl px-6 text-center text-sm leading-relaxed text-paper/70">
          {slide.notes}
        </div>
      )}

      <div className="flex items-center justify-center gap-3 pb-6 pt-2 text-paper/70">
        <PresenterButton onClick={() => move(-1)} disabled={index === 0}>
          ← Anterior
        </PresenterButton>
        <span className="min-w-20 text-center text-sm tabular-nums">
          {index + 1} / {deck.slides.length}
        </span>
        <PresenterButton
          onClick={() => move(1)}
          disabled={index === deck.slides.length - 1}
        >
          Próximo →
        </PresenterButton>
        <PresenterButton onClick={() => setShowNotes((v) => !v)}>
          Notas (N)
        </PresenterButton>
        <PresenterButton onClick={onExit}>Sair (Esc)</PresenterButton>
      </div>
    </div>
  );
}

function PresenterButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-paper/20 px-3.5 py-2 text-sm transition hover:bg-paper/10 disabled:opacity-25"
    >
      {children}
    </button>
  );
}
