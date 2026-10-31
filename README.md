# Parodie Pro Wrestling Tactics

### ▶️ [Jouer maintenant](https://ouellettejeanphilippe-source.github.io/Wrestling/)

Un jeu tactique sur grille à la **Chroma Squad**, avec un **tour de deck-builder** : chaque lutteur pioche cinq
cartes par tour et a trois points d'énergie pour les jouer. Des parodies de lutteurs WWE/AEU, chacun avec un
**gimmick** (passif unique), une **classe**, une **spécialité**, un **signature** et un **finisher**. Les matchs se
gagnent par tombé, soumission, compte à l'extérieur, DQ, par-dessus la troisième corde, échelle, évasion de cage,
survie…

Aucune dépendance, aucun build : du JavaScript (modules ES) servi statiquement. Tout est en **français**, code
et commentaires compris.

Ce fichier décrit le jeu **tel qu'il est**. L'histoire de ses choix (chaque changement, avec les mesures qui l'ont
justifié) est dans [`docs/journal-de-conception.md`](docs/journal-de-conception.md). Les consignes pour travailler
dans le code sont dans [`CLAUDE.md`](CLAUDE.md).

## Lancer le jeu

```bash
npm start          # serveur statique sur http://localhost:8080
npm test           # 196 tests du moteur (node:test), ~40 s
```

