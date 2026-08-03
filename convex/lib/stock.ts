/**
 * Stock photography via Openverse — no API key, and we filter to StockSnap,
 * whose catalogue is CC0 (public domain) editorial photography.
 *
 * Two deliberate constraints:
 * - `source=stocksnap` only. Openverse also aggregates rawpixel, which returns
 *   flat vector clipart — the exact "AI slop" look this redesign is fighting.
 * - CC0 means no attribution is legally required. We still record the credit.
 *
 * Anonymous rate limit is 20/min and 200/day, so callers must go through the
 * Convex-side cache rather than hitting this per slide.
 */

const OPENVERSE_URL = "https://api.openverse.org/v1/images/";
const USER_AGENT = "medslides/1.0 (https://medslides.vercel.app)";

export type StockImage = {
  url: string;
  width: number;
  height: number;
  title: string;
  creator: string;
  sourceUrl: string;
  license: string;
};

/**
 * Same intent as the old generated-image filter: nothing that could read as
 * real diagnostic evidence. Negations are stripped first so a query like
 * "ward, no wounds" isn't blocked by its own safety wording.
 */
const FORBIDDEN =
  /\b(x-?rays?|radiographs?|ct scans?|mri|ultrasounds?|echocardiograms?|ecgs?|ekgs?|histolog\w*|biops\w+|pathology slides?|microscop\w*|lesions?|wounds?|rashes|tumou?rs?|autops\w+|cadavers?|dissection|surgical site|blood smear)\b/i;

function stripNegations(text: string): string {
  return text.replace(/\b(?:no|without|free of)\s+[\w-]+/gi, " ");
}

export function isSafeImageQuery(query: string): boolean {
  return !FORBIDDEN.test(stripNegations(query));
}

/**
 * Generic, always-available themes. Niche queries ("dapagliflozina") return
 * nothing from a curated catalogue, so we fall back to the deck's own topic and
 * finally to these.
 */
export const FALLBACK_QUERIES = [
  "hospital",
  "doctor",
  "nurse",
  "medicine",
  "healthcare",
  "clinic",
  "laboratory",
  "surgery room",
];

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80);
}

export async function searchStock(query: string): Promise<StockImage[]> {
  if (!isSafeImageQuery(query)) return [];

  const params = new URLSearchParams({
    q: query,
    source: "stocksnap",
    license: "cc0",
    size: "large",
    aspect_ratio: "wide",
    mature: "false",
    page_size: "20",
  });

  try {
    const res = await fetch(`${OPENVERSE_URL}?${params}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (!res.ok) {
      console.warn(`openverse ${res.status} para "${query}"`);
      return [];
    }

    const body = (await res.json()) as {
      results?: Array<{
        url?: string;
        width?: number;
        height?: number;
        title?: string;
        creator?: string;
        foreign_landing_url?: string;
        license?: string;
        mature?: boolean;
      }>;
    };

    return (body.results ?? [])
      .filter(
        (r) =>
          r.url &&
          !r.mature &&
          (r.width ?? 0) >= 900 &&
          (r.width ?? 0) > (r.height ?? 0),
      )
      .map((r) => ({
        url: r.url as string,
        width: r.width ?? 0,
        height: r.height ?? 0,
        title: r.title ?? "",
        creator: r.creator ?? "",
        sourceUrl: r.foreign_landing_url ?? "",
        license: r.license ?? "cc0",
      }));
  } catch (error) {
    console.warn(`openverse falhou para "${query}": ${String(error)}`);
    return [];
  }
}

export async function downloadImage(
  url: string,
): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) return null;
    const bytes = await res.arrayBuffer();
    // Guard against a stray HTML error page or a thumbnail-sized file.
    if (bytes.byteLength < 10_000) return null;
    return { bytes, contentType };
  } catch {
    return null;
  }
}

export function creditLine(image: StockImage): string {
  const who = image.creator ? ` · ${image.creator}` : "";
  return `Foto: StockSnap${who} (CC0)`;
}
