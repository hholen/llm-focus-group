import { createHash } from "node:crypto";
import { getKey } from "./keys.js";
import type { Seat } from "./types.js";

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}
export interface Reply {
  text: string;
  usage: Usage;
}
export interface AskOptions {
  /** A reply failing this is never saved, so a resumed run asks again rather than replaying it. */
  valid?: (text: string) => boolean;
  maxTokens?: number;
}
export type Ask = (seat: Seat, system: string, prompt: string, options?: AskOptions) => Promise<Reply>;

const MAX_TOKENS = 4000; // generous: reasoning models spend output budget on thinking
const MAX_RETRIES = 3;
const TIMEOUT_MS = 10 * 60 * 1000;

export interface AnthropicBlock {
  type: string;
  text?: string;
  input?: { query?: string };
  content?: unknown;
  citations?: { url?: string }[];
}
export interface AnthropicResponse {
  content?: AnthropicBlock[];
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number; server_tool_use?: { web_search_requests?: number } };
}
export interface OpenRouterResponse {
  choices?: { message?: { content?: string | null; annotations?: { url_citation?: { url?: string; title?: string } }[] } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; server_tool_use_details?: { web_search_requests?: number } };
}
/** Runs `claude` with these arguments and stdin, resolving with stdout. Swapped out in tests. */
export type RunClaude = (args: string[], input: string) => Promise<string>;

/** API keys are removed so claude uses the signed-in Claude plan, not paid API calls. */
export function claudeEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const { ANTHROPIC_API_KEY: _key, ANTHROPIC_AUTH_TOKEN: _token, ...rest } = env;
  return rest;
}

const runClaude: RunClaude = async (args, input) => {
  const [{ spawn }, { mkdtempSync, rmSync }, { tmpdir }, { join }] = await Promise.all([import("node:child_process"), import("node:fs"), import("node:os"), import("node:path")]);
  const cwd = mkdtempSync(join(tmpdir(), "lfg-claude-")); // empty, so no project files or settings load
  try {
    return await new Promise<string>((done, fail) => {
      const child = spawn("claude", args, { cwd, env: claudeEnv(process.env), timeout: TIMEOUT_MS });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
      child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
      child.on("error", (error) => fail(new Error(`Couldn't start claude: ${error.message}. Is Claude Code installed?`)));
      child.on("close", () => done(stdout || stderr));
      child.stdin.end(input);
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
};

export const settings: { backoffMs: number; runClaude: RunClaude } = { backoffMs: 2000, runClaude };

export const keyName = (route: Seat["route"]): string | null =>
  route === "anthropic" ? "ANTHROPIC_API_KEY" : route === "openrouter" ? "OPENROUTER_API_KEY" : null;

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

export async function post<T>(url: string, key: string, headers: Record<string, string>, body: unknown): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (error) {
      if (attempt >= MAX_RETRIES) throw error;
      await sleep(settings.backoffMs * 2 ** attempt);
      continue;
    }
    if (res.ok) return res.json() as Promise<T>;
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      await sleep(settings.backoffMs * 2 ** attempt);
      continue;
    }
    const detail = (await res.text()).slice(0, 400).replaceAll(key, "[key]");
    throw new Error(`${url} returned ${res.status}: ${detail}`);
  }
}

async function callAnthropic(seat: Seat, system: string, prompt: string, maxTokens: number): Promise<Reply> {
  const key = getKey("ANTHROPIC_API_KEY");
  const data = await post<AnthropicResponse>(
    "https://api.anthropic.com/v1/messages",
    key,
    { "x-api-key": key, "anthropic-version": "2023-06-01" },
    { model: seat.model, max_tokens: maxTokens, system, messages: [{ role: "user", content: prompt }] },
  );
  const text = (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  return { text, usage: { inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0 } };
}

async function callOpenRouter(seat: Seat, system: string, prompt: string, maxTokens: number): Promise<Reply> {
  const key = getKey("OPENROUTER_API_KEY");
  const data = await post<OpenRouterResponse>(
    "https://openrouter.ai/api/v1/chat/completions",
    key,
    { authorization: `Bearer ${key}` },
    { model: seat.model, max_tokens: maxTokens, messages: [{ role: "system", content: system }, { role: "user", content: prompt }] },
  );
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    usage: { inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: data.usage?.completion_tokens ?? 0 },
  };
}

