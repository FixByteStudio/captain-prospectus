# ADR-0032: A stored folded name for search

- Status: accepted
- Date: 2026-10-11
- Deciders: owner, Claude

## Context

`GET /api/admin/prospects?q=` and the CSV export match a substring of the prospect name
(GH #176). SQLite's `LIKE` and `lower()` fold ASCII case only, so in a French-language app
`?q=cafe` missed "Café du Port" and `?q=CAFÉ` missed "café" ([issue #188](https://github.com/FixbyteStudio/captain-prospectus/issues/188)).
D1 runs no user-defined SQL functions, so the fold has to happen in JS. Folding in the
Worker after the query would break the page and `total`, which SQL computes.

Matching against `dedupe_key` was rejected in #188. It is a composite of name,
coordinates and address, so a needle would also match address text. Changing `normalize()`
would change every stored dedupe key.

## Decision

We will store **`prospects.name_search = foldForSearch(name)`** (`src/shared/search.ts`):
NFKD, lowercase, drop the Combining Diacritical Marks block, and spell out the letters
that have no decomposition (`œ`, `æ`, `ß`, `đ`, `ø`, `ł`, `ı`, and final `ς` as `σ`). `q` is
folded by the same function and matched with `LIKE` against the column. Every Worker write of
`name` writes it in the same statement.

The column is nullable, so the deployed Worker survives the migration. Migration `0014`
fills every printable-ASCII name with `lower(name)`, which equals the fold on ASCII. The
daily sweep folds the remaining null rows, `NAME_SEARCH_FOLD_BATCH` a run (`search-backfill.ts`). A null row
matches the raw needle against `name`, as before this ADR.

There is no index on `name_search`, because a leading-wildcard `LIKE` cannot use one.

## Alternatives considered

| Option | Why not |
|---|---|
| Match `dedupe_key` | Matches address text, and keys are not plain names |
| Backfill only with a `replace()` chain in SQL | Characters the chain leaves out (Vietnamese, Greek, Cyrillic case) would be stored folded differently from the needle, with no way to tell those rows apart |
| Backfill only through the cron | Every row would wait for the sweep, about six days at 3,000 prospects |
| Fold in the Worker after reading every row | Breaks paging and `total`, and reads the whole table on every search |

## Consequences

- **`foldForSearch` is now stored data.** Changing it leaves every existing row folded the
  old way. Such a change needs a migration that nulls `name_search`, so that the sweep
  re-folds every row, and it must keep the function equal to `lower()` on ASCII, or
  `0014`'s backfill becomes wrong.
- Until the sweep has run, an accented name answers only to the old ASCII-only match. A row
  the previous Worker **inserts** between the migration and the deploy is null, and the next
  night folds it.
- A row the previous Worker **renames** in that window (PATCH, or a re-import of the same
  place) keeps the fold of its old name, which is not null, so the sweep never revisits it: it
  answers to its old name until renamed again. CI runs the deploy straight after the migration,
  so the window is short, but a failed deploy holds it open. If it happens, setting that row's
  `name_search` to null lets the next sweep re-fold it.
- When nothing is left to fold, the sweep still scans `prospects` once a night. That is a
  few thousand row reads ([free-tier-budget](../free-tier-budget.md)).
- A later release could add `NOT NULL` and drop the null fallback, once no row is null
  (`d1-migration`: a table rebuild).
