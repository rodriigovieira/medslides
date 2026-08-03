"use client";

import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { getClientId } from "@/lib/session";

export type ChatMessage = { role: "user" | "assistant"; text: string; at: number };

const SUGGESTIONS = [
  "Adicione 3 slides sobre contraindicações",
  "No slide 4, enfatize a dose",
  "Troque a imagem do slide 2",
  "Deixe o slide 3 mais curto",
];

/**
 * Docked panel on desktop, full-height sheet on a phone. The deck itself is the
 * source of truth for the conversation — messages are stored on the deck, so a
 * reload or a second tab shows the same history.
 */
export function ChatPanel({
  deckId,
  messages,
  open,
  onClose,
}: {
  deckId: Id<"decks">;
  messages: ChatMessage[];
  open: boolean;
  onClose: () => void;
}) {
  const send = useAction(api.chat.send);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = listRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length, busy]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setDraft("");
    setError("");
    setBusy(true);
    try {
      await send({ deckId, clientId: getClientId(), message });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.replace(/^.*Uncaught Error:\s*/, "").split("\n")[0]
          : "Não foi possível enviar.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Scrim only on mobile, where the sheet covers the deck. */}
      <button
        aria-label="Fechar"
        onClick={onClose}
        className="fixed inset-0 z-30 bg-ink/30 lg:hidden"
      />

      <aside
        className="fixed inset-x-0 bottom-0 z-40 flex h-[78vh] flex-col rounded-t-2xl border border-rule bg-paper-raised shadow-2xl lg:inset-y-0 lg:left-auto lg:right-0 lg:h-auto lg:w-[380px] lg:rounded-none lg:border-l lg:shadow-xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <header className="flex items-center gap-2 border-b border-rule px-4 py-3">
          {/* Grab handle reads as a sheet on touch. */}
          <span className="absolute left-1/2 top-1.5 h-1 w-9 -translate-x-1/2 rounded-full bg-rule lg:hidden" />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Editar com IA</h2>
            <p className="truncate text-xs text-ink-faint">
              Peça mudanças em português
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft transition hover:bg-rule/50"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
              <path
                d="M6 6l8 8M14 6l-8 8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed text-ink-soft">
                Diga o que quer mudar e eu ajusto os slides — um slide, vários,
                ou a imagem de um deles. Só mexo no que você pedir.
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => void submit(s)}
                    className="rounded-full border border-rule px-3 py-1.5 text-xs text-ink-soft transition hover:border-clinical/60 hover:text-clinical-deep"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={`${m.at}-${i}`}
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "ml-auto bg-ink text-paper"
                  : "bg-paper border border-rule text-ink-soft"
              }`}
            >
              {m.text}
            </div>
          ))}

          {busy && (
            <div className="pulse-soft max-w-[85%] rounded-2xl border border-rule bg-paper px-3.5 py-2.5 text-sm text-ink-faint">
              Ajustando os slides…
            </div>
          )}
        </div>

        {error && (
          <p className="border-t border-signal/30 bg-signal/10 px-4 py-2 text-xs text-signal">
            {error}
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(draft);
          }}
          className="flex items-end gap-2 border-t border-rule p-3"
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit(draft);
              }
            }}
            rows={1}
            maxLength={600}
            placeholder="Ex.: deixe o slide 4 mais curto"
            // 16px keeps iOS from zooming the viewport on focus.
            className="max-h-28 min-h-11 flex-1 resize-none rounded-xl border border-rule bg-paper px-3 py-2.5 text-[16px] leading-snug outline-none transition focus:border-clinical lg:text-sm"
          />
          <button
            type="submit"
            disabled={busy || draft.trim().length < 2}
            aria-label="Enviar"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink text-paper transition hover:bg-clinical-deep disabled:opacity-35"
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
      </aside>
    </>
  );
}
