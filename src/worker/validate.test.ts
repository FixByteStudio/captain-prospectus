import { Hono } from "hono";
import * as z from "zod/mini";
import { describe, expect, it } from "vitest";
import { answersSchema } from "../shared/schemas";
import { MAX_VALIDATION_ISSUES, validate } from "./validate";

const app = new Hono().post("/", validate("json", z.object({ answers: answersSchema })), (c) =>
  c.json({ ok: true }),
);

function post(body: unknown) {
  return app.request("/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("validationFailed", () => {
  it("summarises each issue as its path and code only", async () => {
    const response = await post({ answers: { size: { nested: "x".repeat(1000) } } });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "validation",
      issues: [{ path: ["answers", "size"], code: "invalid_union" }],
    });
  });

  it("caps the list, so the 400 does not grow with the body", async () => {
    const answers = Object.fromEntries(
      Array.from({ length: 100 }, (_, i) => [`q${i}`, { nested: true }]),
    );
    const body = (await (await post({ answers })).json()) as { issues: object[] };
    expect(body.issues).toHaveLength(MAX_VALIDATION_ISSUES);
    for (const issue of body.issues) expect(Object.keys(issue).sort()).toEqual(["code", "path"]);
  });
});
