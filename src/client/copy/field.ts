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
  SOURCE_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
} from "./shared";

export const copy = {
  ...sharedCopy,

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
    empty: "Aucun prospect à visiter. Synchronisez pour récupérer votre liste.",
    later: "Plus tard",
    distanceUnknown: "Position inconnue",
    navigate: "Y aller",
    visit: "Visiter",
    /** The stops are a walking order, so the round states its own length. */
    remaining: (n: number) => (n === 1 ? "1 arrêt" : `${n} arrêts`),
    /** GH #119: how much of today's round is done. `total` never repeats the
     * unit — "n visites sur total aujourd'hui", singularising like `remaining`. */
    progress: (n: number, total: number) =>
      n <= 1 ? `${n} visite sur ${total} aujourd'hui` : `${n} visites sur ${total} aujourd'hui`,
    /** The progress bar's own accessible name (Radix gives the root none). */
    progressLabel: "Progression de la tournée du jour",
    nextStop: "Prochain arrêt",
    /** Two cases, one message: a field prospect the server has not accepted
     * yet, or a stop whose visit is still sitting in the outbox. Either way
     * nothing about the round has changed server-side (invariants 2, 3). */
    notSynced: "Pas encore envoyé",
    dueOn: (when: string) => `À relancer le ${when}`,
    /** "type · address", or the type alone when there is no address. */
    meta: (type: string, address: string | null) => (address ? `${type} · ${address}` : type),
    locating: "Recherche de votre position…",
    positionDenied: "Sans votre position, la tournée n'est pas triée par distance.",
    retryPosition: "Réessayer",
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
      /** 0 and 1 are singular in French, as `today.progress` does for 1. */
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
    /** Reconnects through Access (docs/domains/identity-access.md); the
     * outbox is untouched. */
    reconnect: "Se reconnecter",
  },

  /** The service worker has a new build waiting (registerType: "prompt"). */
  update: {
    available: "Une nouvelle version est disponible.",
    apply: "Mettre à jour",
    dismiss: "Plus tard",
  },
} as const;
