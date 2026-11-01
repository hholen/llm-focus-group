import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Objection } from "./ledger.js";
import type { BallotRecord, RunRecord, Stage } from "./protocol.js";
import { seatSystem } from "./prompts.js";
import type { Ask } from "./providers.js";
import { journalled, loadRun, type Snapshot } from "./runs.js";
import type { Seat, Study } from "./types.js";

const CLEAR_CHANGE = 0.5;
type Pair = [Objection, Objection];

const files = (material: string): Map<string, string> => {
  const parts = material.split(/^--- (.+?) ---$/m).slice(1);
  const out = new Map<string, string>();
  for (let i = 0; i + 1 < parts.length; i += 2) out.set(parts[i] as string, parts[i + 1] as string);
  return out;
};

const editedCandidates = (a: Study, b: Study): Set<string> =>
  new Set(a.candidates.filter((c) => b.candidates.find((other) => other.name === c.name)?.material !== c.material).map((c) => c.name));

function materialChanges(a: Study, b: Study): string[] {
  const out: string[] = [];
  for (const before of a.candidates) {
    const after = b.candidates.find((c) => c.name === before.name);
    if (!after || after.material === before.material) continue;
    const old = files(before.material);
    const now = files(after.material);
    const names = [...new Set([...old.keys(), ...now.keys()])].filter((f) => old.get(f) !== now.get(f));
    out.push(`- ${before.name}: ${names.join(", ")}`);
  }
  if (a.scenario !== b.scenario) out.push("- The scenario changed.");
  return out;
}

function setupWarnings(a: Snapshot, b: Snapshot): string[] {
  const list = (s: Study, field: (seat: Seat) => string) => s.seats.map(field).join(", ");
  const checks: [string, string, string][] = [
    ["Seats", list(a.study, (s) => s.name), list(b.study, (s) => s.name)],
    ["Model IDs", list(a.study, (s) => s.model), list(b.study, (s) => s.model)],
    ["Provider routes", list(a.study, (s) => s.route), list(b.study, (s) => s.route)],
    ["Rounds", String(a.study.rounds), String(b.study.rounds)],
    ["Candidates", a.study.candidates.map((c) => c.name).join(", "), b.study.candidates.map((c) => c.name).join(", ")],
    ["Tool version", a.toolVersion, b.toolVersion],
  ];
  return checks.filter(([, x, y]) => x !== y).map(([name, x, y]) => `- **${name} differ:** ${x} / ${y}. Treat this comparison with care.`);
}

const matchPrompt = (a: Objection[], b: Objection[]): string => {
  const list = (items: Objection[]) => items.map((o, i) => `${i}. [${o.candidate}] ${o.objection}`).join("\n");
  return `MATCH OBJECTIONS from two focus group runs. Pair items only when they make the same point about the same candidate.\n\nRUN A\n${list(a)}\n\nRUN B\n${list(b)}\n\nReply with only JSON: {"matches": [[a_number, b_number]]}`;
};

function parsePairs(text: string, a: Objection[], b: Objection[]): Pair[] {
  try {
    const raw = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "") as { matches?: [number, number][] };
    const seenA = new Set<number>();
    const seenB = new Set<number>();
    const pairs: Pair[] = [];
    for (const [x, y] of raw.matches ?? []) {
      const left = a[x];
      const right = b[y];
      if (!left || !right || left.candidate !== right.candidate || seenA.has(x) || seenB.has(y)) continue;
      seenA.add(x);
      seenB.add(y);
      pairs.push([left, right]);
    }
    return pairs;
  } catch {
    return [];
  }
}

/** Wording varies between runs, so exact matches go first and one model call pairs the rest. */
async function pairObjections(a: Objection[], b: Objection[], seat: Seat, ask: Ask): Promise<Pair[]> {
  const key = (o: Objection) => `${o.candidate}\n${o.objection.toLowerCase().trim()}`;
  const pairs: Pair[] = [];
  const restB = [...b];
  const restA = a.filter((item) => {
    const i = restB.findIndex((other) => key(other) === key(item));
    if (i < 0) return true;
    pairs.push([item, restB.splice(i, 1)[0] as Objection]);
    return false;
  });
  if (restA.length && restB.length) {
    const reply = await ask(seat, seatSystem(seat), matchPrompt(restA, restB));
    pairs.push(...parsePairs(reply.text, restA, restB));
  }
  return pairs;
}

const stageTable = (a: Study, runsA: RunRecord[], b: Study, runsB: RunRecord[]): string[] => {
  const names = [...new Set([...a.candidates, ...b.candidates].map((c) => c.name)), "Other"];
  const count = (runs: RunRecord[], stage: Stage, name: string) => {
    const rows: BallotRecord[] = runs.flatMap((r) => r.ballots).filter((x) => x.stage === stage);
    const hits = rows.filter((x) => (name === "Other" ? x.label.startsWith("Other") : x.label === name)).length;
    return `${hits}/${rows.length}`;
  };
  const stages: [string, Stage, Stage][] = [
    ["Unprompted", "unprompted", "unprompted"],
    ["After reading", "blind", "blind"],
    ["No discussion (control)", `control-${a.rounds}`, `control-${b.rounds}`],
    ["After discussion", `round-${a.rounds}`, `round-${b.rounds}`],
  ];
  return [
    `| Stage | ${names.map((n) => `${n} A | ${n} B`).join(" | ")} |`,
    `|---|${names.flatMap(() => ["---", "---"]).join("|")}|`,
    ...stages.map(([title, sa, sb]) => `| ${title} | ${names.map((n) => `${count(runsA, sa, n)} | ${count(runsB, sb, n)}`).join(" | ")} |`),
  ];
};

