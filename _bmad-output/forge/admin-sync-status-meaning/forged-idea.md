# Admin sidebar footer: the recap card

## Locked
- A small-font recap card at the bottom of the admin sidebar, on every admin page. Not a dashboard: three recap lines and the email, no more.
- Headline: **« N / M agents actifs aujourd'hui »**. Actif means a visit received today (the G6 definition behind « Agents en tournée »). M is the active roster.
- Second line: « X visites aujourd'hui ». Meta line: « Dernière visite reçue il y a … », or « Aucune visite aujourd'hui ».
- The signed-in email, informative only. No menu: the top-bar avatar menu stays where it is.
- Icon rail: initials plus a pulse dot, with the lines in a Tooltip. Phone drawer: the full card.
- Data: one small admin read, one 15 s poll. No agent-side change and no sync contract change. Costs phones nothing (admin chunk, ADR-0019).

## Rejected
- « Synchronisé à l'instant »: an admin has no sync, so it would describe a browser refresh and lie while an agent is offline.
- A present-tense « en tournée » headline: it needs working hours nobody defines, and « 0 / 2 » at 19:00 reads as a disaster.
- An account menu in the footer: the email is informative only.
- A build line: there is no build id yet, and no menu to hold it.

## Out of scope: its own epic
Dated rounds (a round per agent per date, with X stops and the number left), a mandatory « Commencer la tournée » swipe that reveals the round, a « Terminer la tournée » swipe, a screen of all rounds including done visits, and hours worked per round as a stat. It needs ADRs: a new agent insert type (ADR-0007, invariant 2), a sync contract bump, and a working-time record (privacy).
