# Story 5.6, the admin map pane: what held

Locked decisions, in the owner's meaning. Input for refining story 5.6 (#269).

- **Gold pin and path (A).** Pin 1 is gold and the dashed path is drawn only when the order comes from a stored position. With none: numbered card-coloured pins, no path, no marker. Rejected: never gold (the admin reads a cluster, not a next step); always gold (the Carte's look).
- **Where that rule lives (E).** In the admin (`RoundScreen` or a helper beside `round-list.ts`): `next: false` on every pin and an empty path when there is no position. `mapPins` and `round-map.ts` stay untouched. Rejected: an optional argument on `mapPins` (a second home for the rule, a shared function changed for one caller).
- **Only shared-code change (E).** `RoundMap`'s `recentre` becomes optional, with no button without it. Carte's tests pass unchanged.
- **Import (B).** `RoundScreen` imports `RoundMap` statically. `RoundMap-*` is already its own precached 4 KB chunk and Leaflet is already in the admin chunk through `MapCanvas`. The build and `check:precache` confirm it; the PR quotes the precache total on `main` and on the branch.
- **Layout (D).** The header and the agent Select stay on top at every width. Below `md`: the map at a fixed ~280 px, then the list. From `md`: list left, map right, sticky. Rejected: list first; a Liste/Carte toggle.
- **Refit (C).** The map is keyed by the agent's email, so choosing another agent remounts and refits. Rejected: a refit prop on `RoundMap`; no refit.
- **Zero pins (C).** The map pane mounts for any loaded round: default Brussels view, centred on the position when there is one. Rejected: hiding the pane; an in-pane message.
- **Fit.** `RoundMap` keeps fitting to the pins and the position together. No new prop.

Weak points accepted, to watch:
- With a position, gold pin 1 can be hours old; only "Position du …" says so.
- On a 390×844 phone the list starts below the fold.
- Remounting re-requests OSM tiles on every agent change (arrowing through the roster).
- An empty-looking map beside "Aucun arrêt…" is the common state once a round is done.
- A reading far from the stops shrinks them until the admin zooms. Not seen yet; revisit on the story 5.7 seeded Flow 3 run.
