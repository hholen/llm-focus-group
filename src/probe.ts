import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { labelExact, parseBallot } from "./ballots.js";
import * as prompts from "./prompts.js";
import type { RunRecord, Turn } from "./protocol.js";
import type { Ask } from "./providers.js";
import type { Candidate, Seat, Study } from "./types.js";

export interface Probe {
  id: string;
  change: string;
  placebo: boolean;
}
export interface ProbeCall {
  probeId: string;
  run: number;
  seat: Seat;
  prompt: string;
}
export interface ProbeBallot {
  probeId: string;
  run: number;
  seat: string;
  label: string;
  reasoning: string;
  whatChangedIt: string;
  newConcern: string;
}

export function loadProbes(path: string): Probe[] {
  const raw = (parse(readFileSync(path, "utf8")) ?? {}) as { probes?: Partial<Probe>[] };
  if (!Array.isArray(raw.probes)) throw new Error('Probe error: "probes" must be a list.');
  const probes = raw.probes.map((p) => {
    if (!p.id || !p.change) throw new Error('Probe error: each probe needs an "id" and a "change".');
    return { id: p.id, change: p.change, placebo: p.placebo === true };
  });
  if (new Set(probes.map((p) => p.id)).size !== probes.length) throw new Error("Probe error: two probes have the same id.");
  if (!probes.some((p) => p.placebo)) throw new Error("Probe error: include a placebo, a change that shouldn't matter, so movement can be judged.");
  if (!probes.some((p) => !p.placebo)) throw new Error("Probe error: include at least one real probe beside the placebo.");
  return probes;
}

export const probeFolder = (runDir: string, probes: Probe[]): string =>
  join(runDir, "probes", createHash("sha256").update(JSON.stringify(probes)).digest("hex").slice(0, 8));

const numbers = (text: string): string[] => [...(text.match(/\d[\d,.]*\d|\d/g) ?? [])];

const neutralPrompt = (probe: Probe): string => `NEUTRALISE PROBE. A researcher wants to test this hypothetical change with a panel of AI models:

"${probe.change}"

Rewrite it as one neutral question to the panel. State the change as a hypothetical and ask whether it changes their pick. Keep every fact and number exact and in the same order, and add none. Don't suggest the change is good, bad, important or likely to matter, and don't say why it is being asked.

Reply with only JSON: {"question": string}`;

function readQuestion(text: string, probe: Probe): string | null {
  try {
    const question = (JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "") as { question?: string }).question?.trim();
    if (!question) return null;
    // A rewrite must test the same change, so its numbers must match in value, count and order.
    return numbers(question).join(" ") === numbers(probe.change).join(" ") ? question : null;
  } catch {
    return null;
  }
}

/** One rewrite per probe, so every model in every run hears identical wording. */
export async function neutralise(study: Study, probes: Probe[], ask: Ask): Promise<Record<string, string>> {
  const seat = study.seats[0] as Seat;
  const out: Record<string, string> = {};
  for (const probe of probes) {
    const options = { valid: (text: string) => readQuestion(text, probe) !== null };
    const body = neutralPrompt(probe);
    const first = readQuestion((await ask(seat, prompts.moderatorSystem, body, options)).text, probe);
    const question = first ?? readQuestion((await ask(seat, prompts.moderatorSystem, `${body}\n\nYour last rewrite changed a fact or wasn't valid JSON.`, options)).text, probe);
    if (!question) throw new Error(`The moderator couldn't rewrite probe ${probe.id} without changing it.`);
    out[probe.id] = question;
  }
  return out;
}

const render = (turns: Turn[]) => turns.map((t) => `${t.speaker}: ${t.text}`).join("\n\n");

export function probeCalls(study: Study, runs: RunRecord[], probes: Probe[], questions: Record<string, string>): ProbeCall[] {
  const final = `round-${study.rounds}`;
  const calls: ProbeCall[] = [];
  for (const run of runs) {
    const ordered = run.productOrder.map((name) => study.candidates.find((c) => c.name === name)).filter((c): c is Candidate => c !== undefined);
    const shown = prompts.shownMaterial(study.scenario, ordered);
    const discussion = render([...run.transcript, ...run.closing]);
    const pick = prompts.pickQuestion(run.productOrder);
    for (const probe of probes) {
      for (const seat of study.seats) {
        const previous = JSON.stringify(run.ballots.find((b) => b.seat === seat.name && b.stage === final)?.ballot);
        const asked = `Moderator: consider a hypothetical. ${questions[probe.id]} Assume nothing else changes. It may or may not affect your view.\n\n${pick} Also add "new_concern": any new worry this raises, or empty.`;
        calls.push({ probeId: probe.id, run: run.run, seat, prompt: prompts.ballot(shown, asked, previous, discussion) });
      }
    }
  }
  return calls;
}

