"use client";

import { useRef, useState } from "react";
import { citationLine, type Deck } from "@/lib/deck";
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
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const active = pinned ?? (streaming ? deck.slides.length - 1 : 0);
  const clamped = Math.max(0, Math.min(active, deck.slides.length - 1));
  const slide = deck.slides[clamped] as Deck["slides"][number] | undefined;

  const step = (delta: number) =>
    setPinned(Math.max(0, Math.min(deck.slides.length - 1, clamped + delta)));

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

  const share = async () => {
    if (!shareId) return;
    const url = `${window.location.origin}/d/${shareId}`;
    // Native share sheet on a phone; clipboard everywhere else.
    if (navigator.share) {
      try {
        await navigator.share({ title: deck.title, url });
        return;
      } catch {
        // Cancelled or unsupported — fall through to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copie o link:", url);
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(t.clientY - start.y)) {
      step(dx < 0 ? 1 : -1);
    }
  };

  const thumbnails = (
    <Thumbnails
      deck={deck}
      current={clamped}
      streaming={streaming}
      onPick={setPinned}
    />
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-rule bg-paper/90 px-4 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-[family-name:var(--font-display)] text-[17px] leading-tight lg:text-xl">
              {deck.title || "Gerando…"}
            </h1>
            <p className="truncate text-[11px] text-ink-faint lg:text-xs">
              {deck.slides.length} slides · {deck.audience}
              {streaming && (
                <span className="pulse-soft ml-2 text-clinical">
                  escrevendo…
                </span>
              )}
            </p>
          </div>

          {/* Labels collapse to icons on a phone — as text buttons they wrapped
              onto two lines and ate a third of the screen. */}
          <div className="flex shrink-0 items-center gap-1">
            {shareId && (
              <Action
                label={copied ? "Copiado" : "Compartilhar"}
                onClick={share}
              >
                <path d="M10 13V3M10 3L6.5 6.5M10 3l3.5 3.5" />
                <path d="M4 11v5h12v-5" />
              </Action>
            )}
            <Action label="Nova" onClick={onRestart}>
              <path d="M10 4v12M4 10h12" />
            </Action>
            <Action
              label={exporting ? "Gerando…" : "Baixar"}
              onClick={doExport}
              disabled={streaming || exporting}
            >
              <path d="M10 3v10M10 13l-3.5-3.5M10 13l3.5-3.5" />
              <path d="M4 16h12" />
            </Action>
            <button
              onClick={onPresent}
              disabled={streaming}
              className="ml-1 rounded-lg bg-ink px-3 py-2 text-sm font-medium text-paper transition hover:bg-clinical-deep disabled:opacity-40"
            >
              Apresentar
            </button>
          </div>
        </div>
      </header>

      {exportError && (
        <p className="border-b border-signal/30 bg-signal/10 px-4 py-2 text-sm text-signal">
          {exportError}
        </p>
      )}

      <div className="flex flex-1 flex-col lg:flex-row">
        <nav className="hidden lg:flex lg:w-56 lg:shrink-0 lg:flex-col lg:gap-3 lg:overflow-y-auto lg:border-r lg:border-rule lg:p-3">
          {thumbnails}
        </nav>

        <main className="flex flex-1 flex-col items-center gap-5 p-4 lg:gap-6 lg:p-10">
          {slide ? (
            <>
              <div
                className="w-full max-w-4xl overflow-hidden rounded-lg border border-rule shadow-[0_20px_50px_-30px_rgba(14,27,42,0.5)]"
                onTouchStart={(e) => {
                  const t = e.touches[0];
                  touchStart.current = { x: t.clientX, y: t.clientY };
                }}
                onTouchEnd={onTouchEnd}
              >
                <SlideView
                  slide={slide}
                  index={clamped}
                  total={deck.slides.length}
                  references={deck.references}
                />
              </div>

              {/* On a phone the navigator belongs directly under the slide. It
                  used to sit below the notes, so changing slides meant
                  scrolling past a wall of text. */}
              <div className="w-full max-w-4xl lg:hidden">
                <div className="mb-2 flex items-center justify-between">
                  <StepButton
                    label="Slide anterior"
                    onClick={() => step(-1)}
                    disabled={clamped === 0}
                  >
                    <path d="M12 4l-6 6 6 6" />
                  </StepButton>
                  <span className="text-xs tabular-nums text-ink-faint">
                    {clamped + 1} / {deck.slides.length}
                  </span>
                  <StepButton
                    label="Próximo slide"
                    onClick={() => step(1)}
                    disabled={clamped === deck.slides.length - 1}
                  >
                    <path d="M8 4l6 6-6 6" />
                  </StepButton>
                </div>
                <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
                  {thumbnails}
                </div>
              </div>

              <div className="w-full max-w-4xl">
                <h2 className="text-xs font-medium uppercase tracking-wider text-ink-faint">
                  Notas do apresentador
                </h2>
                <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-ink-soft">
                  {slide.notes || "—"}
                </p>
                <SlideReferences slide={slide} references={deck.references} />
                {slide.imageCredit && (
                  <p className="mt-3 text-sm text-ink-faint">
                    {slide.imageCredit}
                  </p>
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

/** Full citations for the current slide, each linking to PubMed. */
function SlideReferences({
  slide,
  references,
}: {
  slide: Deck["slides"][number];
  references?: Deck["references"];
}) {
  const cited = (slide.refs ?? [])
    .map((n) => references?.find((r) => r.n === n))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));
  if (cited.length === 0) return null;

  return (
    <div className="mt-4 border-t border-rule pt-3">
      <h3 className="text-xs font-medium uppercase tracking-wider text-ink-faint">
        Referências deste slide
      </h3>
      <ol className="mt-2 space-y-2">
        {cited.map((ref) => (
          <li key={ref.n} className="text-sm leading-snug text-ink-soft">
            <span className="tabular-nums text-ink-faint">{ref.n}.</span>{" "}
            {ref.title}{" "}
            <span className="text-ink-faint">{citationLine(ref)}</span>{" "}
            <a
              href={ref.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-clinical underline underline-offset-2 hover:text-clinical-deep"
            >
              PMID {ref.pmid}
            </a>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-ink-faint">
        Encontradas no PubMed a partir do tema do slide. Confirme se sustentam a
        afirmação antes de apresentar.
      </p>
    </div>
  );
}

function Thumbnails({
  deck,
  current,
  streaming,
  onPick,
}: {
  deck: Deck;
  current: number;
  streaming: boolean;
  onPick: (index: number) => void;
}) {
  return (
    <>
      {deck.slides.map((s, i) => (
        // The index sits beside the slide, never over it — at thumbnail scale
        // an overlaid badge covers the first words of the title.
        <button
          key={i}
          onClick={() => onPick(i)}
          className="rise group flex w-36 shrink-0 items-center gap-2 text-left lg:w-full"
        >
          <span
            className={`hidden w-4 shrink-0 text-right text-[11px] tabular-nums transition lg:block ${
              i === current
                ? "font-semibold text-clinical"
                : "text-ink-faint group-hover:text-ink-soft"
            }`}
          >
            {i + 1}
          </span>
          <span
            className={`min-w-0 flex-1 overflow-hidden rounded-md border transition ${
              i === current
                ? "border-clinical ring-2 ring-clinical/25"
                : "border-rule group-hover:border-ink-faint"
            }`}
          >
            <SlideView slide={s} index={i} total={deck.slides.length} references={deck.references} />
          </span>
        </button>
      ))}
      {streaming && (
        <div className="pulse-soft flex w-36 shrink-0 items-center justify-center rounded-md border border-dashed border-rule py-8 text-xs text-ink-faint lg:ml-6 lg:w-auto lg:flex-1">
          próximo slide…
        </div>
      )}
    </>
  );
}

function Action({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm text-ink-soft transition hover:bg-rule/50 disabled:opacity-40 lg:px-3"
    >
      <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" aria-hidden>
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {children}
        </g>
      </svg>
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}

function StepButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-rule text-ink-soft transition active:bg-rule/50 disabled:opacity-30"
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {children}
        </g>
      </svg>
    </button>
  );
}
