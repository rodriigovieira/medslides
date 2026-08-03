"use client";

import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { getClientId } from "@/lib/session";

/**
 * AI editing anchored to one slide.
 *
 * The docked chat panel is the wrong shape for the commonest request — "fix
 * this slide" — because on a phone it covers the very slide you want to watch
 * change, and you have to name the slide by number. Here the scope is implicit
 * and the three shortcuts cover most asks without a keyboard, which is what
 * matters on touch.
 */
const SHORTCUTS = [
  {
    label: "Encurtar",
    instruction:
      "Reduza o texto deste slide: no máximo 4 tópicos de até 10 palavras cada, preservando o sentido clínico.",
  },
  {
    label: "Mais técnico",
    instruction:
      "Deixe este slide mais técnico para especialistas: inclua doses, cortes e critérios concretos, mantendo o formato.",
  },
  {
    label: "Virar diagrama",
    instruction:
      "Converta este slide em um diagrama, escolhendo entre mecanismo, fluxo ou cards o que melhor representa o conteúdo.",
  },
  {
    label: "Trocar imagem",
    instruction:
      "Troque a foto deste slide por outra que combine com o conteúdo. Se ele ainda não tem foto, escolha uma.",
  },
  {
    label: "Gerar imagem ✦",
    instruction:
      "Gere uma imagem com IA para este slide, que ilustre o conteúdo dele.",
  },
];

export function SlidePrompt({
  deckId,
  slideIndex,
  seed,
  open,
  onClose,
}: {
  deckId: Id<"decks">;
  slideIndex: number;
  /** Pre-filled instruction, e.g. when opened from a bullet's toolbar. */
  seed?: string;
  open: boolean;
  onClose: () => void;
}) {
  const editOne = useAction(api.chat.editOne);
  // The parent remounts this via `key` when the slide or the seed changes, so
  // the initial state is simply the seed — no resetting from an effect.
  const [draft, setDraft] = useState(seed ?? "");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const run = async (instruction: string) => {
    const text = instruction.trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    setReply("");
    try {
      const result = await editOne({
        deckId,
        clientId: getClientId(),
        slideIndex,
        instruction: text,
      });
      setReply(result);
      setDraft("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.replace(/^.*Uncaught Error:\s*/, "").split("\n")[0]
          : "Não foi possível editar.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-4xl rounded-xl border border-clinical/60 bg-paper-raised p-3 shadow-[0_16px_40px_-22px_rgba(14,27,42,.45)]">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-clinical" aria-hidden>
          ✦
        </span>
        <span className="text-xs font-medium text-ink-soft">
          Editando o slide {slideIndex + 1}
        </span>
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-ink-faint transition hover:bg-rule/50"
        >
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden>
            <path
              d="M6 6l8 8M14 6l-8 8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SHORTCUTS.map((s) => (
          <button
            key={s.label}
            onClick={() => void run(s.instruction)}
            disabled={busy}
            className="rounded-full border border-rule px-3 py-1.5 text-xs text-ink-soft transition hover:border-clinical/60 hover:text-clinical-deep disabled:opacity-40"
          >
            {s.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(draft);
        }}
        className="mt-2 flex items-end gap-2"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void run(draft);
            }
          }}
          rows={1}
          maxLength={400}
          placeholder="ou escreva o pedido…"
          // 16px so iOS doesn't zoom the viewport when it takes focus.
          className="max-h-24 min-h-10 flex-1 resize-none rounded-lg border border-rule bg-paper px-3 py-2 text-[16px] leading-snug outline-none transition focus:border-clinical lg:text-sm"
        />
        <button
          type="submit"
          disabled={busy || draft.trim().length < 2}
          aria-label="Enviar"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink text-paper transition hover:bg-clinical-deep disabled:opacity-35"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
            <path
              d="M10 16V4M10 4l-5 5M10 4l5 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </form>

      {busy && (
        <p className="pulse-soft mt-2 text-xs text-ink-faint">
          Reescrevendo o slide…
        </p>
      )}
      {reply && !busy && <p className="mt-2 text-xs text-clinical-deep">{reply}</p>}
      {error && <p className="mt-2 text-xs text-signal">{error}</p>}
    </div>
  );
}
