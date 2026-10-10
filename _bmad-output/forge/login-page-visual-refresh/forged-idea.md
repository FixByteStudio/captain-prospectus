# /login visual refresh — forged

Visual only. Fields, the code/admin swap, alerts, lockout, offline and landing stay as `docs/design.md › The login page` has them.
Reference render: `mockups/3o-final-mobile.png`, `mockups/3o-final-desktop.png`, `mockups/3o-final.html`.

## Locked
- **Page:** plain `background`, no band, no ruled background. Content centred; vertically centred from `md` up.
- **Brand above the card, centred, both sizes:** navy mark (48px phone, 56px desktop), then "Captain Prospectus" (`copy.appName`) at 22px / 700.
- **Card, both sizes:** max 24rem, soft shadow, 4px **gold** top edge.
- **Card header, centred:** "Connexion" at `text-title` (20px / 600), stays the `h1`; the lede under it.
- **Type steps down smoothly:** brand 22/700 → Connexion 20/600 → field labels 16/500.

## The gold-rule amendment (lands in `docs/design.md › Colour`, same PR)
After "Gold is always a fill, with navy on top and a `primary-edge` border." add:
> One decorative exception: the 4px top edge of the login card ([The login page](#the-login-page)) — the first screen anyone sees carries the brand's gold once more. Nowhere else.

## The build must carry
- A navy-ink mark in `public/` (`docs/brand/logo.svg`, ~5 KB): quote the new precache total against 1,000 KiB. Dark theme swaps back to `/mark.svg`.
- A `text-brand` token (1.375rem / 700) in `@theme` — no arbitrary size.
- `docs/design.md › The login page` rewritten: no band, brand above the card, centred header, gold edge.
- No new copy; `App.test.tsx` keeps finding `/login` by `copy.login.title`.

## Rejected
- Split screen (1): the phone stays unchanged, so only the admin would see the redesign.
- Navy hero (2): the hero pushes the form down the screen.
- Band and ruled background: they read as clutter.
- Logo alone with no name: the app's name would appear nowhere on the page.
- "Connexion à Captain Prospectus" as a single heading: it wraps awkwardly.
- Navy edge: the owner chose gold, with the exception written down.
- No card on phone: the owner kept the card.
- iPhone SE-sized phones are not a target.
