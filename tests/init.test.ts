import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { main, type Io } from "../src/cli.js";
import { loadProbes } from "../src/probe.js";
import { loadStudy } from "../src/study.js";

let dir: string;
const io = () => { const lines: string[] = []; const value: Io = { log: (l) => lines.push(l), confirm: async () => false }; return { value, lines }; };
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "lfg-init-")); });

describe("init", () => {
  it("writes a sample study that loads", async () => {
    await main(["init", join(dir, "s")], io().value);
    const s = loadStudy(join(dir, "s/study.yaml"));
    expect(s.candidates.length).toBe(2);
    expect(s.runs).toBe(3);
    expect(s.rounds).toBe(2);
  });
  it("writes sample probes with a placebo", async () => {
    await main(["init", join(dir, "s")], io().value);
    expect(loadProbes(join(dir, "s/probes.yaml")).some((p) => p.placebo)).toBe(true);
  });
  it("needs only OPENROUTER_API_KEY", async () => {
    await main(["init", join(dir, "s")], io().value);
    expect(loadStudy(join(dir, "s/study.yaml")).seats.every((s) => s.route === "openrouter")).toBe(true);
  });
  it("refuses to overwrite", async () => {
    await main(["init", join(dir, "s")], io().value);
    await expect(main(["init", join(dir, "s")], io().value)).rejects.toThrow(/already exists/);
  });
});

describe("demo", () => {
  it("produces a report with no keys", async () => {
    delete process.env.OPENROUTER_API_KEY;
    await main(["demo", "--out", join(dir, "runs")], io().value);
    const [run] = readdirSync(join(dir, "runs"));
    expect(existsSync(join(dir, "runs", run!, "report.md"))).toBe(true);
    expect(readFileSync(join(dir, "runs", run!, "report.md"), "utf8")).toContain("Northdesk");
  });
});

describe("models", () => {
  it("lists openai and google IDs", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ data: [{ id: "openai/a" }, { id: "google/b" }, { id: "x/c" }] })));
    const t = io();
    await main(["models"], t.value);
    vi.unstubAllGlobals();
    expect(t.lines.join("\n")).toContain("openai/a");
    expect(t.lines.join("\n")).toContain("google/b");
    expect(t.lines.join("\n")).not.toContain("x/c");
  });
});

describe("skill", () => {
  it("lets an agent finish a run once the user has approved the estimate", () => {
    const skill = readFileSync("skills/llm-focus-group/SKILL.md", "utf8");
    expect(skill).toMatch(/--yes` only after/);
    expect(skill).not.toMatch(/Never pass/);
  });
});
