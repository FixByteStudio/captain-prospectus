/**
 * A device's label for the Agents page ("iPhone · Safari", GH #307): a fixed
 * vocabulary picked from the User-Agent at login. Only the label is stored;
 * the raw header is never stored or logged (docs/security.md).
 */

/**
 * Order matters: an iPhone says "like Mac OS X", Android and ChromeOS say
 * "Linux", so the more specific families are tried first.
 */
const FAMILIES: [RegExp, string][] = [
  [/iPhone|iPod/, "iPhone"],
  [/iPad/, "iPad"],
  [/Android/, "Android"],
  [/CrOS/, "ChromeOS"],
  [/Macintosh|Mac OS X/, "Mac"],
  [/Windows/, "Windows"],
  [/Linux/, "Linux"],
];

/**
 * Order matters: Edge, Opera and Samsung Internet all say "Chrome", and every
 * Chromium and iOS browser says "Safari". iOS browsers carry their own token.
 */
const BROWSERS: [RegExp, string][] = [
  [/Edg(e|A|iOS)?\//, "Edge"],
  [/OPR\/|OPT\/|Opera/, "Opera"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Safari\//, "Safari"],
];

function first(ua: string, table: [RegExp, string][]): string | null {
  for (const [pattern, name] of table) if (pattern.test(ua)) return name;
  return null;
}

/** "<family> · <browser>", either half alone when the other is unknown, else null. */
export function deviceLabel(ua: string | null | undefined): string | null {
  if (!ua) return null;
  const parts = [first(ua, FAMILIES), first(ua, BROWSERS)].filter((p) => p !== null);
  return parts.length > 0 ? parts.join(" · ") : null;
}
