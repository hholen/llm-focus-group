import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { main, type Io } from "../src/cli.js";
import { loadProbes, neutralise, probeCalls, renderProbeReport, runProbeCalls, type Probe, type ProbeBallot } from "../src/probe.js";
import { mockAsk, type Ask } from "../src/providers.js";
import { createRunDir, loadRun, runStudy } from "../src/runs.js";
import { mockSearch } from "../src/search.js";
import { study } from "./helpers.js";

const probes: Probe[] = [
  { id: "cap-500", change: "Pro now holds 500 assets.", placebo: false },
  { id: "cap-260", change: "Pro now holds 260 assets.", placebo: true },
];
const s = study({ rounds: 1, runs: 2 });
const text = (t: string) => ({ text: t, usage: { inputTokens: 1, outputTokens: 1 } });
let root: string;
const finished = async () => {
  const dir = createRunDir(s, root);
  await runStudy(s, dir, mockAsk, mockSearch);
  return dir;
};
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "lfg-probe-")); });

describe("loadProbes", () => {
  const write = (body: object) => { const p = join(root, "p.yaml"); writeFileSync(p, JSON.stringify(body)); return p; };
  it("loads probes", () => {
    expect(loadProbes(write({ probes: [{ id: "a", change: "x" }, { id: "b", change: "y", placebo: true }] }))[1]?.placebo).toBe(true);
  });
  it("requires a placebo", () => {
    expect(() => loadProbes(write({ probes: [{ id: "a", change: "x" }] }))).toThrow(/placebo/);
  });
  it("requires a real probe", () => {
    expect(() => loadProbes(write({ probes: [{ id: "a", change: "x", placebo: true }] }))).toThrow(/real probe/);
  });
  it("rejects duplicate ids", () => {
    expect(() => loadProbes(write({ probes: [{ id: "a", change: "x" }, { id: "a", change: "y", placebo: true }] }))).toThrow(/same id/);
  });
});

describe("neutralise", () => {
  it("asks the moderator once per probe", async () => {
    const ask = vi.fn<Ask>(mockAsk);
    const out = await neutralise(s, probes, ask);
    expect(ask).toHaveBeenCalledTimes(2);
    expect(Object.keys(out)).toEqual(["cap-500", "cap-260"]);
  });
  it("rejects a rewrite that changes a number", async () => {
    const ask: Ask = async () => text('{"question":"What if Pro held 600 assets?"}');
    await expect(neutralise(s, probes, ask)).rejects.toThrow(/cap-500/);
  });
  it("retries a rejected rewrite once", async () => {
    let n = 0;
    const ask: Ask = async () => text(n++ ? '{"question":"If Pro held 500 assets, would your pick change?"}' : '{"question":"Wow, 900!"}');
    expect((await neutralise(s, [probes[0]!], ask))["cap-500"]).toContain("500");
  });
  it("tells the moderator to keep facts and stay neutral", async () => {
    const ask = vi.fn<Ask>(mockAsk);
    await neutralise(s, [probes[0]!], ask);
    expect(ask.mock.calls[0]?.[2]).toMatch(/neutral/i);
    expect(ask.mock.calls[0]?.[2]).toContain("Pro now holds 500 assets.");
  });
});

describe("probeCalls", () => {
  it("makes one ballot per run, seat and probe", async () => {
    const { snapshot, runs } = loadRun(await finished());
    expect(probeCalls(snapshot.study, runs, probes, { "cap-500": "Q1?", "cap-260": "Q2?" }).length).toBe(12);
  });
  it("gives every model the same wording", async () => {
    const { snapshot, runs } = loadRun(await finished());
    const calls = probeCalls(snapshot.study, runs, probes, { "cap-500": "Neutral one?", "cap-260": "Q2?" }).filter((c) => c.probeId === "cap-500");
    expect(calls.every((c) => c.prompt.includes("Neutral one?"))).toBe(true);
  });
  it("branches each probe from the saved discussion, never from another probe", async () => {
    const { snapshot, runs } = loadRun(await finished());
    const calls = probeCalls(snapshot.study, runs, probes, { "cap-500": "Neutral one?", "cap-260": "Second?" });
    expect(calls.filter((c) => c.probeId === "cap-260").some((c) => c.prompt.includes("Neutral one?"))).toBe(false);
    expect(calls[0]?.prompt).toContain("Discussion so far");
    expect(calls[0]?.prompt).toContain("Your previous ballot");
  });
  it("keeps the run's product order", async () => {
    const { snapshot, runs } = loadRun(await finished());
    const call = probeCalls(snapshot.study, runs, probes, { "cap-500": "Q?", "cap-260": "Q?" }).find((c) => c.run === 1);
    expect(call?.prompt.indexOf("===== Zed")).toBeLessThan(call?.prompt.indexOf("===== Acme") ?? 0);
  });
  it("never tells a model a probe is the placebo", async () => {
    const { snapshot, runs } = loadRun(await finished());
    const calls = probeCalls(snapshot.study, runs, probes, { "cap-500": "Q?", "cap-260": "Q?" });
    expect(calls.some((c) => /placebo/i.test(c.prompt))).toBe(false);
  });
});

