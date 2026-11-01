import type { Candidate, Study } from "../src/types.js";

export const candidate = (name: string): Candidate => ({ name, materialDir: `/m/${name}`, material: `--- about.md ---\n${name} docs` });

export const study = (over: Partial<Study> = {}): Study => ({
  scenario: "A founder needs a tool.",
  audience: "the founder",
  candidates: [candidate("Acme"), candidate("Zed")],
  seats: [
    { name: "Claude", route: "anthropic", model: "c" },
    { name: "Gemini", route: "openrouter", model: "g" },
    { name: "GPT", route: "openrouter", model: "o" },
  ],
  rounds: 3,
  runs: 3,
  blind: false,
  searchBallot: false,
  ...over,
});
