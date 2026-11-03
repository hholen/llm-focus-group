import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse } from "yaml";
import type { Candidate, Route, Seat, Study } from "./types.js";

const fail = (message: string): never => {
  throw new Error(`Study error: ${message}`);
};

const text = (value: unknown, field: string): string =>
  typeof value === "string" && value.trim() ? value : fail(`"${field}" must be a non-empty string.`);

const count = (value: unknown, field: string): number =>
  Number.isInteger(value) && (value as number) >= 1 ? (value as number) : fail(`"${field}" must be a whole number of at least 1.`);

function readMaterial(dir: string, shown: string): string {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) fail(`material folder not found: ${shown}`);
  const names = readdirSync(dir).filter((name) => !name.startsWith(".")).sort();
  if (names.length === 0) fail(`material folder ${shown} has no files.`);
  const joined = names
    .map((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) fail(`material folder ${shown} contains a subfolder, ${name}. Material must be flat files.`);
      const bytes = readFileSync(path);
      if (bytes.includes(0)) fail(`${shown}/${name} is a binary file. Material must be text.`);
      return `--- ${name} ---\n${bytes.toString("utf8")}`;
    })
    .join("\n\n");
  if (!names.some((name) => readFileSync(join(dir, name), "utf8").trim())) fail(`material folder ${shown} has only empty files.`);
  return joined;
}

export function loadStudy(path: string): Study {
  const file = resolve(path);
  const root = dirname(file);
  const raw = (parse(readFileSync(file, "utf8")) ?? {}) as Record<string, unknown>;

  const scenarioPath = text(raw.scenario, "scenario");
  const candidates = (Array.isArray(raw.candidates) ? raw.candidates : fail(`"candidates" must be a list.`)) as Record<string, unknown>[];
  const seats = (Array.isArray(raw.seats) ? raw.seats : fail(`"seats" must be a list.`)) as Record<string, unknown>[];
  if (candidates.length === 0) fail("a study needs at least one candidate.");
  if (seats.length === 0) fail("a study needs at least one seat.");

  const loaded: Candidate[] = candidates.map((c) => {
    const material = text(c.material, "candidate material");
    const dir = resolve(root, material);
    return {
      name: text(c.name, "candidate name"),
      materialDir: dir,
      material: readMaterial(dir, material),
      ...(Array.isArray(c.domains) ? { domains: c.domains as string[] } : {}),
    };
  });
  if (new Set(loaded.map((c) => c.name.toLowerCase())).size !== loaded.length) fail("two candidates have the same name.");

  const loadedSeats: Seat[] = seats.map((s) => {
    const route = s.route;
    if (route !== "anthropic" && route !== "openrouter" && route !== "claude-cli") fail(`seat route must be anthropic, openrouter or claude-cli, got ${String(route)}.`);
    return { name: text(s.name, "seat name"), route: route as Route, model: text(s.model, "seat model") };
  });
  if (new Set(loadedSeats.map((s) => s.name)).size !== loadedSeats.length) fail("two seats have the same name.");

  if (raw.searchBallot === true && loadedSeats.some((s) => s.route === "claude-cli")) fail("the search ballot doesn't work with claude-cli seats yet, because claude -p doesn't report what it searched.");
  const scenario = readFileSync(resolve(root, scenarioPath), "utf8").trim();
  if (!scenario) fail(`scenario file ${scenarioPath} is empty.`);

  return {
    scenario,
    audience: text(raw.audience, "audience"),
    candidates: loaded,
    seats: loadedSeats,
    rounds: count(raw.rounds, "rounds"),
    runs: count(raw.runs, "runs"),
    blind: raw.blind === true,
    searchBallot: raw.searchBallot === true,
  };
}
