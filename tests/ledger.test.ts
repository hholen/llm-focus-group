import { describe, expect, it } from "vitest";
import { extractLedger } from "../src/ledger.js";
import { runSession } from "../src/protocol.js";
import { mockAsk, type Ask } from "../src/providers.js";
import { study } from "./helpers.js";

const s = study({ rounds: 1, runs: 1 });
const reply = (body: unknown): Ask => async () => ({ text: JSON.stringify(body), usage: { inputTokens: 0, outputTokens: 0 } });
const obj = (over = {}) => ({ candidate: "Acme", objection: "No export", runsRaised: [0], quote: "mock reply from Claude", materialSilent: true, ...over });

describe("extractLedger", () => {
  it("keeps an objection whose quote is in the transcript", async () => {
    const runs = [await runSession(s, 0, mockAsk)];
    expect(await extractLedger(s, runs, reply({ objections: [obj()] }))).toEqual([obj()]);
  });
  it("drops a quote not found in the transcripts", async () => {
    const runs = [await runSession(s, 0, mockAsk)];
    expect(await extractLedger(s, runs, reply({ objections: [obj({ quote: "invented words" })] }))).toEqual([]);
  });
  it("matches quotes across case and line breaks", async () => {
    const runs = [await runSession(s, 0, mockAsk)];
    expect((await extractLedger(s, runs, reply({ objections: [obj({ quote: "MOCK  reply\nfrom Claude" })] }))).length).toBe(1);
  });
  it("drops objections about unknown candidates", async () => {
    const runs = [await runSession(s, 0, mockAsk)];
    expect(await extractLedger(s, runs, reply({ objections: [obj({ candidate: "Other" })] }))).toEqual([]);
  });
  it("keeps a miscased candidate under its real name", async () => {
    const runs = [await runSession(s, 0, mockAsk)];
    const [first] = await extractLedger(s, runs, reply({ objections: [obj({ candidate: "acme" })] }));
    expect(first?.candidate).toBe("Acme");
  });
  it("reports how many objections it dropped", async () => {
    const runs = [await runSession(s, 0, mockAsk)];
    let dropped = -1;
    await extractLedger(s, runs, reply({ objections: [obj({ quote: "invented" }), obj()] }), (n) => { dropped = n; });
    expect(dropped).toBe(1);
  });
  it("removes run numbers that do not exist", async () => {
    const runs = [await runSession(s, 0, mockAsk)];
    const [first] = await extractLedger(s, runs, reply({ objections: [obj({ runsRaised: [0, 0, 7] })] }));
    expect(first?.runsRaised).toEqual([0]);
  });
  it("asks for a larger reply than a panel turn", async () => {
    const runs = [await runSession(s, 0, mockAsk)];
    let options: { maxTokens?: number } | undefined;
    const ask: Ask = async (_s, _y, _p, o) => { options = o; return { text: '{"objections":[]}', usage: { inputTokens: 0, outputTokens: 0 } }; };
    await extractLedger(s, runs, ask);
    expect(options?.maxTokens).toBeGreaterThan(4000);
  });
  it("retries once on invalid JSON", async () => {
    const runs = [await runSession(s, 0, mockAsk)];
    let n = 0;
    const flaky: Ask = async () => ({ text: n++ ? JSON.stringify({ objections: [obj()] }) : "nope", usage: { inputTokens: 0, outputTokens: 0 } });
    expect((await extractLedger(s, runs, flaky)).length).toBe(1);
  });
});
