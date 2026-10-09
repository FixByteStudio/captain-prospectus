import { describe, expect, it } from "vitest";
import { CROCKFORD, normaliseCredential } from "./credential";

describe("normaliseCredential", () => {
  it("uppercases and drops spaces and hyphens", () => {
    expect(normaliseCredential("k7qm 2xpa")).toBe("K7QM2XPA");
    expect(normaliseCredential(" K7QM-2XPA\t")).toBe("K7QM2XPA");
  });

  it("reads I and L as 1 and O as 0, in either case", () => {
    expect(normaliseCredential("iLoO")).toBe("1100");
  });

  it("leaves a normalised code as it is", () => {
    expect(normaliseCredential("K7QM2XPA")).toBe("K7QM2XPA");
  });

  it("has an alphabet of 32 distinct characters without I, L, O or U", () => {
    expect(new Set(CROCKFORD).size).toBe(32);
    expect(CROCKFORD).not.toMatch(/[ILOU]/);
  });
});
