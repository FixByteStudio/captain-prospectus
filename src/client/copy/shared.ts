/**
 * French strings both the field route and the admin render (ADR-0013, INVARIANT 15):
 * the app shell, vendored `ui/` components, errors and the enum label maps.
 * Split from the admin strings so the field precache stays small (GH #20).
 *
 * Enum labels must match the tables in docs/glossary.md. Copy style follows
 * CLAUDE.md: sentence case, active verbs, errors say what happened and what to do.
 */
import type {
  Outcome,
  ProspectType,
  QuestionType,
  RefusalReason,
  Source,
  Status,
} from "../../shared/constants";

export const sharedCopy = {
  appName: "Captain Prospectus",

  /** Used by vendored components that ship an English string (INVARIANT 15). */
  close: "Fermer",
  /** Breadcrumb's own overflow item (unused today: the top bar never has
   * enough levels to collapse), translated anyway since it ships in the
   * vendored file (INVARIANT 15). */
  breadcrumbMore: "Plus",
  /** The breadcrumb `<nav>`'s landmark name. */
  breadcrumb: "Fil d'Ariane",
  /** The vendored Spinner's accessible name (it ships "Loading"). */
  spinner: "Chargement",

  nav: {
    dashboard: "Tableau de bord",
    prospects: "Prospects",
    visits: "Visites",
    scripts: "Scripts",
    import: "Import",
    duplicates: "Doublons",
    orphans: "À rattacher",

    /** The band's meta subtitle, naming the current tab (spec-gh-65). */
    subtitle: {
      today: "Tournée",
      add: "Ajouter",
      map: "Carte",
    },

    /** The field tab bar's labels (spec-gh-66), bottom on a phone, in the band
     * from 768px. Tableau de bord only renders for an admin who is online. */
    tabs: {
      today: "Tournée",
      map: "Carte",
      add: "Ajouter",
      dashboard: "Tableau de bord",
    },
    /** The field tab bar's own `<nav>` landmark name (FieldTabs.tsx). */
    tabsLabel: "Navigation",

    /** A tab tapped while a field form has unsaved input (spec-gh-66, #74). */
    leaveGuard: {
      title: "Quitter sans enregistrer ?",
      body: "Ce que vous avez saisi n'est pas encore enregistré et sera perdu.",
      leave: "Quitter",
      cancel: "Annuler",
    },

    /** The band avatar has no menu; this is its only accessible name. */
    avatar: (email: string) => `Connecté en tant que ${email}`,

    /** Admin sidebar group labels, rendered uppercase through CSS (GH #63). */
    groups: {
      pilotage: "Pilotage",
      prospects: "Prospects",
      terrain: "Terrain",
    },
    /** The toggle button's aria-label names the action it performs. */
    openMenu: "Ouvrir le menu",
    collapseMenu: "Réduire le menu",
    /** The mobile drawer's dialog description — distinct from the toggle's action label. */
    drawerDescription: "Navigation de l'administration",
    /** A nav item's accessible name carries its pending count, in every mode. */
    withCount: (label: string, count: number) => `${label} (${count})`,
  },

  /** Defaults for the vendored Command's own English strings (INVARIANT 15) —
   * SearchPalette always overrides them, but the vendored file must still
   * carry no English literal of its own. */
  palette: {
    title: "Palette de commandes",
    description: "Rechercher une commande à exécuter…",
  },

  errors: {
    generic: "Une erreur est survenue. Réessayez.",
    /** First run with no network: there is no cached identity to fall back on. */
    offlineFirstRun:
      "Impossible de vous identifier hors ligne. Connectez-vous une fois avec du réseau.",
    forbidden: "Vous n'avez pas accès à cette page.",
    notFound: "Page introuvable.",
    /** The one button `ScreenState`'s shared retry Alert needs; the message
     *  above it stays the screen's own `loadFailed` string. */
    retry: "Réessayer",
    /** `downloadCsv`'s 401: Access sent the file request to its login page. */
    sessionExpired: "Votre session a expiré. Reconnectez-vous.",
  },

  attribution: "© les contributeurs OpenStreetMap",
} as const;

/** docs/glossary.md — stored in English, shown in French. */
export const OUTCOME_LABELS: Readonly<Record<Outcome, string>> = {
  no_contact: "Personne sur place",
  interested: "Intéressé",
  not_interested: "Pas intéressé",
  follow_up: "À relancer",
  converted: "Converti",
};

/**
 * Step 1's outcome hints (invariant 3, GH #123).
 *
 * Each describes what the agent saw or heard, never what it does to the
 * prospect's status — "Refus clair.", not "passe en Refusé" — so the phone
 * never previews `OUTCOME_TO_STATUS`. `VisitScreen.test.tsx` also asserts none
 * of these contains a `STATUS_LABELS` value.
 */
export const OUTCOME_HINTS: Readonly<Record<Outcome, string>> = {
  no_contact: "Fermé ou personne pour répondre. On repassera.",
  interested: "Ouvert à la discussion, pas encore inscrit sur la liste d'attente.",
  not_interested: "Refus clair.",
  follow_up: "Un rendez-vous à reprendre.",
  converted: "Déjà inscrit sur la liste d'attente.",
};

/** docs/glossary.md — REFUSAL_REASONS, in list order. */
export const REFUSAL_REASON_LABELS: Readonly<Record<RefusalReason, string>> = {
  too_many_devices: "Trop d'applis / de tablettes",
  wait_and_see: "Attend de voir (rien n'est lancé)",
  fee_distrust: "Méfiance sur les frais",
  no_need: "Pas besoin, ça marche comme ça",
  out_of_target: "Hors cible / fermé",
  no_reason_given: "Refus sans raison",
  other: "Autre",
};

export const STATUS_LABELS: Readonly<Record<Status, string>> = {
  new: "Nouveau",
  assigned: "Assigné",
  follow_up: "À relancer",
  interested: "Intéressé",
  converted: "Converti",
  rejected: "Refusé",
};

export const SOURCE_LABELS: Readonly<Record<Source, string>> = {
  csv: "CSV",
  // Both map sources say "Carte" first, because that is the screen the admin
  // used; the provider is what tells them why two rows for the same restaurant
  // exist (ADR-0020).
  osm: "Carte (OSM)",
  google: "Carte (Google)",
  field: "Terrain",
};

export const QUESTION_TYPE_LABELS: Readonly<Record<QuestionType, string>> = {
  yes_no: "Oui / non",
  single: "Choix unique",
  multi: "Choix multiple",
  text: "Texte",
  number: "Nombre",
  rating: "Note (1 à 5)",
};

export const TYPE_LABELS: Readonly<Record<ProspectType, string>> = {
  restaurant: "Restaurant",
  fast_food: "Restauration rapide",
  cafe: "Café",
  bar: "Bar",
  food_truck: "Food truck",
  other: "Autre",
};
