#!/usr/bin/env node
import { mkdirSync, mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { diffRuns } from "./diff.js";
import { estimate, estimateCalls, loadPrices } from "./estimate.js";
import { getKey } from "./keys.js";
import { loadProbes, neutralise, probeCalls, probeFolder, renderProbeReport, runProbeCalls, saveProbes } from "./probe.js";
import { mockAsk, realAsk } from "./providers.js";
import { createRunDir, journalled, loadRun, realAnswers, runStudy, savedCalls } from "./runs.js";
import { mockSearch, runSearchBallot } from "./search.js";
import { loadStudy } from "./study.js";
import { writeSample } from "./templates.js";
import type { Study } from "./types.js";

export interface Io {
  log: (line: string) => void;
  confirm: (question: string) => Promise<boolean>;
}

const USAGE = `Usage:
  llm-focus-group init [folder]
  llm-focus-group demo [--out <folder>]
  llm-focus-group models
  llm-focus-group run <study.yaml> [--yes] [--mock] [--out <folder>]
  llm-focus-group resume <run-folder> [--yes] [--mock]
  llm-focus-group diff <run-a> <run-b> [--mock]
  llm-focus-group probe <run-folder> <probes.yaml> [--yes] [--mock]`;

function requireKeys(study: Study): void {
  for (const route of new Set(study.seats.map((s) => s.route))) getKey(route === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENROUTER_API_KEY");
}

const money = (n: number | null) => (n === null ? "unknown" : `$${n.toFixed(2)}`);

function finished(dir: string, io: Io): void {
  const { usage } = loadRun(dir);
  io.log(`Actual usage: ${usage.inputTokens} input tokens, ${usage.outputTokens} output tokens.`);
  io.log(`Report: ${dir}/report.md`);
}

async function run(path: string, flags: { yes: boolean; mock: boolean; out: string }, io: Io): Promise<void> {
  const study = loadStudy(path);
  if (!flags.mock) {
    requireKeys(study);
    const cost = estimate(study, await loadPrices(study.seats));
    io.log(`Estimated ${cost.calls} calls, ${money(cost.usdLow)} to ${money(cost.usdHigh)}. This is an estimate, not a quote.`);
    if (cost.unpriced.length) io.log(`No price found for: ${cost.unpriced.join(", ")}.`);
    io.log(`Your material will be sent to: ${[...new Set(study.seats.map((s) => s.route))].join(", ")}.`);
    if (!flags.yes && !(await io.confirm("Continue?"))) {
      io.log("Stopped. Nothing was sent.");
      return;
    }
  }
  const dir = createRunDir(study, flags.out);
  io.log(`Run folder: ${dir}`);
  await runStudy(study, dir, flags.mock ? mockAsk : realAsk, flags.mock ? mockSearch : runSearchBallot, (done, total) => io.log(`Run ${done} of ${total} done.`));
  finished(dir, io);
}

async function resume(dir: string, flags: { yes: boolean; mock: boolean }, io: Io): Promise<void> {
  const { mock } = flags;
  const { study } = loadRun(dir).snapshot;
  if (mock && realAnswers(dir) > 0) throw new Error("This run has real answers, so --mock would mix fake replies into it.");
  if (!mock) {
    requireKeys(study);
    const cost = estimate(study, await loadPrices(study.seats));
    const left = Math.max(cost.calls - savedCalls(dir), 0);
    const share = (usd: number | null) => (usd === null ? null : (usd * left) / cost.calls);
    io.log(`Estimated ${left} calls left, ${money(share(cost.usdLow))} to ${money(share(cost.usdHigh))}. This is an estimate, not a quote.`);
    if (!flags.yes && !(await io.confirm("Continue?"))) {
      io.log("Stopped.");
      return;
    }
  }
  io.log("Resuming. Saved calls are reused and not paid for again.");
  await runStudy(study, dir, mock ? mockAsk : realAsk, mock ? mockSearch : runSearchBallot, (done, total) => io.log(`Run ${done} of ${total} done.`));
  finished(dir, io);
}

async function probe(dir: string, path: string, flags: { yes: boolean; mock: boolean }, io: Io): Promise<void> {
  const { snapshot, runs } = loadRun(dir);
  const { study } = snapshot;
  if (study.blind) throw new Error("Probes don't support blind runs yet.");
  if (runs.length < study.runs) throw new Error("This run isn't finished. Resume it first.");
  const probes = loadProbes(path);
  if (!flags.mock) requireKeys(study);
  const folder = `${probeFolder(dir, probes)}${flags.mock ? "-mock" : ""}`;
  mkdirSync(folder, { recursive: true });
  const ask = journalled(flags.mock ? mockAsk : realAsk, join(folder, "calls.jsonl"));
  const questions = await neutralise(study, probes, ask);
  for (const p of probes) io.log(`\n${p.id}${p.placebo ? " (placebo)" : ""}\n  You wrote: ${p.change}\n  Moderator: ${questions[p.id]}`);
  const calls = probeCalls(study, runs, probes, questions);
  if (!flags.mock) {
    const cost = estimateCalls(calls, await loadPrices(study.seats));
    io.log(`\nEstimated ${cost.calls} calls, ${money(cost.usdLow)} to ${money(cost.usdHigh)}. This is an estimate, not a quote.`);
    if (!flags.yes && !(await io.confirm("Continue with this wording?"))) {
      io.log("Stopped. Only the moderator's rewrites were paid for.");
      return;
    }
  }
  const ballots = await runProbeCalls(study, calls, ask);
  saveProbes(folder, ballots, renderProbeReport(study, runs, probes, questions, ballots));
  io.log(`Report: ${folder}/report.md`);
}

async function models(io: Io): Promise<void> {
  const res = await fetch("https://openrouter.ai/api/v1/models");
  const { data } = (await res.json()) as { data: { id: string }[] };
  const ids = data.map((m) => m.id).sort();
  for (const prefix of ["anthropic/", "google/", "openai/"]) io.log(`${prefix}\n  ${ids.filter((id) => id.startsWith(prefix)).join("\n  ")}`);
}

export async function main(argv: string[], io: Io): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { yes: { type: "boolean", default: false }, mock: { type: "boolean", default: false }, out: { type: "string", default: "runs" } },
  });
  const [command, first, second] = positionals;
  if (command === "init") {
    const folder = first ?? "focus-group-study";
    writeSample(folder);
    io.log(`Sample study written to ${folder}. Try it free with: llm-focus-group run ${folder}/study.yaml --mock`);
    return;
  }
  if (command === "demo") {
    const folder = join(mkdtempSync(join(tmpdir(), "llm-focus-group-")), "study");
    writeSample(folder);
    io.log("Demo with mock replies. No keys, no cost, and the answers are placeholders.");
    return run(join(folder, "study.yaml"), { yes: true, mock: true, out: values.out }, io);
  }
  if (command === "models") return models(io);
  if (command === "run" && first) return run(first, { yes: values.yes, mock: values.mock, out: values.out }, io);
  if (command === "resume" && first) return resume(first, { yes: values.yes, mock: values.mock }, io);
  if (command === "probe" && first && second) return probe(first, second, { yes: values.yes, mock: values.mock }, io);
  if (command === "diff" && first && second) {
    if (!values.mock) {
      io.log("Diff may make one small model call to match objections.");
      requireKeys(loadRun(second).snapshot.study);
    }
    io.log(await diffRuns(first, second, values.mock ? mockAsk : realAsk, { save: !values.mock }));
    return;
  }
  io.log(USAGE);
}

export async function confirmInTerminal(question: string, isTerminal: boolean, log: (line: string) => void): Promise<boolean> {
  if (!isTerminal) {
    log("There's no terminal to confirm in. Once the estimate is approved, run this again with --yes.");
    return false;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${question} [y/N] `);
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

const isMain = process.argv[1] !== undefined && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const io: Io = {
    log: console.log,
    confirm: (question) => confirmInTerminal(question, process.stdin.isTTY === true, console.log),
  };
  main(process.argv.slice(2), io).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
