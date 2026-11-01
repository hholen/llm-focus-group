import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findLeak, maskStudy } from "../src/blind.js";
import { mockAsk, type Ask } from "../src/providers.js";
import { createRunDir, loadRun, runStudy } from "../src/runs.js";
import { candidate, study } from "./helpers.js";

const named = (...names: string[]) => study({ blind: true, rounds: 1, runs: 1, candidates: names.map(candidate) });

describe("maskStudy", () => {
  it("replaces names with Product A, Product B", () => {
    const { study: masked, labels } = maskStudy(named("Acme", "Zed"));
    expect(masked.candidates.map((c) => c.name)).toEqual(["Product A", "Product B"]);
    expect(masked.candidates[0]?.material).toBe("--- about.md ---\nProduct A docs");
    expect(labels.get("Acme")).toBe("Product A");
  });
  it("masks the longest name first", () => {
    const { study: masked } = maskStudy({ ...named("Blue", "Blue-Box"), scenario: "Compare Blue-Box." });
    expect(masked.scenario).toBe("Compare Product B.");
  });
  it("is case-insensitive", () => {
    const { study: masked } = maskStudy({ ...named("Acme"), scenario: "ACME and acme." });
    expect(masked.scenario).toBe("Product A and Product A.");
  });
  it("leaves a name inside a longer word alone", () => {
    const { study: masked } = maskStudy({ ...named("Sage"), scenario: "Send a message to Sage." });
    expect(masked.scenario).toBe("Send a message to Product A.");
  });
  it("masks the name written without spaces or hyphens, as in domains", () => {
    const { study: masked } = maskStudy({ ...named("Red Fox"), scenario: "See redfox.com" });
    expect(masked.scenario).toBe("See Product A.com");
  });
});

describe("findLeak", () => {
  const { labels } = maskStudy(named("Acme", "Zed"));
  it("finds a masked name", () => expect(findLeak("Other: Acme", labels)).toBe("Acme"));
  it("does not flag a name inside a longer word", () => {
    expect(findLeak("Other: Message boards", maskStudy(named("Sage")).labels)).toBeNull();
  });
  it("returns null without one", () => expect(findLeak("Other: Reftab", labels)).toBeNull());
});

describe("blind runs", () => {
  const run = async (ask: Ask) => {
    const s = named("Acme", "Zed");
    const dir = createRunDir(s, mkdtempSync(join(tmpdir(), "lfg-blind-")));
    await runStudy(s, dir, ask);
    return dir;
  };
  it("sends no real names to models", async () => {
    const seen: string[] = [];
    await run((seat, system, prompt) => { seen.push(prompt); return mockAsk(seat, system, prompt); });
    expect(seen.join("\n")).not.toMatch(/Acme|Zed/);
  });
  it("counts ballots under real names", async () => {
    const { runs } = loadRun(await run(mockAsk));
    expect(runs[0]?.ballots.filter((b) => b.stage === "blind").every((b) => ["Acme", "Zed"].includes(b.label))).toBe(true);
  });
  it("flags a ballot naming a masked product and counts it as that candidate", async () => {
    const leaky: Ask = async (seat, s, p) => {
      if (p.includes("exactly one of")) return { text: '{"choice":"Other: Acme"}', usage: { inputTokens: 0, outputTokens: 0 } };
      return mockAsk(seat, s, p);
    };
    const dir = await run(leaky);
    const ballot = loadRun(dir).runs[0]?.ballots.find((b) => b.stage === "blind");
    expect(ballot?.label).toBe("Acme");
    expect(ballot?.leak).toBe(true);
    expect(readFileSync(join(dir, "report.md"), "utf8")).toMatch(/Blinding leak/);
  });
  it("runs the unprompted ballot identically and matches real names", async () => {
    const answers: Ask = async (seat, s, p) => {
      if (p.includes("Which tool do you pick?")) return { text: '{"choice":"Acme, probably"}', usage: { inputTokens: 0, outputTokens: 0 } };
      return mockAsk(seat, s, p);
    };
    const ballot = loadRun(await run(answers)).runs[0]?.ballots.find((b) => b.stage === "unprompted");
    expect(ballot?.label).toBe("Acme");
    expect(ballot?.leak).toBeUndefined();
  });
  it("reports objections under real names", async () => {
    const { ledger } = loadRun(await run(mockAsk));
    expect(ledger.map((o) => o.candidate)).toEqual(["Acme", "Zed"]);
  });
});