const concern = (text: string): string => {
  try {
    const value = (JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as { new_concern?: unknown }).new_concern;
    return typeof value === "string" ? value : "";
  } catch {
    return "";
  }
};

export async function runProbeCalls(study: Study, calls: ProbeCall[], ask: Ask): Promise<ProbeBallot[]> {
  const names = study.candidates.map((c) => c.name);
  const options = { valid: (text: string) => parseBallot(text) !== null };
  const one = async (call: ProbeCall): Promise<ProbeBallot> => {
    const system = prompts.seatSystem(call.seat);
    let reply = await ask(call.seat, system, call.prompt, options);
    if (!parseBallot(reply.text)) reply = await ask(call.seat, system, `${call.prompt}\n\nYour last reply was not valid JSON. Return only the JSON object.`, options);
    const ballot = parseBallot(reply.text);
    if (!ballot) throw new Error(`${call.seat.name} did not return a valid probe ballot.`);
    return { probeId: call.probeId, run: call.run, seat: call.seat.name, label: labelExact(ballot.choice, names), reasoning: ballot.reasoning, whatChangedIt: ballot.whatChangedIt, newConcern: concern(reply.text) };
  };
  const out: ProbeBallot[] = [];
  // One group at a time, in parallel within it, as the panel's own ballots are.
  for (const group of new Set(calls.map((c) => `${c.run}:${c.probeId}`))) {
    out.push(...(await Promise.all(calls.filter((c) => `${c.run}:${c.probeId}` === group).map(one))));
  }
  return out;
}

export function renderProbeReport(study: Study, runs: RunRecord[], probes: Probe[], questions: Record<string, string>, ballots: ProbeBallot[]): string {
  const final = `round-${study.rounds}`;
  const baseline = (b: ProbeBallot) => runs.find((r) => r.run === b.run)?.ballots.find((x) => x.seat === b.seat && x.stage === final)?.label;
  const of = (probe: Probe) => ballots.filter((b) => b.probeId === probe.id);
  const moved = (probe: Probe) => of(probe).filter((b) => b.label !== baseline(b));
  const placeboMax = Math.max(0, ...probes.filter((p) => p.placebo).map((p) => moved(p).length));
  const finals = runs.flatMap((r) => r.ballots).filter((b) => b.stage === final);
  const names = study.candidates.map((c) => c.name);
  const count = (labels: string[], name: string) => labels.filter((l) => (name === "Other" ? l.startsWith("Other: ") : l === name)).length;

  const out = [
    `# Probes: ${names.join(" vs ")}`,
    ``,
    `This is screening, not proof. Models are reacting to a stated hypothetical at the end of a discussion. To confirm a result, edit the material and rerun the study.`,
    ``,
    `| Probe | Picks moved | Against placebo |`,
    `|---|---|---|`,
    ...probes.map((p) => `| ${p.id}${p.placebo ? " (placebo)" : ""} | ${moved(p).length} of ${of(p).length} | ${p.placebo ? "-" : moved(p).length > placeboMax ? "above placebo" : "not above placebo"} |`),
    ``,
    `## Picks`,
    ``,
    `| Choice | After discussion | ${probes.map((p) => p.id).join(" | ")} |`,
    `|---|---|${probes.map(() => "---").join("|")}|`,
    ...[...names, "Other"].map((name) => `| ${name} | ${count(finals.map((b) => b.label), name)} | ${probes.map((p) => count(of(p).map((b) => b.label), name)).join(" | ")} |`),
    ``,
    `## Wording`,
    ``,
  ];
  for (const p of probes) out.push(`- **${p.id}** asked: "${p.change}"`, `  - Moderator's neutral wording: "${questions[p.id]}"`);
  out.push(``, `## Reasons`, ``);
  for (const p of probes) {
    out.push(`### ${p.id}`, ``);
    const reasons = moved(p).map((b) => `- Run ${b.run + 1}, ${b.seat}: ${baseline(b)} to ${b.label}. ${b.whatChangedIt || b.reasoning}`);
    const concerns = of(p).filter((b) => b.newConcern).map((b) => `- New concern, run ${b.run + 1}, ${b.seat}: ${b.newConcern}`);
    out.push(...(reasons.length ? reasons : ["No picks moved."]), ...concerns, ``);
  }
  return out.join("\n");
}

export function saveProbes(folder: string, ballots: ProbeBallot[], report: string): void {
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "results.json"), JSON.stringify(ballots, null, 2));
  writeFileSync(join(folder, "report.md"), report);
}
