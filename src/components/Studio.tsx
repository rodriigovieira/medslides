"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { Deck, DeckRequest } from "@/lib/deck";
import {
  GenerationError,
  keyServerSnapshot,
  keySnapshot,
  needsOwnKey,
  readStoredKey,
  streamDeck,
  subscribeToKey,
} from "@/lib/generate";
import { finalizeDeck, parsePartialDeck } from "@/lib/partial";
import { Composer } from "./Composer";
import { DeckWorkspace } from "./DeckWorkspace";
import { KeyDialog } from "./KeyDialog";
import { Presenter } from "./Presenter";

type Phase = "idle" | "streaming" | "ready";

export function Studio() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [deck, setDeck] = useState<Deck | null>(null);
  const [error, setError] = useState("");
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [presenting, setPresenting] = useState(false);

  const storedKey = useSyncExternalStore(
    subscribeToKey,
    keySnapshot,
    keyServerSnapshot,
  );
  const hasKey = !needsOwnKey() || Boolean(storedKey);

  const abortRef = useRef<AbortController | null>(null);
  const pendingRef = useRef<DeckRequest | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(async (req: DeckRequest) => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    setError("");
    setPhase("streaming");
    setDeck({ title: "", subtitle: "", audience: req.audience, slides: [] });

    let lastText = "";
    try {
      for await (const text of streamDeck(req, {
        apiKey: readStoredKey(),
        signal: controller.signal,
      })) {
        lastText = text;
        const partial = parsePartialDeck(text);
        setDeck({
          title: partial.title ?? "",
          subtitle: partial.subtitle ?? "",
          audience: req.audience,
          slides: partial.slides,
        });
      }

      const final = finalizeDeck(lastText, req.audience);
      if (!final) throw new GenerationError("A resposta veio incompleta.");
      setDeck(final);
      setPhase("ready");
    } catch (err) {
      if (controller.signal.aborted) return;
      const salvaged = finalizeDeck(lastText, req.audience);
      if (salvaged && salvaged.slides.length >= 3) {
        // Partial deck is still useful — keep it and say what happened.
        setDeck(salvaged);
        setPhase("ready");
        setError(
          "A geração foi interrompida antes do fim. Os slides abaixo estão completos; gere de novo se faltar conteúdo.",
        );
        return;
      }
      setDeck(null);
      setPhase("idle");
      setError(
        err instanceof GenerationError || err instanceof Error
          ? err.message
          : "Não foi possível gerar a apresentação.",
      );
    }
  }, []);

  const handleSubmit = (req: DeckRequest) => {
    if (needsOwnKey() && !readStoredKey()) {
      pendingRef.current = req;
      setKeyDialogOpen(true);
      return;
    }
    void run(req);
  };

  const handleKeySaved = (key: string) => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (key && pending) void run(pending);
  };

  const restart = () => {
    abortRef.current?.abort();
    setDeck(null);
    setPhase("idle");
    setError("");
  };

  if (deck && (phase === "streaming" || phase === "ready")) {
    return (
      <>
        {error && (
          <p className="border-b border-signal/30 bg-signal/10 px-5 py-2.5 text-sm text-signal">
            {error}
          </p>
        )}
        <DeckWorkspace
          deck={deck}
          streaming={phase === "streaming"}
          onPresent={() => setPresenting(true)}
          onRestart={restart}
        />
        {presenting && (
          <Presenter deck={deck} onExit={() => setPresenting(false)} />
        )}
      </>
    );
  }

  return (
    <>
      <Landing
        onSubmit={handleSubmit}
        error={error}
        hasKey={hasKey}
        onOpenKeyDialog={() => setKeyDialogOpen(true)}
      />
      {keyDialogOpen && (
        <KeyDialog
          onClose={() => setKeyDialogOpen(false)}
          onSaved={handleKeySaved}
        />
      )}
    </>
  );
}

function Landing({
  onSubmit,
  error,
  hasKey,
  onOpenKeyDialog,
}: {
  onSubmit: (req: DeckRequest) => void;
  error: string;
  hasKey: boolean;
  onOpenKeyDialog: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-5">
        <span className="flex items-center gap-2.5">
          <span className="h-5 w-5 rounded-[5px] bg-clinical" />
          <span className="font-[family-name:var(--font-display)] text-xl">
            MedSlides
          </span>
        </span>
        <button
          onClick={onOpenKeyDialog}
          className="rounded-lg border border-rule px-3 py-1.5 text-sm text-ink-soft transition hover:border-ink-faint"
        >
          {hasKey ? "Chave configurada" : "Configurar chave"}
        </button>
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
          estruturada — títulos que afirmam, tópicos enxutos, notas do
          apresentador em cada slide — e baixa em PowerPoint para ajustar do seu
          jeito.
        </p>

        {error && (
          <p className="mt-6 rounded-lg border border-signal/30 bg-signal/10 px-4 py-3 text-sm text-signal">
            {error}
          </p>
        )}

        <div className="mt-9">
          <Composer onSubmit={onSubmit} />
        </div>

        <ul className="mt-14 grid gap-6 border-t border-rule pt-8 sm:grid-cols-3">
          {[
            {
              t: "Escrito para projetar",
              d: "No máximo 5 tópicos por slide, sem parágrafo na tela. O texto da fala vai nas notas.",
            },
            {
              t: "Sai em PowerPoint",
              d: "Arquivo .pptx real, com as notas do apresentador em cada slide. Edite no Keynote, Google Slides ou PowerPoint.",
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
        MedSlides roda no seu navegador. Conteúdo gerado por IA — revise antes de
        usar com pacientes ou alunos.
      </footer>
    </div>
  );
}
