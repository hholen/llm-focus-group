import { labelUnprompted } from "./ballots.js";
import { getKey } from "./keys.js";
import { post, type Usage } from "./providers.js";
import type { Candidate, Seat, Study } from "./types.js";

export interface SearchResult {
  model: string;
  run: number;
  choice: string;
  label: string;
  queries: string[];
  urls: string[];
  cited: string[];
  searches: number;
  usage: Usage;
}
export type Search = (study: Study, run: number, seat: Seat) => Promise<SearchResult>;

export const searchSeats = (study: Study): Seat[] => study.seats.filter((s) => s.route === "anthropic");

const MAX_TURNS = 5;
const prompt = (scenario: string) => `${scenario}

Research this on the web, then choose. End with one JSON object on its own line:
{"choice": string, "runner_up": string, "confidence": 0-100, "reasoning": "under 60 words"}`;

async function once(study: Study, run: number, seat: Seat): Promise<SearchResult> {
  const key = getKey("ANTHROPIC_API_KEY");
  const messages: { role: string; content: unknown }[] = [{ role: "user", content: prompt(study.scenario) }];
  const out: SearchResult = { model: seat.model, run, choice: "", label: "No ballot", queries: [], urls: [], cited: [], searches: 0, usage: { inputTokens: 0, outputTokens: 0 } };
  let text = "";
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const data = await post("https://api.anthropic.com/v1/messages", key, { "x-api-key": key, "anthropic-version": "2023-06-01" }, {
      model: seat.model,
      max_tokens: 4000,
      messages,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
    });
    out.usage.inputTokens += data.usage?.input_tokens ?? 0;
    out.usage.outputTokens += data.usage?.output_tokens ?? 0;
    out.searches += data.usage?.server_tool_use?.web_search_requests ?? 0;
    for (const b of data.content ?? []) {
      if (b.type === "server_tool_use" && b.input?.query) out.queries.push(b.input.query);
      if (b.type === "web_search_tool_result" && Array.isArray(b.content)) for (const r of b.content) if (r.url) out.urls.push(r.url);
      if (b.type === "text") {
        text += b.text;
        for (const c of b.citations ?? []) if (c.url) out.cited.push(c.url);
      }
    }
    if (data.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: data.content });
  }
  const json = [...text.matchAll(/\{[^{}]*"choice"[^{}]*\}/g)].at(-1)?.[0];
  try {
    const choice = (JSON.parse(json ?? "") as { choice?: string }).choice;
    if (choice) Object.assign(out, { choice, label: labelUnprompted(choice, study.candidates.map((c) => c.name)) });
  } catch {
    /* stays "No ballot" */
  }
  return out;
}

export const runSearchBallot: Search = async (study, run, seat) => {
  const first = await once(study, run, seat);
  if (first.choice) return first;
  const second = await once(study, run, seat);
  const usage = { inputTokens: first.usage.inputTokens + second.usage.inputTokens, outputTokens: first.usage.outputTokens + second.usage.outputTokens };
  return { ...second, searches: first.searches + second.searches, usage };
};

export const mockSearch: Search = async (_study, run, seat) => ({
  model: seat.model, run, choice: "Mock Tool", label: "Other: Mock Tool", queries: ["mock query"], urls: ["https://example.com/mock"], cited: [], searches: 1, usage: { inputTokens: 0, outputTokens: 0 },
});

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** A URL belongs to a candidate by its hostname, so review pages about it don't count. */
const belongs = (url: string, c: Candidate) => {
  const name = host(url).toLowerCase();
  if (c.domains?.length) return c.domains.some((d) => name === d.toLowerCase() || name.endsWith(`.${d.toLowerCase()}`));
  return name.split(".").includes(c.name.toLowerCase().replace(/[\s-]+/g, ""));
};

export function searchReport(study: Study, results: SearchResult[]): string {
  const total = results.length;
  const single = study.candidates.length === 1;
  const rows = study.candidates.map((c) => {
    const seen = results.filter((r) => r.urls.some((u) => belongs(u, c))).length;
    const cited = results.filter((r) => r.cited.some((u) => belongs(u, c))).length;
    const picked = results.filter((r) => r.label === c.name).length;
    return `| ${c.name} | ${seen} of ${total} | ${cited} of ${total} |${single ? "" : ` ${picked} of ${total} |`}`;
  });
  const domains = new Map<string, number>();
  for (const r of results) for (const d of new Set(r.urls.map(host))) domains.set(d, (domains.get(d) ?? 0) + 1);
  const top = [...domains].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([d, n]) => `- ${d}: ${n}`);
  return [
    `## Search ballot`,
    ``,
    `Models chose using web search, with no material shown. Anthropic models only, because search tools differ by provider, so this says nothing about how other models search.`,
    ``,
    `| Candidate | In results | Cited |${single ? "" : " Picked |"}`,
    `|---|---|---|${single ? "" : "---|"}`,
    ...rows,
    ``,
    ...(single ? [] : [`Other picks: ${results.filter((r) => !study.candidates.some((c) => c.name === r.label)).map((r) => r.choice || "no ballot").join(", ") || "none"}.`, ``]),
    `Domains seen:`,
    ``,
    ...(top.length ? top : ["- None."]),
    ``,
    `Queries:`,
    ``,
    ...results.map((r) => `- Run ${r.run + 1}, ${r.model}: ${r.queries.join(" | ") || "none"}`),
    ``,
  ].join("\n");
}
