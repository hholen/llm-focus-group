export interface Ballot {
  choice: string;
  confidence: number;
  reasoning: string;
  changedMind: boolean;
  whatChangedIt: string;
}

const other = (raw: string): string => (/^other:/i.test(raw) ? `Other: ${raw.slice(6).trim()}` : `Other: ${raw}`);

export function parseBallot(reply: string): Ballot | null {
  const match = reply.match(/\{[\s\S]*\}/);
  if (!match) return null;
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (typeof raw.choice !== "string" || !raw.choice.trim()) return null;
  return {
    choice: raw.choice,
    confidence: typeof raw.confidence === "number" ? raw.confidence : 0,
    reasoning: typeof raw.reasoning === "string" ? raw.reasoning : "",
    changedMind: raw.changed_mind === true,
    whatChangedIt: typeof raw.what_changed_it === "string" ? raw.what_changed_it : "",
  };
}

/** For ballots shown the candidate list: exact after case and whitespace, otherwise Other. */
export function labelExact(choice: string, names: string[]): string {
  const clean = choice.trim();
  return names.find((name) => name.toLowerCase() === clean.toLowerCase()) ?? other(clean);
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** For the free-text unprompted ballot: a name anywhere in the answer, longest name first. */
export function labelUnprompted(choice: string, names: string[]): string {
  const clean = choice.trim();
  const longestFirst = [...names].sort((a, b) => b.length - a.length);
  const named = (name: string) => new RegExp(`(^|[^\\p{L}\\p{N}])${escape(name)}($|[^\\p{L}\\p{N}])`, "iu").test(clean);
  const negated = (name: string) => new RegExp(`(^|[^\\p{L}\\p{N}-])(not|no|never|avoid|except|anything but)\\s+(the\\s+)?${escape(name)}`, "iu").test(clean);
  return longestFirst.find((name) => named(name) && !negated(name)) ?? other(clean);
}
