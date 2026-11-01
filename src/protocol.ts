import { labelExact, labelUnprompted, parseBallot, type Ballot } from "./ballots.js";
import * as prompts from "./prompts.js";
import type { Ask } from "./providers.js";
import type { Seat, Study } from "./types.js";

export type Stage = "unprompted" | "blind" | `control-${number}` | `round-${number}`;

export interface BallotRecord {
  run: number;
  stage: Stage;
  seat: string;
  ballot: Ballot;
  label: string;
  leak?: boolean;
}
export interface Turn {
  round: number;
  speaker: string;
  text: string;
}
export interface RunRecord {
  run: number;
  seatOrder: string[];
  productOrder: string[];
  moderator: string;
  transcript: Turn[];
  ballots: BallotRecord[];
  closing: Turn[];
}

/** Calls in one run, before any retries: S(4 + 3R) + R. */
export const callsPerRun = (seats: number, rounds: number): number => seats * (4 + 3 * rounds) + rounds;

const rotate = <T>(items: T[], by: number): T[] => items.map((_, i) => items[(i + by) % items.length] as T);
const render = (turns: Turn[]): string => turns.map((t) => `${t.speaker}: ${t.text}`).join("\n\n");

export async function runSession(study: Study, run: number, ask: Ask): Promise<RunRecord> {
  const names = study.candidates.map((c) => c.name);
  const order = rotate(study.seats, run);
  const products = rotate(study.candidates, run);
  const moderator = study.seats[run % study.seats.length] as Seat;
  const shown = prompts.shownMaterial(study.scenario, products);
  const question = prompts.pickQuestion(products.map((c) => c.name));
  const ballots: BallotRecord[] = [];
  const transcript: Turn[] = [];

  const vote = async (seat: Seat, prompt: string): Promise<Ballot> => {
    const system = prompts.seatSystem(seat);
    const options = { valid: (text: string) => parseBallot(text) !== null };
    let reply = await ask(seat, system, prompt, options);
    for (let attempt = 0; attempt < 2; attempt++) {
      const parsed = parseBallot(reply.text);
      if (parsed) return parsed;
      reply = await ask(seat, system, `${prompt}\n\nYour last reply was not valid JSON. Return only the JSON object.`, options);
    }
    const parsed = parseBallot(reply.text);
    if (parsed) return parsed;
    throw new Error(`${seat.name} did not return a valid ballot.`);
  };

  const collect = async (stage: Stage, promptFor: (seat: Seat) => string) => {
    const results = await Promise.all(study.seats.map((seat) => vote(seat, promptFor(seat))));
    results.forEach((ballot, i) => {
      const label = stage === "unprompted" ? labelUnprompted(ballot.choice, names) : labelExact(ballot.choice, names);
      ballots.push({ run, stage, seat: (study.seats[i] as Seat).name, ballot, label });
    });
  };
  const previous = (seat: Seat, stage: Stage) => JSON.stringify(ballots.filter((b) => b.seat === seat.name && b.stage === stage).at(-1)?.ballot);

  const say = async (seat: Seat, round: number, moderatorQuestion: string): Promise<void> => {
    const prompt = prompts.speak(shown, render(transcript), moderatorQuestion, seat.name);
    const reply = await ask(seat, prompts.seatSystem(seat), prompt);
    transcript.push({ round, speaker: seat.name, text: reply.text });
  };

  await collect("unprompted", () => prompts.unpromptedBallot(study.scenario));
  await collect("blind", () => prompts.ballot(shown, question));

  // Control: the same vote again, blind to the earlier one, so it measures drift rather than consistency.
  for (let r = 1; r <= study.rounds; r++) {
    await collect(`control-${r}`, () => prompts.ballot(shown, question));
  }

  for (const seat of order) await say(seat, 0, "Which tool would you pick here, and why?");

  for (let r = 1; r <= study.rounds; r++) {
    const raw = await ask(moderator, prompts.moderatorSystem, prompts.nextQuestion(render(transcript), study.seats.map((s) => s.name)));
    const next = parseModerator(raw.text);
    const challenge = next.question ?? "Where do you disagree most with the others?";
    transcript.push({ round: r, speaker: "Moderator", text: `(to ${next.addressed_to ?? "everyone"}) ${challenge}` });
    const speakers = [...order].sort((a, b) => Number(b.name === next.addressed_to) - Number(a.name === next.addressed_to));
    for (const seat of speakers) await say(seat, r, challenge);
    const discussion = render(transcript);
    const prior: Stage = r === 1 ? "blind" : `round-${r - 1}`;
    await collect(`round-${r}`, (seat) => prompts.ballot(shown, question, previous(seat, prior), discussion));
  }

  const closing: Turn[] = [];
  const closingPrompt = prompts.closing(shown, render(transcript), prompts.closingQuestion(study));
  for (const seat of order) {
    const reply = await ask(seat, prompts.seatSystem(seat), closingPrompt);
    closing.push({ round: study.rounds + 1, speaker: seat.name, text: reply.text });
  }

  return { run, seatOrder: order.map((s) => s.name), productOrder: products.map((c) => c.name), moderator: moderator.name, transcript, ballots, closing };
}

function parseModerator(text: string): { addressed_to?: string; question?: string } {
  try {
    return JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as { addressed_to?: string; question?: string };
  } catch {
    return {};
  }
}