(ou n'importe quel serveur statique à la racine du dépôt : `python3 -m http.server 8080`).

**En ligne** : chaque push sur `main` lance les tests puis redéploie le jeu sur GitHub Pages
(`.github/workflows/pages.yml`). Les pull requests font tourner `npm test` (`.github/workflows/test.yml`).

**Installable (PWA) et jouable hors ligne.** Un bouton *Installer le jeu* apparaît sur l'écran titre quand le
navigateur le permet (Android, Chrome, Edge, bureau) ; sur iPhone, *Partager → Sur l'écran d'accueil*. Le service
worker `sw.js` précache tous les modules, et un test vérifie qu'aucun module n'a été ajouté sans être listé. Tous
les chemins sont **relatifs** : en ligne, le jeu est servi depuis `/Wrestling/`, pas depuis la racine.

## Où en est le jeu — honnêtement

Le match se jouait **une carte par tour**, main gardée d'un tour à l'autre : quarante tours de six clics, trois
cartes sur cinq jouables, un adversaire qui marchait la moitié du temps, un match sur quatre fini au chrono. Le
**tour à énergie** (trois cartes par tour, main neuve à chaque tour) et la **double équipe** ont remplacé ça.
Mesuré sur 60 matchs simples joués par l'IA contre l'IA (`autoPlay`), avant et après :

| ce qu'on constate | avant | **après** |
| --- | --- | --- |
| longueur d'un match simple (médiane) | 40 tours | **12 à 16 tours** selon l'échantillon |
| coups qui touchent par match | 30 | **30** — la densité est la même, en trois fois moins de tours |
| cartes de la main jouables à un tour donné | 3 sur 5 | **4 sur 5** en médiane, et le tour 1 en joue trois |
| phases adverses où l'IA ne fait **aucun** dégât | 50 % | **30 %** |
| matchs finis à la **limite de temps** | 23 % | **0 %** sur 60 |
| tours où le meilleur choix de l'IA est *Attendre* | 14 % | **3 %** |
| match d'échelle gagné par la ceinture | 4 sur 12 | **10 sur 12** |

Un tour est maintenant une suite de décisions : se déplacer, poser un coup qui étourdit, enchaîner avec la prise
qui demande une cible étourdie, et finir par un tombé — dans le même tour. À plusieurs, un lutteur peut donner son
tour pour que ses partenaires frappent plus loin et qu'il enchaîne sur leurs coups.

Ce qui reste à faire, par ordre d'importance :

1. **Du retour à l'écran** : le coup, le bump, la chute, la couverture, le compte. Aujourd'hui une ligne de journal
   et un nombre qui flotte.
2. **La carrière en équipe.** La double équipe n'existe qu'à plusieurs, et la carrière reste celle d'un seul
   lutteur : les nœuds 🤝 et l'exhibition la font jouer, pas la route. Une carrière d'écurie, c'est la suite
   logique de *Chroma Squad*.
3. **Le match par équipes à relais** reste une forme longue (30 tours en médiane) : quatre corps, le coin qui
   soigne, le partenaire illégal qui attend. À resserrer.
4. **Le momentum verrouille encore** les cartes de spécialité (45) au premier tour : un tour sur dix commence avec
   une seule carte jouable.

Les sections qui suivent décrivent les règles en place ; ce tableau dit ce qu'elles donnent une fois assemblées.

## Les écrans

| écran | ce qu'on y fait |
| --- | --- |
| **🆕 Nouvelle saison** | choisir un lutteur parmi ceux du vestiaire, un mode (Kayfabe ou Scénarios), et partir en carrière |
| **🥊 Match d'exhibition** | un match libre : stipulation, format (1c1, 2c2, 3c3), managers, n'importe lequel des 30 lutteurs ; les résultats 1c1 nourrissent les **rivalités** |
| **🔒 Vestiaire** | les 29 portraits de la carrière, les verrouillés grisés avec leur condition de déblocage en clair |
| **📖 Comment jouer** | le tutoriel (16 pages), aussi accessible en match via *Aide* |

### Les deux modes de campagne

| Mode | Vous êtes… | Objectif d'un match | Récompenses |
| --- | --- | --- | --- |
| **🎭 Kayfabe** | le promoteur | gagner | argent + fans, bonus pour les **directives du Network** |
| **🎬 Scénarios (IRL)** | le booker | réaliser le **script** : un finish imposé (parfois *votre* lutteur doit perdre) + des spots | note en étoiles → argent + fans ; le classement monte sur le finish livré |

En mode Scénarios, votre lutteur a deux actions de plus : **Vendre** (prendre un bump) et **Faire le job**. L'IA
adverse « travaille » le match, mais un **shoot** reste possible.

## La carrière

**Un lutteur, huit semaines, une ceinture au bout.** Sept nœuds de route, puis le **Championnat du Monde** contre
The Roc. La carrière se termine toujours par ce match, gagné ou perdu, et le show continue après une défaite : ce
qui se paie, c'est le public (−14 % de fans) et le classement.

### La route — une carte à embranchements

La carte est tirée à la graine de la partie, à la *Slay the Spire* : on voit les nœuds vers lesquels le sien
pointe, et on choisit.

| nœud | ce que c'est |
| --- | --- |
| 🤼 **Match** | un match écrit, solo : une victoire, une place au classement |
| ⭐ **Main event** | un adversaire classé, renforcé (+10 PV, +1 partout) : **deux places** si on gagne, une seule perdue sinon |
| 🤝 **Par équipes** | un match 2c2 ou 3c3 avec un **partenaire d'un soir** choisi parmi les lutteurs débloqués ; jamais imposé — chaque nœud mène à au moins une porte solo |
| 🛋️ **Semaine off** | une séance d'entraînement offerte, une carte oubliée, ou un house show |
| ❓ **En coulisses** | un angle, deux portes, jamais gratuit |
| 💼 **Bureau du booker** | acheter une carte, une séance, de l'affichage |
| 🏆 **Championnat** | le dernier nœud |

Le vivier compte 15 matchs écrits dans les huit épisodes plus 8 matchs solo, qui font jouer les 13 stipulations.

### Le classement

On part **sixième prétendant**. Une victoire fait monter d'une place, une défaite en fait perdre une, et la place
le soir du titre fixe **les conditions** du match, jamais s'il a lieu :

| classement | le soir du titre |
| --- | --- |
| **1ᵉʳ prétendant** | un contre un, match propre |
| **2ᵉ à 5ᵉ** | un contre un, mais le champion a choisi la date et l'arbitre : +25 PV, +1 partout |
| **6ᵉ et en dessous** | il amène son homme de main ; amenez le vôtre |

### Entre les matchs

- **Entraînement** : +1 stat ou +10 PV contre de l'argent, maximum 5 par stat, chaque progression coûtant 100 $ de
  plus que la précédente. Tout maximiser est hors de portée : il faut choisir.
- **Le deck** : chaque match de carrière propose d'apprendre une carte (trois au choix, deux après une défaite).
  Plafond 32 cartes, plancher 12 ; au-delà du plafond, apprendre veut dire oublier. Signature, finisher et
  fondamentaux ne s'oublient jamais. **L'exhibition ne lit pas ce deck** : elle joue toujours la fiche écrite.
- **Sauvegarde** automatique dans `localStorage` (`ppw-save-v1`) ; le vestiaire et les rivalités ont leurs propres
  clés et survivent à une nouvelle carrière.

### Le vestiaire

Six lutteurs au départ, 23 à débloquer, **29 en tout**. Les conditions sont de trois familles : l'**héritage**
(gagner la ceinture avec X ouvre Y), les **exploits** (3 victoires par soumission, un colosse battu, un deck de 12
cartes, une carrière en Scénarios…) et le **haut de l'affiche** (deux ceintures, puis cinq têtes d'affiche
sacrées). Douze conditions ne demandent pas la ceinture : une carrière ratée sert quand même. Chaque condition est
affichée avant d'être remplie.

