"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { Deck, DeckRequest } from "@/lib/deck";
import {
  clientIdServerSnapshot,
  clientIdSnapshot,
  getClientId,
  subscribeToClientId,
} from "@/lib/session";
import { Composer } from "./Composer";
import { DeckWorkspace } from "./DeckWorkspace";
import { Landing } from "./Landing";
import { Presenter } from "./Presenter";

export function Studio() {
  const [deckId, setDeckId] = useState<Id<"decks"> | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const clientId = useSyncExternalStore(
    subscribeToClientId,
    clientIdSnapshot,
    clientIdServerSnapshot,
  );

  const start = useMutation(api.decks.start);
  const record = useQuery(api.decks.get, deckId ? { deckId } : "skip");

  const deck: Deck | null = useMemo(() => {
    if (!record) return null;
    return {
      title: record.title,
      subtitle: record.subtitle,
      audience: record.audience,
      slides: record.slides,
      references: record.references,
    };
  }, [record]);

  const handleSubmit = async (req: DeckRequest) => {
    setError("");
    setSubmitting(true);
    try {
      const id = await start({ ...req, clientId: getClientId() });
      setDeckId(id);
    } catch (err) {
      setError(readableError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const restart = () => {
    setDeckId(null);
    setError("");
    setPresenting(false);
  };

  if (deckId) {
    const streaming = !record || record.status === "gerando";
    return (
      <>
        {record?.error && (
          <p className="border-b border-signal/30 bg-signal/10 px-5 py-2.5 text-sm text-signal">
            {record.error}
          </p>
        )}
        <DeckWorkspace
          deck={deck ?? { title: "", subtitle: "", audience: "", slides: [] }}
          streaming={streaming}
          shareId={deckId}
          phase={record?.phase}
          expectedSlides={record?.slideCount}
          onPresent={() => setPresenting(true)}
          onRestart={restart}
        />
        {presenting && deck && (
          <Presenter deck={deck} onExit={() => setPresenting(false)} />
        )}
      </>
    );
  }

  return (
    <Landing error={error} clientId={clientId} onOpenDeck={setDeckId}>
      <Composer onSubmit={handleSubmit} disabled={submitting} />
    </Landing>
  );
}

function readableError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  // Convex wraps thrown errors with server context; the last line is ours.
  const match = raw.match(/Uncaught Error:\s*(.+?)(\n|$)/);
  return (match?.[1] ?? raw).trim() || "Não foi possível gerar a apresentação.";
}
