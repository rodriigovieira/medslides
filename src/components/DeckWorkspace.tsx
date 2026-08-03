"use client";

import { useState } from "react";
import type { Deck } from "@/lib/deck";
import { exportPptx } from "@/lib/pptx";
import { SlideView } from "./SlideView";

export function DeckWorkspace({
  deck,
  streaming,
  shareId,
  onPresent,
  onRestart,
}: {
  deck: Deck;
  streaming: boolean;
  shareId?: string;
  onPresent: () => void;
  onRestart: () => void;
}) {
  const [copied, setCopied] = useState(false);
  // `null` means "not pinned yet": while slides stream in we follow the newest
  // one, and once the reader picks a thumbnail we stay on their choice.
  const [pinned, setPinned] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const active = pinned ?? (streaming ? deck.slides.length - 1 : 0);
  const clamped = Math.max(0, Math.min(active, deck.slides.length - 1));
  const slide = deck.slides[clamped] as Deck["slides"][number] | undefined;

  const doExport = async () => {
    setExporting(true);
    setExportError("");
    try {
      await exportPptx(deck);
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : "Falha ao gerar o arquivo.",
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-rule bg-paper/85 px-5 py-3 backdrop-blur-md">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-[family-name:var(--font-display)] text-xl leading-tight">
            {deck.title || "Gerando…"}
          </h1>
          <p className="truncate text-xs text-ink-faint">
            {deck.slides.length} slides · {deck.audience}
            {streaming && (
              <span className="pulse-soft ml-2 text-clinical">escrevendo…</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {shareId && (
            <button
              onClick={async () => {
                const url = `${window.location.origin}/d/${shareId}`;
                try {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                } catch {
                  window.prompt("Copie o link:", url);
                }
              }}
              className="rounded-lg px-3 py-2 text-sm text-ink-soft transition hover:bg-rule/50"
            >
              {copied ? "Link copiado" : "Compartilhar"}
            </button>
          )}
          <button
            onClick={onRestart}
            className="rounded-lg px-3 py-2 text-sm text-ink-soft transition hover:bg-rule/50"
          >
            Nova
          </button>
          <button
            onClick={onPresent}
            disabled={streaming}
            className="rounded-lg border border-rule bg-paper-raised px-3.5 py-2 text-sm font-medium transition hover:border-ink-faint disabled:opacity-40"
          >
            Apresentar
          </button>
          <button
            onClick={doExport}
            disabled={streaming || exporting}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-clinical-deep disabled:opacity-40"
          >
            {exporting ? "Gerando…" : "Baixar .pptx"}
          </button>
        </div>
      </header>

      {exportError && (
        <p className="border-b border-signal/30 bg-signal/10 px-5 py-2 text-sm text-signal">
          {exportError}
        </p>
      )}

      <div className="flex flex-1 flex-col lg:flex-row">
        <nav className="order-2 flex gap-3 overflow-x-auto border-t border-rule p-3 lg:order-1 lg:w-56 lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:border-r lg:border-t-0">
          {deck.slides.map((s, i) => (
            // The index sits beside the slide, never over it — at thumbnail
            // scale an overlaid badge covers the first words of the title.
            <button
              key={i}
              onClick={() => setPinned(i)}
              className="rise group flex w-44 shrink-0 items-center gap-2 text-left lg:w-full"
            >
              <span
                className={`w-4 shrink-0 text-right text-[11px] tabular-nums transition ${
                  i === clamped
                    ? "font-semibold text-clinical"
                    : "text-ink-faint group-hover:text-ink-soft"
                }`}
              >
                {i + 1}
              </span>
              <span
                className={`min-w-0 flex-1 overflow-hidden rounded-md border transition ${
                  i === clamped
                    ? "border-clinical ring-2 ring-clinical/25"
                    : "border-rule group-hover:border-ink-faint"
                }`}
              >
                <SlideView slide={s} index={i} total={deck.slides.length} />
              </span>
            </button>
          ))}
          {streaming && (
            <div className="pulse-soft ml-6 flex w-38 shrink-0 items-center justify-center rounded-md border border-dashed border-rule py-8 text-xs text-ink-faint lg:w-auto lg:flex-1">
              próximo slide…
            </div>
          )}
        </nav>

        <main className="order-1 flex flex-1 flex-col items-center gap-6 p-5 lg:order-2 lg:p-10">
          {slide ? (
            <>
              <div className="w-full max-w-4xl overflow-hidden rounded-lg border border-rule shadow-[0_20px_50px_-30px_rgba(14,27,42,0.5)]">
                <SlideView
                  slide={slide}
                  index={clamped}
                  total={deck.slides.length}
                />
              </div>

              <div className="w-full max-w-4xl">
                <h2 className="text-xs font-medium uppercase tracking-wider text-ink-faint">
                  Notas do apresentador
                </h2>
                <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-ink-soft">
                  {slide.notes || "—"}
                </p>
                {(slide.source || slide.imageCredit) && (
                  <div className="mt-4 space-y-1 border-t border-rule pt-3 text-sm text-ink-faint">
                    {slide.source && (
                      <p>
                        Referência citada: {slide.source} — confirme antes de
                        apresentar.
                      </p>
                    )}
                    {slide.imageCredit && <p>{slide.imageCredit}</p>}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-rule py-24">
              <span className="pulse-soft text-sm text-ink-faint">
                Montando o roteiro da apresentação…
              </span>
              <p className="max-w-sm text-center text-xs leading-relaxed text-ink-faint/80">
                Os slides aparecem aqui conforme forem escritos.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