The Roc, le champion, est jouable en exhibition mais **n'a pas de condition de déblocage** : c'est le trentième
nom, hors vestiaire.

## Un match

### Le tour — trois points d'énergie

Chaque lutteur **se déplace une fois**, puis joue **autant de cartes que son énergie le permet** : trois points
par tour. On sélectionne, on voit la portée de déplacement (bleu) et d'attaque (rouge), on se place, et un menu
s'ouvre : **Votre main**, **Mérité** (signature et finisher), **Tombé**, **Provoquer**, **Le ring** (projeter
par-dessus la corde, grimper, tag, armes, manager, vendre/faire le job), **Double équipe**, **Souffler**. Après
chaque carte, le menu se rouvre sur le même lutteur tant qu'il lui reste de l'énergie ; le tour se ferme à zéro, ou
en soufflant. Avant de confirmer une cible, la **prévision** donne précision, dégâts, critique, risque de
renversement, usure infligée, combos actifs, enchaînement de double équipe et risque de DQ.

| carte | coût |
| --- | --- |
| fondamentaux et mouvements de classe | ⚡1 |
| spécialité, signature | ⚡2 |
| finisher | ⚡3 — le tour entier |
| tombé, projection par-dessus la corde, arme, relais | ⚡1 |
| un échelon d'échelle ou de cage | ⚡2 |
| souffler, double équipe, manager, rentrer dans le ring, jeter sa main | ferme le tour |

### La main — neuve à chaque tour

Chaque lutteur pioche **5 cartes** de son deck (24 à 28 cartes de fiche) **à chaque tour** ; ce qui n'est pas joué
part à la défausse, et le talon se reconstitue avec elle. On revoit donc tout son deck tous les cinq tours, et une
carte apprise en carrière revient vite. **Tout est une carte**, coup de poing compris ; les fondamentaux y sont en
plusieurs exemplaires. **Le tour est le plan** : une carte qui demande une cible étourdie se joue juste après le
coup qui étourdit, dans le même tour.

Seuls la **signature** et le **finisher** ne se piochent pas : ils s'ouvrent au momentum (60 et 100) et le
consomment. Une carte `step: N` **emmène** son lutteur jusqu'à N cases vers la cible avant de frapper. Survoler
une carte **allume sur le plateau** les cases qui la débloqueraient.

### La double équipe — le système de *Chroma Squad*

