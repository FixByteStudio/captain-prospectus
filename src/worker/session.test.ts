import { afterEach, describe, expect, it, vi } from "vitest";
import { newLoginCode } from "./session";

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
