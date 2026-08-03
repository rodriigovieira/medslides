import type { Deck, Slide } from "./deck";

/**
 * The model streams one big JSON object, but we want slides to appear as they
 * land rather than all at once at the end. This walks the partial text and
 * pulls out whatever is already syntactically complete: the header strings,
 * plus every slide object whose closing brace has arrived.
 */
export type PartialDeck = {
  title?: string;
  subtitle?: string;
  slides: Slide[];
};

/** Reads a JSON string literal starting at `start` (which must be a quote). */
function readString(text: string, start: number): { value: string; end: number } | null {
  if (text[start] !== '"') return null;
  let out = "";
  for (let i = start + 1; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\") {
      const next = text[i + 1];
      if (next === undefined) return null;
      if (next === "u") {
        const hex = text.slice(i + 2, i + 6);
        if (hex.length < 4) return null;
        out += String.fromCharCode(parseInt(hex, 16));
        i += 5;
        continue;
      }
      const map: Record<string, string> = {
        '"': '"',
        "\\": "\\",
        "/": "/",
        b: "\b",
        f: "\f",
        n: "\n",
        r: "\r",
        t: "\t",
      };
      out += map[next] ?? next;
      i += 1;
      continue;
    }
    if (ch === '"') return { value: out, end: i };
    out += ch;
  }
  return null;
}

function topLevelString(text: string, key: string, limit: number): string | undefined {
  const needle = `"${key}"`;
  const at = text.indexOf(needle);
  if (at === -1 || at > limit) return undefined;
  const colon = text.indexOf(":", at + needle.length);
  if (colon === -1) return undefined;
  let i = colon + 1;
  while (i < text.length && /\s/.test(text[i])) i++;
  return readString(text, i)?.value;
}

export function parsePartialDeck(text: string): PartialDeck {
  const slidesKey = text.indexOf('"slides"');
  const headerLimit = slidesKey === -1 ? text.length : slidesKey;

  const result: PartialDeck = {
    title: topLevelString(text, "title", headerLimit),
    subtitle: topLevelString(text, "subtitle", headerLimit),
    slides: [],
  };

  if (slidesKey === -1) return result;
  const arrayStart = text.indexOf("[", slidesKey);
  if (arrayStart === -1) return result;

  let depth = 0;
  let objStart = -1;
  let inString = false;
  let escaped = false;

  for (let i = arrayStart + 1; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) objStart = i;
      depth++;
      continue;
    }
    if (ch === "}") {
      depth--;
      if (depth === 0 && objStart !== -1) {
        try {
          result.slides.push(JSON.parse(text.slice(objStart, i + 1)) as Slide);
        } catch {
          // Shouldn't happen — a balanced object should parse. Skip it rather
          // than losing the slides that came before.
        }
        objStart = -1;
      }
      continue;
    }
    if (ch === "]" && depth === 0) break;
  }

  return result;
}

export function finalizeDeck(text: string, audience: string): Deck | null {
  try {
    const parsed = JSON.parse(text) as Deck;
    if (!parsed || !Array.isArray(parsed.slides) || parsed.slides.length === 0) {
      return null;
    }
    return { ...parsed, audience: parsed.audience || audience };
  } catch {
    const partial = parsePartialDeck(text);
    if (partial.slides.length === 0) return null;
    return {
      title: partial.title ?? "Apresentação",
      subtitle: partial.subtitle ?? "",
      audience,
      slides: partial.slides,
    };
  }
}
