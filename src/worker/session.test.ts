import { afterEach, describe, expect, it, vi } from "vitest";
import { newLoginCode, newPassphrase } from "./session";

/** Fixed bytes in, so a shift or mask slip that cuts the code's 40 bits shows. */
function stubBytes(bytes: number[]) {
  vi.spyOn(crypto, "getRandomValues").mockImplementation(
    <T extends ArrayBufferView | null>(array: T): T => {
      if (array instanceof Uint8Array) array.set(bytes);
      return array;
    },
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("newLoginCode", () => {
  it("reads 5 zero bytes as eight 0s", () => {
    stubBytes([0, 0, 0, 0, 0]);
    expect(newLoginCode()).toBe("00000000");
  });

  it("reads 5 0xff bytes as eight Zs", () => {
    stubBytes([0xff, 0xff, 0xff, 0xff, 0xff]);
    expect(newLoginCode()).toBe("ZZZZZZZZ");
  });

  it("splits the 40 bits into 5-bit groups, most significant first", () => {
    // 00000001 00100011 01000101 01100111 10001001
    // → 00000 00100 10001 10100 01010 11001 11100 01001 → 0 4 17 20 10 25 28 9
    stubBytes([0x01, 0x23, 0x45, 0x67, 0x89]);
    expect(newLoginCode()).toBe("04HMASW9");
  });
});

describe("newPassphrase", () => {
  it("draws 13 bytes and reads twenty 0s from zero bytes", () => {
    stubBytes(Array<number>(13).fill(0));
    expect(newPassphrase()).toBe("00000000000000000000");
  });

  it("reads 13 0xff bytes as twenty Zs", () => {
    stubBytes(Array<number>(13).fill(0xff));
    expect(newPassphrase()).toBe("ZZZZZZZZZZZZZZZZZZZZ");
  });

  it("keeps the top 100 bits, most significant first, and drops the last 4", () => {
    // The first 5 bytes are the login-code vector; the last byte's low nibble
    // (the 4 spare bits) must not show.
    stubBytes([0x01, 0x23, 0x45, 0x67, 0x89, 0, 0, 0, 0, 0, 0, 0, 0x0f]);
    expect(newPassphrase()).toBe("04HMASW9000000000000");
  });

  it("uses Crockford characters only", () => {
    expect(newPassphrase()).toMatch(/^[0-9A-HJKMNP-TV-Z]{20}$/);
  });
});