export async function diffRuns(dirA: string, dirB: string, ask: Ask): Promise<string> {
  const a = loadRun(dirA);
  const b = loadRun(dirB);
  const totalA = a.runs.length;
  const totalB = b.runs.length;
  const seat = b.snapshot.study.seats[0] as Seat;
  const pairs = await pairObjections(a.ledger, b.ledger, seat, journalled(ask, join(dirB, "diff-calls.jsonl")));

  const counted = (o: Objection, total: number) => `${o.runsRaised.length} of ${total}`;
  const rateA = (o: Objection) => (totalA ? o.runsRaised.length / totalA : 0);
  const rateB = (o: Objection) => (totalB ? o.runsRaised.length / totalB : 0);
  const line = (o: Objection, text: string) => `- ${o.candidate}: ${o.objection} (${text})`;
  const moved = ([x, y]: Pair) => Math.abs(rateA(x) - rateB(y)) >= CLEAR_CHANGE;

  const gone = a.ledger.filter((o) => !pairs.some(([x]) => x === o));
  const added = b.ledger.filter((o) => !pairs.some(([, y]) => y === o));
  const pairLine = ([x, y]: Pair) => line(x, `${counted(x, totalA)} to ${counted(y, totalB)}`);
  const none = (items: string[]) => (items.length ? items : ["- None."]);
  const entry = (o: Objection, text: string) => ({ candidate: o.candidate, text: line(o, text) });
  const moves = [
    ...pairs.filter(moved).map(([x, y]) => entry(x, `${counted(x, totalA)} to ${counted(y, totalB)}`)),
    ...gone.filter((o) => rateA(o) >= CLEAR_CHANGE).map((o) => entry(o, `${counted(o, totalA)} to 0 of ${totalB}`)),
    ...added.filter((o) => rateB(o) >= CLEAR_CHANGE).map((o) => entry(o, `0 of ${totalA} to ${counted(o, totalB)}`)),
  ];
  // Rivals' material is identical between runs, so their moves show what the method does with no edit.
  const edited = editedCandidates(a.snapshot.study, b.snapshot.study);
  const allNames = new Set([...a.snapshot.study.candidates, ...b.snapshot.study.candidates].map((c) => c.name));
  const clear = moves.filter((m) => edited.has(m.candidate)).map((m) => m.text);
  const baseline = moves.filter((m) => !edited.has(m.candidate)).map((m) => m.text);
  const unchangedTotal = pairs.filter(([x]) => !edited.has(x.candidate)).length + [...gone, ...added].filter((o) => !edited.has(o.candidate)).length;
  const baselineText = edited.size >= allNames.size
    ? ["No baseline: every candidate's material changed, so nothing here shows the noise level."]
    : [`${baseline.length} of ${unchangedTotal} objections about unchanged products moved by at least half the runs. With no edit to those products, these are noise or knock-on effects from the other changes. Read the clear changes above against this rate.`, ``, ...none(baseline)];

  const warnings = setupWarnings(a.snapshot, b.snapshot);
  const out = [
    `# Diff`,
    ``,
    `A: ${dirA}`,
    `B: ${dirB}`,
    ``,
    `Counts only. This doesn't show why anything moved, and a small sample can move by chance.`,
    ``,
    `## Setup warnings`,
    ``,
    ...none(warnings),
    ``,
    `## Material changed`,
    ``,
    ...none(materialChanges(a.snapshot.study, b.snapshot.study)),
    ``,
    `## Objections: clear change`,
    ``,
    `Products whose material changed, where an objection moved by at least half the runs.`,
    ``,
    ...none(clear),
    ``,
    `## Noise baseline`,
    ``,
    ...baselineText,
    ``,
    `## Objections: within likely noise`,
    ``,
    ...none(pairs.filter((p) => !moved(p)).map(pairLine)),
    ``,
    `## Objections gone`,
    ``,
    ...none(gone.map((o) => line(o, `was ${counted(o, totalA)}`))),
    ``,
    `## New objections`,
    ``,
    ...none(added.map((o) => line(o, `now ${counted(o, totalB)}`))),
    ``,
    `## Objections that persisted`,
    ``,
    ...none(pairs.map(pairLine)),
    ``,
    `## Ballots`,
    ``,
    `Compare any shift with the control row. It repeats the vote with no discussion and no sight of the earlier ballot, so it shows how much picks drift by chance.`,
    ``,
    ...(a.snapshot.study.candidates.length === 1 && b.snapshot.study.candidates.length === 1
      ? ["Not shown for a single-candidate study."]
      : stageTable(a.snapshot.study, a.runs, b.snapshot.study, b.runs)),
    ``,
  ].join("\n");
  writeFileSync(join(dirB, "diff.md"), out);
  return out;
}
