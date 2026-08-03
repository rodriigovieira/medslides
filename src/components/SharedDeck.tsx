"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { DeckWorkspace } from "./DeckWorkspace";
import { Presenter } from "./Presenter";

export function SharedDeck({ deckId }: { deckId: string }) {
  const router = useRouter();
  const [presenting, setPresenting] = useState(false);

  const record = useQuery(api.decks.get, {
    deckId: deckId as Id<"decks">,
  });

  if (record === undefined) {
    return <Centered>Carregando apresentação…</Centered>;
  }
  if (record === null) {
    return <Centered>Esta apresentação não existe ou foi removida.</Centered>;
  }

  const deck = {
    title: record.title,
    subtitle: record.subtitle,
    audience: record.audience,
    slides: record.slides,
    references: record.references,
  };

  return (
    <>
      <DeckWorkspace
        deck={deck}
        streaming={record.status === "gerando"}
        shareId={deckId}
        onPresent={() => setPresenting(true)}
        onRestart={() => router.push("/")}
      />
      {presenting && (
        <Presenter deck={deck} onExit={() => setPresenting(false)} />
      )}
    </>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center p-10 text-center text-sm text-ink-faint">
      {children}
    </div>
  );
}
