"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { getClientId } from "@/lib/session";

/**
 * Opens the showcase deck.
 *
 * Sits under the composer rather than beside it: someone who came here to make
 * their own deck should not have to step past a demo to do it. But someone being
 * shown the product — or wondering what "animação" actually means before typing
 * anything — needs one click, and no wait.
 *
 * The deck is hand-authored server-side, so this is instant and free. See
 * `convex/demo.ts`.
 */
export function DemoButton({
  onOpen,
}: {
  onOpen: (deckId: Id<"decks">) => void;
}) {
  const createDemo = useMutation(api.demo.create);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const open = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      onOpen(await createDemo({ clientId: getClientId() }));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.replace(/^.*Uncaught Error:\s*/, "").split("\n")[0]
          : "Não consegui abrir a demonstração.",
      );
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 border-t border-rule pt-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          onClick={() => void open()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg border border-clinical/50 px-4 py-2.5 text-sm font-medium text-clinical-deep transition hover:border-clinical hover:bg-clinical/[0.06] disabled:opacity-50"
        >
          <span aria-hidden>✦</span>
          {busy ? "Abrindo…" : "Ver uma apresentação animada"}
        </button>
        <p className="text-xs leading-relaxed text-ink-faint">
          Dez slides prontos, cinco com movimento. Abre na hora.
        </p>
      </div>
      {error && <p className="mt-2 text-xs text-signal">{error}</p>}
    </div>
  );
}
