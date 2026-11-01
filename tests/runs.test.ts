import { appendFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { callsPerRun } from "../src/protocol.js";
import { mockAsk, type Ask } from "../src/providers.js";
import { createRunDir, journalled, loadRun, runStudy, savedCalls } from "../src/runs.js";
import { study } from "./helpers.js";

let root: string;
const small = study({ rounds: 1, runs: 2 });
const counting = (fail?: number) => {
  const state = { calls: 0 };
  const ask: Ask = (seat, system, prompt) => {
    state.calls++;
    if (fail !== undefined && state.calls > fail) return Promise.reject(new Error("provider down"));
    return mockAsk(seat, system, prompt);
  };
  return { ask, state };
};
const seat = small.seats[0]!;

beforeEach(() => { root = mkdtempSync(join(tmpdir(), "lfg-runs-")); });

describe("snapshot", () => {
  it("stores material, scenario, model IDs, routes and hash", () => {
    const { snapshot } = loadRun(createRunDir(small, root));
    expect(snapshot.study.candidates[0]?.material).toContain("Acme docs");
    expect(snapshot.study.scenario).toBe(small.scenario);
    expect(snapshot.study.seats[0]).toEqual({ name: "Claude", route: "anthropic", model: "c" });
    expect(snapshot.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(snapshot.createdAt).toMatch(/^\d{4}-/);
  });
  it("gives the same inputs the same hash", () => {
    const a = loadRun(createRunDir(small, root)).snapshot.contentHash;
    const b = loadRun(createRunDir({ ...small, candidates: small.candidates.map((c) => ({ ...c, materialDir: "/elsewhere" })) }, root)).snapshot.contentHash;
    expect(a).toBe(b);
  });
  it("gives changed material a different hash", () => {
    const changed = { ...small, candidates: small.candidates.map((c) => ({ ...c, material: "new" })) };
    expect(loadRun(createRunDir(small, root)).snapshot.contentHash).not.toBe(loadRun(createRunDir(changed, root)).snapshot.contentHash);
  });
});

describe("journalled", () => {
  it("keeps repeated identical prompts distinct", async () => {
    const path = join(root, "calls.jsonl");
    let n = 0;
    const ask: Ask = async () => ({ text: `reply ${++n}`, usage: { inputTokens: 1, outputTokens: 1 } });
    const first = journalled(ask, path);
    await first(seat, "s", "p");
    await first(seat, "s", "p");
    const again = journalled(ask, path);
    expect((await again(seat, "s", "p")).text).toBe("reply 1");
    expect((await again(seat, "s", "p")).text).toBe("reply 2");
    expect(n).toBe(2);
  });
  it("repeats only the call on a broken last line", async () => {
    const path = join(root, "calls.jsonl");
    const c = counting();
    await journalled(c.ask, path)(seat, "s", "one");
    await journalled(c.ask, path)(seat, "s", "two");
    writeFileSync(path, readFileSync(path, "utf8").slice(0, -20));
    const c2 = counting();
    const resumed = journalled(c2.ask, path);
    await resumed(seat, "s", "one");
    await resumed(seat, "s", "two");
    expect(c2.state.calls).toBe(1);
    const c3 = counting();
    const third = journalled(c3.ask, path);
    await third(seat, "s", "one");
    await third(seat, "s", "two");
    expect(c3.state.calls).toBe(0);
  });
});

describe("journal safety", () => {
  it("never replays mock replies as real ones", async () => {
    const path = join(root, "calls.jsonl");
    await journalled(mockAsk, path)(seat, "s", "p");
    const real = counting();
    await journalled(real.ask, path)(seat, "s", "p");
    expect(real.state.calls).toBe(1);
  });
  it("counts paid replies that failed validation in usage", async () => {
    const dir = createRunDir(small, root);
    const ask: Ask = async () => ({ text: "bad", usage: { inputTokens: 7, outputTokens: 3 } });
    await journalled(ask, join(dir, "calls.jsonl"))(seat, "s", "p", { valid: () => false });
    expect(loadRun(dir).usage).toEqual({ inputTokens: 7, outputTokens: 3 });
    expect(savedCalls(dir)).toBe(0);
  });
  it("counts finished searches as saved calls", async () => {
    const dir = createRunDir(small, root);
    writeFileSync(join(dir, "search.json"), JSON.stringify([{ usage: { inputTokens: 0, outputTokens: 0 } }]));
    expect(savedCalls(dir)).toBe(1);
  });
  it("marks a run unfinished until the ledger is saved", async () => {
    const dir = createRunDir(small, root);
    const bad: Ask = (s, y, p) => (p.includes("EXTRACT OBJECTIONS") ? Promise.reject(new Error("down")) : mockAsk(s, y, p));
    await expect(runStudy(small, dir, bad)).rejects.toThrow("down");
    expect(loadRun(dir).finished).toBe(false);
    await runStudy(small, dir, mockAsk);
    expect(loadRun(dir).finished).toBe(true);
  });
});

describe("runStudy", () => {
  it("reports progress after each run", async () => {
    const seen: string[] = [];
    await runStudy(small, createRunDir(small, root), counting().ask, undefined, (done, total) => seen.push(`${done}/${total}`));
    expect(seen).toEqual(["1/2", "2/2"]);
  });
  it("saves results and usage", async () => {
    const dir = createRunDir(small, root);
    const runs = await runStudy(small, dir, counting().ask);
    const loaded = loadRun(dir);
    expect(runs.length).toBe(2);
    expect(loaded.runs.length).toBe(2);
    expect(loaded.usage.inputTokens).toBeGreaterThan(0);
  });
  it("replays journalled calls on resume without calling ask", async () => {
    const dir = createRunDir(small, root);
    await runStudy(small, dir, counting().ask);
    const again = counting();
    await runStudy(small, dir, again.ask);
    expect(again.state.calls).toBe(0);
  });
  it("leaves a resumable folder and a readable error on provider failure", async () => {
    const dir = createRunDir(small, root);
    const failing = counting(10);
    await expect(runStudy(small, dir, failing.ask)).rejects.toThrow(/provider down/);
    await new Promise((done) => setTimeout(done, 10));
    const paid = readFileSync(join(dir, "calls.jsonl"), "utf8").trim().split("\n").length;
    const resumed = counting();
    await runStudy(small, dir, resumed.ask);
    expect(resumed.state.calls).toBe(callsPerRun(3, 1) * 2 + 1 - paid);
  });
  it("never saves an invalid reply, so resume can recover", async () => {
    const dir = createRunDir(small, root);
    const bad: Ask = (seat, system, prompt) => (prompt.includes("EXTRACT OBJECTIONS") ? Promise.resolve({ text: "cut off", usage: { inputTokens: 1, outputTokens: 1 } }) : mockAsk(seat, system, prompt));
    await expect(runStudy(small, dir, bad)).rejects.toThrow(/ledger/);
    const good = counting();
    await runStudy(small, dir, good.ask);
    expect(good.state.calls).toBe(1);
  });
  it("reads a damaged results file as empty", () => {
    const dir = createRunDir(small, root);
    writeFileSync(join(dir, "results.json"), '{"runs":[');
    expect(loadRun(dir).runs).toEqual([]);
  });
  it("ignores stray text after a crash mid-line", async () => {
    const dir = createRunDir(small, root);
    await runStudy(small, dir, counting().ask);
    appendFileSync(join(dir, "calls.jsonl"), '{"key":"abc","rep');
    expect(() => journalled(counting().ask, join(dir, "calls.jsonl"))).not.toThrow();
  });
});
