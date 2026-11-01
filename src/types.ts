export type Route = "anthropic" | "openrouter";

export interface Seat {
  name: string;
  route: Route;
  model: string;
}

export interface Candidate {
  name: string;
  materialDir: string;
  material: string;
  domains?: string[];
}

export interface Study {
  scenario: string;
  audience: string;
  candidates: Candidate[];
  seats: Seat[];
  rounds: number;
  runs: number;
  blind: boolean;
  searchBallot: boolean;
}
