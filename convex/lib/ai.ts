import { DECK_SCHEMA, SYSTEM_PROMPT, buildPrompt } from "../../src/lib/deck";
import type { DeckRequest } from "../../src/lib/deck";

export const GEMINI_MODEL = "gemini-2.5-flash";
export const OPENAI_MODEL = "gpt-4.1";

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`;
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export type Provider = "gemini" | "openai";

export class ProviderError extends Error {
  constructor(
    readonly provider: Provider,
    readonly status: number | null,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Same rule the Panda backend uses: fall through to the next provider on rate
 * limits and server errors, but never on a 4xx we caused.
 */
export function shouldFallback(error: unknown): boolean {
  if (!(error instanceof ProviderError)) return false;
  const { status } = error;
  if (status === null) return true; // network/timeout — worth another provider
  return status === 429 || (status >= 500 && status <= 599);
}

/** Reads an SSE body, handing each `data:` payload to `onEvent`. */
async function readSse(
  res: Response,
  onEvent: (json: unknown) => void,
): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("Resposta sem corpo.");
  const decoder = new TextDecoder();
  let buffer = "";

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
      try {
        onEvent(JSON.parse(payload));
      } catch {
        // Partial frame — the next chunk completes it.
      }
    }
  }
}

async function failure(provider: Provider, res: Response): Promise<never> {
  const raw = await res.text().catch(() => "");
  let message = raw.slice(0, 300);
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    if (parsed.error?.message) message = parsed.error.message;
  } catch {
    // Non-JSON error body.
  }
  throw new ProviderError(
    provider,
    res.status,
    `${provider} ${res.status}: ${message || "erro desconhecido"}`,
  );
}

type OnText = (accumulated: string) => void | Promise<void>;

async function streamGemini(req: DeckRequest, onText: OnText): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new ProviderError("gemini", null, "GEMINI_API_KEY ausente");

  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: buildPrompt(req) }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: DECK_SCHEMA,
        temperature: 0.8,
        maxOutputTokens: 32768,
      },
    }),
  });
  if (!res.ok) await failure("gemini", res);

  let text = "";
  const pending: Array<Promise<void> | void> = [];
  await readSse(res, (event) => {
    const chunk = event as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      promptFeedback?: { blockReason?: string };
    };
    if (chunk.promptFeedback?.blockReason) {
      throw new ProviderError(
        "gemini",
        400,
        `Conteúdo bloqueado (${chunk.promptFeedback.blockReason}).`,
      );
    }
    for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
      if (typeof part.text === "string") text += part.text;
    }
    pending.push(onText(text));
  });
  await Promise.all(pending);

  if (!text) throw new ProviderError("gemini", null, "Resposta vazia.");
  return text;
}

async function streamOpenAI(req: DeckRequest, onText: OnText): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new ProviderError("openai", null, "OPENAI_API_KEY ausente");

  // OpenAI's strict json_schema mode requires every property to be listed in
  // `required`, which our optional per-layout fields can't satisfy. This is the
  // rare fallback path, so plain JSON mode plus the schema inline is enough.
  const system = `${SYSTEM_PROMPT}

Responda SOMENTE com JSON válido, sem markdown e sem cercas de código, exatamente neste formato:
${JSON.stringify(DECK_SCHEMA)}`;

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      stream: true,
      temperature: 0.8,
      max_tokens: 16384,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: buildPrompt(req) },
      ],
    }),
  });
  if (!res.ok) await failure("openai", res);

  let text = "";
  const pending: Array<Promise<void> | void> = [];
  await readSse(res, (event) => {
    const chunk = event as {
      choices?: Array<{ delta?: { content?: string } }>;
    };
    const delta = chunk.choices?.[0]?.delta?.content;
    if (typeof delta === "string") {
      text += delta;
      pending.push(onText(text));
    }
  });
  await Promise.all(pending);

  if (!text) throw new ProviderError("openai", null, "Resposta vazia.");
  return text;
}

export async function generateDeckText(
  req: DeckRequest,
  onText: OnText,
): Promise<{ text: string; provider: Provider; model: string }> {
  try {
    const text = await streamGemini(req, onText);
    return { text, provider: "gemini", model: GEMINI_MODEL };
  } catch (error) {
    if (!shouldFallback(error)) throw error;
    console.warn(
      `Gemini falhou (${error instanceof Error ? error.message : error}); tentando OpenAI.`,
    );
    const text = await streamOpenAI(req, onText);
    return { text, provider: "openai", model: OPENAI_MODEL };
  }
}

/**
 * The model's answer ran past the output limit and stops mid-token, so the JSON
 * never closes. Carries the raw text: for a list of operations, the ones that
 * did close are perfectly good, and throwing the whole reply away over the last
 * one costs the user the entire request.
 */
export class TruncatedJsonError extends Error {
  constructor(readonly raw: string) {
    super("A resposta do modelo veio cortada.");
    this.name = "TruncatedJsonError";
  }
}

function parseOrTruncated(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new TruncatedJsonError(text);
  }
}

/**
 * One-shot structured call, for jobs that aren't the deck stream — currently
 * the chat editor. Same provider order and fallback rule as `generateDeckText`.
 */
export async function generateStructured(
  system: string,
  user: string,
  schema: unknown,
): Promise<unknown> {
  const gemini = async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new ProviderError("gemini", null, "GEMINI_API_KEY ausente");
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: schema,
            temperature: 0.4,
            maxOutputTokens: 16384,
          },
        }),
      },
    );
    if (!res.ok) await failure("gemini", res);
    const body = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new ProviderError("gemini", null, "Resposta vazia.");
    return parseOrTruncated(text);
  };

  const openai = async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new ProviderError("openai", null, "OPENAI_API_KEY ausente");
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.4,
        max_tokens: 16384,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `${system}\n\nResponda SOMENTE com JSON válido neste formato:\n${JSON.stringify(schema)}`,
          },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) await failure("openai", res);
    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = body.choices?.[0]?.message?.content;
    if (!text) throw new ProviderError("openai", null, "Resposta vazia.");
    return parseOrTruncated(text);
  };

  try {
    return await gemini();
  } catch (error) {
    if (!shouldFallback(error)) throw error;
    return await openai();
  }
}
