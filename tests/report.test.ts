import { describe, expect, it } from "vitest";
import type { Objection } from "../src/ledger.js";
import { runSession, type RunRecord } from "../src/protocol.js";
import { mockAsk } from "../src/providers.js";
import { renderReport } from "../src/report.js";
import { candidate, study } from "./helpers.js";

const usage = { inputTokens: 1000, outputTokens: 200 };
const ledger: Objection[] = [
  { candidate: "Acme", objection: "No export", runsRaised: [0, 1], quote: "no export", materialSilent: true },
  { candidate: "Zed", objection: "Too dear", runsRaised: [0], quote: "too dear", materialSilent: false },
];
const session = async (over = {}) => {
  const s = study({ rounds: 1, ...over });
  const runs: RunRecord[] = [];
  for (let i = 0; i < s.runs; i++) runs.push(await runSession(s, i, mockAsk));
  return { s, runs };
};

describe("renderReport", () => {
  it("orders sections warnings, ledger, gaps, ballots, mind changes, transcripts", async () => {
    const { s, runs } = await session();
    const out = renderReport(s, runs, ledger, usage);
    const at = ["## Evidence warnings", "## Objections", "## Documentation gaps", "## Ballots (evidence)", "## Discussion effects", "## Transcripts"].map((h) => out.indexOf(h));
    expect(at.every((n) => n >= 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
  });
  it("labels single-candidate reports objection-finding only with no pick tallies", async () => {
    const { s, runs } = await session({ candidates: [candidate("Acme")] });
    const out = renderReport(s, runs, ledger, usage);
    expect(out).toContain("objection-finding only");
    expect(out).not.toContain("| Choice |");
  });
  it("hides mind changes in a single-candidate study", async () => {
    const { s, runs } = await session({ candidates: [candidate("Acme")] });
    runs[0]!.ballots.find((b) => b.stage === "round-1")!.label = "Other: Rival";
    expect(renderReport(s, runs, ledger, usage)).not.toContain("Other: Rival");
  });
  it("warns on fewer than 3 runs", async () => {
    const { s, runs } = await session({ runs: 2 });
    expect(renderReport(s, runs, ledger, usage)).toMatch(/Low evidence.*2 runs/);
  });
  it("warns on fewer than 2 providers", async () => {
    const seats = [{ name: "A", route: "openrouter" as const, model: "openai/a" }, { name: "B", route: "openrouter" as const, model: "openai/b" }];
    const { s, runs } = await session({ seats });
    expect(renderReport(s, runs, ledger, usage)).toMatch(/Low evidence.*1 provider/);
  });
  it("does not warn with 3 runs across providers", async () => {
    const seats = [{ name: "A", route: "anthropic" as const, model: "x" }, { name: "B", route: "openrouter" as const, model: "openai/b" }];
    const { s, runs } = await session({ seats });
    expect(renderReport(s, runs, ledger, usage)).not.toContain("Low evidence");
  });
  it("warns when objections were dropped", async () => {
    const { s, runs } = await session();
    expect(renderReport(s, runs, ledger, usage, [], 2)).toMatch(/2 objections were dropped/);
  });
  it("contains no winner line", async () => {
    const { s, runs } = await session();
    expect(renderReport(s, runs, ledger, usage).toLowerCase()).not.toContain("winner");
  });
  it("states blind masking may be incomplete", async () => {
    const { s, runs } = await session({ blind: true });
    expect(renderReport(s, runs, ledger, usage)).toContain("masking may be incomplete");
  });
  it("shows sample sizes in ballot tables", async () => {
    const { s, runs } = await session();
    expect(renderReport(s, runs, ledger, usage)).toContain("n=9");
  });
  it("lists gaps for a human to check, silent items only", async () => {
    const { s, runs } = await session();
    const gaps = renderReport(s, runs, ledger, usage).split("## Documentation gaps")[1]?.split("## Ballots")[0] ?? "";
    expect(gaps).toContain("No export");
    expect(gaps).not.toContain("Too dear");
    expect(gaps).toMatch(/check/i);
  });
  it("shows runs raised out of the total", async () => {
    const { s, runs } = await session();
    expect(renderReport(s, runs, ledger, usage)).toContain("2 of 3 runs");
  });
  it("logs a label change between ballots as a mind change", async () => {
    const { s, runs } = await session();
    const run = runs[0]!;
    const blind = run.ballots.find((b) => b.stage === "blind" && b.seat === "Claude")!;
    const round = run.ballots.find((b) => b.stage === "round-1" && b.seat === "Claude")!;
    blind.label = "Acme";
    round.label = "Zed";
    round.ballot.whatChangedIt = "GPT's point on price";
    expect(renderReport(s, runs, ledger, usage)).toContain("Run 1, Claude: Acme to Zed after round 1. GPT's point on price");
  });
  it("reports token usage", async () => {
    const { s, runs } = await session();
    expect(renderReport(s, runs, ledger, usage)).toContain("1000 input tokens");
  });
});
