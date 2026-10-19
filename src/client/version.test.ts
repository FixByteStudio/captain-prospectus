import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BUILD } from "./version";

describe("BUILD", () => {
  it("carries package.json's version", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
    expect(BUILD.version).toBe(pkg.version);
  });

  it("carries a 7-character commit, or dev when the build had no GITHUB_SHA", () => {
    expect(BUILD.commit).toBe(process.env.GITHUB_SHA?.slice(0, 7) || "dev");
  });
});
