import { describe, expect, it } from "vitest";
import { countsFor, sendableBy } from "./outbox-stamp";

describe("sendableBy", () => {
  it("returns false for an unconfirmed row, whatever the identity — backlog 013", () => {
    const row = { writtenBy: "a@example.com", unconfirmed: true as const };
    expect(sendableBy("a@example.com")(row)).toBe(false);
    expect(sendableBy("b@example.com")(row)).toBe(false);
  });

  it("still sends an unstamped (pre-v3) row to whoever asks first", () => {
    expect(sendableBy("a@example.com")({})).toBe(true);
  });

  it("sends a confirmed row only to the identity it names", () => {
    const row = { writtenBy: "a@example.com" };
    expect(sendableBy("a@example.com")(row)).toBe(true);
    expect(sendableBy("b@example.com")(row)).toBe(false);
  });
});

describe("countsFor", () => {
  it("counts an unconfirmed row as this identity's own, unlike sendableBy", () => {
    const row = { writtenBy: "a@example.com", unconfirmed: true as const };
    expect(countsFor("a@example.com")(row)).toBe(true);
    // Even for another identity — it is display bookkeeping for "my progress
    // this launch", not proof of who wrote it (that is what sendableBy is for).
    expect(countsFor("b@example.com")(row)).toBe(true);
  });

  it("otherwise agrees with sendableBy", () => {
    const mine = { writtenBy: "a@example.com" };
    const theirs = { writtenBy: "b@example.com" };
    expect(countsFor("a@example.com")(mine)).toBe(true);
    expect(countsFor("a@example.com")(theirs)).toBe(false);
  });
});
