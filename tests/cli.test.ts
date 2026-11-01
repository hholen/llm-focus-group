import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { main, type Io } from "../src/cli.js";

let dir: string;
let yaml: string;
const io = (answer = false) => {
  const lines: string[] = [];
  const confirm = vi.fn(async () => answer);
  const value: Io = { log: (l) => lines.push(l), confirm };
  return { value, lines, confirm };
};
const runDirs = () => readdirSync(join(dir, "runs"));

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "lfg-cli-"));
  mkdirSync(join(dir, "m/a"), { recursive: true });
  mkdirSync(join(dir, "m/b"), { recursive: true });
  writeFileSync(join(dir, "m/a/a.md"), "a docs");
  writeFileSync(join(dir, "m/b/b.md"), "b docs");
  writeFileSync(join(dir, "s.md"), "Pick.");
  yaml = join(dir, "study.yaml");
  writeFileSync(yaml, JSON.stringify({
    scenario: "s.md", audience: "a founder",
    candidates: [{ name: "Acme", material: "m/a" }, { name: "Zed", material: "m/b" }],
    seats: [{ name: "One", route: "openrouter", model: "openai/gpt-6.1-sol" }, { name: "Two", route: "openrouter", model: "google/gemini-4-argon" }],
    rounds: 1, runs: 1,
  }));
  vi.stubGlobal("fetch", async () => { throw new Error("offline"); });
  process.env.OPENROUTER_API_KEY = "test";
});

describe("run", () => {
  it("--mock runs with no keys and no prompt", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const t = io();
    await main(["run", yaml, "--mock", "--out", join(dir, "runs")], t.value);
    expect(t.confirm).not.toHaveBeenCalled();
    expect(readFileSync(join(dir, "runs", runDirs()[0]!, "report.md"), "utf8")).toContain("## Objections");
  });
  it("stops at the prompt unless --yes", async () => {
    const t = io(false);
    await main(["run", yaml, "--out", join(dir, "runs")], t.value);
    expect(t.confirm).toHaveBeenCalledOnce();
    expect(t.lines.join("\n")).toMatch(/Estimated.*calls/);
    expect(() => runDirs()).toThrow();
  });
  it("prints that material goes to the chosen providers", async () => {
    const t = io(false);
    await main(["run", yaml, "--out", join(dir, "runs")], t.value);
    expect(t.lines.join("\n")).toMatch(/material.*sent to/i);
  });
  it("fails on a missing key before asking to spend", async () => {
    delete process.env.OPENROUTER_API_KEY;
    vi.doMock("node:child_process", () => ({ execFileSync: () => { throw new Error("none"); } }));
    const t = io(true);
    const previous = process.platform;
    Object.defineProperty(process, "platform", { value: "linux" });
    await expect(main(["run", yaml, "--out", join(dir, "runs")], t.value)).rejects.toThrow(/OPENROUTER_API_KEY/);
    Object.defineProperty(process, "platform", { value: previous });
    expect(t.confirm).not.toHaveBeenCalled();
  });
});

describe("resume", () => {
  it("picks up with resume <dir>", async () => {
    await main(["run", yaml, "--mock", "--out", join(dir, "runs")], io().value);
    const t = io();
    await main(["resume", join(dir, "runs", runDirs()[0]!), "--mock"], t.value);
    expect(t.lines.join("\n")).toContain("report.md");
  });
});

describe("resume costs", () => {
  it("shows what's left and stops unless confirmed", async () => {
    await main(["run", yaml, "--mock", "--out", join(dir, "runs")], io().value);
    const folder = join(dir, "runs", runDirs()[0]!);
    writeFileSync(join(folder, "calls.jsonl"), "");
    const t = io(false);
    await main(["resume", folder], t.value);
    expect(t.confirm).toHaveBeenCalledOnce();
    expect(t.lines.join("\n")).toMatch(/Estimated.*16 calls left/);
  });
  it("passes --yes through", async () => {
    await main(["run", yaml, "--mock", "--out", join(dir, "runs")], io().value);
    const t = io(false);
    await main(["resume", join(dir, "runs", runDirs()[0]!), "--yes", "--mock"], t.value);
    expect(t.confirm).not.toHaveBeenCalled();
  });
});

describe("diff", () => {
  it("prints a diff of two runs", async () => {
    await main(["run", yaml, "--mock", "--out", join(dir, "runs")], io().value);
    await main(["run", yaml, "--mock", "--out", join(dir, "runs")], io().value);
    const [a, b] = runDirs();
    const t = io();
    await main(["diff", join(dir, "runs", a!), join(dir, "runs", b!), "--mock"], t.value);
    expect(t.lines.join("\n")).toContain("# Diff");
  });
});

describe("usage", () => {
  it("prints help for an unknown command", async () => {
    const t = io();
    await main(["nope"], t.value);
    expect(t.lines.join("\n")).toMatch(/Usage/);
  });
});
