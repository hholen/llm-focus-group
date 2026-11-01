import { describe, expect, it, vi } from "vitest";
import { estimate, loadPrices } from "../src/estimate.js";
import { study } from "./helpers.js";

const prices = { c: [1, 2], g: [1, 2], o: [1, 2] } as Record<string, [number, number]>;

describe("estimate", () => {
  it("gives 211 calls for 3 seats, 3 rounds, 5 runs", () => {
    expect(estimate(study({ rounds: 3, runs: 5 }), prices).calls).toBe(211);
  });
  it("counts search ballot calls", () => {
    expect(estimate(study({ rounds: 3, runs: 5, searchBallot: true }), prices).calls).toBe(216);
  });
  it("adds search fees to the high figure", () => {
    const off = estimate(study({ searchBallot: false }), prices).usdHigh as number;
    const on = estimate(study({ searchBallot: true }), prices).usdHigh as number;
    expect(on).toBeGreaterThan(off);
  });
  it("prices search tokens as well as search fees", () => {
    const off = estimate(study(), prices).usdLow as number;
    const on = estimate(study({ searchBallot: true }), prices).usdLow as number;
    expect(on - off).toBeGreaterThan(0.01);
  });
  it("returns a low and high figure", () => {
    const e = estimate(study({ rounds: 2, runs: 3 }), prices);
    expect(e.usdLow).toBeGreaterThan(0);
    expect(e.usdHigh as number).toBeGreaterThan(e.usdLow as number);
  });
  it("shows unknown cost rather than $0 for an unpriced model", () => {
    const e = estimate(study(), { c: [1, 2], g: [1, 2] });
    expect(e.usdLow).toBeNull();
    expect(e.usdHigh).toBeNull();
    expect(e.unpriced).toEqual(["o"]);
  });
  it("grows with material size", () => {
    const large = study({ candidates: study().candidates.map((c) => ({ ...c, material: "x".repeat(100_000) })) });
    expect(estimate(large, prices).usdLow as number).toBeGreaterThan(estimate(study(), prices).usdLow as number);
  });
});

describe("loadPrices", () => {
  it("reads OpenRouter's list and normalises Anthropic IDs", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ data: [{ id: "anthropic/claude-sonnet-5.5", pricing: { prompt: "0.000002", completion: "0.00001" } }] })));
    const p = await loadPrices([{ name: "C", route: "anthropic", model: "claude-sonnet-5-5" }]);
    expect(p["claude-sonnet-5-5"]?.[0]).toBeCloseTo(2);
    vi.unstubAllGlobals();
  });
  it("falls back to saved prices when the list is unreachable", async () => {
    vi.stubGlobal("fetch", async () => { throw new Error("offline"); });
    const p = await loadPrices([{ name: "C", route: "openrouter", model: "google/gemini-4-argon" }]);
    expect(p["google/gemini-4-argon"]).toEqual([2, 10]);
    vi.unstubAllGlobals();
  });
});
