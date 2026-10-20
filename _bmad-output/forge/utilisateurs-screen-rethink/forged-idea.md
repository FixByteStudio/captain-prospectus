# Utilisateurs screen: tabs instead of two stacked tables

Replaces #594's layout (two sections, each its own table). Owner, 2026-10-20.

- **Tabs**: shadcn `Tabs` « Agents n » (default) / « Administrateurs n », one table under the selected tab. No role badge or Rôle column (ADR-0037: role fixed at creation).
- **First column** is « Nom » (the add dialog's word), not « Utilisateur », so the page title is the only place that says it.
- **Désactivés (n)** toggle per tab, under that tab's list.
- **After adding a user**, open the tab their row lands in.
- **Phone**: tabs full width, two equal halves, over today's list rows; the empty Agents tab keeps « Aucun agent. Ajoutez-en un pour lancer les tournées. »
- Unchanged: header, add dialog, Inscription badge, device lines, row menu, dialogs.

Rejected:
- One table with an Agent/Admin badge: the owner wants admins out of the way.
- « Nom et e-mail » / « Utilisateur »: too long, or a repeat of the title.

Open for refinement: tab state in the URL (assumed no; Agents by default).

Mockups: `mockup-b-nom.png` (desktop), `mockup-b-phone.png` (phone).