describe("renderProbeReport", () => {
  const b = (probeId: string, seat: string, label: string, over = {}): ProbeBallot => ({ probeId, run: 0, seat, label, reasoning: "r", whatChangedIt: "", newConcern: "", ...over });
  const render = async (ballots: ProbeBallot[]) => {
    const { snapshot, runs } = loadRun(await finished());
    for (const x of runs[0]!.ballots) if (x.stage === "round-1") x.label = "Zed";
    return renderProbeReport(snapshot.study, runs, probes, { "cap-500": "Neutral?", "cap-260": "Other?" }, ballots);
  };
  it("shows original and neutral wording", async () => {
    const out = await render([]);
    expect(out).toContain("Pro now holds 500 assets.");
    expect(out).toContain("Neutral?");
  });
  it("counts moved picks against the saved final ballot", async () => {
    expect(await render([b("cap-500", "Claude", "Acme"), b("cap-500", "GPT", "Zed")])).toMatch(/cap-500[^\n]*1 of 2/);
  });
  it("marks a probe that moved no more than the placebo", async () => {
    const out = await render([b("cap-500", "Claude", "Acme"), b("cap-260", "Claude", "Acme")]);
    expect(out).toMatch(/cap-500[^\n]*not above placebo/);
  });
  it("marks a probe above the placebo", async () => {
    const out = await render([b("cap-500", "Claude", "Acme"), b("cap-260", "Claude", "Zed")]);
    expect(out).toMatch(/cap-500[^\n]*above placebo/);
    expect(out).not.toMatch(/cap-500[^\n]*not above placebo/);
  });
  it("lists new concerns", async () => {
    expect(await render([b("cap-500", "Claude", "Zed", { newConcern: "Depends on support" })])).toContain("Depends on support");
  });
  it("says a probe is screening, not proof", async () => {
    expect(await render([])).toMatch(/screening/i);
  });
});

describe("probe command", () => {
  const io = (answer = true) => { const lines: string[] = []; const confirm = vi.fn(async () => answer); const value: Io = { log: (l) => lines.push(l), confirm }; return { value, lines, confirm }; };
  const file = () => { const p = join(root, "probes.yaml"); writeFileSync(p, JSON.stringify({ probes })); return p; };
  it("writes a report under the run folder", async () => {
    const dir = await finished();
    await main(["probe", dir, file(), "--mock"], io().value);
    const [set] = readdirSync(join(dir, "probes"));
    expect(existsSync(join(dir, "probes", set!, "report.md"))).toBe(true);
    expect(readFileSync(join(dir, "probes", set!, "report.md"), "utf8")).toContain("cap-500");
  });
  it("shows the wording and stops unless confirmed", async () => {
    process.env.OPENROUTER_API_KEY = "k";
    process.env.ANTHROPIC_API_KEY = "k";
    const dir = await finished();
    const fetchStub = vi.fn(async (_url: string, init?: RequestInit) => {
      const n = String(init?.body).includes("500 assets") ? 500 : 260;
      return new Response(JSON.stringify({ content: [{ type: "text", text: `{"question":"If Pro held ${n} assets, would your pick change?"}` }], data: [] }));
    });
    vi.stubGlobal("fetch", fetchStub);
    const t = io(false);
    await main(["probe", dir, file()], t.value);
    vi.unstubAllGlobals();
    expect(t.confirm).toHaveBeenCalledOnce();
    expect(t.lines.join("\n")).toContain("If Pro held 500");
    expect(t.lines.join("\n")).toMatch(/Estimated.*calls/);
  });
  it("reuses saved answers when run again", async () => {
    const dir = await finished();
    await main(["probe", dir, file(), "--mock"], io().value);
    const [set] = readdirSync(join(dir, "probes"));
    const before = readFileSync(join(dir, "probes", set!, "calls.jsonl"), "utf8");
    await main(["probe", dir, file(), "--mock"], io().value);
    expect(readFileSync(join(dir, "probes", set!, "calls.jsonl"), "utf8")).toBe(before);
  });
  it("refuses a blind run", async () => {
    const blind = { ...s, blind: true };
    const dir = createRunDir(blind, root);
    await runStudy(blind, dir, mockAsk, mockSearch);
    await expect(main(["probe", dir, file(), "--mock"], io().value)).rejects.toThrow(/blind/i);
  });
});
