import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockAsk } from "../src/providers.js";
import { createRunDir, loadRun, runStudy } from "../src/runs.js";
import { mockSearch, runSearchBallot, searchReport, type SearchResult } from "../src/search.js";
import type { Seat } from "../src/types.js";
import { candidate, study } from "./helpers.js";

const claude: Seat = { name: "Claude", route: "anthropic", model: "claude-x" };
const gpt: Seat = { name: "GPT", route: "openrouter", model: "o" };
const page = (over: object) => new Response(JSON.stringify({ stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 5, server_tool_use: { web_search_requests: 1 } }, content: [], ...over }));
const blocks = [
  { type: "server_tool_use", input: { query: "asset tracking" } },
  { type: "web_search_tool_result", content: [{ url: "https://www.acme.io/x" }, { url: "https://capterra.com/y" }] },
  { type: "text", text: 'I choose.\n{"choice": "Acme", "runner_up": "Zed", "confidence": 70, "reasoning": "r"}', citations: [{ url: "https://www.acme.io/x" }] },
];
const stub = (...pages: Response[]) => {
  const fn = vi.fn(async (_u: string, _i: RequestInit) => pages.shift() as Response);
  vi.stubGlobal("fetch", fn);
  return fn;
};
const base = study({ seats: [claude, gpt], rounds: 1, runs: 1 });

beforeEach(() => { process.env.ANTHROPIC_API_KEY = "k"; });
afterEach(() => vi.unstubAllGlobals());

describe("runSearchBallot", () => {
  it("collects queries, urls and citations", async () => {
    stub(page({ content: blocks }));
    const r = await runSearchBallot(base, 0, claude);
    expect(r?.queries).toEqual(["asset tracking"]);
    expect(r?.urls).toContain("https://capterra.com/y");
    expect(r?.cited).toEqual(["https://www.acme.io/x"]);
    expect(r?.label).toBe("Acme");
    expect(r?.searches).toBe(1);
  });
  it("continues on pause_turn", async () => {
    const fn = stub(page({ stop_reason: "pause_turn", content: [blocks[0]] }), page({ content: blocks }));
    const r = await runSearchBallot(base, 0, claude);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(r?.searches).toBe(2);
  });
  it("records no ballot rather than crashing", async () => {
    stub(page({ content: [{ type: "text", text: "no json here" }] }), page({ content: [{ type: "text", text: "still none" }] }));
    const r = await runSearchBallot(base, 0, claude);
    expect(r?.label).toBe("No ballot");
  });
  it("retries once when the first reply has no ballot", async () => {
    const fn = stub(page({ content: [{ type: "text", text: "no json" }] }), page({ content: blocks }));
    const r = await runSearchBallot(base, 0, claude);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(r.label).toBe("Acme");
    expect(r.usage.inputTokens).toBe(20);
  });
  it("sends no material", async () => {
    const fn = stub(page({ content: blocks }));
    await runSearchBallot(base, 0, claude);
    expect(fn.mock.calls[0]?.[1].body).not.toContain("Acme docs");
  });
});

describe("searchReport", () => {
  const r = (over: Partial<SearchResult>): SearchResult => ({ model: "m", run: 0, choice: "Acme", label: "Acme", queries: [], urls: [], cited: [], searches: 1, usage: { inputTokens: 0, outputTokens: 0 }, ...over });
  const s = study({ candidates: [{ ...candidate("Acme"), domains: ["acme.io"] }, candidate("Big Zed")] });
  it("shows appearance, cited and picked counts per candidate", () => {
    const out = searchReport(s, [r({ urls: ["https://www.acme.io/a"], cited: ["https://acme.io/a"] }), r({ label: "Other: X", urls: ["https://bigzed.com"] })]);
    expect(out).toContain("| Acme | 1 of 2 | 1 of 2 | 1 of 2 |");
    expect(out).toContain("| Big Zed | 1 of 2 | 0 of 2 | 0 of 2 |");
  });
  it("does not count a review page mentioning a listed domain's product", () => {
    expect(searchReport(s, [r({ urls: ["https://capterra.com/acme-review"] })])).toContain("| Acme | 0 of 1 |");
  });
  it("hides picks in a single-candidate study", () => {
    const out = searchReport(study({ candidates: [candidate("Acme")] }), [r({})]);
    expect(out).not.toContain("Picked");
    expect(out).not.toContain("Other picks");
  });
  it("lists top domains and queries", () => {
    const out = searchReport(s, [r({ urls: ["https://capterra.com/a"], queries: ["best tool"] })]);
    expect(out).toContain("capterra.com: 1");
    expect(out).toContain("best tool");
  });
  it("says only Anthropic models searched", () => {
    expect(searchReport(s, [r({})])).toMatch(/Anthropic/);
  });
});

describe("runStudy with search", () => {
  const root = () => mkdtempSync(join(tmpdir(), "lfg-search-"));
  it("is off by default", async () => {
    const dir = createRunDir(base, root());
    await runStudy(base, dir, mockAsk, mockSearch);
    expect(existsSync(join(dir, "search.json"))).toBe(false);
    expect(readFileSync(join(dir, "report.md"), "utf8")).not.toContain("## Search ballot");
  });
  it("adds a section when on", async () => {
    const s = { ...base, searchBallot: true };
    const dir = createRunDir(s, root());
    await runStudy(s, dir, mockAsk, mockSearch);
    expect(readFileSync(join(dir, "report.md"), "utf8")).toContain("## Search ballot");
    expect(loadRun(dir).search.length).toBe(1);
  });
  it("keeps one seat's finished search when another fails", async () => {
    const seats = [claude, { ...claude, name: "Opus", model: "claude-y" }];
    const s = { ...base, seats, searchBallot: true };
    const dir = createRunDir(s, root());
    const first = vi.fn(async (st: typeof s, run: number, seat: Seat) => {
      if (seat.name === "Opus") throw new Error("429");
      return mockSearch(st, run, seat);
    });
    await expect(runStudy(s, dir, mockAsk, first)).rejects.toThrow("429");
    const second = vi.fn(mockSearch);
    await runStudy(s, dir, mockAsk, second);
    expect(second).toHaveBeenCalledTimes(1);
  });
  it("does not repeat finished searches on resume", async () => {
    const s = { ...base, searchBallot: true };
    const dir = createRunDir(s, root());
    await runStudy(s, dir, mockAsk, mockSearch);
    const again = vi.fn(mockSearch);
    await runStudy(s, dir, mockAsk, again);
    expect(again).not.toHaveBeenCalled();
  });
});
