/** Lowercase hex, two digits a byte: the form every hash and random id is stored in. */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 of a UTF-8 string, as hex: the map imports' cache keys. */
export async function sha256Hex(input: string): Promise<string> {
  return toHex(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input))),
  );
}
