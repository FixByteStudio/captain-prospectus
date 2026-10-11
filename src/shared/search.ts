/**
 * The folded form of a prospect name that `q` matches against — ADR-0032.
 *
 * SQLite's `LIKE` and `lower()` fold ASCII case only, so the name is folded
 * here, stored in `prospects.name_search`, and the needle folded the same way.
 * Changing this function changes what every stored row means: see the ADR.
 *
 * On printable ASCII it must equal SQLite's `lower()`, because the migration
 * that added the column backfilled ASCII names with exactly that.
 */

/** Letters with no Unicode decomposition, spelled the way a French keyboard types them. */
const SPELLED_OUT: Record<string, string> = {
  œ: "oe",
  æ: "ae",
  ß: "ss",
  đ: "d",
  ð: "d",
  ø: "o",
  ł: "l",
  ı: "i",
  // Context-dependent lowercase: "ΟΣ" gives a final "ς", "ΟΣΑ" a medial "σ".
  ς: "σ",
};
const SPELLED_OUT_RE = new RegExp(`[${Object.keys(SPELLED_OUT).join("")}]`, "g");

export function foldForSearch(value: string): string {
  return (
    value
      // Decompose first, so a compatibility form that expands to capitals
      // ("™", mathematical letters) is lowercased too. NFKD also folds "ﬁ".
      .normalize("NFKD")
      .toLowerCase()
      // Only the Combining Diacritical Marks block: `\p{Diacritic}` would also
      // strip ASCII `^` and `` ` ``, and `\p{M}` the vowel signs of Indic scripts.
      .replace(/[\u0300-\u036f]/g, "")
      .replace(SPELLED_OUT_RE, (ch) => SPELLED_OUT[ch] ?? ch)
  );
}
