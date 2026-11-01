import type { RunRecord, Turn } from "./protocol.js";
import { seatSystem } from "./prompts.js";
import type { Ask } from "./providers.js";
import type { Seat, Study } from "./types.js";

const LEDGER_MAX_TOKENS = 16000; // it covers every run, and a cut-off reply can't be parsed

export interface Objection {
  candidate: string;
  objection: string;
  runsRaised: number[];
  quote: string;
  materialSilent: boolean;
}

const squash = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();
const turns = (items: Turn[]) => items.map((t) => `${t.speaker}: ${t.text}`).join("\n");

function evidence(runs: RunRecord[]): string {
  return runs
    .map((run) => {
      const reasons = run.ballots.map((b) => `${b.seat} (${b.stage}) chose ${b.label}: ${b.ballot.reasoning}`).join("\n");
      return `RUN ${run.run}\n${turns(run.transcript)}\n${turns(run.closing)}\n${reasons}`;
    })
    .join("\n\n");
}

const prompt = (study: Study, runs: RunRecord[]): string => `EXTRACT OBJECTIONS from this focus group.
Candidates: ${study.candidates.map((c) => c.name).join(", ")}

List each distinct objection raised against a candidate, merging the same objection across runs.
For each one give the candidate's exact name, the objection in under 15 words, the RUN numbers it was raised in, one short verbatim quote copied exactly from the record, and materialSilent: true if the candidate's material says nothing on this point.

MATERIAL
${study.candidates.map((c) => `===== ${c.name} =====\n${c.material}`).join("\n\n")}

RECORD
${evidence(runs)}

Reply with only JSON: {"objections": [{"candidate": string, "objection": string, "runsRaised": number[], "quote": string, "materialSilent": boolean}]}`;

function parse(text: string): Objection[] | null {
  try {
    const raw = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "") as { objections?: Objection[] };
    return Array.isArray(raw.objections) ? raw.objections : null;
  } catch {
    return null;
  }
}

export async function extractLedger(study: Study, runs: RunRecord[], ask: Ask, onDropped?: (count: number) => void): Promise<Objection[]> {
  const seat = study.seats[0] as Seat;
  const body = prompt(study, runs);
  const system = seatSystem(seat);
  const options = { maxTokens: LEDGER_MAX_TOKENS, valid: (text: string) => parse(text) !== null };
  const found = parse((await ask(seat, system, body, options)).text) ?? parse((await ask(seat, system, `${body}\n\nYour last reply was not valid JSON.`, options)).text);
  if (!found) throw new Error(`${seat.name} did not return a valid objection ledger.`);

  const record = squash(evidence(runs));
  const names = new Map(study.candidates.map((c) => [c.name.toLowerCase(), c.name]));
  const runIds = new Set(runs.map((r) => r.run));
  const kept = found
    // The quote is the one claim we can check, so an invented quote never reaches the report.
    .filter((o) => names.has(String(o.candidate).toLowerCase()) && typeof o.quote === "string" && o.quote.trim() && record.includes(squash(o.quote)))
    .map((o) => ({ ...o, candidate: names.get(o.candidate.toLowerCase()) as string, runsRaised: [...new Set(o.runsRaised)].filter((r) => runIds.has(r)) }));
  if (kept.length < found.length) onDropped?.(found.length - kept.length);
  return kept;
}
