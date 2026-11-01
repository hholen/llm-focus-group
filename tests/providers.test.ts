import { execFileSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getKey } from "../src/keys.js";
import { mockAsk, realAsk, settings } from "../src/providers.js";
import type { Seat } from "../src/types.js";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn(() => "from-keychain\n") }));

const claude: Seat = { name: "Claude", route: "anthropic", model: "claude-x" };
const gpt: Seat = { name: "GPT", route: "openrouter", model: "openai/x" };
const SECRET = "sk-secret-value";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const chat = (content: string | null) => json({ choices: [{ message: { content } }], usage: { prompt_tokens: 3, completion_tokens: 4 } });
const stub = (...replies: Response[]) => {
  const fn = vi.fn(async (_url: string, _init: RequestInit) => replies.shift() ?? json({}, 500));
  vi.stubGlobal("fetch", fn);
  return fn;
};

beforeEach(() => {
  settings.backoffMs = 0;
  process.env.ANTHROPIC_API_KEY = SECRET;
  process.env.OPENROUTER_API_KEY = SECRET;
});
afterEach(() => vi.unstubAllGlobals());

describe("realAsk", () => {
  it("routes anthropic seats to the Messages API", async () => {
    const fn = stub(json({ content: [{ type: "text", text: "hi" }], usage: { input_tokens: 1, output_tokens: 2 } }));
    const reply = await realAsk(claude, "sys", "prompt");
    expect(fn.mock.calls[0]?.[0]).toBe("https://api.anthropic.com/v1/messages");
    expect(reply).toEqual({ text: "hi", usage: { inputTokens: 1, outputTokens: 2 } });
  });
  it("routes openrouter seats to chat completions with the seat's model", async () => {
    const fn = stub(chat("hi"));
    const reply = await realAsk(gpt, "sys", "prompt");
    expect(fn.mock.calls[0]?.[0]).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(JSON.parse(fn.mock.calls[0]?.[1].body as string).model).toBe("openai/x");
    expect(reply.usage).toEqual({ inputTokens: 3, outputTokens: 4 });
  });
  it("retries 429 and 5xx with backoff, three retries at most", async () => {
    const fn = stub(json({}, 429), json({}, 500), chat("ok"));
    expect((await realAsk(gpt, "s", "p")).text).toBe("ok");
    const always = stub(json({}, 429), json({}, 429), json({}, 429), json({}, 429), json({}, 429));
    await expect(realAsk(gpt, "s", "p")).rejects.toThrow(/429/);
    expect(always).toHaveBeenCalledTimes(4);
    expect(fn).toBeDefined();
  });
  it("does not retry a 401", async () => {
    const fn = stub(json({}, 401));
    await expect(realAsk(gpt, "s", "p")).rejects.toThrow(/401/);
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it("retries once on empty content, then throws naming the seat", async () => {
    const fn = stub(chat(null), chat("  "));
    await expect(realAsk(gpt, "s", "p")).rejects.toThrow(/GPT.*empty/);
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it("counts the paid empty attempt in usage", async () => {
    stub(chat(""), chat("second"));
    expect((await realAsk(gpt, "s", "p")).usage).toEqual({ inputTokens: 6, outputTokens: 8 });
  });
  it("recovers when the retry after empty content has text", async () => {
    stub(chat(""), chat("second"));
    expect((await realAsk(gpt, "s", "p")).text).toBe("second");
  });
  it("error messages never contain the key", async () => {
    stub(new Response(`bad key ${SECRET}`, { status: 401 }));
    await expect(realAsk(gpt, "s", "p")).rejects.not.toThrow(SECRET);
  });
});

describe("getKey", () => {
  it("prefers the environment over the keychain", () => {
    process.env.SOME_API_KEY = "from-env";
    expect(getKey("SOME_API_KEY")).toBe("from-env");
    expect(execFileSync).not.toHaveBeenCalled();
    delete process.env.SOME_API_KEY;
  });
  it("falls back to the keychain on macOS", () => {
    if (process.platform !== "darwin") return;
    expect(getKey("OTHER_API_KEY")).toBe("from-keychain");
    delete process.env.OTHER_API_KEY;
  });
  it("names the variable when no key exists", () => {
    vi.mocked(execFileSync).mockImplementationOnce(() => { throw new Error("none"); });
    expect(() => getKey("MISSING_API_KEY")).toThrow(/MISSING_API_KEY/);
  });
});

describe("mockAsk", () => {
  it("is deterministic", async () => {
    const prompt = 'PRIVATE BALLOT. "choice" must be exactly one of: A, B, or "Other: <name>".';
    expect(await mockAsk(claude, "s", prompt)).toEqual(await mockAsk(claude, "s", prompt));
  });
  it("picks a listed candidate", async () => {
    const reply = await mockAsk(claude, "s", 'PRIVATE BALLOT. "choice" must be exactly one of: Acme, Zed, or "Other: <name>".');
    expect(["Acme", "Zed"]).toContain(JSON.parse(reply.text).choice);
  });
});
