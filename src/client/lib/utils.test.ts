/**
 * Pins GH #136: a --text-* size token must survive next to a text colour,
 * in either order, while Tailwind's own xs…9xl scale keeps merging as today.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cn } from "./utils";

const TOKENS = ["display", "title", "heading", "body-field", "body", "label", "meta", "overline"];

describe("cn", () => {
  it.each(TOKENS)("keeps text-%s beside a colour", (token) => {
    expect(cn(`text-${token}`, "text-success")).toBe(`text-${token} text-success`);
  });

  it("reads every --text-* token app.css declares, so a ninth one fails here first", () => {
    const css = readFileSync(fileURLToPath(new URL("../styles/app.css", import.meta.url)), "utf-8");
    const declared = [...css.matchAll(/--text-([a-z-]+):/g)]
      .map((m) => m[1] ?? "")
      .filter(
        (name) =>
          !["line-height", "letter-spacing", "font-weight"].some((sub) => name.endsWith(sub)),
      );

    expect(declared.length).toBeGreaterThan(0);
    for (const name of declared) {
      expect(TOKENS).toContain(name);
    }
  });

  it("lets the last of two size tokens win", () => {
    expect(cn("text-meta", "text-title")).toBe("text-title");
  });

  it("lets the last of two colours win", () => {
    expect(cn("text-success", "text-destructive")).toBe("text-destructive");
  });

  it("still merges Tailwind's own scale against itself", () => {
    expect(cn("text-xs", "text-sm")).toBe("text-sm");
  });

  it("keeps Tailwind's own scale beside a colour, as today", () => {
    expect(cn("text-xs", "text-success")).toBe("text-xs text-success");
  });

  it("drops a preceding leading-* when a size token follows it (a known trap)", () => {
    expect(cn("leading-none", "text-title")).toBe("text-title");
  });

  it("keeps leading-* when it follows the size token instead", () => {
    expect(cn("text-title", "leading-none")).toBe("text-title leading-none");
  });
});
