import { Hono } from "hono";
import { DrizzleQueryError } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { isD1DailyLimitError } from "./errors";
import { onError } from "./index";
import type { AppEnv } from "./types";

const READ_LIMIT_MESSAGE =
  "Your account has exceeded D1's free tier daily row read limit. If you would like to continue querying, please upgrade your plan.";
const WRITE_LIMIT_MESSAGE =
  "Your account has exceeded D1's free tier daily row write limit. If you would like to continue querying, please upgrade your plan.";

describe("isD1DailyLimitError", () => {
  it("is true for the documented read-limit message, bare", () => {
    expect(isD1DailyLimitError(new Error(READ_LIMIT_MESSAGE))).toBe(true);
  });

  it("is true for the documented write-limit message, bare", () => {
    expect(isD1DailyLimitError(new Error(WRITE_LIMIT_MESSAGE))).toBe(true);
  });

  it("is true wrapped as a DrizzleQueryError, D1's message on the cause", () => {
    const cause = new Error(READ_LIMIT_MESSAGE);
    const wrapped = new DrizzleQueryError("select 1", [], cause);
    expect(isD1DailyLimitError(wrapped)).toBe(true);
  });

  it("is false for an unrelated Error", () => {
    expect(isD1DailyLimitError(new Error("boom"))).toBe(false);
  });

  it("is false for a non-Error throw", () => {
    expect(isD1DailyLimitError("boom")).toBe(false);
    expect(isD1DailyLimitError(undefined)).toBe(false);
  });

  it("is false for a DrizzleQueryError whose cause is a different D1 error", () => {
    const cause = new Error("D1_ERROR: UNIQUE constraint failed: prospects.dedupe_key");
    const wrapped = new DrizzleQueryError("insert into prospects ...", [], cause);
    expect(isD1DailyLimitError(wrapped)).toBe(false);
  });

  it("is false when a bound value merely contains the phrase, unrelated failure", () => {
    // DrizzleQueryError's own message is `Failed query: <sql>\nparams: <values>`
    // (drizzle-orm/errors.js) — a note that happens to contain the daily-limit
    // text must not turn an unrelated failure into a false 503 (INVARIANT 5:
    // the client must not be told to wait for a quota that was never hit).
    const cause = new Error("D1_ERROR: UNIQUE constraint failed: prospects.dedupe_key");
    const wrapped = new DrizzleQueryError(
      "insert into visits (notes) values (?)",
      ["Your account has exceeded D1's free tier daily row write limit."],
      cause,
    );
    expect(isD1DailyLimitError(wrapped)).toBe(false);
  });
});

/** A throwing app mounted on the real onError, so this needs no route in routes/admin.ts. */
function buildThrowingApp(err: unknown) {
  return new Hono<AppEnv>().onError(onError).get("/boom", () => {
    throw err;
  });
}

describe("onError", () => {
  it("answers 503 with error: quota for a wrapped daily-limit error", async () => {
    const cause = new Error(WRITE_LIMIT_MESSAGE);
    const app = buildThrowingApp(new DrizzleQueryError("insert into visits ...", [], cause));

    const response = await app.request("/boom");

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: "quota" });
  });

  it("answers 500 with error: internal for any other error", async () => {
    const app = buildThrowingApp(new Error("boom"));

    const response = await app.request("/boom");

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: "internal" });
  });

  it("logs no message or bound values, even when the error carries one", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const app = buildThrowingApp(new Error("leaked secret-note in query params"));

      await app.request("/boom");

      expect(spy).toHaveBeenCalledTimes(1);
      const serialized = JSON.stringify(spy.mock.calls[0]);
      expect(serialized).not.toContain("secret-note");
    } finally {
      spy.mockRestore();
    }
  });
});
