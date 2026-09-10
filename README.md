# Parodie Pro Wrestling Tactics

Un jeu tactique sur grille à la **Fire Emblem × Chroma Squad**, avec des parodies de lutteurs WWE/AEW.
Chaque lutteur a un **gimmick** (passif unique, comme dans League of Legends), une **classe**, une **spécialité**,
un **signature** et un **finisher**. Les matchs se gagnent (ou se perdent avec panache) de plein de façons :
tombé, soumission, compte à l'extérieur, DQ, par-dessus la troisième corde, échelle, évasion de cage, survie…

Aucune dépendance, aucun build : du JavaScript (modules ES) servi statiquement.

## Lancer le jeu

```bash
npm start          # serveur statique sur http://localhost:8080
npm test           # tests du moteur (node:test)
```

(ou n'importe quel serveur statique à la racine du dépôt : `python3 -m http.server 8080`).

**En ligne (GitHub Pages)** : chaque push sur `main` déploie le jeu via `.github/workflows/pages.yml`.
Première fois seulement : dans *Settings → Pages*, mettre *Source* sur **GitHub Actions**. Le jeu est ensuite servi à
`https://<utilisateur>.github.io/<dépôt>/`.

## Les deux modes de campagne

| Mode | Vous êtes… | Objectif d'un match | Récompenses |
| --- | --- | --- | --- |
| **🎭 Kayfabe** | le promoteur d'une promotion qui monte | gagner le match | argent + fans, bonus pour les **directives du Network** |
| **🎬 Scénarios (IRL)** | le booker en coulisses | réaliser le **script** : un finish imposé (parfois *votre* lutteur doit perdre) + des spots | note en étoiles (★1 à ★5) → argent + fans ; sous 2,5★ le Network exige une reprise |

En mode Scénarios, vos lutteurs ont deux actions supplémentaires : **Vendre** (prendre un bump : chaleur, momentum
pour l'adversaire) et **Faire le job** (prendre le tombé / abandonner / passer par-dessus la corde, quand le script le
prévoit). L'adversaire IA « travaille » le match : ses tombés contraires au script réussissent rarement… mais un
**shoot** reste possible.

La saison compte 8 épisodes (salle de bingo → PPV), 2 matchs bookables par épisode, avec renforts, tables,
échelle, cage et un Boss Final.

## Structure d'un lutteur

```
Lutteur = classe + spécialité + gimmick (passif) + signature + finisher
Mouvements = base (tous) + classe (3) + spécialité (2) + signature (50 momentum) + finisher (100 momentum)
```

| Classes | Spécialités |
| --- | --- |
| 💪 Force, 🪽 Voltigeur, 🧠 Technicien, 🥊 Bagarreur, 🎤 Vedette | 🦅 Aérien, 🔗 Soumission, 🪑 Hardcore, 🦵 Frappeur, 😈 Tricheur, 🗿 Colosse, ⚡ Vitesse, 📣 Micro |

Le roster : John Sena, Darby All-In, Bryan Danielsonne, Stone Cold Steve Boston, Orange Casually, Cody Roads,
Kenny Oméga-3, Will Ospray, Becky Lunch, Rey Mysterioso, Bulk Hogan, Stung, Hangman Adam Paige, CM Funk, Toni Stormy,
Chris Jerico, Randy Horton, Maxwell Jacob Fraude (MJF), Rhea Rippley, Jon Moxie, Günter, Seth Rollings, Swerve Strickly,
Logan Pawl, Danhowsen, Fray Wyatt, Andrei le Géant, The Undertacker, Roman Rains et The Roc (+ jobbers et envahisseurs).

Quelques gimmicks : *Reconnaissez-moi* (aura d'équipe), *N'abandonne jamais* (refuse la première chute),
*Sorti de nulle part* (contre RKO), *Repose en paix* (se redresse à 50 %), *Mains dans les poches* (esquive),
*Meilleure machine à matchs* (combo), *La Liste*, *Très gentil très méchant* (malédiction), *Laisse-moi entrer*
(transformation), *Inamovible*, *Le Boss Final*… (30 lutteurs + jobbers, voir `src/data/wrestlers.js`).

## Règles de match

- **Déplacement puis action**, une fois par lutteur et par tour (comme Fire Emblem). Les cordes et les coins coûtent
  2 de mouvement ; les ennemis bloquent le passage.
- **Momentum** (0–100) : gagné en frappant, en encaissant, en provoquant (+5 par tour). Il **débloque les paliers de
  mouvements** et se dépense à l'usage :

  | Palier | Débloqué à | Coût à l'usage |
  | --- | --- | --- |
  | Base (coup de poing, prise, Irish Whip, provoquer) | 0 | 0 |
  | Classe | 25 | 0 |
  | Spécialité | 45 | 0 |
  | Signature | 60 | 40 |
  | Finisher | 100 | 100 |

  Le palier donne l'**accès** ; seuls le signature et le finisher **consomment** la jauge. Un coup qui touche rapporte
  son propre momentum (10 à 20), donc la jauge monte pendant que le match s'installe, puis se vide sur les grands coups.
  Les provocations sont toujours gratuites.

- **Étourdissement** : un coup qui étourdit dure jusqu'à votre tour suivant, ce qui permet des enchaînements
  (doigt dans l'œil puis Elbow Drop, coup de pied retourné puis finisher, étourdir puis jeter par-dessus la corde).

## Les trois actes d'un match

La phase se déduit de l'état du match (tour, chaleur de la foule, usure des corps), pas d'un minuteur, et elle est
affichée en haut de l'écran avec ce qu'elle récompense.

| Acte | Rôle | Effets |
| --- | --- | --- |
| 🔔 **Ouverture** | Build-up | Dégâts -15 %, momentum +35 %, chaleur -30 %, gros mouvements -15 % (personne n'y croit encore), tombés plus durs |
| 🔥 **Corps du match** | Prendre l'avantage | Valeurs normales, soumissions +8 % d'abandon : c'est le moment d'user, de marquer et de contrôler le terrain |
| 🏆 **Main event** | Tout donner | Dégâts +15 %, mouvements spectaculaires +15 %, chaleur +40 %, tombés +12 % |

## Combos

Ils se déclenchent tout seuls quand les conditions sont réunies, s'annoncent dans le journal et se cumulent
(multiplicateur plafonné). Ils sont visibles à l'avance sur chaque mouvement et dans la prévision de combat.

| Combo | Condition |
| --- | --- |
| 💫 Suite logique | Frapper une cible étourdie |
| 🔴 Poitrine en feu | Frapper une cible marquée 3 fois (chops) |
| 🦅 High spot | Plonger depuis un coin |
| 🪢 Rebond des cordes | Attaquer depuis les cordes |
| 🔨 Au sol et martelé | Frapper une cible au sol |
| ☠️ Séquence de finition | Finisher sur une cible encore sonnée |
| 📣 La foule est debout | Attaquer avec 80+ de chaleur |
| 🪑 Décor complice | Frapper une cible acculée à un obstacle |
| 🔗 Enchaînement | Alterner les familles de coups sur la même cible |
| 💪 Différence de force | Prise sur un adversaire nettement moins fort |

## Plusieurs façons de gagner

Le panneau « Comment gagner » liste en permanence les routes ouvertes et leur état : tombé, **arrêt de l'arbitre**
(un adversaire sans cœur qui retombe ne se relève plus), soumission, compte à l'extérieur, disqualification adverse,
par-dessus la troisième corde, échelle, évasion de cage, survie, élimination totale. Sur une saison simulée, les
victoires se répartissent réellement entre toutes ces routes.

## Tutoriel

Cinq pages accessibles depuis l'écran titre (« Comment jouer ») et le bouton Aide en match, affichées automatiquement
au premier match : les trois actes, l'échelle de momentum, les combos, les routes de victoire, et trois approches
possibles (rouleau compresseur, voltigeur, technicien) présentées comme des exemples et non comme la bonne façon de
jouer.
- **Au sol** : à 0 PV un lutteur tombe et perd un tour. C'est là qu'on le **couvre**. Il peut se dégager (kick-out),
  mais chaque kick-out et chaque relevé use son **cœur ❤️**. Un finisher donne un tombé immédiat et +30 %.
- **Soumissions** : peuvent faire abandonner une cible affaiblie. *Rope break* près des cordes (matchs avec arbitre).
- **Terrain** : coin = plongeons +25 %, cordes = étourdi, coin/marches/table/cage = dégâts sur Irish Whip, table qui casse.
- **Armes** (chaise, kendo, poubelle, batte) : illégales avec arbitre → risque de DQ, sauf s'il est distrait.
- **Tag** : un seul lutteur légal par équipe ; tag avec un partenaire adjacent (soigne, +30 momentum, « HOT TAG »).
  Attaquer sans être légal = risque de DQ.
- **Compte à l'extérieur** : 6 tours sur le plancher = éliminé (matchs avec arbitre).

| Type | Condition de victoire |
| --- | --- |
| 🥇 Match simple / 🤝 Par équipes | premier tombé, soumission, count-out ou DQ décide |
| 🪑 Hardcore | idem, sans DQ ni compte, armes et tables partout, tombé n'importe où |
| 👑 Bataille royale | jeter les adversaires par-dessus la corde (ils doivent être sur les cordes/coin) |
| 🪜 Échelle | grimper au centre 2 tours de suite sans subir de dégâts |
| 🔒 Cage | tombé, soumission ou évasion (2 tours depuis un coin) |
| ⏱️ Survie | tenir N tours face aux renforts |
| ⚔️ Confrontation | éliminer tous les adversaires |

## Interface de match (façon Fire Emblem)

- Sélectionner un lutteur affiche sa **portée de déplacement (bleu)** et sa **portée d'attaque (rouge)** ; survoler un
  adversaire affiche sa **zone de menace**.
- Après le déplacement, un **menu contextuel** apparaît près du lutteur : Attaquer, Tombé, Provoquer, Spécial, Attendre.
- Avant de confirmer une cible, une **prévision de combat** montre précision, dégâts estimés, critique, PV après le
  coup, risques (contre, DQ) — cliquer la cible confirme, Échap annule.
- Barre d'équipe avec **vignettes** (bustes pixel générés, un sprite par lutteur), PV et momentum ; bannière de tour
  façon transition sentai ; journal de commentaires.

## Direction artistique

Le jeu se présente comme une **émission de catch du samedi soir filmée en pixel** : gros contours d'encre, ombres
portées dures (jamais de flou), aplats saturés, lignes de balayage et vignettage de vieille télé. C'est un clin d'œil
assumé aux jeux tactiques tokusatsu — sans copier leur palette : ici c'est violet de coulisses, or de ceinture, rouge
de tapis.

- **Sprites** (`src/ui/sprite.js`) : chaque lutteur est dessiné pixel par pixel sur une grille 32×40, en SVG à arêtes
  franches (`shape-rendering="crispEdges"`), à partir de sa description `look` (peau, cheveux, tenue, accent,
  `features`). Deux cadrages sur le même dessin : `full` (corps entier, pions du plateau, défilé de l'écran titre) et
  `bust` (portrait, cartes et listes). Les silhouettes sont détourées d'un pixel d'encre, les pions respirent
  (animation d'attente) et regardent l'adversaire (`facing`).
- **Aucune image externe** : tout est généré à la volée, donc ajouter un lutteur ne demande aucun fichier d'art.
- **Habillage** : voyant « ON AIR » sur le bandeau de régie, guirlande de loges sur l'écran titre, menu contextuel
  coiffé d'un clap de cinéma (qui sert de poignée à la feuille d'actions sur mobile), onomatopées à contour épais pour
  les dégâts, bannière de tour en balayage diagonal.
- `prefers-reduced-motion` coupe les animations d'ambiance.

## Hub de promotion (entre les shows)

- **Le show** : 2 matchs bookables, adversaires, directives/scripts, récompenses ; choix de l'équipe.
- **Roster & entraînement** : +1 stat / +10 PV contre de l'argent (max 5 par stat).
- **Agents libres** : 3 recrues par épisode, salaire payé à la signature.
- **Historique** ; sauvegarde automatique dans `localStorage`.

## Code

```
index.html, styles.css        interface (DOM pur)
src/main.js                   navigation entre écrans
src/engine/  grid.js          terrain, aréna 14×10, déplacement (Dijkstra)
             phases.js        les trois actes du match et leurs modificateurs
             units.js         création d'unités, liste de mouvements par palier
             battle.js        état de match, actions, dégâts, tombés, soumissions, whip, armes/DQ, tag, escalade, phases
             ai.js            IA : évalue chaque tuile atteignable × chaque action × chaque cible
             rules.js         conditions de victoire
             rng.js, util.js  RNG à seed, helpers
src/data/    wrestlers.js     roster parodique
             moves.js         catalogue des mouvements (base / classe / spécialité / signature / finisher)
             classes.js       classes et spécialités
             gimmicks.js      passifs (hooks appelés par le moteur)
             matchTypes.js    types de matchs, armes
             directives.js    directives du Network / spots des scripts
             combos.js        enchaînements nommés et leurs conditions
             campaign.js      la saison (8 épisodes, scripts pour le mode Scénarios)
src/game/    state.js         campagne : argent, fans, roster, entraînement, recrutement, sauvegarde
             script.js        évaluation des directives et des scripts (étoiles)
src/ui/      title.js hub.js match.js cards.js tutorial.js dom.js
             sprite.js        sprites pixel 32×40 générés en SVG (corps entier / buste)
             avatar.js        enrobage DOM des sprites (vignettes, pions)
tests/                        node:test — grille, moteur, gimmicks, types de matchs, campagne
```

Le moteur est indépendant du DOM et déterministe (seed) : `autoPlay(battle)` fait jouer l'IA contre l'IA, pratique
pour l'équilibrage.

### Ajouter un lutteur

1. Ajouter son signature et son finisher dans `src/data/moves.js` (`tier: 'signature'` / `'finisher'`).
2. Ajouter son gimmick dans `src/data/gimmicks.js` (n'importe quel sous-ensemble de hooks).
3. Ajouter l'entrée dans `src/data/wrestlers.js`. Les mouvements de base/classe/spécialité sont automatiques.

## Idées pour la suite

- Rivalités et storylines persistantes (heat entre lutteurs, promos entre les shows).
- Blessures, moral, contrats en mode Scénarios ; gestion des heels/faces (turns).
- Managers et interférences (ref bump), matchs à stipulations (No Holds Barred, Last Man Standing).
- Sons et musiques ; animations de coups (sprites d'attaque) ; éditeur de lutteurs.
