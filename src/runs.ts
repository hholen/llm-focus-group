import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { maskStudy, unmaskLedger, unmaskRun } from "./blind.js";
import { extractLedger, type Objection } from "./ledger.js";
import { runSession, type RunRecord } from "./protocol.js";
import { mockAsk, type Ask, type Reply, type Usage } from "./providers.js";
import { renderReport } from "./report.js";
import { runSearchBallot, searchSeats, type Search, type SearchResult } from "./search.js";
import type { Study } from "./types.js";

export interface Snapshot {
  createdAt: string;
  toolVersion: string;
  contentHash: string;
  study: Study;
}

const MOCK_KEY = "mock:";
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const toolVersion = (): string => (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }).version;

/** Hashes what the models saw, so the same inputs match wherever the files sit on disk. */
function hashStudy(study: Study): string {
  return sha(JSON.stringify({ ...study, candidates: study.candidates.map(({ materialDir: _dir, ...rest }) => rest) }));
}

export function createRunDir(study: Study, root: string): string {
  const createdAt = new Date().toISOString();
  const dir = join(root, `${createdAt.replace(/[:.]/g, "-")}-${sha(String(Math.random())).slice(0, 6)}`);
  mkdirSync(dir, { recursive: true });
  const snapshot: Snapshot = { createdAt, toolVersion: toolVersion(), contentHash: hashStudy(study), study };
  writeFileSync(join(dir, "snapshot.json"), JSON.stringify(snapshot, null, 2));
  return dir;
}

function readJournal(path: string): { replies: Map<string, Reply>; rejected: Usage[] } {
  const entries = new Map<string, Reply>();
  const rejected: Usage[] = [];
  if (!existsSync(path)) return { replies: entries, rejected };
  const raw = readFileSync(path, "utf8");
  // A crash mid-write leaves a partial last line. End it so later appends start clean.
  if (raw && !raw.endsWith("\n")) appendFileSync(path, "\n");
  for (const line of raw.split("\n")) {
    if (!line) continue;
    try {
      const entry = JSON.parse(line) as { key?: string; reply?: Reply; rejected?: Usage };
      if (entry.key && entry.reply) entries.set(entry.key, entry.reply);
      if (entry.rejected) rejected.push(entry.rejected);
    } catch {
      /* broken line: that call runs again */
    }
  }
  return { replies: entries, rejected };
}

/** Wraps an Ask so each finished call is saved and never paid for twice. */
export function journalled(ask: Ask, path: string): Ask {
  const saved = readJournal(path).replies;
  const salt = ask === mockAsk ? MOCK_KEY : ""; // a mock reply must never pass as a paid one
  const seen = new Map<string, number>();
  return async (seat, system, prompt, options) => {
    const valid = options?.valid ?? (() => true);
    const base = sha(JSON.stringify([seat.name, seat.route, seat.model, system, prompt]));
    const repeat = seen.get(base) ?? 0;
    seen.set(base, repeat + 1);
    const key = `${salt}${base}:${repeat}`; // identical prompts can recur, so each keeps its own answer
    const known = saved.get(key);
    if (known && valid(known.text)) return known;
    const reply = await ask(seat, system, prompt, options);
    // A rejected reply is never replayed, but it was paid for, so usage still counts it.
    appendFileSync(path, `${JSON.stringify(valid(reply.text) ? { key, reply } : { rejected: reply.usage })}\n`);
    return reply;
  };
}

/** Write then rename, so a crash can't leave a half-written file. */
function writeAtomic(path: string, content: string): void {
  writeFileSync(`${path}.tmp`, content);
  renameSync(`${path}.tmp`, path);
}

function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

const loadSearch = (dir: string) => readJson<SearchResult[]>(join(dir, "search.json"), []);

export async function runStudy(study: Study, dir: string, ask: Ask, search: Search = runSearchBallot, onRun?: (done: number, total: number) => void): Promise<RunRecord[]> {
  const logged = journalled(ask, join(dir, "calls.jsonl"));
  const save = (runs: RunRecord[], ledger: Objection[], finished: boolean) => writeAtomic(join(dir, "results.json"), JSON.stringify({ runs, ledger, finished }, null, 2));
  const blind = study.blind ? maskStudy(study) : undefined;
  const panel = blind?.study ?? study;
  const shownRuns: RunRecord[] = [];
  const realRuns = () => (blind ? shownRuns.map((r) => unmaskRun(r, blind.labels)) : shownRuns);
  for (let run = 0; run < study.runs; run++) {
    shownRuns.push(await runSession(panel, run, logged));
    save(realRuns(), [], false);
    onRun?.(run + 1, study.runs);
  }
  let dropped = 0;
  const extracted = await extractLedger(panel, shownRuns, logged, (count) => { dropped = count; });
  const ledger = blind ? unmaskLedger(extracted, blind.labels) : extracted;
  const runs = realRuns();
  save(runs, ledger, true);
  if (study.searchBallot) {
    const results = loadSearch(dir);
    for (let run = 0; run < study.runs; run++) {
      for (const seat of searchSeats(study)) {
        if (results.some((r) => r.run === run && r.model === seat.model)) continue;
        results.push(await search(study, run, seat));
        writeAtomic(join(dir, "search.json"), JSON.stringify(results, null, 2));
      }
    }
  }
  writeFileSync(join(dir, "report.md"), renderReport(study, runs, ledger, loadRun(dir).usage, loadSearch(dir), dropped));
  return runs;
}

/** Calls answered by a real provider, as opposed to the mock. */
export const realAnswers = (dir: string): number =>
  [...readJournal(join(dir, "calls.jsonl")).replies.keys()].filter((key) => !key.startsWith(MOCK_KEY)).length;

export const savedCalls = (dir: string): number => realAnswers(dir) + loadSearch(dir).length;

export function loadRun(dir: string): { snapshot: Snapshot; runs: RunRecord[]; ledger: Objection[]; search: SearchResult[]; usage: Usage; finished: boolean } {
  const snapshot = JSON.parse(readFileSync(join(dir, "snapshot.json"), "utf8")) as Snapshot;
  const { runs, ledger, finished = true } = readJson<{ runs: RunRecord[]; ledger: Objection[]; finished?: boolean }>(join(dir, "results.json"), { runs: [], ledger: [] });
  const usage: Usage = { inputTokens: 0, outputTokens: 0 };
  const search = loadSearch(dir);
  const journal = readJournal(join(dir, "calls.jsonl"));
  for (const used of [...[...journal.replies.values(), ...search].map((r) => r.usage), ...journal.rejected]) {
    usage.inputTokens += used.inputTokens;
    usage.outputTokens += used.outputTokens;
  }
  return { snapshot, runs, ledger, search, usage, finished };
}
