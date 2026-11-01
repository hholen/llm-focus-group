import type { Objection } from "./ledger.js";
import type { BallotRecord, RunRecord, Stage } from "./protocol.js";
import type { Usage } from "./providers.js";
import { searchReport, type SearchResult } from "./search.js";
import type { Seat, Study } from "./types.js";

const provider = (seat: Seat) => (seat.route === "anthropic" ? "anthropic" : (seat.model.split("/")[0] ?? seat.model));
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const bucket = (label: string) => (label.startsWith("Other") ? "Other" : label);

function warnings(study: Study, runs: RunRecord[], dropped: number): string[] {
  const out: string[] = [];
  const providers = new Set(study.seats.map(provider)).size;
  if (study.candidates.length === 1) out.push("- This is objection-finding only. In single-product sessions every product tested ended up chosen, so picks are not shown.");
  if (runs.length < 3) out.push(`- Low evidence: ${plural(runs.length, "run")}. Use at least 3.`);
  if (providers < 2) out.push(`- Low evidence: ${plural(providers, "provider")}. Use at least 2.`);
  if (study.blind) {
    out.push(`- Blind mode: masking may be incomplete, so a model may still recognise a product. Transcripts use: ${study.candidates.map((c, i) => `Product ${String.fromCharCode(65 + i)} = ${c.name}`).join(", ")}.`);
    for (const b of runs.flatMap((r) => r.ballots).filter((x) => x.leak)) out.push(`- Blinding leak: run ${b.run + 1}, ${b.seat} named ${b.label} at ${b.stage}. Counted as ${b.label}.`);
  }
  if (dropped) out.push(`- ${plural(dropped, "objection")} ${dropped === 1 ? "was" : "were"} dropped because the quote wasn't in the record, so the list below may be short.`);
  return out.length ? out : ["- None."];
}

function objections(study: Study, ledger: Objection[], total: number): string[] {
  if (ledger.length === 0) return ["No objections extracted."];
  return study.candidates.flatMap((c) => {
    const items = ledger.filter((o) => o.candidate === c.name).sort((a, b) => b.runsRaised.length - a.runsRaised.length);
    if (items.length === 0) return [];
    return [`### ${c.name}`, ``, ...items.map((o) => `- ${o.objection} (${o.runsRaised.length} of ${total} runs). "${o.quote}"`), ``];
  });
}

function table(study: Study, ballots: BallotRecord[], columns: [string, Stage][]): string[] {
  const size = (stage: Stage) => ballots.filter((b) => b.stage === stage).length;
  const cell = (name: string, stage: Stage) => ballots.filter((b) => b.stage === stage && bucket(b.label) === name).length;
  const rows = [...study.candidates.map((c) => c.name), "Other"];
  return [
    `| Choice | ${columns.map(([title, stage]) => `${title} (n=${size(stage)})`).join(" | ")} |`,
    `|---|${columns.map(() => "---").join("|")}|`,
    ...rows.map((name) => `| ${name} | ${columns.map(([, stage]) => cell(name, stage)).join(" | ")} |`),
  ];
}

function mindChanges(study: Study, runs: RunRecord[]): string[] {
  const out: string[] = [];
  for (const run of runs) {
    for (const seat of study.seats) {
      let last = run.ballots.find((b) => b.seat === seat.name && b.stage === "blind");
      for (let r = 1; r <= study.rounds; r++) {
        const now = run.ballots.find((b) => b.seat === seat.name && b.stage === `round-${r}`);
        if (last && now && now.label !== last.label) {
          out.push(`- Run ${run.run + 1}, ${seat.name}: ${last.label} to ${now.label} after round ${r}. ${now.ballot.whatChangedIt}`.trimEnd());
        }
        last = now ?? last;
      }
    }
  }
  return out.length ? out : ["No changes."];
}

export function renderReport(study: Study, runs: RunRecord[], ledger: Objection[], usage: Usage, search: SearchResult[] = [], dropped = 0): string {
  const ballots = runs.flatMap((r) => r.ballots);
  const names = study.candidates.map((c) => c.name).join(" vs ");
  const gaps = ledger.filter((o) => o.materialSilent);
  const single = study.candidates.length === 1;
  const out: string[] = [
    `# LLM focus group: ${names}`,
    ``,
    `${plural(runs.length, "run")}, ${plural(study.rounds, "discussion round")}. Seats: ${study.seats.map((s) => `${s.name} = ${s.model}`).join(", ")}.`,
    ``,
    `## Evidence warnings`,
    ``,
    ...warnings(study, runs, dropped),
    ``,
    `## Objections`,
    ``,
    ...objections(study, ledger, runs.length),
    `## Documentation gaps`,
    ``,
    `The material says nothing on these points. Check each one against the real product: models tend to treat what's missing from docs as missing from the product.`,
    ``,
    ...(gaps.length ? gaps.map((o) => `- ${o.candidate}: ${o.objection}`) : ["- None found."]),
    ``,
    `## Ballots (evidence)`,
    ``,
  ];
  if (single) out.push(`Not shown for a single-candidate study.`, ``);
  else {
    out.push(...table(study, ballots, [["Unprompted", "unprompted"], ["After reading", "blind"], ["No discussion (control)", `control-${study.rounds}`]]), ``);
    out.push(`Unprompted answers:`, ``, ...ballots.filter((b) => b.stage === "unprompted").map((b) => `- Run ${b.run + 1}, ${b.seat}: ${b.ballot.choice}`), ``);
  }
  if (search.length) out.push(searchReport(study, search));
  out.push(`## Discussion effects`, ``, `Shifts here come from moderated discussion, which can swing a model towards the latest challenge. They are not the same as evidence.`, ``);
  if (!single) out.push(...table(study, ballots, [["After reading", "blind"], ["After discussion", `round-${study.rounds}`]]), ``);
  out.push(...(single ? [`Mind changes are not shown for a single-candidate study.`] : mindChanges(study, runs)), ``, `## Transcripts`, ``);
  for (const run of runs) {
    out.push(`### Run ${run.run + 1}`, ``, `Seats: ${run.seatOrder.join(", ")}. Products: ${run.productOrder.join(", ")}. Moderator: ${run.moderator}.`, ``);
    for (const turn of [...run.transcript, ...run.closing]) out.push(`**${turn.speaker}:** ${turn.text}`, ``);
  }
  out.push(`Usage: ${usage.inputTokens} input tokens, ${usage.outputTokens} output tokens.`);
  return out.join("\n");
}