À plusieurs, un lutteur peut **donner son tour** pour se mettre en double équipe. Jusqu'à son prochain tour, ses
partenaires qui partent d'à côté de lui vont **une case plus loin**, et chaque fois qu'un partenaire touche un
adversaire adjacent à lui, il **enchaîne** un coup par-dessus (70 % d'un coup de poing, sans jet ni renversement).
L'IA s'en sert aussi : 2,4 enchaînements par match à trois contre trois. En match à relais, seul le lutteur légal
peut s'y mettre.

### L'élan et le statisme

Le coup vaut ce que vaut la course qui le précède : **−15 %** sans bouger, **+25 %** après 4 cases ou plus (pas
pour les soumissions, les provocations, ni un lutteur étourdi). Rester sur place trois tours creuse encore le
plancher (−7 % par tour) **et refroidit la salle** ; une seule case parcourue remet le compteur à zéro.

### Deux jauges opposées

| | momentum ⚡ | souffle 😮‍💨 |
| --- | --- | --- |
| sens | monte quand on frappe, encaisse, provoque | descend quand on frappe (4 à 22 selon le palier, +3 en courant) |
| rôle | ouvre les paliers (classe 25, spécialité 45, signature 60, finisher 100) ; signature et finisher le dépensent | sous 25 : −25 % de dégâts, −10 de précision, plus de signature ni de finisher |
| se refait | en frappant | +5 par tour, +14 si on a soufflé (attendre, provoquer) |

### Le sol, le cœur et le tombé

À 0 PV un lutteur **tombe**, perd un tour, se relève à 55 % de ses PV avec un **cœur ❤️ en moins**. Le cœur est le
**plafond** du tombé : plein 15 %, ¾ 35 %, ½ 55 %, ¼ 75 %, vide 95 %. Un kick-out coûte aussi un cœur, donc
couvrir tôt est un investissement. Un adversaire sans cœur qui retombe ne se relève plus : **l'arbitre arrête le
match**. Sous 60 % de PV ou juste après un finisher, on peut couvrir debout (roll-up, plafonné à 15 %).

### L'usure ciblée

Chaque coup marque un membre (jambe, bras, côtes, tête), avec deux seuils : **touché** à 45, **hors service** à
85, et ça ne redescend jamais. Une jambe hors service interdit les aériens et l'escalade ; des côtes hors service
empêchent de reprendre son souffle. **Les soumissions paient là-dessus** : la chance d'abandon dépend d'abord de
l'usure du membre visé, et le cœur la plafonne comme le tombé. Un coup qui *vise* le membre l'use quatre fois plus
qu'un coup qui l'atteint au passage.

### Le renversement, l'étourdissement, la grille

- Un gros mouvement sur un adversaire frais peut se **retourner** contre son auteur : 2 % (base) à 15 % (finisher),
  modulé par vitesse, technique et souffle. Une cible au sol ou étourdie ne renverse rien.
- Un coup qui **étourdit** dure jusqu'au tour suivant : c'est ce qui permet les enchaînements.
- Les coups agissent **sur la grille** : ligne (le coup continue derrière), zone (les voisins dégustent, partenaire
  compris), recul (vers les cordes, un coin, une table), attirer.
- **Les cordes sont un tremplin** : y entrer coûte 1, en repartir est gratuit. Le coin coûte 2 et donne la hauteur.
  Entrer dans le ring coûte 3, en sortir 2 : c'est *revenir* qui coûte, et c'est là qu'est le compte de l'arbitre.

### Les trois actes et la chaleur

La phase se lit sur les corps (PV, cœurs, puis le chrono) et s'affiche en haut : 🔔 **Ouverture** (dégâts −15 %,
momentum +35 %, gros coups −15 %), 🔥 **Corps du match** (soumissions +8 %), 🏆 **Main event** (dégâts +15 %, tombés
+12 %). La **chaleur** de la foule monte sur les coups, les near-falls et les finishers, et perd 18 % par tour :
c'est sa **moyenne** sur tout le match qui compte pour la note, la recette et les directives. Répéter un coup
rapporte de moins en moins (la foule l'a déjà vu).

### L'arbitre, les armes, les managers

- **L'arbitre a une tolérance** tirée au sort : pointilleux (2 avertissements, voit ×1,5), à l'ancienne (3),
  complaisant (5, voit ×0,6). Les armes se cherchent **sous le ring** (sortir, se coller au tablier, fouiller) ;
  s'en servir devant lui use sa patience.
- **Cinq managers**, à choisir en exhibition ou offerts par la route : chacun intervient **deux fois** par match,
  jamais avant le tour 4, et son intervention coûte le tour du lutteur. Deux sont illégales et usent la même
  tolérance d'arbitre que vos coups bas.
- **Tag** : un seul lutteur légal par équipe ; relais avec un partenaire adjacent (soigne, +30 momentum).

### Combos

Douze enchaînements nommés se déclenchent tout seuls (cible étourdie, plongeon depuis un coin, attaque depuis les
cordes, cible au sol, finisher sur un sonné, foule à 70+, cible acculée, familles alternées, traversée des cordes,
arriver dans le dos, différence de force, poitrine marquée). Ils sont annoncés à l'avance sur chaque carte et dans
la prévision.

### Les stipulations

| type | comment on gagne |
| --- | --- |
| 🥇 Match simple / 🤝 Par équipes | tombé, soumission, compte de 6 tours dehors, ou DQ adverse |
| 🪑 Hardcore / 🥊 Street fight | idem sans DQ ni compte ; armes et tables partout, tombé n'importe où |
| 👑 Bataille royale | par-dessus la troisième corde, après avoir usé l'adversaire |
| 🪜 Échelle / TLC | décrocher la ceinture : 2 échelons (⚡2 chacun, un par tour) ; on ne grimpe pas avec quelqu'un debout à côté, et seule une chute ou un déplacement fait redescendre — pas d'abandon dans ce match |
| 🔒 Cage | tombé, soumission ou évasion (3 tours depuis un coin) |
| 😈 Hell in a Cell | pas d'évasion ; les murs font mal |
| 🔟 Last Man Standing | au sol et incapable de répondre au compte de dix |
| 🔗 Soumission uniquement | le faire abandonner, et rien d'autre |
| ⏱️ Survie | tenir N tours face aux renforts (campagne seulement) |
| ⚔️ Confrontation | éliminer tous les adversaires |

Le panneau **Comment gagner** liste en permanence les routes ouvertes et leur état. Au-delà de **40 tours** (55
pour les formes longues), le match est donné aux points — mesuré à zéro fin au chrono sur soixante matchs simples.

### Après le match

Le jeu **écrit l'histoire du match** à partir des temps forts réellement enregistrés (le membre travaillé, le
tournant, la fin) et lui donne une note sur cinq étoiles. En exhibition 1c1, le résultat est gardé : la prochaine
fois que ces deux-là se croisent, la salle est déjà chaude et le perdant arrive avec une rancune.

