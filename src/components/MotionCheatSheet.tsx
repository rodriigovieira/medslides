"use client";

import { useState } from "react";

/**
 * What to say to get each effect.
 *
 * The animation vocabulary is only reachable through the chat, which means it is
 * invisible: there is no menu to browse, and a doctor has no reason to guess
 * that the word "herói" means anything. This is the menu — every line is a
 * sentence you can copy, and clicking one sends it.
 *
 * It doubles as the honest list of limits. Someone deciding whether this
 * replaces the specialist they pay needs to know what it will not do, and
 * finding that out mid-demo in front of a customer is the wrong moment.
 */
const RECIPES = [
  {
    prompt: "Anime a apresentação inteira",
    effect:
      "Escolhe um efeito por slide conforme o layout. Acima de 3 slides ele descreve o plano e espera você confirmar.",
  },
  {
    prompt: "No slide 4, use o efeito herói",
    effect:
      "O elemento central chega grande e sozinho, é lido, e então desliza para a esquerda encolhendo enquanto o resto do diagrama aparece. Só em slides com um conceito central.",
  },
  {
    prompt: "Faça o slide 4 se transformar a partir do slide 3",
    effect:
      "O que os dois slides têm em comum — um número, um título, uma imagem — voa de uma posição para a outra em vez de sumir e reaparecer. É o Morph do PowerPoint.",
  },
  {
    prompt: "No slide 5, revele uma etapa por vez",
    effect: "Cada passo do fluxo entra na ordem em que acontece.",
  },
  {
    prompt: "Deixe o número do slide 3 mais solene",
    effect: "O número cresce sozinho, devagar. Bom para a estatística que sustenta o argumento.",
  },
  {
    prompt: "Tire a animação do slide 8",
    effect:
      "Slide parado. Vale usar de propósito: numa apresentação boa a maioria dos slides não se mexe.",
  },
  {
    prompt: "Gere uma ilustração do mecanismo no slide 4 e anime com herói",
    effect:
      "Cria a imagem com IA e já define o movimento. A imagem chega alguns segundos depois; a animação vale a partir daí.",
  },
];

const LIMITS = [
  "O movimento é só na tela. O .pptx exportado sai sem animação — o modelo do PowerPoint é outro, e uma tradução pela metade é pior que nenhuma.",
  "Quem tem “reduzir movimento” ligado no sistema vê todos os slides inteiros e parados.",
];

export function MotionCheatSheet({ onSend }: { onSend?: (prompt: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4 rounded-xl border border-rule bg-paper-raised">
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-ink-soft transition hover:text-clinical-deep"
        aria-expanded={open}
      >
        <span className="text-clinical" aria-hidden>
          ✦
        </span>
        Como pedir animação
        <span className="ml-auto text-xs text-ink-faint" aria-hidden>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div className="border-t border-rule px-4 pb-4 pt-3">
          <ul className="space-y-3">
            {RECIPES.map((recipe) => (
              <li key={recipe.prompt}>
                {onSend ? (
                  <button
                    onClick={() => onSend(recipe.prompt)}
                    className="text-left text-sm font-medium text-clinical-deep underline decoration-clinical/30 underline-offset-2 transition hover:decoration-clinical"
                  >
                    “{recipe.prompt}”
                  </button>
                ) : (
                  <span className="text-sm font-medium text-clinical-deep">
                    “{recipe.prompt}”
                  </span>
                )}
                <p className="mt-1 text-xs leading-relaxed text-ink-faint">
                  {recipe.effect}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-4 border-t border-rule pt-3">
            {LIMITS.map((limit) => (
              <p key={limit} className="text-xs leading-relaxed text-ink-faint">
                {limit}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
