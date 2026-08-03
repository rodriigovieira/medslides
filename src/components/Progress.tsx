"use client";

export type Phase = "texto" | "referencias" | "imagens" | "pronto";

const STEPS: Array<{ id: Phase; label: string; hint: string }> = [
  { id: "texto", label: "Escrevendo", hint: "montando os slides" },
  { id: "referencias", label: "Referências", hint: "buscando no PubMed" },
  { id: "imagens", label: "Imagens", hint: "escolhendo as fotos" },
];

const ORDER: Phase[] = ["texto", "referencias", "imagens", "pronto"];

export function phaseIndex(phase: Phase | undefined): number {
  return phase ? ORDER.indexOf(phase) : 0;
}

/**
 * The deck's text lands in ~30s but references and images take another minute.
 * Before this, `status` flipped to "pronto" the moment the text was done, so the
 * UI claimed the deck was finished while two more stages were still running.
 */
export function PhaseBar({ phase }: { phase: Phase | undefined }) {
  const current = phaseIndex(phase);
  const done = phase === "pronto";

  return (
    <div className="flex items-center gap-2">
      {STEPS.map((step, i) => {
        const state = done || i < current ? "done" : i === current ? "active" : "todo";
        return (
          <div key={step.id} className="flex items-center gap-2">
            <span
              className={`flex items-center gap-1.5 text-[11px] lg:text-xs ${
                state === "active"
                  ? "font-medium text-clinical"
                  : state === "done"
                    ? "text-ink-faint"
                    : "text-ink-faint/50"
              }`}
            >
              {state === "done" ? (
                <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
                  <path
                    d="M2.5 6.5l2.5 2.5 4.5-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    state === "active"
                      ? "pulse-soft bg-clinical"
                      : "bg-ink-faint/30"
                  }`}
                />
              )}
              <span className="hidden sm:inline">{step.label}</span>
            </span>
            {i < STEPS.length - 1 && (
              <span
                className={`h-px w-4 lg:w-6 ${
                  done || i < current ? "bg-clinical/40" : "bg-rule"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** One-line status for tight spaces. */
export function phaseLabel(phase: Phase | undefined): string {
  const step = STEPS.find((s) => s.id === phase);
  if (!step) return phase === "pronto" ? "Pronta" : "Preparando…";
  return `${step.label} — ${step.hint}`;
}

/** Placeholder card shown where a slide will land. */
export function SlideSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative aspect-video w-full overflow-hidden rounded-md border border-dashed border-rule bg-paper-raised ${className}`}
      aria-hidden
    >
      <div className="absolute left-0 top-0 h-[3px] w-[16%] bg-rule" />
      <div className="flex h-full flex-col justify-center gap-[6%] px-[8%]">
        <div className="h-[9%] w-[70%] rounded-full bg-rule/70" />
        <div className="h-[5%] w-[85%] rounded-full bg-rule/50" />
        <div className="h-[5%] w-[60%] rounded-full bg-rule/50" />
      </div>
      <div className="absolute inset-0 animate-pulse bg-paper/30" />
    </div>
  );
}
