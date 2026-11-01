import { describe, expect, it } from "vitest";
import { labelExact, labelUnprompted, parseBallot } from "../src/ballots.js";

const names = ["Blue-Box", "Red Fox"];

describe("labelExact", () => {
  it("ignores case and surrounding whitespace", () => expect(labelExact("blue-box ", names)).toBe("Blue-Box"));
  it("treats a qualified name as Other", () => expect(labelExact("Blue-Box (hosted)", names)).toBe("Other: Blue-Box (hosted)"));
  it("treats a negation as Other", () => expect(labelExact("not Red Fox", names)).toBe("Other: not Red Fox"));
  it("keeps an Other answer without doubling the prefix", () => expect(labelExact("Other: Reftab", names)).toBe("Other: Reftab"));
});

describe("labelUnprompted", () => {
  it("matches a name inside free text", () => expect(labelUnprompted("Blue-Box hosted", names)).toBe("Blue-Box"));
  it("treats a negation as Other", () => expect(labelUnprompted("not Red Fox", names)).toBe("Other: not Red Fox"));
  it("treats a negation inside the answer as Other", () => expect(labelUnprompted("Definitely not Red Fox", names)).toBe("Other: Definitely not Red Fox"));
  it("keeps a pick when only a longer rival is negated", () => expect(labelUnprompted("Acme, not Plainbook Pro", ["Acme", "Plainbook Pro"])).toBe("Acme"));
  it("does not read but as a negation", () => expect(labelUnprompted("Not sure, but Acme", ["Acme"])).toBe("Acme"));
  it("still reads anything but as a negation", () => expect(labelUnprompted("anything but Acme", ["Acme"])).toBe("Other: anything but Acme"));
  it("does not read a hyphenated No as a negation", () => expect(labelUnprompted("No-fuss Acme", ["Acme"])).toBe("Acme"));
  it("tries the longest name first", () => expect(labelUnprompted("Blue-Box cloud", ["Blue", "Blue-Box"])).toBe("Blue-Box"));
  it("does not match inside a longer word", () => expect(labelUnprompted("Bluest", ["Blue"])).toBe("Other: Bluest"));
  it("handles regex characters in names", () => expect(labelUnprompted("C++ Tool now", ["C++ Tool"])).toBe("C++ Tool"));
  it("counts an unknown tool as Other with the raw answer", () => expect(labelUnprompted("Reftab", names)).toBe("Other: Reftab"));
});

describe("parseBallot", () => {
  it("reads JSON wrapped in prose", () => {
    const ballot = parseBallot('Sure.\n{"choice":"Acme","confidence":70,"reasoning":"r","changed_mind":true,"what_changed_it":"x"}\nDone.');
    expect(ballot).toEqual({ choice: "Acme", confidence: 70, reasoning: "r", changedMind: true, whatChangedIt: "x" });
  });
  it("ignores any picks_product field", () => {
    expect(parseBallot('{"choice":"Acme","picks_product":true}')).not.toHaveProperty("picks_product");
  });
  it("returns null on invalid JSON", () => expect(parseBallot("{nope")).toBeNull());
  it("returns null when choice is missing", () => expect(parseBallot('{"confidence":1}')).toBeNull());
});
