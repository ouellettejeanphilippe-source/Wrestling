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
- **Momentum** (0–100) : gagné en frappant, en encaissant, en provoquant. Signature = 50, finisher = 100.
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
             campaign.js      la saison (8 épisodes, scripts pour le mode Scénarios)
src/game/    state.js         campagne : argent, fans, roster, entraînement, recrutement, sauvegarde
             script.js        évaluation des directives et des scripts (étoiles)
src/ui/      title.js hub.js match.js cards.js dom.js
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
- Sprites/animations, sons ; éditeur de lutteurs.
