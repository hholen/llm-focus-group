import { mkdtempSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { diffRuns } from "../src/diff.js";
import type { Objection } from "../src/ledger.js";
import { runSession, type RunRecord } from "../src/protocol.js";
import { mockAsk, type Ask } from "../src/providers.js";
import { createRunDir } from "../src/runs.js";
import type { Study } from "../src/types.js";
import { study } from "./helpers.js";

let root: string;
const o = (objection: string, count: number, candidate = "Acme"): Objection => ({ candidate, objection, runsRaised: Array.from({ length: count }, (_, i) => i), quote: "q", materialSilent: false });
const make = async (s: Study, ledger: Objection[], tweak?: (r: RunRecord) => void) => {
  const dir = createRunDir(s, root);
  const runs: RunRecord[] = [];
  for (let i = 0; i < s.runs; i++) {
    const r = await runSession(s, i, mockAsk);
    tweak?.(r);
    runs.push(r);
  }
  writeFileSync(join(dir, "results.json"), JSON.stringify({ runs, ledger }));
  return dir;
};
const five = study({ rounds: 1, runs: 5 });
const edited = { ...five, candidates: five.candidates.map((c) => (c.name === "Acme" ? { ...c, material: "--- about.md ---\nnew" } : c)) };

beforeEach(() => { root = mkdtempSync(join(tmpdir(), "lfg-diff-")); });

describe("diffRuns", () => {
  it("lists changed material", async () => {
    const changed = { ...five, candidates: five.candidates.map((c) => (c.name === "Acme" ? { ...c, material: "--- about.md ---\nnew" } : c)) };
    const out = await diffRuns(await make(five, []), await make(changed, []), mockAsk);
    expect(out).toContain("Acme: about.md");
    expect(out).not.toContain("Zed: about.md");
  });
  it("calls 4 of 5 to 1 of 5 a clear change", async () => {
    const out = await diffRuns(await make(five, [o("No export", 4)]), await make(edited, [o("No export", 1)]), mockAsk);
    expect(out).toMatch(/clear change.*No export.*4 of 5.*1 of 5/s);
  });
  it("calls 2 of 5 to 1 of 5 within likely noise", async () => {
    const out = await diffRuns(await make(five, [o("No export", 2)]), await make(five, [o("No export", 1)]), mockAsk);
    expect(out).toMatch(/within likely noise.*No export/s);
    expect(out).not.toMatch(/clear change[^#]*No export/);
  });
  it("compares unequal run counts by rate", async () => {
    const small = { ...edited, runs: 2 };
    const out = await diffRuns(await make(five, [o("No export", 5)]), await make(small, [o("No export", 1)]), mockAsk);
    expect(out).toMatch(/clear change[^#]*5 of 5.*1 of 2/s);
  });
  it("puts moves on unchanged products in the noise baseline, not clear change", async () => {
    const out = await diffRuns(await make(five, [o("Pricey", 3, "Zed"), o("Calm", 2, "Zed")]), await make(edited, [o("Pricey", 0, "Zed"), o("Calm", 2, "Zed")]), mockAsk);
    expect(out.split("## Noise baseline")[0]).not.toContain("Pricey");
    expect(out.split("## Noise baseline")[1]).toContain("Pricey");
    expect(out).toContain("1 of 2 objections about unchanged products moved");
  });
  it("counts new objections on unchanged products in the baseline", async () => {
    const out = await diffRuns(await make(five, []), await make(edited, [o("Sudden", 5, "Zed")]), mockAsk);
    expect(out.split("## Noise baseline")[1]?.split("##")[0]).toContain("Sudden");
  });
  it("says there is no baseline when every candidate changed", async () => {
    const all = { ...five, candidates: five.candidates.map((c) => ({ ...c, material: "--- about.md ---\nnew" })) };
    expect(await diffRuns(await make(five, []), await make(all, []), mockAsk)).toContain("No baseline");
  });
  it("treats identical material as all baseline", async () => {
    const out = await diffRuns(await make(five, [o("Thing", 4)]), await make(five, [o("Thing", 1)]), mockAsk);
    expect(out.split("## Noise baseline")[0]).not.toContain("Thing");
  });
  it("lists new, gone and persisted objections", async () => {
    const out = await diffRuns(await make(five, [o("Old", 3), o("Both", 3)]), await make(five, [o("Fresh", 3), o("Both", 3)]), mockAsk);
    expect(out).toMatch(/## Objections gone[^#]*Old/);
    expect(out).toMatch(/## New objections[^#]*Fresh/);
    expect(out).toMatch(/## Objections that persisted[^#]*Both/);
  });
  it("uses a model to match differently worded objections", async () => {
    const ask: Ask = async () => ({ text: JSON.stringify({ matches: [[0, 0]] }), usage: { inputTokens: 0, outputTokens: 0 } });
    const out = await diffRuns(await make(five, [o("No CSV export", 3)]), await make(five, [o("Export is missing", 3)]), ask);
    expect(out).toMatch(/persisted[^#]*No CSV export/);
    expect(out).not.toMatch(/## Objections gone\n\n- Acme/);
  });
  it("makes no model call when wording already matches", async () => {
    const ask: Ask = async () => { throw new Error("should not be called"); };
    await expect(diffRuns(await make(five, [o("Same", 2)]), await make(five, [o("Same", 2)]), ask)).resolves.toBeTruthy();
  });
  it("shows control ballots beside ballot changes", async () => {
    const out = await diffRuns(await make(five, []), await make(five, []), mockAsk);
    expect(out).toMatch(/\| Stage/);
    expect(out).toContain("No discussion (control)");
    expect(out).toContain("/15");
  });
  it("warns but still runs when setup differs", async () => {
    const other = { ...five, rounds: 1, seats: five.seats.map((s, i) => (i === 0 ? { ...s, model: "new-model" } : i === 1 ? { ...s, route: "anthropic" as const } : s)) };
    const out = await diffRuns(await make(five, []), await make(other, []), mockAsk);
    expect(out).toMatch(/model/i);
    expect(out).toMatch(/route/i);
    expect(out).toContain("## Ballots");
  });
  it("warns when candidates or rounds differ", async () => {
    const other = study({ rounds: 2, runs: 5, candidates: [five.candidates[0]!] });
    const out = await diffRuns(await make(five, []), await make(other, []), mockAsk);
    expect(out).toMatch(/rounds/i);
    expect(out).toMatch(/candidates/i);
  });
  it("hides ballots when both runs have one candidate", async () => {
    const one = study({ rounds: 1, runs: 2, candidates: [five.candidates[0]!] });
    const out = await diffRuns(await make(one, []), await make(one, []), mockAsk);
    expect(out).not.toContain("| Stage");
    expect(out).toContain("single-candidate");
  });
  it("never says a change worked", async () => {
    const out = (await diffRuns(await make(five, [o("X", 5)]), await make(five, []), mockAsk)).toLowerCase();
    for (const word of ["worked", "improved", "better", "fixed", "success"]) expect(out).not.toContain(word);
  });
  it("writes diff.md into run B's folder", async () => {
    const b = await make(five, []);
    await diffRuns(await make(five, []), b, mockAsk);
    expect(existsSync(join(b, "diff.md"))).toBe(true);
  });
});
