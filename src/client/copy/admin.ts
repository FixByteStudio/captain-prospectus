/**
 * French strings only admin screens render (ADR-0013, INVARIANT 15). Reached
 * through `../copy.ts`, never from a field-reachable module (GH #20).
 */
import { formatCount, formatRadiusKm } from "../format";
import type { DashboardPeriod, OrphanReason } from "../../shared/constants";

/** The 25-row pager's words, shared by Prospects and Visites; each adds its own `nav`. */
const PAGER = {
  previous: "Précédent",
  next: "Suivant",
  morePages: "Plus de pages",
  pageLabel: (page: number) => `Page ${page}`,
};

export const adminCopy = {
  /** The admin shell's offline banner (GH #209, EXPERIENCE.md § State Patterns). */
  offline: {
    banner:
      "Hors ligne. Les données affichées ne changent plus et se rafraîchiront au retour du réseau.",
    /** Read out, never shown, when the banner goes (EXPERIENCE.md § Accessibility). */
    reconnected: "Connexion rétablie.",
  },

  /** The Agents page (GH #304, docs/design.md › Agents). */
  agents: {
    title: "Agents",
    subtitle: "Qui peut se connecter, et avec quel rôle.",
    loading: "Chargement des utilisateurs…",
    loadFailed: "Impossible de charger les utilisateurs.",
    add: "Ajouter un utilisateur",
    columns: {
      user: "Utilisateur",
      role: "Rôle",
      enrolment: "Inscription",
      devices: "Appareils",
    },
    roles: { agent: "Agent", admin: "Admin" },
    enrolled: "Inscrit",
    notEnrolled: "Pas encore inscrit",
    you: "Vous",
    menu: (name: string) => `Actions pour ${name}`,
    generateCode: "Générer un code",
    newPassphrase: "Nouvelle phrase de passe",
    makeAdmin: "Passer admin",
    makeAgent: "Passer agent",
    deactivate: "Désactiver",
    reactivate: "Réactiver",
    lastAdmin: "Il faut au moins un administrateur actif.",
    deactivated: (n: number) => `Désactivés (${n})`,
    deactivatedLabel: "Utilisateurs désactivés",

    /** A row's device lines (GH #307). `date` and `dateTime` come formatted. */
    devices: {
      expand: (name: string) => `Appareils de ${name}`,
      unknown: "Appareil inconnu",
      none: "Aucun appareil inscrit.",
      enrolledOn: (date: string) => `Inscrit le ${date}`,
      seenOn: (dateTime: string) => `Vu le ${dateTime}`,
      revoke: "Révoquer",
      revokeLabel: (label: string) => `Révoquer ${label}`,
      current: "Cet appareil",
    },

    addDialog: {
      title: "Ajouter un utilisateur",
      email: "Adresse e-mail",
      name: "Nom",
      role: "Rôle",
      submit: "Ajouter",
      cancel: "Annuler",
      emailInvalid: "Saisissez une adresse e-mail valide.",
      nameRequired: "Saisissez un nom.",
      emailTaken:
        "Cette adresse a déjà un compte. S'il est désactivé, réactivez-le sous Désactivés.",
    },

    deactivateDialog: {
      title: (name: string) => `Désactiver ${name} ?`,
      checking: "Vérification des prospects assignés…",
      assigned: (n: number, name: string) =>
        n === 0
          ? `Aucun prospect n'est assigné à ${name}.`
          : n === 1
            ? `1 prospect reste assigné à ${name}. Réassignez-le depuis « Prospects sans agent actif » au Tableau de bord.`
            : `${n} prospects restent assignés à ${name}. Réassignez-les depuis « Prospects sans agent actif » au Tableau de bord.`,
      always: "Ses appareils seront déconnectés et son code annulé. Vous pourrez le réactiver.",
      cancel: "Annuler",
      confirm: "Désactiver",
    },

    /** Shown once; `time` is the server's expiry in Brussels time. */
    codeDialog: {
      title: (name: string) => `Code pour ${name}`,
      validUntil: (time: string) => `Valable jusqu'à ${time}, une seule fois.`,
      once: "Ce code ne sera plus affiché. En générer un autre annule celui-ci.",
      copy: "Copier",
      done: "Terminé",
      copied: "Code copié.",
      copyFailed: "Copie impossible. Recopiez-le à la main.",
    },

    passphraseDialog: {
      confirmTitle: "Remplacer votre phrase de passe ?",
      confirmBody: "L'ancienne cessera de fonctionner dès que la nouvelle s'affiche.",
      cancel: "Annuler",
      replace: "Remplacer",
      title: "Votre phrase de passe",
      save: "Enregistrez-la dans votre gestionnaire de mots de passe : elle ne sera plus affichée. L'ancienne ne fonctionne plus.",
      copy: "Copier",
      done: "Terminé",
      copied: "Phrase de passe copiée.",
      copyFailed: "Copie impossible. Recopiez-la à la main.",
    },

    toast: {
      added: "Utilisateur ajouté.",
      roleChanged: "Rôle modifié.",
      deactivated: "Utilisateur désactivé.",
      reactivated: "Utilisateur réactivé.",
      revoked: "Appareil déconnecté.",
      failed: "L'action n'a pas abouti. Réessayez.",
    },
  },

  /** The top bar's search button and its inert CommandDialog (GH #64). */
  search: {
    // Reused verbatim as the ≥768px button's text and, below 768px, as the
    // icon-only button's aria-label (spec's Always list).
    button: "Rechercher…",
    // The palette makes no request yet — this is its only content besides
    // the input, so it doubles as the dialog's sr-only description.
    unavailable:
      "La recherche n'est pas encore disponible. Utilisez les filtres de la page Prospects.",
  },

  notifications: {
    /** Disabled for now (Never list): no content, just the aria-label. */
    label: "Notifications",
  },

  /** The top bar's Sun/Moon toggle. Each label names the action a click
   * performs, matching its icon (spec-gh-64: "Moon with 'Thème sombre' while
   * light, Sun with 'Thème clair' while dark"). */
  theme: {
    toDark: "Thème sombre",
    toLight: "Thème clair",
  },

  account: {
    menu: (email: string) => `Menu du compte de ${email}`,
    logout: "Se déconnecter",
  },

  /** Tableau de bord at /admin (GH #107). */
  dashboard: {
    title: "Tableau de bord",
    subtitle: "Où en est la prospection.",
    /** The period selector's own accessible name. */
    periodLabel: "Période",
    periods: {
      7: "7 jours",
      30: "30 jours",
      90: "90 jours",
    } satisfies Record<DashboardPeriod, string>,
    openProspects: "Prospects ouverts",
    visits: "Visites",
    converted: "Convertis",
    conversionRate: "Taux de conversion",
    /** Visites dans le temps (GH #110); series labels are OUTCOME_LABELS. */
    visitsChart: {
      title: "Visites dans le temps",
      /** The visually hidden table that is the chart's text equivalent. */
      tableCaption: "Visites par jour et par résultat",
      day: "Jour",
      total: "Total",
    },
    /** The KPI cards' bottom row (GH #111). */
    kpiFooter: {
      /** The mini-bar's visible caption joins STATUS_LABELS; this is its counts, read out. */
      openSplit: (nNew: number, nAssigned: number, nFollowUp: number) =>
        `${formatCount(nNew)} ${nNew <= 1 ? "nouveau" : "nouveaux"}, ` +
        `${formatCount(nAssigned)} ${nAssigned <= 1 ? "assigné" : "assignés"}, ` +
        `${formatCount(nFollowUp)} à relancer`,
      /** French takes the singular for 0 and 1. */
      conversionCaption: (converted: number, visited: number) =>
        `${formatCount(converted)} ${converted <= 1 ? "converti" : "convertis"} sur ${formatCount(visited)} ` +
        (visited <= 1 ? "prospect visité" : "prospects visités"),
      noneVisited: "Aucun prospect visité sur la période",
    },
    /** Pipeline par statut (GH #112); row labels are STATUS_LABELS. */
    pipeline: {
      title: "Pipeline par statut",
      total: (n: number) => `${formatCount(n)} ${n <= 1 ? "prospect" : "prospects"}`,
    },
    /** Activité par agent (GH #112). */
    agents: {
      title: "Activité par agent",
      agent: "Agent",
      visits: "Visites",
      converted: "Convertis",
      followUp: "À relancer",
      openProspects: "Prospects ouverts",
      empty: "Aucun agent pour l'instant.",
    },
    /** À traiter (GH #113, #308): four queues, each with its count and a way in. */
    todo: {
      title: "À traiter",
      followUps: "Relances dues",
      followUpsMeta: "À relancer aujourd'hui ou plus tôt",
      followUpsAction: "Voir",
      orphans: "Visites à rattacher",
      orphansMeta: "Conservées, pas encore comptées",
      orphansAction: "Rattacher",
      duplicates: "Doublons",
      duplicatesMeta: "Semblent désigner le même endroit",
      duplicatesAction: "Fusionner",
      pairs: (n: number) => `${formatCount(n)} ${n <= 1 ? "paire" : "paires"}`,
      inactiveAgent: "Prospects sans agent actif",
      inactiveAgentMeta: "Assignés à un agent désactivé",
      inactiveAgentAction: "Réassigner",
    },
    /** Dernières visites (GH #113); the rest of its copy is `visits`'. */
    recent: {
      title: "Dernières visites",
      seeAll: "Tout voir",
      time: "Heure",
      prospect: "Prospect",
      outcome: "Résultat",
      flyer: "Flyer",
      agent: "Agent",
      /** A visit without a flyer: nothing to say, but the cell is not empty. */
      noFlyer: "—",
    },
    /** A KPI card's name as a link (GH #114): its label and figure, not the chip. */
    openList: (label: string, value: string) => `${label}\u00a0: ${value}. Voir la liste`,
    /** Follows the delta chip: "+12,4 % vs période précédente". */
    vsPrevious: "vs période précédente",
    /** Read out while the skeletons stand in for the cards. */
    loading: "Chargement du tableau de bord…",
    loadFailed: "Impossible de charger le tableau de bord.",
    retry: "Réessayer",
  },

  prospects: {
    title: "Prospects",
    count: (n: number) => (n === 1 ? "1 prospect" : `${n} prospects`),
    importCta: "Importer un CSV",
    empty: "Aucun prospect. Importez un CSV pour commencer.",
    noMatch: "Aucun prospect ne correspond à ces filtres.",
    /** Under `noMatch` when a search found nothing: names it, and says accents count (docs/api.md). */
    noMatchSearch: (q: string) =>
      `Aucun nom ne contient « ${q} ». Vérifiez l'orthographe et les accents, ou effacez les filtres.`,
    /** Under `noMatch` when only filters are set. */
    noMatchFilters: "Retirez un filtre ou effacez-les tous pour revoir la liste.",
    clearFilters: "Effacer les filtres",
    loading: "Chargement des prospects…",
    loadFailed: "Impossible de charger les prospects. Réessayez.",

    /** The one toolbar slot's search box (G4, #176/#179). */
    search: {
      label: "Rechercher un prospect",
      placeholder: "Rechercher par nom…",
    },

    /** The 25-row server-side pager (#179) — same shape as Visites' own. */
    pager: { ...PAGER, nav: "Pagination des prospects" },
    /** "26–50 sur 60" — the pager's own range, distinct from the plain count. */
    range: (from: number, to: number, total: number) => `${from}–${to} sur ${total}`,

    export: {
      button: "Exporter en CSV",
      exporting: "Export…",
      truncated: (cap: number) =>
        `L'export s'arrête à ${cap} prospects. Choisissez des filtres plus précis pour tout obtenir.`,
      failed: "L'export a échoué. Réessayez.",
    },

    filters: {
      status: "Statut",
      agent: "Agent",
      source: "Source",
      anyStatus: "Tous les statuts",
      anyAgent: "Tous les agents",
      anySource: "Toutes les sources",
      /** The Hors cible toggle (GH #250): the count joins the label only while it is on. */
      outOfTarget: "Hors cible signalé",
      outOfTargetCount: (n: number) => `Hors cible signalé\u00a0: ${n}`,
      /** A chip for a URL filter the Statut select cannot show (GH #114). */
      severalStatuses: (labels: string[]) => `Statut\u00a0: ${labels.join(", ")}`,
      /** `next_visit_at` strictly before that instant, named by its Brussels day. */
      dueBefore: (date: string) => `Relance avant le ${date}`,
      remove: (label: string) => `Retirer le filtre « ${label} »`,
      /** The Statut select's text while the URL holds several statuses. */
      someStatuses: "Plusieurs statuts",
      /** `inactiveAgent=true` (GH #308): its chip, and the Agent select's text while it is on. */
      inactiveAgentChip: "Agent\u00a0: désactivé",
      inactiveAgentSelect: "Agent désactivé",
    },

    columns: {
      name: "Nom",
      type: "Type",
      address: "Adresse",
      status: "Statut",
      agent: "Agent",
      lastVisit: "Dernière visite",
    },

    selection: {
      // The toolbar replaces the filters in place, so this states the count.
      count: (n: number) => (n === 1 ? "1 sélectionné" : `${n} sélectionnés`),
      selectAll: "Tout sélectionner",
      selectOne: (name: string) => `Sélectionner ${name}`,
      assignTo: "Assigner à",
      chooseAgent: "Choisir un agent",
      assign: "Assigner",
      unassign: "Désassigner",
      cancel: "Annuler",
    },

    row: {
      menu: (name: string) => `Actions pour ${name}`,
      assignTo: "Assigner à",
      changeStatus: "Changer le statut",
      unassign: "Retirer l'assignation",
    },

    /** An action keeps its name through the flow: Assigner → Assigné. */
    assigned: (n: number) => (n === 1 ? "1 prospect assigné" : `${n} prospects assignés`),
    unassigned: (n: number) => (n === 1 ? "1 prospect désassigné" : `${n} prospects désassignés`),
    statusChanged: "Statut modifié",
    assignFailed: "L'assignation a échoué. Réessayez.",
    updateFailed: "La modification a échoué. Réessayez.",
    unknownAssignee: "Cette adresse ne figure pas parmi les agents.",
  },

  import: {
    title: "Importer des prospects",
    steps: {
      source: "Source",
      columns: "Fichier & colonnes",
      preview: "Aperçu & validation",
      map: "Zone",
      label: "Étapes",
      done: "terminée",
      current: "En cours",
      upcoming: (n: number) => `Étape ${n}`,
    },

    source: {
      lede: "D'où viennent les prospects ?",
      csv: {
        tag: "Lu dans le navigateur",
        format: ".csv",
        title: "Un fichier CSV",
        hint: "Un export de tableur, lu dans votre navigateur. Idéal pour vos listes existantes.",
        bullets: [
          "Colonnes reconnues automatiquement",
          "Aperçu avant tout enregistrement",
          "Lignes rejetées expliquées",
          "Réimport sans doublon",
        ],
        flow: "Flux direct : 3 étapes",
        action: "Importer un fichier",
      },
      map: {
        tag: "Gratuit avec OpenStreetMap",
        title: "Une zone sur la carte",
        // Two providers since ADR-0020, so the card names the gesture and not
        // one of them; the choice between them lives on the map step.
        hint: "Les commerces répertoriés sur OpenStreetMap ou Google Places, dans la zone que vous tracez.",
        bullets: [
          "Zone tracée à main levée",
          "Adresse et type de commerce",
          "Lieux déjà listés écartés",
          "Lieux sans nom ignorés",
        ],
        flow: "Flux rapide : 2 étapes",
        action: "Dessiner une zone",
      },
    },

    file: {
      chosen: (name: string, rows: number) =>
        rows === 1 ? `${name} — 1 ligne` : `${name} — ${formatCount(rows)} lignes`,
      unreadable: "Ce fichier ne se lit pas comme un CSV. Vérifiez le format et réessayez.",
      emptyFile: "Ce fichier ne contient aucune ligne.",
      noHeaders: "Ce fichier n'a pas d'en-têtes de colonnes.",
    },

    columns: {
      lede: "Indiquez quelle colonne correspond à quel champ.",
      skip: "Ne pas importer",
      noSample: "Vide sur la première ligne",
      required: "Le nom est obligatoire : choisissez la colonne qui le contient.",
      unmappedNote: "Une colonne non associée laisse le champ inchangé lors d'un réimport.",
      head: {
        field: "Champ",
        column: "Colonne du fichier",
        sample: "Exemple",
        status: "Statut",
      },
      fields: {
        name: "Nom",
        type: "Type",
        lat: "Latitude",
        lng: "Longitude",
        address: "Adresse",
        phone: "Téléphone",
        website: "Site web",
        cuisine: "Cuisine",
        sourceRef: "Identifiant source",
      },
      hints: {
        name: "Enseigne ou raison sociale",
        type: "Restaurant, café, food truck…",
        lat: "En degrés décimaux, ex. 50,8466",
        lng: "En degrés décimaux, ex. 4,3528",
        address: "Rue, numéro et code postal",
        phone: "Numéro de l'établissement",
        website: "Site ou page de l'établissement",
        cuisine: "Spécialité, ex. belge, italienne",
        sourceRef:
          "Si votre fichier a un identifiant stable, un nom corrigé mettra à jour au lieu de créer un doublon.",
      },
      status: {
        required: "Requis",
        gps: "Coordonnées GPS",
        uniqueKey: "Clé unique",
        detected: "Détecté",
        optional: "Optionnel",
        ignored: "Ignoré",
      },
      changeFile: "Changer de fichier",
      inBrowser: "Le fichier est lu dans votre navigateur. Il n'est jamais envoyé ni conservé.",
      lines: (n: number) => (n === 1 ? "1 ligne" : `${formatCount(n)} lignes`),
      configured: (done: number, total: number) =>
        done === 1 ? `1 champ configuré sur ${total}` : `${done} champs configurés sur ${total}`,
      footer: (rows: number, mapped: number) =>
        `${rows === 1 ? "1 ligne" : `${formatCount(rows)} lignes`} à traiter · ${mapped === 1 ? "1 colonne associée" : `${mapped} colonnes associées`}`,
      step: (n: number, total: number) => `Étape ${n} sur ${total}`,
    },

    preview: {
      ready: (n: number) =>
        n === 1 ? "1 ligne à importer" : `${formatCount(n)} lignes à importer`,
      rejected: (n: number) => (n === 1 ? "1 ligne rejetée" : `${formatCount(n)} lignes rejetées`),
      summary: (valid: number, total: number) =>
        `${formatCount(valid)} ${valid === 1 ? "valide" : "valides"} sur ${total === 1 ? "1 ligne" : `${formatCount(total)} lignes`}`,
      // Papa reports the character; the admin reads its name.
      separator: (delimiter: string) =>
        `Séparateur : ${
          (
            {
              ",": "virgule",
              ";": "point-virgule",
              "\t": "tabulation",
              "|": "barre verticale",
            } as Record<string, string>
          )[delimiter] ?? delimiter
        }`,
      share: (percent: number) => `${percent} %`,
      filterLabel: "Filtrer les lignes",
      all: "Toutes les lignes",
      errors: (n: number) => (n === 1 ? "Voir l'erreur" : `Voir les ${formatCount(n)} erreurs`),
      coordinates: "Coordonnées",
      status: "Statut",
      // A line that will be imported as it stands.
      readyChip: "Prêt",
      line: (n: number) => `Ligne ${n}`,
      nothingToImport: "Aucune ligne valide à importer. Revenez aux colonnes.",
      showingFirst: (n: number) => `Les ${formatCount(n)} premières lignes sont affichées.`,
      noCoordinates: "Sans coordonnées",
    },

    reasons: {
      missingName: "Nom manquant",
      invalid: "Valeur invalide",
    },

    actions: {
      back: "Retour",
      toColumns: "Associer les colonnes",
      toPreview: "Voir l'aperçu",
      start: (n: number) => (n === 1 ? "Importer 1 ligne" : `Importer ${formatCount(n)} lignes`),
      done: "Terminer",
      retry: "Réessayer",
    },

    running: (done: number, total: number) =>
      `Import en cours : ${formatCount(done)} / ${formatCount(total)}`,
    result: {
      title: "Import terminé",
      created: (n: number) => (n === 1 ? "1 prospect créé" : `${formatCount(n)} prospects créés`),
      updated: (n: number) =>
        n === 1 ? "1 prospect mis à jour" : `${formatCount(n)} prospects mis à jour`,
      skipped: (n: number) => (n === 1 ? "1 ligne rejetée" : `${formatCount(n)} lignes rejetées`),
      seeProspects: "Voir les prospects",
    },
    failed:
      "L'import s'est interrompu. Les lignes déjà envoyées sont enregistrées ; réimporter le même fichier est sans risque.",
    /**
     * The failure Alert always names how many rows already went in before the
     * batch that failed — including zero, when the very first batch fails.
     */
    failedAfter: (n: number) =>
      n === 0
        ? "L'import s'est interrompu avant d'envoyer la moindre ligne. Réimporter le même fichier est sans risque."
        : n === 1
          ? "L'import s'est interrompu après 1 ligne envoyée. Réimporter le même fichier est sans risque."
          : `L'import s'est interrompu après ${formatCount(n)} lignes envoyées. Réimporter le même fichier est sans risque.`,
  },

  map: {
    lede: "Dessinez une zone : cliquez pour poser chaque sommet.",

    /** Which data source the area is searched against — ADR-0020. */
    provider: {
      label: "Données",
      osm: "OpenStreetMap",
      google: "Google Places",
      /**
       * A standing fact, not a warning: a Google search is a billable call and
       * a small circle is the habit that keeps it cheap. Said once, under the
       * choice, where it changes what the admin draws next.
       */
      googleHint:
        "Chaque recherche Google compte dans le quota mensuel. 20 lieux maximum par cercle.",
      osmHint: "Gratuit et sans limite. Couverture variable selon la ville.",
    },

    /** Google's Nearby Search takes a circle; there is no polygon search. */
    circle: {
      lede: "Dessinez un cercle : cliquez pour placer le centre, puis pour fixer le rayon.",
      radius: (m: number) =>
        m >= 1000 ? `Rayon ${formatRadiusKm(m / 1000)} km` : `Rayon ${formatCount(m)} m`,
      hint: "Faites glisser le centre pour déplacer le cercle, le point à droite pour le redimensionner.",
      none: "Cliquez sur la carte pour placer le centre.",
    },

    /** The canvas needs a pointer to draw — docs/design.md › "The map import". */
    pointerOnly:
      "Dessiner une zone demande une souris ou un écran tactile. Sans pointeur, importez plutôt depuis un fichier CSV.",

    /**
     * The failure Alert on the map path — same three branches as
     * `import.failedAfter`, but there is no file to reimport here, so the
     * closing sentence names the import itself rather than a file.
     */
    failedAfter: (n: number) =>
      n === 0
        ? "L'import s'est interrompu avant d'envoyer la moindre ligne. Relancer l'import est sans risque."
        : n === 1
          ? "L'import s'est interrompu après 1 ligne envoyée. Relancer l'import est sans risque."
          : `L'import s'est interrompu après ${formatCount(n)} lignes envoyées. Relancer l'import est sans risque.`,

    vertices: (n: number) => (n === 1 ? "1 sommet" : `${formatCount(n)} sommets`),
    needMore: "Trois sommets au minimum.",
    full: "Nombre de sommets maximum atteint.",
    undo: "Annuler le dernier point",
    clear: "Effacer",
    search: "Rechercher dans la zone",
    searching: "Recherche en cours…",
    // ADR-0008: Overpass is a public service that is sometimes slow or down.
    failed: "OpenStreetMap n'a pas répondu. Réessayez dans quelques instants, ou réduisez la zone.",
    placesFailed:
      "Google n'a pas répondu. Réessayez dans quelques instants, ou réduisez le cercle.",
    // A server configuration fact, not a failure: it says who can fix it.
    placesUnconfigured:
      "Google Places n'est pas configuré sur ce serveur. Utilisez OpenStreetMap, ou demandez l'ajout de la clé API.",
    retry: "Réessayer",

    results: {
      // The panel before a search: an empty screen is an invitation, not a
      // void with a stray button in it (design.md).
      idle: "Dessinez une zone sur la carte, puis lancez la recherche pour voir ce qu'OpenStreetMap y connaît.",
      found: (n: number) => (n === 1 ? "1 lieu trouvé" : `${formatCount(n)} lieux trouvés`),
      unnamed: (n: number) => (n === 1 ? "1 sans nom" : `${formatCount(n)} sans nom`),
      // Probably already a prospect under another source's id (ADR-0020). Left
      // out of the import unless the admin says otherwise.
      likely: (n: number) =>
        n === 1 ? "1 semble déjà dans la liste" : `${formatCount(n)} semblent déjà dans la liste`,
      looksLike: (name: string) => `Semble déjà dans la liste : ${name}`,
      includeLikely: (n: number) =>
        n === 1
          ? "Importer aussi le lieu qui semble déjà dans la liste"
          : `Importer aussi les ${formatCount(n)} lieux qui semblent déjà dans la liste`,
      includeLikelyHint: "Un doublon importé se fusionne ensuite depuis l'écran Doublons.",
      empty: "Aucun commerce trouvé dans cette zone. Élargissez-la et cherchez à nouveau.",
      // The cache is up to seven days old, so the screen says how old rather
      // than letting two identical searches look like two live ones.
      // `cachedAt` is optional (docs/api.md) — absent only on an answer from
      // before this field existed — so a cache hit with no age still reads as
      // a complete sentence.
      cached: "Résultat en cache, actualisé sous 7 jours.",
      cachedAge: (days: number, hours: number) =>
        days > 0
          ? days === 1
            ? "Résultat en cache, obtenu il y a 1 jour."
            : `Résultat en cache, obtenu il y a ${formatCount(days)} jours.`
          : hours < 1
            ? "Résultat en cache, obtenu il y a moins d'une heure."
            : hours === 1
              ? "Résultat en cache, obtenu il y a 1 heure."
              : `Résultat en cache, obtenu il y a ${formatCount(hours)} heures.`,
      truncated: "Zone trop vaste : seuls les premiers résultats sont affichés. Réduisez-la.",
      // Google's own ceiling, not ours: 20 per call and no next page.
      truncatedGoogle:
        "Google renvoie 20 lieux au maximum : voici les 20 plus proches du centre. Réduisez le cercle et cherchez à nouveau.",
      // The attribution Google's terms ask for; the tiles stay OSM (ADR-0020).
      poweredByGoogle: "Résultats fournis par Google",
      idleGoogle:
        "Dessinez un cercle sur la carte, puis lancez la recherche pour voir ce que Google y connaît.",
      // A place OSM has no name for cannot be imported: `name` is required.
      noName: "Sans nom",
      start: (n: number) =>
        n === 1 ? "Importer 1 prospect" : `Importer ${formatCount(n)} prospects`,
      nothingToImport: "Aucun lieu importable dans cette zone.",
    },
  },

  visits: {
    title: "Visites",
    lede: "Les visites arrivent ici dès qu'un agent synchronise.",
    count: (n: number) => (n === 1 ? "1 visite" : `${n} visites`),
    /** The opening page filled the feed's cap (ADMIN_VISITS_PAGE_SIZE), so more may exist. */
    countCapped: (n: number) => `${n} visites ou plus`,
    // An empty screen is an invitation, not a shrug (design.md).
    empty: "Aucune visite reçue. Les visites apparaissent ici dès qu'un agent synchronise.",
    loading: "Chargement des visites…",
    loadFailed: "Impossible de charger les visites. Réessayez.",
    flyer: "Flyer remis",
    /** Announced when rows arrive, for a reader that cannot see the highlight. */
    arrived: (n: number) => (n === 1 ? "1 nouvelle visite" : `${n} nouvelles visites`),

    /** The strip's four compact cards (GH #178, docs/design.md › The live feed). */
    strip: {
      followUpsDueSoon: "Relances dues sous 7 jours",
      followUpsDueSoonMeta: (date: string) => `Avant le ${date}`,
      flyersGiven: "Flyers remis",
      flyersGivenMeta: "Sur la période",
      agentsActiveToday: "Agents en tournée",
      agentsActiveTodayMeta: "Aujourd'hui",
      loading: "Chargement des chiffres…",
      loadFailed: "Impossible de charger les figures.",
    },

    /** The 25-row pager over the held feed (GH #178). */
    pager: { ...PAGER, nav: "Pagination des visites" },

    /** Narrows the ledger and its export to one refusal reason (GH #249). */
    reasonFilter: {
      label: "Raison du refus",
      any: "Toutes les raisons",
      empty: "Aucune visite pour cette raison sur la période.",
    },

    /**
     * The export button (GH #178) — a warning toast, not a blocking dialog,
     * when the server flags `x-truncated`. Its own cap, `EXPORT_ROWS`, is a
     * separate request from the ledger's, which caps at `ADMIN_VISITS_PAGE_SIZE`
     * — the two happen to share a value today, not a constant.
     */
    export: {
      button: "Exporter en CSV",
      exporting: "Export…",
      truncated: (cap: number) =>
        `L'export s'arrête à ${cap} visites. Choisissez une période plus courte pour tout obtenir.`,
      failed: "L'export a échoué. Réessayez.",
    },
  },

  /** The admin round view (spec 5.5, design.md "The admin round view"). */
  round: {
    title: "Tournée du jour",
    // French keeps 0 singular: "0 arrêt".
    count: (n: number) => (n <= 1 ? `${n} arrêt` : `${n} arrêts`),
    agentLabel: "Agent",
    choosePlaceholder: "Choisir un agent",
    choosePrompt: "Choisissez un agent pour voir sa tournée du jour.",
    position: (date: string) => `Position du ${date}`,
    noPosition: "Aucune position reçue aujourd'hui. La tournée est triée par nom.",
    empty: "Aucun arrêt dans la tournée du jour de cet agent.",
    loadFailed: "Impossible de charger la tournée. Réessayez.",
    loading: "Chargement de la tournée…",
  },

  orphans: {
    title: "Visites à rattacher",
    // The lede carries the correction for every row at once: the edge colour
    // forecasts what repairing would do, and none of it has happened yet
    // (design.md, "The repair queue").
    lede: "Ces visites sont conservées, mais elles ne comptent pas encore. Rattachez chacune au bon prospect.",
    // The whole queue, and worded as a wait: none of these has counted yet.
    count: (n: number) =>
      n === 1 ? "1 visite pas encore rattachée" : `${formatCount(n)} visites pas encore rattachées`,
    // An empty queue is the healthy state, so it reassures rather than shrugs.
    empty: "Aucune visite à rattacher.",
    emptyHint: "Tout ce que les agents ont envoyé est arrivé à destination.",
    emptyCta: "Voir les visites",
    loading: "Chargement des visites à rattacher…",
    loadFailed: "Impossible de charger les visites à rattacher. Réessayez.",
    flyer: "Flyer remis",
    reason: {
      unknown_prospect: "Prospect introuvable",
      not_assigned: "Prospect d'un autre agent",
    } as Readonly<Record<OrphanReason, string>>,
    rowAria: (when: string, agent: string) => `Visite du ${when} par ${agent}`,
    attachTo: "Rattacher à",
    attachAria: (name: string, distance: string | null) =>
      distance === null
        ? `Rattacher cette visite à ${name}`
        : `Rattacher cette visite à ${name}, à ${distance}`,
    // No picker exists and none is proposed (design.md), so the one way out
    // left is named rather than implied.
    noPosition:
      "Aucune position enregistrée pour cette visite : aucun prospect à proposer. Si elle ne peut pas être rattachée, supprimez-la.",
    attached: (name: string) => `Visite rattachée à ${name}.`,
    attachFailed: "Impossible de rattacher cette visite. Réessayez.",
    // The row count the page could not show. Non-zero means look upstream.
    overflow: (n: number) =>
      n === 1
        ? "1 visite de plus n'est pas affichée."
        : `${formatCount(n)} visites de plus ne sont pas affichées.`,
    discard: "Supprimer",
    discardAria: (when: string) => `Supprimer la visite du ${when}`,
    discarded: "Visite supprimée.",
    discardFailed: "Impossible de supprimer cette visite. Réessayez.",
    confirm: {
      title: "Supprimer cette visite ?",
      // Names the consequence, like copy.scripts.confirm.body does.
      body: "C'est la seule copie : le téléphone de l'agent ne l'a plus. Elle sera définitivement perdue.",
      cancel: "Annuler",
      confirm: "Supprimer définitivement",
    },
  },

  duplicates: {
    title: "Doublons",
    lede: "Ces prospects semblent désigner le même endroit. Un nom corrigé dans le fichier crée une nouvelle fiche : c'est ici qu'on les réunit.",
    empty: "Aucun doublon détecté.",
    loading: "Recherche des doublons…",
    loadFailed: "Impossible de chercher les doublons. Réessayez.",
    truncated:
      "Seules les premières paires sont affichées. Fusionnez-les et relancez la recherche.",
    // Same agreement as the dashboard's own `pairs`: zero takes the singular.
    count: (n: number) => `${formatCount(n)} ${n <= 1 ? "paire" : "paires"}`,

    pairAria: (a: string, b: string) => `« ${a} » et « ${b} »`,
    visits: (n: number) =>
      n === 0 ? "Aucune visite" : n === 1 ? "1 visite" : `${formatCount(n)} visites`,

    emptyHint: "Aucune paire de prospects ne semble désigner le même endroit.",
    emptyCta: "Voir les prospects",

    relaunch: "Relancer la recherche",
    relaunching: "Recherche en cours…",

    distanceUnknown: "Position inconnue",
    keep: "Garder",
    keepAria: (name: string) => `Garder « ${name} » et fusionner l'autre`,
    /** Says which one survived, because that is the thing the admin chose. */
    merged: (name: string) => `Fusionné dans « ${name} »`,
    mergeFailed: "La fusion a échoué. Réessayez.",
  },

  scripts: {
    title: "Scripts",
    lede: "Le questionnaire posé à chaque visite. L'enregistrement crée une nouvelle version et l'active aussitôt ; les versions précédentes restent pour les visites déjà répondues.",
    loading: "Chargement du script…",
    loadFailed: "Impossible de charger les scripts. Réessayez.",

    name: "Nom du script",
    namePlaceholder: "default",

    question: {
      sectionTitle: "Questions",
      empty: "Aucune question. Ajoutez-en une pour commencer.",
      untitled: "Question sans intitulé",
      add: "Ajouter une question",
      remove: (label: string) => `Supprimer « ${label} »`,
      dragHandle: (label: string) => `Réordonner « ${label} »`,
      cardAria: (n: number, label: string) => `Question ${n} : ${label}`,
      label: "Intitulé",
      labelPlaceholder: "Ex. Proposez-vous la livraison ?",
      key: "Clé",
      keyHint: "Identifie la réponse. Ne change plus une fois la version enregistrée.",
      keyLocked: "Cette clé existe déjà dans une version enregistrée.",
      unlockKey: "Modifier la clé",
      unlockKeyAria: (key: string) => `Modifier la clé ${key}`,
      keyUnlockedWarning:
        "Les réponses déjà données sous l'ancienne clé resteront associées à celle-ci, pas à la nouvelle.",
      type: "Type de réponse",
      required: "Obligatoire",
      options: "Choix proposés",
      optionPlaceholder: (n: number) => `Choix ${n}`,
      removeOption: (n: number) => `Supprimer le choix ${n}`,
      addOption: "Ajouter un choix",
    },

    errors: {
      nameRequired: "Donnez un nom au script.",
      noQuestions: "Ajoutez au moins une question.",
      emptyLabel: "Indiquez l'intitulé de cette question.",
      invalidKey: "La clé doit être en minuscules, sans espaces, et commencer par une lettre.",
      duplicateKey: "Une autre question utilise déjà cette clé.",
      missingOptions: "Ajoutez au moins un choix pour cette question.",
    },

    editor: {
      saveWarning: "L'enregistrement crée une nouvelle version et l'active immédiatement.",
      save: "Enregistrer une nouvelle version",
      saved: (version: number) => `Version ${version} enregistrée et activée.`,
      saveFailed: "L'enregistrement a échoué. Réessayez.",
    },

    confirm: {
      title: "Enregistrer une nouvelle version ?",
      body: (version: number) =>
        `Cela crée la version ${version} et l'active pour toutes les prochaines visites. Les versions précédentes restent consultables.`,
      cancel: "Annuler",
      confirm: "Enregistrer",
    },

    history: {
      title: "Versions",
      empty: "Aucune version enregistrée pour l'instant.",
      version: (n: number) => `Version ${n}`,
      active: "Active",
      inactive: "Inactive",
      questionsCount: (n: number) => (n === 1 ? "1 question" : `${n} questions`),
    },
  },
} as const;