interface ClaudeCliResult {
  is_error?: boolean;
  result?: string;
  usage?: { input_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number; output_tokens?: number };
}

/** Runs on the signed-in Claude plan. claude -p has no output limit flag, so maxTokens is not applied. */
async function callClaudeCli(seat: Seat, system: string, prompt: string): Promise<Reply> {
  const args = ["-p", "--model", seat.model, "--system-prompt", system, "--tools", "", "--output-format", "json", "--no-session-persistence", "--strict-mcp-config", "--safe-mode"];
  const raw = await settings.runClaude(args, prompt);
  let data: ClaudeCliResult;
  try {
    data = JSON.parse(raw) as ClaudeCliResult;
  } catch {
    throw new Error(`claude -p gave no JSON reply: ${raw.trim().slice(0, 300)}`);
  }
  if (data.is_error) throw new Error(`claude -p reported an error: ${(data.result ?? "").slice(0, 300)}`);
  const u = data.usage ?? {};
  return {
    text: data.result ?? "",
    usage: { inputTokens: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0), outputTokens: u.output_tokens ?? 0 },
  };
}

export const realAsk: Ask = async (seat, system, prompt, options) => {
  const maxTokens = options?.maxTokens ?? MAX_TOKENS;
  const call = seat.route === "anthropic" ? callAnthropic : seat.route === "claude-cli" ? callClaudeCli : callOpenRouter;
  const first = await call(seat, system, prompt, maxTokens);
  if (first.text.trim()) return first;
  const second = await call(seat, system, prompt, maxTokens);
  const paid = { inputTokens: first.usage.inputTokens + second.usage.inputTokens, outputTokens: first.usage.outputTokens + second.usage.outputTokens };
  if (second.text.trim()) return { text: second.text, usage: paid };
  throw new Error(`${seat.name} (${seat.model}) returned empty content twice.`);
};

const pick = <T>(items: T[], seed: string): T => {
  const n = createHash("sha256").update(seed).digest().readUInt32BE(0);
  return items[n % items.length] as T;
};

function mockText(seat: Seat, prompt: string): string {
  if (prompt.includes("NEUTRALISE PROBE")) return JSON.stringify({ question: `If this were so, would your pick change? ${prompt.match(/"(.+)"/)?.[1] ?? ""}` });
  if (prompt.includes("MATCH OBJECTIONS")) return JSON.stringify({ matches: [] });
  if (prompt.includes("EXTRACT OBJECTIONS")) {
    const names = prompt.match(/^Candidates: (.+)$/m)?.[1]?.split(", ") ?? ["Unknown"];
    return JSON.stringify({
      objections: names.map((candidate) => ({ candidate, objection: `mock objection about ${candidate}`, runsRaised: [0], quote: "mock reply from", materialSilent: true })),
    });
  }
  if (prompt.includes("PRIVATE BALLOT")) {
    const listed = prompt.match(/exactly one of: (.+?), or "Other/)?.[1]?.split(", ");
    return JSON.stringify({
      choice: listed ? pick(listed, seat.name + prompt) : "Mock Tool",
      confidence: 60,
      reasoning: `mock reasoning from ${seat.name}`,
      changed_mind: false,
      what_changed_it: "",
    });
  }
  if (prompt.includes("Choose the next question")) {
    const names = prompt.match(/Participants: (.+?)\.\n/)?.[1]?.split(", ") ?? [seat.name];
    return JSON.stringify({ addressed_to: pick(names, prompt), question: "mock: what would make you switch?" });
  }
  return `mock reply from ${seat.name}`;
}

/** Deterministic: the same input always gives the same reply, so tests and demo repeat exactly. */
export const mockAsk: Ask = async (seat, _system, prompt) => {
  const text = mockText(seat, prompt);
  return { text, usage: { inputTokens: Math.ceil(prompt.length / 4), outputTokens: Math.ceil(text.length / 4) } };
};
