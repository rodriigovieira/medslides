"use client";

import { useEffect, useState } from "react";
import { readStoredKey, storeKey } from "@/lib/generate";

/** Mounted only while open, so the stored key seeds the field on mount. */
export function KeyDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (key: string) => void;
}) {
  const [value, setValue] = useState(readStoredKey);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = () => {
    const trimmed = value.trim();
    storeKey(trimmed);
    onSaved(trimmed);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
      <div className="rise w-full max-w-lg rounded-2xl border border-rule bg-paper-raised p-7 shadow-xl">
        <h2 className="font-[family-name:var(--font-display)] text-2xl">
          Sua chave do Google AI Studio
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          O MedSlides roda inteiro no seu navegador — não há servidor nosso no
          meio. A chave fica salva só neste dispositivo e vai direto para a API
          do Google a cada geração.
        </p>

        <label className="mt-6 block text-xs font-medium uppercase tracking-wider text-ink-faint">
          Chave da API
        </label>
        <input
          autoFocus
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="AIza..."
          spellCheck={false}
          className="mt-2 w-full rounded-lg border border-rule bg-paper px-4 py-3 font-mono text-sm outline-none transition focus:border-clinical"
        />

        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm text-clinical underline underline-offset-4 hover:text-clinical-deep"
        >
          Gerar uma chave gratuita no Google AI Studio →
        </a>

        <div className="mt-7 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-ink-soft transition hover:bg-rule/50"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={!value.trim()}
            className="rounded-lg bg-ink px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-clinical-deep disabled:opacity-40"
          >
            Salvar chave
          </button>
        </div>
      </div>
    </div>
  );
}
