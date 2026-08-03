"use client";

import { useRef, useState } from "react";
import { citationLine, type Deck } from "@/lib/deck";
import { exportPptx } from "@/lib/pptx";
import { SlideView } from "./SlideView";
import { PhaseBar, SlideSkeleton, phaseLabel, type Phase } from "./Progress";
import type { EditHandler } from "./Editable";
import { ChatPanel, type ChatMessage } from "./ChatPanel";
import type { Id } from "../../convex/_generated/dataModel";

export function DeckWorkspace({
  deck,
  streaming,
  shareId,
  phase,
  expectedSlides,
  onEditSlide,
  chat,
  onPresent,
  onRestart,
}: {
  deck: Deck;
  streaming: boolean;
  shareId?: string;
  phase?: Phase;
  expectedSlides?: number;
  /** Absent when the reader doesn't own the deck — then nothing is editable. */
  onEditSlide?: (slideIndex: number, patch: Parameters<EditHandler>[0]) => void;
  /** Present only for the deck's owner; enables the AI editor. */
  chat?: { deckId: Id<"decks">; messages: ChatMessage[] };
  onPresent: () => void;
  onRestart: () => void;
}) {
  const busy = Boolean(phase) && phase !== "pronto";
  // How many slides are still to come, for the skeleton placeholders.
  const pending = Math.max(
    0,
    Math.min(expectedSlides ?? 0, 25) - deck.slides.length,
  );
  const [copied, setCopied] = useState(false);
  // `null` means "not pinned yet": while slides stream in we follow the newest
  // one, and once the reader picks a thumbnail we stay on their choice.
  const [pinned, setPinned] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
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
      pending={pending}
      onPick={setPinned}
    />
  );

  return (
    <div
      className={`flex min-h-screen flex-col transition-[padding] ${
        chatOpen ? "lg:pr-[380px]" : ""
      }`}
    >
      <header className="sticky top-0 z-20 border-b border-rule bg-paper/90 px-4 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-[family-name:var(--font-display)] text-[17px] leading-tight lg:text-xl">
              {deck.title || "Gerando…"}
            </h1>
            {busy ? (
              <div className="mt-1 flex items-center gap-3">
                <PhaseBar phase={phase} />
                <span className="hidden truncate text-[11px] text-ink-faint xl:inline">
                  {phaseLabel(phase)}
                </span>
              </div>
            ) : (
              <p className="truncate text-[11px] text-ink-faint lg:text-xs">
                {deck.slides.length} slides · {deck.audience}
                {(deck.references?.length ?? 0) > 0 &&
                  ` · ${deck.references?.length} referências`}
              </p>
            )}
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
              disabled={busy || exporting}
            >
              <path d="M10 3v10M10 13l-3.5-3.5M10 13l3.5-3.5" />
              <path d="M4 16h12" />
            </Action>
            {chat && (
              <Action
                label="Editar com IA"
                onClick={() => setChatOpen((v) => !v)}
                disabled={busy}
              >
                <path d="M4 5h12M4 10h8M4 15h5" />
                <path d="M14.5 13.5l1.2 2.4 2.4 1.2-2.4 1.2-1.2 2.4-1.2-2.4-2.4-1.2 2.4-1.2z" />
              </Action>
            )}
            <button
              onClick={onPresent}
              disabled={busy || deck.slides.length === 0}
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
                  onEdit={
                    onEditSlide && !busy
                      ? (patch) => onEditSlide(clamped, patch)
                      : undefined
                  }
                />
              </div>

              {onEditSlide && !busy && (
                <p className="-mt-2 w-full max-w-4xl text-xs text-ink-faint">
                  Toque em qualquer texto do slide para editar.
                </p>
              )}

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
                <SlideReferences
                  slide={slide}
                  references={deck.references}
                  searching={phase === "referencias"}
                />
                {slide.imageCredit && (
                  <p className="mt-3 text-sm text-ink-faint">
                    {slide.imageCredit}
                  </p>
                )}
              </div>

              <Bibliography deck={deck} onJump={setPinned} />
            </>
          ) : (
            <div className="w-full max-w-4xl">
              <SlideSkeleton />
              <p className="mt-4 text-center text-sm text-ink-faint">
                <span className="pulse-soft">
                  Montando o roteiro da apresentação…
                </span>
              </p>
              <p className="mt-1 text-center text-xs text-ink-faint/80">
                Os slides aparecem aqui conforme forem escritos.
              </p>
            </div>
          )}
        </main>
      </div>

      {chat && (
        <ChatPanel
          deckId={chat.deckId}
          messages={chat.messages}
          open={chatOpen}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  );
}

