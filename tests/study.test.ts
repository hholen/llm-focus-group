import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { loadStudy } from "../src/study.js";

let dir: string;
const base = {
  scenario: "scenario.md",
  audience: "a founder",
  candidates: [{ name: "Acme", material: "m/acme" }, { name: "Zed", material: "m/zed" }],
  seats: [{ name: "Claude", route: "anthropic", model: "c" }, { name: "GPT", route: "openrouter", model: "g" }],
  rounds: 2,
  runs: 3,
};
const write = (over: object = {}) => {
  const path = join(dir, "study.yaml");
  writeFileSync(path, JSON.stringify({ ...base, ...over })); // JSON is valid YAML
  return path;
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "lfg-"));
  mkdirSync(join(dir, "m/acme"), { recursive: true });
  mkdirSync(join(dir, "m/zed"), { recursive: true });
  writeFileSync(join(dir, "scenario.md"), "Pick a tool.");
  writeFileSync(join(dir, "m/acme/b.md"), "second");
  writeFileSync(join(dir, "m/acme/a.md"), "first");
  writeFileSync(join(dir, "m/acme/.DS_Store"), "\0");
  writeFileSync(join(dir, "m/zed/z.md"), "zed");
});

describe("loadStudy", () => {
  it("loads a study with paths relative to the YAML file", () => {
    const study = loadStudy(write());
    expect(study.scenario).toBe("Pick a tool.");
    expect(study.candidates[0]?.material).toBe("--- a.md ---\nfirst\n\n--- b.md ---\nsecond");
    expect(study.blind).toBe(false);
    expect(study.searchBallot).toBe(false);
  });
  it("rejects a missing material folder naming the path", () => {
    expect(() => loadStudy(write({ candidates: [{ name: "Acme", material: "m/nope" }] }))).toThrow(/m\/nope/);
  });
  it("rejects an empty material folder", () => {
    mkdirSync(join(dir, "m/empty"));
    expect(() => loadStudy(write({ candidates: [{ name: "Acme", material: "m/empty" }] }))).toThrow(/m\/empty.*no files/);
  });
  it("rejects a binary file in material naming it", () => {
    writeFileSync(join(dir, "m/zed/logo.png"), Buffer.from([1, 0, 2]));
    expect(() => loadStudy(write())).toThrow(/logo\.png/);
  });
  it("rejects a nested folder rather than skipping it", () => {
    mkdirSync(join(dir, "m/zed/sub"));
    expect(() => loadStudy(write())).toThrow(/sub/);
  });
  it("rejects rounds or runs below 1", () => {
    expect(() => loadStudy(write({ rounds: 0 }))).toThrow(/rounds/);
    expect(() => loadStudy(write({ runs: 0 }))).toThrow(/runs/);
  });
  it("rejects material with only empty files", () => {
    writeFileSync(join(dir, "m/zed/z.md"), " \n");
    expect(() => loadStudy(write())).toThrow(/m\/zed.*empty/);
  });
  it("rejects an empty scenario file", () => {
    writeFileSync(join(dir, "scenario.md"), "\n");
    expect(() => loadStudy(write())).toThrow(/scenario/);
  });
  it("allows a search ballot with no anthropic seat", () => {
    const seats = [{ name: "GPT", route: "openrouter", model: "g" }, { name: "Gemini", route: "openrouter", model: "h" }];
    expect(loadStudy(write({ seats, searchBallot: true })).searchBallot).toBe(true);
  });
  it("rejects two candidates with the same name", () => {
    const candidates = [{ name: "Acme", material: "m/acme" }, { name: "acme", material: "m/zed" }];
    expect(() => loadStudy(write({ candidates }))).toThrow(/same name/);
  });
  it("rejects an unknown seat route", () => {
    expect(() => loadStudy(write({ seats: [{ name: "X", route: "fax", model: "m" }] }))).toThrow(/route/);
  });
});
