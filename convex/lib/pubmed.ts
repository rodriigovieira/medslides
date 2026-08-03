/**
 * Reference verification against PubMed E-utilities — free, no API key.
 *
 * The model never supplies a citation directly. It supplies a *claim* to
 * support; we search PubMed and attach only articles that actually came back
 * with a real PMID. A fabricated `Am J Hypertens. 2025;38(3):e0025` on a
 * clinical slide is the failure mode that gets a tool banned from a hospital,
 * so nothing reaches a slide unless NCBI returned it.
 *
 * Anonymous rate limit is 3 requests/second, so callers must serialise and go
 * through the Convex-side cache.
 */

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const TOOL = "tool=medslides&email=contato@medslides.app";

export type Reference = {
  pmid: string;
  title: string;
  authors: string;
  journal: string;
  year: string;
  url: string;
};

/**
 * Tiers, strongest evidence first. A claim backed by a guideline or a
 * meta-analysis is worth more on a slide than the first hit for the keywords.
 */
const TIERS = [
  "(Guideline[pt] OR Practice Guideline[pt] OR Meta-Analysis[pt] OR Systematic Review[pt])",
  "(Randomized Controlled Trial[pt] OR Review[pt])",
  "",
];

function pause(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 120);
}

async function esearch(term: string): Promise<string[]> {
  const url = `${EUTILS}/esearch.fcgi?db=pubmed&retmode=json&retmax=3&sort=relevance&${TOOL}&term=${encodeURIComponent(term)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`esearch ${res.status}`);
  const body = (await res.json()) as {
    esearchresult?: { idlist?: string[] };
  };
  return body.esearchresult?.idlist ?? [];
}

/** Collaborative author lists can be paragraphs long; keep the slide readable. */
function formatAuthors(authors: Array<{ name?: string }> | undefined): string {
  const first = authors?.[0]?.name?.trim();
  if (!first) return "";
  const short = first.length > 40 ? `${first.slice(0, 38).trimEnd()}…` : first;
  return (authors?.length ?? 0) > 1 ? `${short}, et al` : short;
}

function formatYear(pubdate: string | undefined): string {
  const match = /\b(19|20)\d{2}\b/.exec(pubdate ?? "");
  return match ? match[0] : "";
}

async function esummary(ids: string[]): Promise<Reference[]> {
  if (ids.length === 0) return [];
  const url = `${EUTILS}/esummary.fcgi?db=pubmed&retmode=json&${TOOL}&id=${ids.join(",")}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`esummary ${res.status}`);

  const body = (await res.json()) as {
    result?: Record<string, unknown> & { uids?: string[] };
  };
  const result = body.result;
  if (!result?.uids) return [];

  const out: Reference[] = [];
  for (const uid of result.uids) {
    const raw = result[uid] as
      | {
          title?: string;
          source?: string;
          pubdate?: string;
          authors?: Array<{ name?: string }>;
        }
      | undefined;
    if (!raw?.title || !raw.source) continue;
    out.push({
      pmid: uid,
      title: raw.title.replace(/\.$/, ""),
      authors: formatAuthors(raw.authors),
      journal: raw.source,
      year: formatYear(raw.pubdate),
      url: `https://pubmed.ncbi.nlm.nih.gov/${uid}/`,
    });
  }
  return out;
}

/**
 * Returns real articles for a clinical claim, best evidence tier first.
 * Returns an empty array rather than throwing — a slide with no reference is
 * fine; a slide with an invented one is not.
 */
export async function findReferences(query: string): Promise<Reference[]> {
  const cleaned = normalizeQuery(query);
  if (cleaned.length < 4) return [];

  for (const tier of TIERS) {
    try {
      const term = `${cleaned} AND english[la]${tier ? ` AND ${tier}` : ""}`;
      const ids = await esearch(term);
      await pause(400); // stay under 3 req/s
      if (ids.length === 0) continue;

      const refs = await esummary(ids.slice(0, 2));
      await pause(400);
      if (refs.length > 0) return refs;
    } catch (error) {
      console.warn(`pubmed falhou para "${cleaned}": ${String(error)}`);
      return [];
    }
  }
  return [];
}

/** Compact form for the strip at the bottom of a slide. */
export function shortCitation(ref: Reference): string {
  const parts = [ref.authors, ref.journal, ref.year].filter(Boolean);
  return parts.join(". ") + ".";
}
