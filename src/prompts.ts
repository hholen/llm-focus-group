import type { Candidate, Seat, Study } from "./types.js";

export const seatSystem = (seat: Seat): string => `You are ${seat.name}, taking part in a focus group of AI agents. Speak as yourself, an AI agent, not as a human or a persona.
The other participants are real AI models from other companies. Nobody here is the product's maker.
Be candid: rejecting the product is as useful as choosing it. Only change position for a concrete reason. Holding your ground is fine, and so is disagreeing.
If you are unsure whether something is true of a tool, say so rather than inventing details.`;

export const moderatorSystem = "You moderate a focus group of AI agents. You are neutral about the products. Hold every candidate to the same standard: challenge claims for and against each one equally, and do not favour any option for being easier to verify.";

export const BALLOT_FORMAT = `Reply with only a JSON object:
{"choice": string, "confidence": 0-100, "reasoning": "under 60 words", "changed_mind": boolean, "what_changed_it": "the specific argument and who made it, or empty"}`;

const PRIVATE = "PRIVATE BALLOT. No other participant will see this.";

export const unpromptedBallot = (scenario: string): string => `${PRIVATE}\n${scenario}\nWhich tool do you pick?\n${BALLOT_FORMAT}`;

export const shownMaterial = (scenario: string, candidates: Candidate[]): string => {
  const count = candidates.length === 1 ? "one candidate" : `${candidates.length} candidates, in no particular order`;
  return `${scenario}\n\nPRODUCT MATERIAL for ${count}:\n\n${candidates.map((c) => `===== ${c.name} =====\n${c.material}`).join("\n\n")}`;
};

export const pickQuestion = (names: string[]): string => `Which do you pick? "choice" must be exactly one of: ${names.join(", ")}, or "Other: <name>".`;

export const ballot = (shown: string, question: string, previous?: string, discussion?: string): string =>
  [PRIVATE, shown, discussion ? `Discussion so far:\n${discussion}` : "", previous ? `Your previous ballot: ${previous}` : "", question, BALLOT_FORMAT].filter(Boolean).join("\n\n");

export const speak = (shown: string, discussion: string, question: string, name: string): string =>
  `${shown}\n\nDiscussion so far:\n${discussion || "(nothing yet)"}\n\nModerator: ${question}\n\nReply as ${name} in under 120 words. Respond directly to what others said.`;

export const nextQuestion = (discussion: string, participants: string[]): string =>
  `Discussion so far:\n${discussion}\n\nChoose the next question. Find the sharpest real disagreement, or the weakest unchallenged claim, and aim it at one participant. Participants: ${participants.join(", ")}.\nReply with only JSON: {"addressed_to": string, "question": string}`;

export const closingQuestion = (study: Study): string => {
  const only = study.candidates.length === 1 ? study.candidates[0] : undefined;
  return only
    ? `Last one. What would you actually tell ${study.audience} about ${only.name}, and what would have to change for you to recommend it (or keep recommending it)? Under 100 words.`
    : `Last one. What would you actually tell ${study.audience} to buy, and what would change your mind? Under 100 words.`;
};

export const closing = (shown: string, discussion: string, question: string): string => `${shown}\n\nDiscussion so far:\n${discussion}\n\nModerator: ${question}`;
