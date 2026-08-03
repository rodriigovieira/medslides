/**
 * Scores decks from a Convex snapshot export against the quality heuristics.
 *   npx convex export --prod --path /tmp/p.zip && unzip -o /tmp/p.zip -d /tmp/p
 *   npx tsx scripts/score.mts /tmp/p/decks/documents.jsonl
 */
import { readFileSync } from "node:fs";
import type { Deck } from "../src/lib/deck";
import { scoreDeck } from "../src/lib/quality";

const path = process.argv[2];
const count = Number(process.argv[3] ?? 3);
const decks = readFileSync(path, "utf8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line) as Deck & { createdAt: number })
  .sort((a, b) => a.createdAt - b.createdAt)
  .slice(-count);

let total = 0;
for (const deck of decks) {
  const report = scoreDeck(deck);
  total += report.overall;
  console.log(
    `\n=== ${deck.title.slice(0, 55)} — ${(report.overall * 100).toFixed(0)}/100`,
  );
  for (const m of report.metrics) {
    const bar = "█".repeat(Math.round(m.score * 10)).padEnd(10, "·");
    console.log(
      `  ${bar} ${(m.score * 100).toFixed(0).padStart(3)}  ${m.label} — ${m.detail}`,
    );
  }
  for (const w of report.worstSlides) {
    console.log(`  ! slide ${w.index + 1}: ${w.reason}`);
  }
}
console.log(`\nmédia: ${((total / decks.length) * 100).toFixed(0)}/100`);