/** Full citations for the current slide, each linking to PubMed. */
function SlideReferences({
  slide,
  references,
  searching,
}: {
  slide: Deck["slides"][number];
  references?: Deck["references"];
  searching?: boolean;
}) {
  const cited = (slide.refs ?? [])
    .map((n) => references?.find((r) => r.n === n))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  if (cited.length === 0) {
    if (!searching) return null;
    return (
      <p className="pulse-soft mt-4 border-t border-rule pt-3 text-sm text-ink-faint">
        Buscando estudos no PubMed…
      </p>
    );
  }

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

/**
 * Every study behind the deck, in one place. The per-slide list answers "what
 * backs this claim"; this answers "what is this deck built on", and is the view
 * someone actually checks before presenting.
 */
function Bibliography({
  deck,
  onJump,
}: {
  deck: Deck;
  onJump: (index: number) => void;
}) {
  const refs = deck.references ?? [];
  if (refs.length === 0) return null;

  const slideFor = (n: number) =>
    deck.slides.findIndex((s) => (s.refs ?? []).includes(n));

  return (
    <details className="w-full max-w-4xl rounded-lg border border-rule bg-paper-raised/60 px-4 py-3">
      <summary className="cursor-pointer list-none text-sm font-medium text-ink-soft marker:hidden">
        <span className="inline-flex items-center gap-2">
          <span>Estudos usados nesta apresentação</span>
          <span className="rounded-full bg-clinical/10 px-2 py-0.5 text-xs tabular-nums text-clinical-deep">
            {refs.length}
          </span>
        </span>
      </summary>

      <ol className="mt-3 space-y-3 border-t border-rule pt-3">
        {refs.map((ref) => {
          const slide = slideFor(ref.n);
          return (
            <li key={ref.n} className="text-sm leading-snug text-ink-soft">
              <span className="tabular-nums text-ink-faint">{ref.n}.</span>{" "}
              {ref.title}{" "}
              <span className="text-ink-faint">{citationLine(ref)}</span>{" "}
              <a
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
                className="whitespace-nowrap text-clinical underline underline-offset-2 hover:text-clinical-deep"
              >
                PMID {ref.pmid}
              </a>
              {slide >= 0 && (
                <button
                  onClick={() => onJump(slide)}
                  className="ml-2 whitespace-nowrap text-xs text-ink-faint underline underline-offset-2 hover:text-ink-soft"
                >
                  slide {slide + 1}
                </button>
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-xs text-ink-faint">
        Localizados no PubMed a partir do tema de cada slide. Confirme se
        sustentam a afirmação antes de apresentar.
      </p>
    </details>
  );
}

function Thumbnails({
  deck,
  current,
  pending,
  onPick,
}: {
  deck: Deck;
  current: number;
  pending: number;
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
      {/* One placeholder per slide still to come, so the rail shows the whole
          deck's shape from the first second instead of growing unpredictably. */}
      {Array.from({ length: Math.min(pending, 8) }).map((_, i) => (
        <div
          key={`skeleton-${i}`}
          className="flex w-36 shrink-0 items-center gap-2 lg:w-full"
        >
          <span className="hidden w-4 shrink-0 text-right text-[11px] text-ink-faint/40 lg:block">
            {deck.slides.length + i + 1}
          </span>
          <SlideSkeleton className="min-w-0 flex-1" />
        </div>
      ))}
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
