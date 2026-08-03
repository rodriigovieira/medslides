import {
  DECK_SCHEMA,
  SYSTEM_PROMPT,
  buildPrompt,
  type DeckRequest,
} from "./deck";

export const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`;

/**
 * Optional server-side proxy. When set at build time, the browser posts the
 * DeckRequest here instead of talking to Google directly, and the key lives on
 * that server. Unset (the GitHub Pages default) means bring-your-own-key.
 */
export const PROXY_URL = process.env.NEXT_PUBLIC_GENERATE_PROXY_URL ?? "";

export const KEY_STORAGE = "medslides.geminiKey";

export function readStoredKey(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

const keyListeners = new Set<() => void>();

export function storeKey(key: string) {
  try {
    if (key) window.localStorage.setItem(KEY_STORAGE, key);
    else window.localStorage.removeItem(KEY_STORAGE);
  } catch {
    // Private-browsing mode with storage disabled — the key just won't persist.
  }
  keyListeners.forEach((cb) => cb());
}

/** `useSyncExternalStore` plumbing so components read the key without an effect. */
export function subscribeToKey(cb: () => void) {
  keyListeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    keyListeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export const keySnapshot = readStoredKey;
export const keyServerSnapshot = () => "";

export function needsOwnKey(): boolean {
  return !PROXY_URL;
}

function requestBody(req: DeckRequest) {
  return {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: buildPrompt(req) }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: DECK_SCHEMA,
      temperature: 0.8,
      maxOutputTokens: 32768,
    },
  };
}

export class GenerationError extends Error {}

async function readErrorMessage(res: Response): Promise<string> {
  const raw = await res.text().catch(() => "");
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    if (parsed.error?.message) return parsed.error.message;
  } catch {
    // Not JSON — fall through to the raw body.
  }
  return raw.slice(0, 300) || `HTTP ${res.status}`;
}

/**
 * Streams the deck JSON, yielding the text accumulated so far. Callers feed
 * each chunk to `parsePartialDeck` to render slides as they land.
 */
export async function* streamDeck(
  req: DeckRequest,
  opts: { apiKey?: string; signal?: AbortSignal } = {},
): AsyncGenerator<string> {
  const usingProxy = Boolean(PROXY_URL);

  if (!usingProxy && !opts.apiKey) {
    throw new GenerationError("Nenhuma chave da API configurada.");
  }

  const res = await fetch(usingProxy ? PROXY_URL : GEMINI_ENDPOINT, {
    method: "POST",
    signal: opts.signal,
    headers: {
      "Content-Type": "application/json",
      ...(usingProxy ? {} : { "x-goog-api-key": opts.apiKey as string }),
    },
    body: JSON.stringify(usingProxy ? req : requestBody(req)),
  });

  if (!res.ok) {
    const detail = await readErrorMessage(res);
    if (res.status === 400 && /API key/i.test(detail)) {
      throw new GenerationError(
        "Chave da API inválida. Confira a chave em Configurar chave.",
      );
    }
    if (res.status === 429) {
      throw new GenerationError(
        "Limite de uso da API atingido. Aguarde um instante e tente de novo.",
      );
    }
    throw new GenerationError(detail);
  }
  if (!res.body) throw new GenerationError("Resposta vazia do servidor.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;

      let chunk: GeminiChunk;
      try {
        chunk = JSON.parse(payload) as GeminiChunk;
      } catch {
        continue; // Partial SSE frame; the next read completes it.
      }

      const blocked = chunk.promptFeedback?.blockReason;
      if (blocked) {
        throw new GenerationError(
          `O modelo recusou este tema (${blocked}). Tente reformular.`,
        );
      }

      const parts = chunk.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (typeof part.text === "string") accumulated += part.text;
      }
      if (parts.length > 0) yield accumulated;
    }
  }

  if (!accumulated) {
    throw new GenerationError("O modelo não retornou conteúdo.");
  }
  yield accumulated;
}

type GeminiChunk = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
};