## Les lutteurs

```
Lutteur = classe + spécialité + gimmick (passif) + signature + finisher
Deck de départ = fondamentaux (en plusieurs exemplaires) + classe + spécialité ≈ 24 à 28 cartes
```

| classes (5) | spécialités (8) |
| --- | --- |
| 💪 Force, 🪽 Voltigeur, 🧠 Technicien, 🥊 Bagarreur, 🎤 Vedette | 🦅 Aérien, 🔗 Soumission, 🪑 Hardcore, 🦵 Frappeur, 😈 Tricheur, 🗿 Colosse, ⚡ Vitesse, 📣 Micro |

Le catalogue compte **131 mouvements** (11 de base, 23 de classe, 28 de spécialité, 37 signatures, 32 finishers).
Une partie du vocabulaire n'existe pas à l'arrêt : `requires: { ran: n }` exige n cases de course, `crossedRope`
d'avoir traversé les cordes, `turnbuckle` d'être monté dans un coin, `targetDown` une cible au sol.

Trente lutteurs jouables (John Sena, Darby All-In, Bryan Danielsonne, Stone Cold Steve Boston, Orange Casually,
Cody Roads, Kenny Oméga-3, Will Ospray, Becky Lunch, Rey Mysterioso, Bulk Hogan, Stung, Hangman Adam Paige, CM
Funk, Toni Stormy, Chris Jerico, Randy Horton, MJF, Rhea Rippley, Jon Moxie, Günter, Seth Rollings, Swerve
Strickly, Logan Pawl, Danhowsen, Fray Wyatt, Andrei le Géant, The Undertacker, Roman Rains, The Roc) plus trois
PNJ (deux jobbers, un envahisseur). Un colosse occupe **2×2 cases** ; l'aréna fait **20×16**, le ring 10×10 cordes
comprises.

## Interface et direction artistique

- Plateau en **caméra isométrique** (rotation par quarts de tour, touche R) ou en **vue de dessus** ; zoom à la
  molette ou au pincement, glisser pour déplacer la vue. Le HUD flotte dans les coins pour laisser la place aux
  sprites. Pensé pour le **paysage** sur téléphone ; en portrait, un rappel s'affiche. L'énergie du tour se lit
  en tête du menu, sur la fiche et dans la barre d'équipe ; chaque carte affiche son coût ⚡.
- Le jeu se présente comme une **émission de catch du samedi soir filmée en pixel** : contours d'encre, ombres dures,
  aplats saturés, lignes de balayage, voyant « ON AIR ».
- **Sprites 24×32 en SVG**, personne n'est dessiné à la main : un lutteur est *composé* depuis sa description `look`
  (carrure, palette, posture, expression, vêtements posés par-dessus, animation de repos). Aucune image externe.
  Les règles et les erreurs déjà commises sont dans `.claude/skills/pixel-art/SKILL.md`.
