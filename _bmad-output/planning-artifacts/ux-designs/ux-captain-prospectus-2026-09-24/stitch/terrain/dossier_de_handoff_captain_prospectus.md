# Captain Prospectus — Dossier de Handoff & Spécifications de Design (Stitch Export)

Ce document rassemble l'ensemble des livrables, règles d'implémentation frontend, tokens de style et matrice des écrans pour **Captain Prospectus** (mode Web Admin & mode App Terrain).

---

## 1. Identité de marque, Règles d'Or & Tokens de Couleur

L'identité visuelle de **Captain Prospectus** découle du carnet de tournée (*field canvassing ledger*). L'encre est marine, la feuille est lin/ivoire, et l'or symbolise le cap et l'action prioritaire.

### Palette de Tokens (Light / Dark)

| Rôle Token | CSS Variable (`@theme`) | Valeur Light | Valeur Dark | Règle d'usage & Accessibilité |
|---|---|---|---|---|
| `background` | `--background` | `#F6F7F0` | `#101726` | Fond d'écran général off-white lin |
| `card` | `--card` | `#FFFFFF` | `#182031` | Cartes, tables, volets et panneaux |
| `foreground` | `--foreground` | `#1B2A4A` | `#E7EAF0` | Encre principale, texte fort, icônes |
| `secondary` / `muted` | `--secondary` | `#E8EAEF` | `#222B3D` | Surfaces neutres d'appui, boutons secondaires |
| `muted-foreground` | `--muted-foreground` | `#5A6478` | `#97A2B8` | Métadonnées, libellés secondaires, aides |
| `border` / `input` | `--border` | `#D7DAE2` | `#2B3547` | Filets fins de séparation, bordures de champs |
| `primary` (Gold) | `--primary` | `#C9A227` | `#D9B43C` | Bouton d'action principale exclusif |
| `primary-edge` | `--primary-edge` | `#A8801A` | `#E6C65C` | Filet 1px obligatoire autour du bouton or |
| `primary-foreground` | `--primary-foreground` | `#1B2A4A` | `#141C2E` | **Texte sur bouton or : TOUJOURS marine** |
| `ring` (Focus) | `--ring` | `#1B2A4A` | `#E7EAF0` | Anneau de focus (jamais d'or, contraste WCAG 3:1) |
| `success` | `--success` | `#1F6F4A` | `#4FA97D` | Statut *Converti*, taux positifs |
| `warn` | `--warn` | `#9A6B12` | `#D98A3C` | Statut *À relancer*, avertissements, doublons |
| `destructive` | `--destructive` | `#8C2F39` | `#D2757E` | Statut *Refusé*, suppressions, erreurs critiques |
| `band` / `sidebar` | `--sidebar` | `#1B2A4A` | `#0B1120` | Fond bandeau haut / barre latérale nav |
| `sidebar-foreground` | `--sidebar-foreground` | `#EEF0F4` | `#EEF0F4` | Texte sur bandeau / barre latérale |
| `sidebar-muted` | `--sidebar-muted` | `#95A0B8` | `#95A0B8` | Métadonnées sur la barre latérale |

### Les 3 Règles d'Or Inviolables (Palette CI Tests)
1. **L'or n'est JAMAIS utilisé comme couleur de texte sur fond clair** (ratio 2.4:1 insuffisant).
2. **Le texte sur fond or est TOUJOURS marine `#1B2A4A`**, jamais blanc (le blanc sur or n'offre que 2.4:1, contre 5.9:1 pour le marine).
3. **L'or n'est JAMAIS la couleur du focus ring** (le focus ring pointe sur l'encre marine `--ring`).
4. **Tout bouton or porte sa bordure `primary-edge`** (`border-primary-edge`, contraste structurel WCAG 1.4.11).

---

## 2. Typographie & Rythme Visuel

- **Famille typographique unique** : `Archivo` (Variable font latin subset, axe de poids uniquement, fichier woff2 unifié). Pas de seconde police, pas de monospace.
- **Échelle des tailles** :
  - `12px` (`text-xs`) : métadonnées, badges discrets, en-têtes de colonnes de tableau.
  - `14px` (`text-sm`) : corps de texte admin, cellules de tableaux (défaut).
  - `16px` (`text-base`) : corps de texte application terrain, tous les champs de saisie (évite le zoom auto sur iOS).
  - `20px` (`text-xl`) : titres d'écrans.
  - `28px` (`text-display` / `text-2xl` bold) : chiffres clés et indicateurs KPI.
- **Règle des chiffres tabulaires** : Tout nombre, distance, date et métrique utilise `font-variant-numeric: tabular-nums;` (`.tnum`). Les montants et totaux sont **alignés à droite** dans les tableaux.
- **Rayons de courbure (Border Radius)** :
  - Éléments standard / boutons : `6px` (`rounded-md`).
  - Cartes et panneaux : `12px` (`rounded-xl`).
  - Badges : `4px` (`rounded-sm`).
- **Cibles tactiles & ergonomie** :
  - Admin : lignes de tableau de `44px` minimum.
  - Terrain : cibles de `48px` minimum ; boutons d'issue de visite de `56px` pleine largeur.

---

## 3. Matrice des Statuts & Sémantique Métier

Le statut est **structurel avant d'être textuel** : chaque ligne de grand livre (*ledger*) présente un liseré indicateur de `4px` en bordure gauche, couplé impérativement à son libellé en français.

| Statut Métier | Clé Interne | Liseré de statut (Bord gauche 4px) | Couleur du libellé | Signification métier |
|---|---|---|---|---|
| **Nouveau** | `new` | Neutre ardoise 16% (`#D7DAE2`) | `muted-foreground` | Importé, non attribué |
| **Assigné** | `assigned` | Bleu ardoise 55% (`#5A6478`) | `foreground` | Attribué à un agent |
| **À relancer** | `follow_up` | Moutarde ambrée (`--warn` `#9A6B12`) | `warn` | Contacté, action future requise |
| **Converti** | `converted` | Vert forêt (`--success` `#1F6F4A`) | `success` | Client gagné / signé |
| **Refusé** | `rejected` | Rouge bordeaux (`--destructive` `#8C2F39`) | `destructive` | Refus définitif |

### Issues de Visite Terrain (Visites)
1. `Personne sur place` (Gris ardoise)
2. `Intéressé` (Bleu marine / Accent)
3. `Pas intéressé` (Gris neutre)
4. `À relancer` (Moutarde `--warn`)
5. `Converti` (Vert `--success`)

---

## 4. Spécifications des Écrans — Projet Web Admin (Desktop 1440px)

### Architecture du Shell Admin
- **Barre latérale gauche (260px)** : fond marine `#1B2A4A`, rétractable en mode icônes.
  - En-tête : logo SVG Captain Prospectus (gouvernail + repère or) + typographie "Captain Prospectus".
  - Groupe *Pilotage* : "Tableau de bord".
  - Groupe *Prospects* : "Prospects", "Import", "Doublons" (badge `3`), "À rattacher" (badge `2`).
  - Groupe *Terrain* : "Visites", "Scripts", "Tournée du jour".
  - Pied : utilisateur `admin@exemple.be` avec puce de statut de synchronisation verte.
- **Bandeau supérieur fin** : bascule de sidebar, fil d'Ariane, recherche rapide, toggle thème jour/nuit, profil.

### Écrans Admin (A1 à A13)
- **A1 — Tableau de bord** : Vue d'ensemble avec sélecteur 7J/30J/90J, 4 cartes KPI avec deltas et sparklines, barres empilées chronologiques des visites, pipeline horizontal (412 prospects), activité par agent, file d'actions prioritaires *À traiter* et flux temps réel des dernières visites.
- **A2 — Prospects** : Grand livre des prospects avec sélection multiple, filtres intégrés en bandeau unique (remplacé sur sélection par le menu d'affectation d'agent), pagination et actions par ligne.
- **A3 — Prospects : États vides & recherche infructueuse** : Gestion des messages d'invitation avec CTA d'import CSV.
- **A4 — Import : Choix de la source** : Sélection guidée "Fichier CSV" ou "Zone sur la carte".
- **A5 — Import CSV : Fichier & Mappage des colonnes** : Zone de glisser-déposer et configuration d'association des champs avec aperçu de la première ligne.
- **A6 — Import CSV : Aperçu des lignes & Rapport d'exécution** : Table de prévisualisation des lignes valides et lignes rejetées (barrées avec motif), barre de progression de l'import et dialogue de fin.
- **A7 — Import Carte : Zone & Résultats** : Vue scindée Leaflet OpenStreetMap (avec polygone dessiné) et volet de prospection dynamique avec identification des doublons et lieux sans nom.
- **A8 — Doublons** : Résolution des doublons détectés par paires d'adresses comparatives avec bouton de fusion immédiate *Garder*.
- **A9 — Visites à rattacher** : File de quarantaine des visites orphelines avec proposition d'association aux commerces les plus proches par géolocalisation.
- **A10 — Visites** : Journal temps réel exhaustif des visites synchronisées par les agents avec statut, remise de flyer et notes de terrain.
- **A11 — Scripts d'entretien** : Concepteur de questionnaires dynamiques réordonnables (Dnd-kit accessible), types de questions, verrouillage des clés d'historique et gestion des versions publiées.
- **A12 — Scripts : Dialogue de confirmation** : Modale d'activation immédiate de nouvelle version.
- **A13 — États système Admin** : Squelettes de chargement, bannières d'alerte, toasts de notification Sonner et bandeau de mise à jour logicielle.

---

## 5. Spécifications des Écrans — Projet App Terrain (Mobile 390×844px)

### Architecture du Shell Terrain
- **Bandeau supérieur sécurisé (Safe-area top)** : Logo marque, nom "Captain Prospectus", indicateur d'état de synchronisation permanent (pastille + compteur d'attente).
- **Bandeau de synchronisation conditionnel** : Affiché uniquement lorsqu'un état requiert l'attention de l'agent (ex: "3 éléments en attente d'envoi", "Hors ligne. Vos visites sont conservées").
- **Navigation basse (Tab bar)** : "Tournée" (icône liste ordonnée), "Carte" (icône plan OpenStreetMap), "Ajouter" (icône ajout rapide).

### Écrans Terrain (F1 à F8)
- **F1 — Tournée du jour** : Liste de tournée ordonnée au plus proche. Arrêt suivant mis en valeur sans carte superfétatoire, boutons directs *Y aller* et *Visiter*, jauges d'avancement journalier, section *Plus tard* et actions de balayage (swipe).
- **F2 — Carte de la tournée** : Carte OpenStreetMap plein écran centrée sur Bruxelles avec repères numérotés suivant l'itinéraire de marche et fiche tiroir de l'étape active.
- **F3 — Visite Étape 1 : Résultat** : Sélection plein écran d'issue en 5 boutons de 56px de haut faciles à actionner d'une main au soleil, case à cocher "Flyer remis" et sélection de date de relance conditionnelle.
- **F4 — Visite Étape 2 : Questionnaire** : Remplissage fluide des questions du script en cours avec sélecteurs larges, note chiffrée et champ de commentaires.
- **F5 — Confirmation d'enregistrement** : Volet récapitulatif avant écriture locale et envoi au prochain cycle de synchronisation.
- **F6 — Ajouter un prospect** : Formulaire d'ajout express sur le terrain avec capture des coordonnées GPS automatiques et sélection rapide de typologie de commerce.
- **F7 — États réseau & hors ligne** : Alertes non bloquantes garantissant la saisie continue sans connexion réseau.
- **F8 — Planche des états de synchronisation** : Matrice des 7 états du bandeau (Synchronisé, En attente, Hors ligne, Session expirée, Mise à jour requise, Échec avec réessai automatique, Synchronisation active).

---

## 6. Structure des Fichiers & Nomenclature pour l'Export

Pour l'intégration dans le dépôt source du projet :

```text
stitch/
├── DESIGN.stitch.md              # Tokens de design, règles d'or et charte
├── HANDOFF.md                    # Présent document de synthèse
├── admin/                        # Écrans Web Admin (Desktop 1440px)
│   ├── a01-tableau-de-bord.html
│   ├── a01-tableau-de-bord.png
│   ├── a02-prospects.html
│   ├── a02-prospects.png
│   └── ...
└── terrain/                      # Écrans App Mobile (Mobile 390px)
    ├── f01-tournee.html
    ├── f01-tournee.png
    ├── f02-carte.html
    ├── f02-carte.png
    └── ...
```

---
*Ce document sert de référence contractuelle pour la génération et l'exportation des gabarits HTML/CSS Tailwind v4 et des composants shadcn/ui.*
