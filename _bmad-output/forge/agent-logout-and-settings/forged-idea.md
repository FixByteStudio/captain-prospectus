# Forged: the field account card (GH #561)

**Decided**
- No agent logout. Signing back in needs a fresh admin code; the admin's « Révoquer » ends a device's session; a borrowed phone signs in with a new code.
- Tapping the field avatar opens a small native-popover card under it (shadcn look, no Radix menu).
- Card: email (12px, never truncated; the card widens, a long email wraps before « @ ») and role; « Tableau de bord » for an online admin; Apparence; the version.
- Apparence = Système / Clair / Sombre as native radios with icons (monitor/sun/moon). Système is the default and clears the stored theme. A choice applies at once. One theme setting per phone, shared with the admin side.
- The dashboard leaves the tab bar: four tabs for everyone, the admin's way to it is the card, behind the leave guard.
- Version = release + deploy commit, « Version 0.1.0 · a605114 » (« · dev » locally), stamped by CI in its own commit.
- One story, no epic, no ADR.

**Rejected**
- A colour picker: the tokens' contrast tests forbid it.
- A full settings page or bottom sheet: two items don't fill a page.
- A shadcn DropdownMenu: Radix Menu + Popper weight, and its radios aren't native.
- Keeping the dashboard tab: the tab bar is the crowded space; a vertical card has room.
- A date in the version line: the release + commit is enough.

**Still open**
- Léa's and François's iOS versions (popover needs iOS 17+).
