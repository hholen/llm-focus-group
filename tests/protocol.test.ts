import { describe, expect, it } from "vitest";
import { callsPerRun, runSession } from "../src/protocol.js";
import { mockAsk, type Ask } from "../src/providers.js";
import { study } from "./helpers.js";

const recording = () => {
  const prompts: { seat: string; system: string; prompt: string }[] = [];
  const ask: Ask = (seat, system, prompt) => {
    prompts.push({ seat: seat.name, system, prompt });
    return mockAsk(seat, system, prompt);
  };
  return { ask, prompts };
};

describe("runSession", () => {
  it("rotates product order per run", async () => {
    expect((await runSession(study(), 0, mockAsk)).productOrder).toEqual(["Acme", "Zed"]);
    expect((await runSession(study(), 1, mockAsk)).productOrder).toEqual(["Zed", "Acme"]);
  });
  it("rotates seat order per run", async () => {
    expect((await runSession(study(), 1, mockAsk)).seatOrder).toEqual(["Gemini", "GPT", "Claude"]);
  });
  it("rotates the moderator between seats across runs", async () => {
    const seen = await Promise.all([0, 1, 2].map(async (run) => (await runSession(study(), run, mockAsk)).moderator));
    expect(seen).toEqual(["Claude", "Gemini", "GPT"]);
  });
  it("shows no candidate names in the unprompted prompt", async () => {
    const { ask, prompts } = recording();
    await runSession(study(), 0, ask);
    const first = prompts[0]?.prompt ?? "";
    expect(first).not.toMatch(/Acme|Zed/);
    expect(first).toContain("PRIVATE BALLOT");
  });
  it("lists exact names and Other on later ballots", async () => {
    const { ask, prompts } = recording();
    await runSession(study(), 0, ask);
    expect(prompts.filter((p) => p.prompt.includes('exactly one of: Acme, Zed, or "Other: <name>"')).length).toBeGreaterThan(0);
  });
  it("rotates the choice list with product order", async () => {
    const { ask, prompts } = recording();
    await runSession(study(), 1, ask);
    expect(prompts.some((p) => p.prompt.includes("exactly one of: Zed, Acme,"))).toBe(true);
  });
  it("hides the previous vote from control ballots", async () => {
    const { ask, prompts } = recording();
    await runSession(study({ rounds: 1 }), 0, ask);
    const ballots = prompts.filter((p) => p.prompt.includes("PRIVATE BALLOT") && !p.prompt.includes("Discussion so far"));
    expect(ballots.length).toBe(9);
    expect(ballots.some((p) => p.prompt.includes("Your previous ballot"))).toBe(false);
  });
  it("never asks for picks_product", async () => {
    const { ask, prompts } = recording();
    await runSession(study(), 0, ask);
    expect(prompts.some((p) => p.prompt.includes("picks_product"))).toBe(false);
  });
  it("states the candidate count instead of assuming three", async () => {
    const { ask, prompts } = recording();
    await runSession(study(), 0, ask);
    expect(prompts.some((p) => p.prompt.includes("PRODUCT MATERIAL for 2 candidates"))).toBe(true);
  });
  it("records every stage per seat", async () => {
    const run = await runSession(study({ rounds: 2 }), 0, mockAsk);
    const stages = new Set(run.ballots.map((b) => b.stage));
    expect(stages).toEqual(new Set(["unprompted", "blind", "control-1", "control-2", "round-1", "round-2"]));
    expect(run.ballots.length).toBe(18);
  });
  it("labels ballots with the tool's match, not the model's word", async () => {
    const run = await runSession(study(), 0, mockAsk);
    expect(run.ballots.filter((b) => b.stage === "unprompted").every((b) => b.label === "Other: Mock Tool")).toBe(true);
    expect(run.ballots.filter((b) => b.stage === "blind").every((b) => ["Acme", "Zed"].includes(b.label))).toBe(true);
  });
  it("makes the formula's number of calls", async () => {
    const { ask, prompts } = recording();
    await runSession(study(), 0, ask);
    expect(prompts.length).toBe(callsPerRun(3, 3));
  });
  it("runs a single-candidate study", async () => {
    const run = await runSession(study({ candidates: [study().candidates[0]!] }), 0, mockAsk);
    expect(run.closing.length).toBe(3);
  });
  it("retries a broken ballot, then stops naming the seat", async () => {
    const bad: Ask = async (seat, s, p) => (p.includes("PRIVATE BALLOT") ? { text: "no json", usage: { inputTokens: 0, outputTokens: 0 } } : mockAsk(seat, s, p));
    await expect(runSession(study(), 0, bad)).rejects.toThrow(/valid ballot/);
  });
  it("survives a moderator reply that is not JSON", async () => {
    const odd: Ask = async (seat, s, p) => (p.includes("Choose the next question") ? { text: "hmm", usage: { inputTokens: 0, outputTokens: 0 } } : mockAsk(seat, s, p));
    expect((await runSession(study(), 0, odd)).transcript.some((t) => t.speaker === "Moderator")).toBe(true);
  });
});

describe("callsPerRun", () => {
  it("matches S(4 + 3R) + R", () => {
    expect(callsPerRun(3, 3)).toBe(42);
    expect(callsPerRun(3, 1)).toBe(22);
  });
});
