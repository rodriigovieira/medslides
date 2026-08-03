"use client";

import { useState } from "react";
import { AUDIENCES, EXAMPLES, type DeckRequest } from "@/lib/deck";

export function Composer({
  onSubmit,
  disabled,
}: {
  onSubmit: (req: DeckRequest) => void;
  disabled?: boolean;
}) {
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState<string>(AUDIENCES[0]);
  const [slideCount, setSlideCount] = useState(10);
  const [depth, setDepth] = useState<DeckRequest["depth"]>("aprofundado");

  const tooShort = topic.trim().length < 8;

  const submit = () => {
    if (tooShort || disabled) return;
    onSubmit({ topic: topic.trim(), audience, slideCount, depth });
  };

  return (
    <div className="w-full">
      <div className="rounded-2xl border border-rule bg-paper-raised p-2 shadow-[0_1px_2px_rgba(14,27,42,0.04),0_12px_32px_-16px_rgba(14,27,42,0.18)] transition focus-within:border-clinical/50">
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
          rows={3}
          maxLength={600}
          placeholder="Sobre o que é a apresentação? Ex.: manejo inicial da sepse no pronto-socorro, com foco nas primeiras 3 horas."
          className="w-full resize-none bg-transparent px-4 py-3.5 text-[17px] leading-relaxed outline-none placeholder:text-ink-faint/70"
        />

        <div className="flex flex-wrap items-center gap-2 border-t border-rule/70 px-2 pb-1 pt-2.5">
          <Select
            label="Público"
            value={audience}
            onChange={setAudience}
            options={AUDIENCES.map((a) => ({ value: a, label: a }))}
          />
          <Select
            label="Slides"
            value={String(slideCount)}
            onChange={(v) => setSlideCount(Number(v))}
            options={[6, 8, 10, 12, 15, 20].map((n) => ({
              value: String(n),
              label: `${n} slides`,
            }))}
          />
          <Select
            label="Profundidade"
            value={depth}
            onChange={(v) => setDepth(v as DeckRequest["depth"])}
            options={[
              { value: "aprofundado", label: "Aprofundado" },
              { value: "panorama", label: "Panorâmico" },
            ]}
          />

          <button
            onClick={submit}
            disabled={tooShort || disabled}
            className="ml-auto rounded-lg bg-ink px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-clinical-deep disabled:cursor-not-allowed disabled:opacity-35"
          >
            Gerar apresentação
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-faint">Comece por:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            onClick={() => {
              setTopic(ex.topic);
              setAudience(ex.audience);
            }}
            className="rounded-full border border-rule bg-paper-raised px-3.5 py-1.5 text-sm text-ink-soft transition hover:border-clinical/60 hover:text-clinical-deep"
          >
            {ex.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="group relative flex items-center rounded-lg border border-rule bg-paper px-3 py-2 transition hover:border-ink-faint/60">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none bg-transparent pr-5 text-sm text-ink-soft outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg
        viewBox="0 0 12 12"
        className="pointer-events-none absolute right-2.5 h-3 w-3 text-ink-faint"
        aria-hidden
      >
        <path
          d="M3 4.5 6 8l3-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    </label>
  );
}