- **Son synthétisé** en Web Audio (`src/ui/sound.js`) : cloche, coups, foule dont le volume suit la chaleur. Pas un
  fichier à télécharger ; aucune fonction audio ne peut faire planter un match.
- `prefers-reduced-motion` coupe les animations d'ambiance.

## Code

```
index.html, styles.css        interface (DOM pur)
src/main.js                   navigation entre écrans
src/pwa.js                    service worker, bouton d'installation
src/engine/  grid.js          terrain, aréna 20×16, gabarits, déplacement (Dijkstra)
             battle.js        état de match, actions, dégâts, tombés, soumissions, whip, armes/DQ, tag,
                              escalade, managers, arbitre, double équipe, phases (le gros fichier)
             hand.js          la main, le talon, la défausse, l'énergie et le coût des cartes
             wear.js          l'usure par membre
             ai.js            IA : évalue chaque tuile atteignable × chaque action × chaque cible
             phases.js        les trois actes et leurs modificateurs
             units.js         création d'unités, mouvements par palier, échelle des PV
             rules.js         conditions de victoire, limite de temps
             rng.js, util.js  RNG à seed, helpers
src/data/    wrestlers.js     les 33 fiches (30 jouables + 3 PNJ), dont le `look` des sprites
             moves.js         les 131 mouvements
             classes.js       classes et spécialités
             gimmicks.js      les passifs (hooks appelés par le moteur)
             matchTypes.js    les 13 stipulations, armes
             combos.js        les 12 enchaînements
             managers.js      les 5 managers
             directives.js    directives du Network / spots des scripts
             campaign.js      la saison : 8 épisodes, 15 matchs écrits, 8 matchs solo
src/game/    state.js         la carrière : argent, fans, entraînement, exploits, sauvegarde
             route.js         la carte à embranchements
             rank.js          le classement et les conditions du match de titre
             week.js          semaine off, coulisses, bureau du booker
             deck.js          le deck qui se construit (offre, plafond, oubli)
             unlocks.js       le vestiaire : 23 conditions de déblocage
             rivalry.js       les rivalités d'exhibition
             story.js         l'histoire du match et sa note
             script.js        évaluation des directives et des scripts (étoiles)
src/ui/      title.js         écran titre, vestiaire
             hub.js           la carte, l'entraînement, le deck, l'historique
             match.js         l'écran de match
             cards.js, dom.js fiches de lutteur, helpers DOM
             tutorial.js      les 16 pages
             sound.js         tout l'audio
             spriteart.js     les planches de pixels (grilles de caractères)
             spritepixel.js   palette, postures, vêtements, rendu SVG
             avatar.js        enrobage DOM des sprites
manifest.webmanifest, sw.js   installation et mode hors ligne
icons/                        icônes d'application, générées par le moteur de sprites
tests/                        19 fichiers node:test, 196 tests
docs/                         le journal de conception
```

Le moteur est **indépendant du DOM et déterministe** (seed). `autoPlay(battle)` fait jouer l'IA contre l'IA : c'est
l'outil d'équilibrage, et la plupart des tests mesurent le jeu plutôt que des fonctions (longueur des matchs, part
des fins par soumission, taux de ceinture sur cent carrières…).

### Ajouter un lutteur

1. Son signature et son finisher dans `src/data/moves.js` (`tier: 'signature'` / `'finisher'`).
2. Son gimmick dans `src/data/gimmicks.js` (n'importe quel sous-ensemble de hooks).
3. Sa fiche dans `src/data/wrestlers.js`, avec son `look`. Base, classe et spécialité sont automatiques.
4. Sa condition de déblocage dans `src/game/unlocks.js`, sinon il n'apparaît qu'en exhibition.

## Idées pour la suite

- D'abord ce que dit la section « Où en est le jeu » : retour visuel, carrière en équipe, match à relais.
- Une difficulté montante entre les runs (l'Ascension de *Slay the Spire*).
- Jouer un match entièrement au clavier, rôles et labels ARIA.
- Des cartes qui ne sont pas que des mouvements : une carte qui change une règle du match pour un tour.
- Blessures, moral, contrats en mode Scénarios ; gestion des heels/faces (turns).
- Des musiques d'entrée ; animations de coups ; éditeur de lutteurs.
