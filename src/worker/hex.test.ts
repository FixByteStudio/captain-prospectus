import { describe, expect, it } from "vitest";
import { sha256Hex, toHex } from "./hex";

describe("toHex", () => {
  it("pads every byte to two lowercase digits", () => {
    expect(toHex(new Uint8Array([0, 10, 255]))).toBe("000aff");
  });
});

describe("sha256Hex", () => {
  it("matches the published SHA-256 of 'abc'", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
