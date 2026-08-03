"use client";

import type { ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export function Landing({
  children,
  error,
  clientId,
  onOpenDeck,
}: {
  children: ReactNode;
  error: string;
  clientId: string;
  onOpenDeck: (id: Id<"decks">) => void;
}) {
  const recent = useQuery(
    api.decks.listMine,
    clientId ? { clientId, limit: 6 } : "skip",
  );

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-5">
        <span className="flex items-center gap-2.5">
          <span className="h-5 w-5 rounded-[5px] bg-clinical" />
          <span className="font-[family-name:var(--font-display)] text-xl">
            MedSlides
          </span>
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-12">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-clinical">
          Para médicos
        </p>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-5xl leading-[1.05] tracking-tight sm:text-6xl">
          A aula pronta antes
          <br />
          do plantão acabar.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
          Descreva o tema e quem vai assistir. Você recebe a apresentação
          estruturada — títulos que afirmam, tópicos enxutos, imagem de capa e
          notas do apresentador em cada slide — e baixa em PowerPoint para
          ajustar do seu jeito.
        </p>

        {error && (
          <p className="mt-6 rounded-lg border border-signal/30 bg-signal/10 px-4 py-3 text-sm text-signal">
            {error}
          </p>
        )}

        <div className="mt-9">{children}</div>

        {recent && recent.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xs font-medium uppercase tracking-wider text-ink-faint">
              Suas apresentações
            </h2>
            <ul className="mt-3 divide-y divide-rule border-y border-rule">
              {recent.map((deck) => (
                <li key={deck._id}>
                  <button
                    onClick={() => onOpenDeck(deck._id)}
                    className="group flex w-full items-center gap-4 py-3 text-left transition hover:bg-paper-raised"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px]">
                        {deck.title || deck.topic}
                      </span>
                      <span className="block truncate text-xs text-ink-faint">
                        {deck.audience} · {deck.slideCount} slides
                      </span>
                    </span>
                    {deck.status === "gerando" && (
                      <span className="pulse-soft shrink-0 text-xs text-clinical">
                        gerando…
                      </span>
                    )}
                    {deck.status === "erro" && (
                      <span className="shrink-0 text-xs text-signal">falhou</span>
                    )}
                    <span className="shrink-0 text-ink-faint transition group-hover:translate-x-0.5">
                      →
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <ul className="mt-14 grid gap-6 border-t border-rule pt-8 sm:grid-cols-3">
          {[
            {
              t: "Escrito para projetar",
              d: "No máximo 5 tópicos por slide, sem parágrafo na tela. O texto da fala vai nas notas.",
            },
            {
              t: "Sai em PowerPoint",
              d: "Arquivo .pptx real, com imagens e notas do apresentador. Edite no Keynote, Google Slides ou PowerPoint.",
            },
            {
              t: "Você revisa antes",
              d: "É apoio para montar a aula, não fonte clínica. Confira condutas e referências antes de apresentar.",
            },
          ].map((f) => (
            <li key={f.t}>
              <h3 className="text-[15px] font-semibold">{f.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-faint">
                {f.d}
              </p>
            </li>
          ))}
        </ul>
      </main>

      <footer className="px-6 py-8 text-center text-xs text-ink-faint">
        Conteúdo e imagens gerados por IA — as imagens são ilustrativas, nunca
        registro clínico. Revise antes de usar com pacientes ou alunos.
      </footer>
    </div>
  );
}
