import { describe, expect, it } from "vitest";
import { foldForSearch } from "./search";

/** Matrix: _bmad-output/implementation-artifacts/spec-gh-188-accent-insensitive-search.md */
describe("foldForSearch", () => {
  it("drops accents and case together", () => {
    expect(foldForSearch("Café du Port")).toBe("cafe du port");
    expect(foldForSearch("CAFÉ")).toBe(foldForSearch("café"));
  });

  it("spells out the French ligatures", () => {
    expect(foldForSearch("Le Bœuf")).toBe("le boeuf");
    expect(foldForSearch("ŒUVRE")).toBe("oeuvre");
    expect(foldForSearch("Æ")).toBe("ae");
  });

  it("strips stacked Vietnamese marks", () => {
    expect(foldForSearch("Phở 75")).toBe("pho 75");
  });

  it("spells out the letters that have no decomposition", () => {
    expect(foldForSearch("Phở Đức")).toBe("pho duc");
    expect(foldForSearch("Łódź")).toBe("lodz");
    expect(foldForSearch("Smørrebrød")).toBe("smorrebrod");
    expect(foldForSearch("Straße")).toBe("strasse");
    expect(foldForSearch("Kızılay")).toBe("kizilay");
    expect(foldForSearch("İstanbul")).toBe("istanbul");
  });

  it("folds Greek sigma the same wherever it stands", () => {
    expect(foldForSearch("ΟΣΑ")).toContain(foldForSearch("ΟΣ"));
  });

  it("lowercases what a compatibility form expands to", () => {
    expect(foldForSearch("Bistro™")).toBe("bistrotm");
    expect(foldForSearch("𝚨")).toBe(foldForSearch("α"));
  });

  it("keeps other scripts as they are", () => {
    expect(foldForSearch("餃子館")).toBe("餃子館");
    expect(foldForSearch("मसाला")).toBe("मसाला");
  });

  it("folds compatibility forms", () => {
    expect(foldForSearch("ﬁne")).toBe("fine");
  });

  it("leaves nothing of a needle made only of combining marks", () => {
    expect(foldForSearch("\u0301\u0300")).toBe("");
  });

  // The migration backfilled ASCII names with SQLite's lower(): the two must agree.
  it("equals lower() on every printable ASCII character", () => {
    let ascii = "";
    for (let code = 0x20; code <= 0x7e; code++) ascii += String.fromCharCode(code);
    const sqliteLower = ascii.replace(/[A-Z]/g, (ch) => ch.toLowerCase());
    expect(foldForSearch(ascii)).toBe(sqliteLower);
  });
});
