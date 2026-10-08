import { describe, expect, it } from "vitest";
import { AGENT_POSITION_ACCURACY_MAX_M } from "./constants";
import { agentPositionSchema, loginRequestSchema, syncRequestSchema } from "./schemas";

const position = { lat: 50.85, lng: 4.35, accuracy: 12, capturedAt: 1_760_000_000_000 };

describe("agentPositionSchema", () => {
  it("accepts a reading", () => {
    expect(agentPositionSchema.safeParse(position).success).toBe(true);
  });

  it.each([
    ["lat out of range", { lat: 200 }],
    ["lng out of range", { lng: -181 }],
    ["negative accuracy", { accuracy: -1 }],
    ["non-finite accuracy", { accuracy: Infinity }],
    ["accuracy over the cap", { accuracy: AGENT_POSITION_ACCURACY_MAX_M + 1 }],
    ["fractional capturedAt", { capturedAt: 1.5 }],
  ])("rejects %s", (_name, patch) => {
    expect(agentPositionSchema.safeParse({ ...position, ...patch }).success).toBe(false);
  });
});

describe("syncRequestSchema position", () => {
  it("keeps a valid position", () => {
    const parsed = syncRequestSchema.parse({ clientVersion: 1, position });
    expect(parsed.position).toEqual(position);
  });

  it("parses an invalid position to undefined instead of failing the request", () => {
    const parsed = syncRequestSchema.safeParse({
      clientVersion: 1,
      position: { ...position, lat: 200 },
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.position).toBeUndefined();
  });

  it("accepts a version 1 body with no position", () => {
    const parsed = syncRequestSchema.parse({ clientVersion: 1 });
    expect(parsed.position).toBeUndefined();
  });
});

describe("loginRequestSchema — code", () => {
  it("keeps the code exactly as typed", () => {
    expect(loginRequestSchema.parse({ kind: "code", code: " k7qm 2xpa " })).toEqual({
      kind: "code",
      code: " k7qm 2xpa ",
    });
  });

  it.each([
    ["an empty code", ""],
    ["a code over 200 characters", "A".repeat(201)],
  ])("rejects %s", (_name, code) => {
    expect(loginRequestSchema.safeParse({ kind: "code", code }).success).toBe(false);
  });
});
