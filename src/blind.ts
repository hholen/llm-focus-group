import { labelExact, labelUnprompted } from "./ballots.js";
import type { Objection } from "./ledger.js";
import type { RunRecord } from "./protocol.js";
import type { Study } from "./types.js";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const forms = (name: string): string[] => [...new Set([name, name.replace(/[\s-]+/g, "")])];
const longestFirst = (labels: Map<string, string>) =>
  [...labels].flatMap(([name, label]) => forms(name).map((form) => [form, label] as const)).sort((a, b) => b[0].length - a[0].length);

function mask(text: string, labels: Map<string, string>): string {
  // One pass over all names, so a label already written is never masked again.
  const pairs = longestFirst(labels);
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${pairs.map(([form]) => escape(form)).join("|")})(?![\\p{L}\\p{N}])`, "giu");
  return text.replace(pattern, (hit) => pairs.find(([form]) => form.toLowerCase() === hit.toLowerCase())?.[1] ?? hit);
}

export function maskStudy(study: Study): { study: Study; labels: Map<string, string> } {
  const labels = new Map(study.candidates.map((c, i) => [c.name, `Product ${String.fromCharCode(65 + i)}`]));
  return {
    labels,
    study: {
      ...study,
      scenario: mask(study.scenario, labels),
      candidates: study.candidates.map((c) => ({ ...c, name: labels.get(c.name) as string, material: mask(c.material, labels) })),
    },
  };
}

export function findLeak(choice: string, labels: Map<string, string>): string | null {
  const names = [...labels.keys()].sort((a, b) => b.length - a.length);
  const found = (form: string) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(form)}(?![\\p{L}\\p{N}])`, "iu").test(choice);
  return names.find((name) => forms(name).some(found)) ?? null;
}

/** Puts ballots back under real names, counting a named masked product as that candidate. */
export function unmaskRun(run: RunRecord, labels: Map<string, string>): RunRecord {
  const real = [...labels.keys()];
  const byLabel = new Map([...labels].map(([name, label]) => [label, name]));
  return {
    ...run,
    productOrder: run.productOrder.map((label) => byLabel.get(label) ?? label),
    ballots: run.ballots.map((b) => {
      if (b.stage === "unprompted") return { ...b, label: labelUnprompted(b.ballot.choice, real) };
      const exact = labelExact(b.ballot.choice, [...byLabel.keys()]);
      const name = byLabel.get(exact);
      if (name) return { ...b, label: name };
      const leak = findLeak(b.ballot.choice, labels);
      return leak ? { ...b, label: leak, leak: true } : b;
    }),
  };
}

export const unmaskLedger = (ledger: Objection[], labels: Map<string, string>): Objection[] => {
  const byLabel = new Map([...labels].map(([name, label]) => [label, name]));
  return ledger.map((o) => ({ ...o, candidate: byLabel.get(o.candidate) ?? o.candidate }));
};
