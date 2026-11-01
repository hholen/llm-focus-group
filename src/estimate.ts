import { createRequire } from "node:module";
import { callsPerRun } from "./protocol.js";
import type { Seat, Study } from "./types.js";

export type Prices = Record<string, [number, number]>; // dollars per million tokens: input, output

export interface Estimate {
  calls: number;
  usdLow: number | null;
  usdHigh: number | null;
  unpriced: string[];
}

const fallback = (createRequire(import.meta.url)("./prices.json") as { models: Prices }).models;
const TURN_TOKENS = 200; // a turn is capped at about 120 words
const OUTPUT_LOW = 150;
const OUTPUT_HIGH = 800; // reasoning models bill thinking as output
const SEARCH_USD = 0.014; // per search: Anthropic and GPT charged $0.01, Gemini $0.014
const SEARCHES_MAX = 5;
const SEARCH_INPUT_LOW = 20_000; // search results count as input: 23-57k per session in the spike
const SEARCH_INPUT_HIGH = 60_000;

const tokens = (text: string) => Math.ceil(text.length / 4);
const listId = (seat: Seat) => (seat.route === "anthropic" ? `anthropic/${seat.model.replace(/-(\d+)-(\d+)$/, "-$1.$2")}` : seat.model);

/** Live prices from OpenRouter's public list, or saved ones if that can't be reached. */
export async function loadPrices(seats: Seat[]): Promise<Prices> {
  let live: Prices = {};
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models");
    const data = (await res.json()) as { data: { id: string; pricing: { prompt: string; completion: string } }[] };
    live = Object.fromEntries(data.data.map((m) => [m.id, [Number(m.pricing.prompt) * 1e6, Number(m.pricing.completion) * 1e6]]));
  } catch {
    /* saved prices below */
  }
  const out: Prices = {};
  for (const seat of seats) {
    const price = live[listId(seat)] ?? fallback[listId(seat)];
    if (price) out[seat.model] = price;
  }
  return out;
}

/** Priced from the actual prompts, which are known before a probe spends anything. */
export function estimateCalls(calls: { seat: Seat; prompt: string }[], prices: Prices): Estimate {
  const unpriced = [...new Set(calls.map((c) => c.seat.model))].filter((m) => !prices[m]);
  if (unpriced.length) return { calls: calls.length, usdLow: null, usdHigh: null, unpriced };
  const dollars = (output: number) =>
    calls.reduce((sum, c) => {
      const [input, out] = prices[c.seat.model] as [number, number];
      return sum + (tokens(c.prompt) * input + output * out) / 1e6;
    }, 0);
  return { calls: calls.length, usdLow: dollars(OUTPUT_LOW), usdHigh: dollars(OUTPUT_HIGH) * 1.3, unpriced };
}

export function estimate(study: Study, prices: Prices): Estimate {
  const seats = study.seats.length;
  const searching = study.searchBallot ? study.seats : [];
  const searchCalls = searching.length * study.runs;
  const calls = callsPerRun(seats, study.rounds) * study.runs + 1 + searchCalls;
  const unpriced = [...new Set(study.seats.map((s) => s.model))].filter((m) => !prices[m]);
  if (unpriced.length) return { calls, usdLow: null, usdHigh: null, unpriced };

  const material = tokens(study.scenario) + study.candidates.reduce((sum, c) => sum + tokens(c.material), 0);
  const discussion = (TURN_TOKENS * seats * (study.rounds + 1)) / 2; // the transcript grows, so use its average
  const perSeat = (callsPerRun(seats, study.rounds) * study.runs + 1) / seats;
  const inputPerCall = material + discussion;
  const dollars = (output: number) =>
    study.seats.reduce((sum, seat) => {
      const [input, out] = prices[seat.model] as [number, number];
      return sum + (perSeat * (inputPerCall * input + output * out)) / 1e6;
    }, 0);
  const searchCost = (inputTokens: number, searches: number) =>
    searching.reduce((sum, seat) => sum + study.runs * ((inputTokens * (prices[seat.model] as [number, number])[0]) / 1e6 + searches * SEARCH_USD), 0);
  return { calls, usdLow: dollars(OUTPUT_LOW) + searchCost(SEARCH_INPUT_LOW, 1), usdHigh: dollars(OUTPUT_HIGH) * 1.3 + searchCost(SEARCH_INPUT_HIGH, SEARCHES_MAX), unpriced };
}
