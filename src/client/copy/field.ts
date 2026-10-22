/**
 * The copy every module outside `src/client/admin/` imports: shared + field
 * sections, without the admin ones (GH #20). Importing `../copy` instead would
 * pull every admin string into the chunk the field route precaches, and
 * `check:precache` fails when `copy/admin.ts` reaches a precached chunk.
 */
import { sharedCopy } from "./shared";

export {
  OUTCOME_HINTS,
  OUTCOME_LABELS,
  QUESTION_TYPE_LABELS,
  REFUSAL_REASON_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
} from "./shared";

export const copy = {
  ...sharedCopy,

  /** The account card the band avatar opens (AccountMenu.tsx, GH #561). Not
   * `account`: the admin copy owns that key, and the full aggregator spreads it over this one. */
  accountCard: {
    /** Only an agent reaches the field side (ADR-0037). */
    role: "Agent",
    appearance: "Apparence",
    theme: { system: "Système", light: "Clair", dark: "Sombre" },
    /** « Version 0.1.0 · a605114 », or « · dev » for a build with no commit (version.ts). */
    version: ({ version, commit }: { version: string; commit: string }) =>
      `Version ${version} · ${commit}`,
  },

  /** Carte (spec-gh-121): the round on a map, sharing `useRound()`'s list with
   * `today` below rather than a second vocabulary for the same stops. */
  carte: {
    offline: "Carte indisponible hors ligne. La liste reste à jour.",
    showList: "Voir la liste",
    recentre: "Me recentrer",
    /** The map canvas's own accessible name (`role="application"`, same
     * pattern as MapCanvas's `aria-label`). */
    label: "Carte de la tournée du jour",
    /** The persistent sheet's landmark name, phone only (spec-gh-122). */
    sheetLabel: "Arrêt sélectionné",
    /** A pin's accessible name, so it reads as a stop and not a bare number
     * (spec-gh-122, `RoundMap`'s `onSelect` markers). */
    pinLabel: (n: number, name: string) => `Arrêt ${n} · ${name}`,
    /** The tablet left pane's landmark name (`CarteList`). */
    listLabel: "Arrêts de la tournée",
  },

  today: {
    title: "Tournée du jour",
    /** Every stop has a visit today. */
    allDone: "Tous les arrêts sont faits.",
    /** Every stop left unvisited: the day holds none, which is not « all done ». */
    nothingLeft: "Plus aucun arrêt dans votre tournée aujourd'hui.",
    /** The visited stops live in Carnet: the muted line and the button under both done states. */
    findInCarnet: "Retrouvez-les dans Carnet.",
    openCarnet: "Ouvrir le carnet",
    /** A prospect that joined the tournée after the swipe. */
    joiner: "Nouveau",
    distanceUnknown: "Position inconnue",
    navigate: "Y aller",
    visit: "Visiter",
    /** The stops are a walking order, so the start screen states its own length. */
    remaining: (n: number) => (n === 1 ? "1 arrêt" : `${n} arrêts`),
    /** The counter's second half, after `{n}` in display size (docs/design.md › Next-stop card). */
    progressOf: (total: number) => `sur ${total}`,
    /** The bar's accessible name; 0 and 1 are singular in French. Arrêts, never visites. */
    progressLabel: (n: number, total: number) =>
      n <= 1 ? `${n} arrêt fait sur ${total}` : `${n} arrêts faits sur ${total}`,
    nextStop: "Prochain arrêt",
    /** Two cases, one message: a field prospect the server has not accepted
     * yet, or a stop whose visit is still sitting in the outbox. Either way
     * nothing about the round has changed server-side (invariants 2, 3). */
    notSynced: "Pas encore envoyé",
    /** "type · address", or the type alone when there is no address. */
    meta: (type: string, address: string | null) => (address ? `${type} · ${address}` : type),
    locating: "Recherche de votre position…",
  },

  /** Carnet: today's visited stops (docs/design.md › Carnet, ADR-0036). */
  carnet: {
    title: "Carnet",
    empty: "Aucun arrêt fait aujourd'hui.",
    emptyHint: "Chaque arrêt enregistré arrive ici, avec son résultat.",
    /** Shown from the second visit of the day on. */
    visits: (n: number) => `${n} visites`,
    /** The row's one link: stop number when it has one, outcome and time, then the action. */
    rowLabel: (n: number | null, name: string, outcome: string, time: string) =>
      `${n === null ? "" : `Arrêt ${n} · `}${name} · ${outcome}, à ${time}. Rouvrir`,
  },

  /** Before the swipe (docs/design.md › Before the swipe, ADR-0036). */
  start: {
    /** No pull ever succeeded on this phone. */
    neverLoadedTitle: "Tournée pas encore chargée",
    neverLoadedBody:
      "Connectez-vous à internet une fois pour récupérer votre tournée. Elle restera ensuite disponible hors ligne.",
    /** A pull happened and a swipe would freeze no stop. */
    nothingAssignedTitle: "Aucune tournée aujourd'hui",
    nothingAssignedBody:
      "Aucun prospect ne vous est assigné pour l'instant. Votre tournée s'affichera ici dès qu'un admin vous en assigne.",
    explainer: "Les arrêts seront numérotés au départ, du plus proche au plus loin.",
    /** The preview lists seven stops, then this line; 1 is singular. */
    more: (n: number) => (n === 1 ? "et 1 autre arrêt" : `et ${n} autres arrêts`),
    previewLabel: "Arrêts de la tournée",
    swipeLabel: "Glisser pour commencer la tournée",
    /** The button's accessible name, whatever the visible label says. */
    swipeName: "Commencer la tournée",
    waiting: "En attente de votre position",
    starting: "Démarrage…",
    storageError:
      "Impossible de commencer la tournée sur cet appareil. Libérez de l'espace de stockage, puis réessayez.",
  },

  /** The location dialog over the start screen (docs/design.md › The location dialog). */
  location: {
    title: "Activez la localisation",
    description: "Afin de préparer votre tournée et démarrer votre journée.",
    activate: "Activer",
    /** The web app cannot open the phone's settings, so the line names them. */
    settings: "Ouvrez Réglages › Localisation, puis revenez ici.",
    coarse: (meters: number) => `Précision : ${meters} m. On affine…`,
    refused: "La localisation est refusée sur ce téléphone.",
    unavailable: "Position introuvable. Sortez à découvert si possible, puis touchez Activer.",
  },

  visit: {
    title: "Nouvelle visite",
    flyerGiven: "Flyer remis",
    outcome: "Résultat",
    followUpAt: "Relancer le",
    notes: "Notes",
    save: "Enregistrer la visite",
    saved: "Visite enregistrée. Elle partira à la prochaine synchronisation.",
    followUpRequired: "Indiquez une date de relance pour ce résultat.",
    previousVisits: "Visites précédentes",
    back: "Retour à la tournée",
    /** Step 1's back link when the form was opened from Carnet. */
    backToCarnet: "Retour au carnet",
    outcomeRequired: "Choisissez un résultat.",
    /** The when step, shared by À relancer and Personne sur place
     * (when-step.md, CAP-2). */
    when: "Quand ?",
    whenToday: "Aujourd'hui",
    whenDate: "Choisir une date",
    whenRequired: "Choisissez quand relancer : aujourd'hui ou une date.",
    followUpInvalid: "Cette date n'existe pas. Vérifiez le jour et le mois.",
    followUpNotAfterToday: "Choisissez une date à partir de demain.",
    notesTooLong: "Ces notes sont trop longues. Raccourcissez-les.",
    /** Pas intéressé's step 2 (refusal-reasons.md, CAP-1/CAP-2). */
    refusalReason: "Raison du refus",
    refusalReasonRequired: "Choisissez une raison du refus.",
    refusalOtherNeedsNote: "Précisez la raison dans les notes.",
    noPreviousVisits: "Première visite à cet endroit.",
    historyOffline: "Les visites précédentes s'afficheront au retour du réseau.",
    flyerHint: "Cochez si vous avez laissé un flyer sur place.",
    /** The step indicator, after its gold dot (DESIGN.md › Step indicator;
     * docs/design.md, "The script is the second screen"). `name` is the
     * step's own name — `visit.outcome` or `visit.questions` — never the
     * prospect's, so the two steps read as one flow. */
    step: (n: number, total: number, name: string) => `Étape ${n} sur ${total} · ${name}`,
    saving: "Enregistrement…",
    /**
     * The outbox write itself failed, so nothing is queued and nothing will be
     * sent. Says the storage is full because that is the realistic cause on a
     * phone, and it is the one thing the agent can act on.
     */
    saveFailed:
      "Impossible d'enregistrer la visite sur cet appareil. Libérez de l'espace de stockage, puis réessayez.",

    /* --- the script's questions, step 2 (design.md) --- */
    continue: "Continuer",
    /** The back link on step 2 names where it goes: step 1, draft intact. */
    backToOutcome: "Résultat",
    questions: "Questions",
    answerRequired: "Répondez à cette question.",
    answerInvalid: "Cette réponse n'est pas valide. Vérifiez-la.",
    yes: "Oui",
    no: "Non",
    /** The number stepper's − / + buttons (EXPERIENCE.md › Voice and tone). */
    stepDown: "Diminuer",
    stepUp: "Augmenter",

    /* --- the save confirmation, sheet or dialog (EXPERIENCE.md › Save sheet) --- */
    confirm: {
      overline: "Validation",
      title: "Enregistrer cette visite ?",
      place: "Établissement",
      flyer: "Flyer",
      /** 0 and 1 are singular in French, as `today.progressLabel` does for 1. */
      answers: (n: number) => `${n} ${n <= 1 ? "réponse" : "réponses"}`,
      reassurance: "La visite reste sur ce téléphone jusqu'à la prochaine synchronisation.",
      save: "Enregistrer",
      edit: "Modifier",
    },
  },

  fieldProspect: {
    title: "Ajouter un prospect",
    name: "Nom",
    namePlaceholder: "Le nom sur la devanture",
    nameRequired: "Indiquez le nom de l'établissement.",
    type: "Type",
    address: "Adresse",
    phone: "Téléphone",
    optional: "facultatif",
    position: "Position",
    useMyPosition: "Utiliser ma position",
    /** Both already `formatCoordinate`d: "50,8466 · 4,3528". */
    positionSet: (lat: string, lng: string) => `${lat} · ${lng}`,
    positionNone: "Aucune position enregistrée",
    positionRefresh: "Actualiser",
    save: "Ajouter",
    saving: "Ajout…",
    saved: "Prospect ajouté. Il partira à la prochaine synchronisation.",
    cancel: "Annuler",
    addressTooLong: "Cette adresse est trop longue. Raccourcissez-la.",
    phoneTooLong: "Ce numéro est trop long. Vérifiez-le.",
    saveFailed:
      "Impossible d'enregistrer ce prospect sur cet appareil. Libérez de l'espace de stockage, puis réessayez.",
  },

  sync: {
    /** The dot's accessible name when nothing is pending and the last sync
     * worked — every dot state names itself, this one included. */
    synced: "Synchronisé",
    pending: (count: number) =>
      count === 1 ? "1 élément en attente d'envoi" : `${count} éléments en attente d'envoi`,
    syncing: "Synchronisation…",
    lastSync: (when: string) => `Dernière synchronisation : ${when}`,
    never: "Jamais synchronisé",
    offline: "Hors ligne. Vos visites sont conservées et partiront au retour du réseau.",
    /** A cache-sourced identity, not yet confirmed by the server
     * (docs/backlog/013) — distinct from `offline`, since the network may be
     * up; nothing sends until `/api/me` confirms who is really signed in. */
    unconfirmed: "Vérification de votre session. Vos visites sont conservées et partiront ensuite.",
    authExpired: "Votre session a expiré. Reconnectez-vous pour synchroniser.",
    upgrade: "Une mise à jour est nécessaire. Vos visites sont conservées.",
    failed: "La synchronisation a échoué. Nouvel essai automatique.",
    /** Rows another agent queued on this device; never sent under this one. */
    heldBack: (count: number) =>
      count === 1
        ? "1 élément appartient à un autre agent et n'a pas été envoyé"
        : `${count} éléments appartiennent à un autre agent et n'ont pas été envoyés`,
    /** Opens /login (docs/domains/identity-access.md); the outbox is untouched. */
    reconnect: "Se reconnecter",
  },

  /** `/login` (docs/design.md › The login page, ADR-0029): the code form by
   * default, the admin form behind "Accès administrateur". */
  login: {
    title: "Connexion",
    codeLede: "Entrez le code que vous a donné un administrateur.",
    code: "Code",
    codeRequired: "Saisissez votre code.",
    codeRefused:
      "Ce code ne fonctionne pas. Il a peut-être expiré ou déjà servi\u00a0: demandez-en un nouveau.",
    toAdmin: "Accès administrateur",
    toCode: "Retour au code",
    adminLede: "Connectez-vous avec votre adresse e-mail et un code généré par un administrateur.",
    email: "Adresse e-mail",
    submit: "Se connecter",
    emailRequired: "Saisissez votre adresse e-mail.",
    /** One sentence whichever part was wrong (ADR-0038). */
    adminRefused:
      "Adresse e-mail ou code incorrect. Le code a peut-être expiré ou déjà servi\u00a0: demandez-en un nouveau.",
    unreachable: "Connexion impossible. Vérifiez le réseau et réessayez.",
    failed: "Connexion impossible pour le moment. Réessayez dans un instant.",
    offline: "Hors ligne. Connectez-vous dès que le réseau revient.",
    /** 429: `time` is Brussels "HH:MM", now plus Retry-After. */
    lockedUntil: (time: string) =>
      `Trop de tentatives depuis cette connexion. Réessayez à ${time}, ou changez de réseau.`,
    /** 429 without a usable Retry-After. */
    lockedForMinutes:
      "Trop de tentatives depuis cette connexion. Réessayez dans quelques minutes, ou changez de réseau.",
    /** The outbox on this device, for a phone sent here by a 401; never zero. */
    outboxWaiting: (count: number) =>
      count === 1
        ? "1 visite non envoyée est gardée sur ce téléphone. Elle partira après la connexion."
        : `${count} visites non envoyées sont gardées sur ce téléphone. Elles partiront après la connexion.`,
  },

  /** An `/admin` route opened on a cached identity (GH #209, EXPERIENCE.md §
   * State Patterns, Offline after a reload). The field shell renders it, so it
   * lives here and not in `copy/admin.ts`. */
  adminRoute: {
    offline: "Hors ligne. Cette page a besoin du réseau. Votre tournée reste accessible.",
  },

  /** The Hors ligne screen of an admin whose identity came from the cache
   * (ADR-0037, R6). Entry chunk, so it lives here and not in `copy/admin.ts`. */
  adminOffline: {
    title: "Vous êtes hors ligne",
    body: "Le tableau de bord a besoin du réseau. Reconnectez-vous puis réessayez.",
    retry: "Réessayer",
    checking: "Vérification…",
  },

  /** The service worker has a new build waiting (registerType: "prompt"). */
  update: {
    available: "Une nouvelle version est disponible.",
    apply: "Mettre à jour",
    dismiss: "Plus tard",
  },
} as const;
