# Parodie Pro Wrestling Tactics

### ▶️ [Jouer maintenant](https://ouellettejeanphilippe-source.github.io/Wrestling/)

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

**En ligne** : <https://ouellettejeanphilippe-source.github.io/Wrestling/> — chaque push sur `main` redéploie le jeu
via `.github/workflows/pages.yml` (rien à installer, ça tourne dans le navigateur, mobile compris).

## Installer le jeu (PWA)

Le jeu s'installe comme une application et **se joue hors ligne** : tout est statique, et la sauvegarde vit déjà dans
`localStorage`, donc une saison commencée dans le métro se termine dans le métro.

- **Android / Chrome / Edge** : un bouton **📲 Installer le jeu** apparaît sur l'écran titre dès que le navigateur
  signale que c'est possible.
- **iPhone / Safari** : pas d'événement d'installation sur iOS — bouton *Partager*, puis « Sur l'écran d'accueil ».
  L'écran titre affiche la marche à suivre.
- **Bureau** : l'icône d'installation dans la barre d'adresse.

| pièce | rôle |
| --- | --- |
| `manifest.webmanifest` | nom, icônes, couleurs, `display: standalone` |
| `sw.js` | précache la coquille et tous les modules, puis sert le cache d'abord et rafraîchit derrière |
| `src/pwa.js` | enregistrement du service worker et bouton d'installation |
| `icons/` | icônes 192/512 + maskable, **générées par le moteur de sprites du jeu** |

Tous les chemins sont **relatifs** : en ligne le jeu est servi depuis `/Wrestling/`, pas depuis la racine. Un chemin
absolu marcherait en local et mettrait l'installation en 404 en ligne — `tests/pwa.test.js` le vérifie, en même temps
qu'il vérifie qu'aucun module n'a été ajouté sans être précaché.

Le service worker ne fait pas de `skipWaiting` : une partie en cours ne se fait pas remplacer sous les pieds du
joueur. La nouvelle version prend la main au lancement suivant.

## Les deux modes de campagne

| Mode | Vous êtes… | Objectif d'un match | Récompenses |
| --- | --- | --- | --- |
| **🎭 Kayfabe** | le promoteur d'une promotion qui monte | gagner le match | argent + fans, bonus pour les **directives du Network** |
| **🎬 Scénarios (IRL)** | le booker en coulisses | réaliser le **script** : un finish imposé (parfois *votre* lutteur doit perdre) + des spots | note en étoiles (★1 à ★5) → argent + fans ; le classement monte sur le finish livré |

En mode Scénarios, vos lutteurs ont deux actions supplémentaires : **Vendre** (prendre un bump : chaleur, momentum
pour l'adversaire) et **Faire le job** (prendre le tombé / abandonner / passer par-dessus la corde, quand le script le
prévoit). L'adversaire IA « travaille » le match : ses tombés contraires au script réussissent rarement… mais un
**shoot** reste possible.

## Le vestiaire — faire le tour des 29 lutteurs

Une carrière dure quarante minutes et finit sur une ceinture, gagnée ou pas. Mais une fois la ceinture prise, il n'y
avait **aucune raison de recommencer** : la carrière suivante repartait du même vestiaire. Un roguelike sans
méta-jeu n'a qu'une seule bonne partie.

**Six lutteurs au départ, vingt-neuf en tout.** Chaque carrière en ouvre d'autres. Le modèle est celui de *Slay the
Spire* (on débloque la Silencieuse en terminant avec l'Ironclad) et de *Binding of Isaac*.

Le lutteur choisi est celui dont c'est la carrière, et c'est avec lui que comptent les déblocages. Les autres
noms du vestiaire ne sont pas décoratifs pour autant : ce sont eux qu'on appelle en **partenaire d'un soir** sur un
nœud « match par équipes ».

Deux règles décident de tout le reste :

1. **On débloque en jouant, pas seulement en gagnant.** Douze des vingt-trois conditions ne demandent pas la
   ceinture — passer un adversaire à travers une table, gagner une cage, arriver premier prétendant. Une carrière
   ratée doit quand même avoir servi à quelque chose.
2. **Chaque condition est écrite à l'écran avant d'être remplie.** Un déblocage surprise ne récompense rien : on ne
   peut pas viser ce qu'on ne voit pas. Le vestiaire (menu principal) montre les 29 portraits, les verrouillés
   grisés avec leur condition en clair.

Trois familles :

| | |
| --- | --- |
| **L'héritage** (6) | Gagner la ceinture avec un lutteur ouvre la porte à celui qui lui ressemble — ou à celui qui l'attendait au tournant. |
| **Les exploits** (15) | Une manière de jouer : 3 victoires par soumission, 3 main events, un colosse battu, un deck de 12 cartes, 4 000 $ en caisse, une carrière en mode Scénarios… |
| **Le haut de l'affiche** (2) | Ne se prennent pas en une carrière : deux ceintures, puis cinq têtes d'affiche différentes sacrées. |

**Mesuré sur 24 carrières simulées enchaînées** : 27 lutteurs sur 29, avec 5 déblocages dès la première carrière —
les deux derniers sont justement les deux qui demandent une intention (tailler son deck sous 12 cartes, finir sans
avoir tout dépensé), et un robot qui joue comme un robot ne les vise jamais.

**Une condition était cassée et la mesure l'a attrapée** : « passez 3 adversaires à travers une table » — sur trente
carrières, la médiane est de **zéro** table et le maximum de **deux**. Une condition que personne ne peut remplir
n'est pas difficile, elle rend un lutteur injouable à vie. Un test construit maintenant, pour *chaque* condition, la
carrière qui devrait la remplir, et exige qu'elle la remplisse — et vérifie l'inverse : qu'aucune ne tombe sur une
carrière où il ne s'est rien passé.

## La carrière — courte, et une seule question au bout

Une carrière, c'est **un lutteur** et **huit soirs** : sept matchs de route, puis le **Championnat du Monde**. Elle
se termine toujours par ce match-là, et elle se raconte en une phrase — il est reparti avec la ceinture, ou il est
reparti sans.

**Un seul lutteur**, pas une écurie. C'est lui qu'on entraîne, c'est son deck qui grossit, c'est sa fiche, et c'est
avec lui que comptent les déblocages du vestiaire. On ne recrute plus personne : il n'y a pas de roster où faire
entrer quelqu'un.

### Les matchs par équipes : possibles, jamais obligatoires

Neuf des quatorze matchs écrits demandent deux ou trois lutteurs. Ils n'ont pas disparu — ils sont devenus un
**type de nœud** sur la carte (🤝), avec un **partenaire d'un soir** choisi parmi les lutteurs qu'on a débloqués.
Chaque nom gagné au vestiaire sert donc deux fois : on peut faire sa carrière, et on peut l'appeler en renfort. Le
partenaire vient pour la soirée : il ne rejoint pas la carrière, ne s'entraîne pas, ne gagne pas de carte.

Et **aucun chemin ne peut l'imposer**. L'invariant « au moins un match jouable seul » ne suffisait pas par ligne :
le joueur ne voit que les nœuds vers lesquels son nœud pointe, et **7,1 %** des ensembles accessibles ne
proposaient que du tag. Chaque nœud mène maintenant à au moins une porte qu'on passe seul — vérifié en explorant
*tous* les chemins de 150 cartes.

On ne transforme jamais un match d'équipe en un contre deux : mesuré, l'infériorité numérique donne **0 victoire
sur 40** dans ce moteur.

### Six soirs en solo, et cinq stipulations enfin jouées

Il ne restait que **cinq** matchs jouables seul dans les shows écrits — cinq matchs pour sept semaines, c'était la
même soirée trois fois. Six matchs solo ont été ajoutés, et tant qu'à les écrire, ils font servir les cinq
stipulations que la campagne n'utilisait **jamais** alors qu'elles étaient écrites, mesurées et jouables :
**street fight**, **soumission uniquement**, **Last Man Standing**, **TLC** et **Hell in a Cell**. Une carrière
traverse maintenant les 13 stipulations du jeu, contre 8 avant.

### Ce que le solo a cassé dans l'économie

Tout l'argent va sur un seul homme. À barème inchangé, il finissait avec **+15** de bonus de stats au lieu des
**+5** que chacun avait quand on en entraînait trois — trois fois plus fort, et la ceinture tombait **55 fois sur
100** au lieu de 30.

On ne baisse pas les revenus (ils servent aussi aux cartes et à l'affichage) : chaque progression coûte
**100 $ de plus que la précédente** au lieu de 25. Mesuré après correction : **+8** de bonus, **0,8** stat au
maximum sur 5, et **35 %** de ceintures. Tout maximiser est hors de portée d'une carrière — il faut choisir ce que
son lutteur devient.

Avant, elle se terminait sur un total de fans (« 2 000 à l'arrivée, sinon la fin *ok* »). Un nombre en guise
d'histoire : on pouvait jouer huit épisodes sans jamais savoir vers quoi on allait. Le public est maintenant le
**moyen** — il achète les entraînements et les recrues — et plus le but.

### La route — une carte à embranchements

Le modèle est celui de *Slay the Spire*, parce que la correspondance avec le catch tombe juste. La carrière n'est
plus une ligne droite de huit épisodes identiques à chaque partie : c'est une **carte tirée à la graine de la
partie**, dont on choisit le chemin.

| Slay the Spire | La route vers la ceinture |
| --- | --- |
| combat normal | 🤼 **Match** — une victoire, une place au classement |
| élite | ⭐ **Main event** — un adversaire classé : **deux places**, et il cogne |
| feu de camp | 🛋️ **Semaine off** — une séance offerte, un deck resserré, ou un house show |
| événement `?` | ❓ **En coulisses** — un angle, deux portes, jamais gratuit |
| boutique | 💼 **Bureau du booker** — un mouvement, une séance, de l'affichage, un contrat |
| boss d'acte | 🏆 **Le Championnat du Monde** |

**Ce qu'on n'a pas jeté : les quatorze matchs écrits à la main**, avec leurs scripts, leurs adversaires et leurs
textes. Une carte qui tirerait des adversaires au hasard dans des stipulations au hasard produirait des matchs
incohérents — « un chien enragé, quatre armes, deux tables » contre un voltigeur. On tire donc des **matchs
entiers**, et ce qui change d'une carrière à l'autre, c'est lesquels, dans quel ordre, et ce qu'on choisit de faire
entre eux. Dans chaque épisode écrit, le second match était déjà le plus dur des deux : il alimente les nœuds
*main event*, le premier les nœuds *match*. On n'invente pas une difficulté, on lit celle qui était écrite.

Trois invariants, tenus par des tests sur 120 cartes :

- **Chaque semaine propose au moins un match.** Sans ça, une carte peut offrir une semaine où l'on ne peut pas se
  battre, et le classement devient hors de portée.
- **Aucun nœud n'est orphelin ni en cul-de-sac.** Tout chemin mène à la ceinture.
- **La difficulté suit la semaine** à ±1 les trois premières semaines, ±2 ensuite — jamais plus. Sur 200 graines,
  200 cartes différentes.

### Ce que la mesure a corrigé

La première version de la carte était **décorative** : les trois façons de la jouer donnaient le même résultat
(30 % / 33 % / 25 % de ceintures), et le rang médian au PPV était le même dans les trois cas. Deux raisons, toutes
les deux mesurées :

- **Le main event n'était pas plus dur** — 65 % de victoires sur les nœuds *élite* contre 67 % sur les nœuds
  *match*. Deux places au classement offertes sans risque : ce n'était pas une décision, c'était la bonne réponse.
  Son adversaire arrive maintenant comme le champion arrive à son match de titre (+10 PV, +1 partout), ce qui met
  le nœud à **44 %** de victoires.
- **Une semaine sur trois seulement offrait un choix** : un nœud ne menait souvent qu'à un seul autre. Un nœud mène
  maintenant à deux quand la ligne suivante le permet — **75 %** des semaines offrent un vrai choix, dont **52 %**
  avec une option sans match.

Et un troisième défaut, arithmétique celui-là : à coût symétrique, l'espérance du main event (−0,2 place) était
*pire* que celle d'un match de carte (−0,3). Le nœud « risqué et payant » était donc toujours le mauvais choix. Une
victoire en main event vaut **deux places, une défaite n'en coûte qu'une** : perdre un main event serré contre un
lutteur classé ne doit pas enterrer une carrière, c'est le gagner qui doit la faire.

Après correction, la façon de jouer la carte décide enfin — sur 40 carrières par profil :

| Manière de jouer | Ceinture | Rang médian au PPV |
| --- | --- | --- |
| tout combattre, main events compris | **33 %** | 4ᵉ |
| équilibré (une semaine off sur trois) | **30 %** | 4ᵉ |
| éviter les matchs dès que possible | **18 %** | 6ᵉ — jamais premier prétendant |

L'arbitrage est celui du genre : une semaine off ne fait pas monter au classement, et ça se paie le soir du titre.

### Le classement

Vous commencez **sixième prétendant**. Chaque victoire vous fait monter d'une place, chaque défaite en fait perdre
une, et votre place le soir du PPV fixe les **conditions** du match de titre. Elle ne décide jamais si vous l'avez :
vous l'avez toujours.

| Classement | Le soir du titre | À roster égal |
| --- | --- | --- |
| **1ᵉʳ prétendant** (6-7 victoires) | ⚖️ Un contre un. Le champion vous doit un match propre. | ceinture **55 %** |
| **2ᵉ à 5ᵉ** (4-5 victoires) | 🪙 Un contre un, mais il a choisi la date, la salle et l'arbitre : +25 PV, +1 partout. | **37 %** |
| **6ᵉ et en dessous** (≤3 victoires) | 🐺 Il prend le match pour l'insulte et **amène son homme de main** — amenez le vôtre. | **15 %** |

Ces trois taux sont mesurés **à roster égal** : soixante finales par palier, avec le même roster de fin de carrière.
C'est ce que valent les conditions elles-mêmes.

Sur **cent carrières complètes** jouées de bout en bout (avec entraînement entre les épisodes, comme un vrai
joueur), **28 % finissent avec la ceinture**, et le classement du soir se répartit **17 / 59 / 24** entre les trois
paliers : celui du milieu est le cas courant, les deux autres se méritent ou se paient. L'écart entre paliers y est
plus serré (35 / 29 / 21) qu'à roster égal — sur des échantillons de cette taille, seul le palier de la ceinture
gagnée un tiers du temps est solide.

Trois choses trouvées en mesurant, et gardées dans `src/game/rank.js` pour ne pas les refaire :

- **Le un contre deux est un mur, pas une punition** : 0 victoire sur 40, dans toutes ses variantes, même contre un
  champion sans bonus. L'infériorité numérique ne se négocie pas dans ce moteur. Le champion amène donc son homme,
  et vous avez le droit d'amener le vôtre.
- **Partir huitième envoyait 37 carrières sur 40 dans le pire palier.** Un palier que presque tout le monde touche
  n'est pas un palier.
- **Au-delà de +25 PV / +1 stat, le bonus du champion ne fait plus rien** (+35/+2 donne le même 38 %). Il ne devient
  pas plus dur, juste plus lent à tomber.

En **mode Scénarios** on ne monte pas au classement en gagnant le combat mais en **livrant le finish demandé** :
plusieurs scripts exigent que votre lutteur perde, et faire monter le classement sur la victoire revenait à
demander au joueur de saboter son propre show pour avoir son match de titre.

La carrière compte 8 semaines (salle de bingo → PPV) sur une carte à embranchements générée, avec renforts,
tables, échelle, cage et un champion du monde au bout.

## Structure d'un lutteur

```
Lutteur = classe + spécialité + gimmick (passif) + signature + finisher
Mouvements = base (9) + classe (5) + spécialité (4) + signature + finisher ≈ 19 par lutteur
```

Le catalogue compte **123 mouvements**. Un long match épuise un kit de trois coups : la variété est ce qui évite de
matraquer le même bouton quinze tours de suite.

### Les mouvements de course

Une partie du vocabulaire **n'existe pas à l'arrêt** : `requires: { ran: n }` est un interrupteur, pas un bonus.
Coude en course, épaule, genou sauté, lariat lancé, se coucher au passage — et `crossedRope` pour ce qui exige
d'avoir **traversé les cordes** en chemin. Tout le monde en a dans son kit de base, jobber compris : c'est une
raison de bouger placée dans chaque main.

| depuis | mouvements |
| --- | --- |
| **en courant** | coude en course, épaule, genou sauté, lariat lancé, renversement d'Irish Whip |
| **après les cordes** | clothesline de rebond, dropkick springboard |
| **sur les cordes** | senton slingshot, marche sur la corde, tope con hilo, moonsault Asai |
| **depuis le coin** | coup de tête plongeant, double stomp, avalanche |
| **sur une cible aux cordes** | superplex — on l'arrache jusqu'au tapis |

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

## Le plateau et les gabarits

L'aréna fait **20×14 cases**, le ring 10×6 (cordes comprises). Chaque lutteur occupe un **rectangle** de cases,
ancré en haut à gauche : `size` s'écrit `2` (carré 2×2), `[3, 2]` ou `{ w: 3, h: 2 }`. Par défaut, un colosse
(`weight: 'super'`, comme Andrei le Géant) tient sur 2×2 et tout le monde sur une case.

- Le gabarit complet doit tenir pour se déplacer : terrain praticable, pas d'adversaire, et le coût payé est celui
  de la case la plus chère (un colosse à cheval sur les cordes paie le prix des cordes).
- Les distances sont calculées entre gabarits : « à portée 1 » veut dire que les deux rectangles se touchent.
- Un colosse ne rentre pas partout : points d'apparition et projections vérifient qu'il tient.

## Règles de match

- **Déplacement puis action**, une fois par lutteur et par tour (comme Fire Emblem). Les ennemis bloquent le passage.
- **Les cordes sont un tremplin, pas un mur.** On ne les escalade pas, on rebondit dessus : y entrer coûte 1, en
  **repartir est gratuit**. Passer par les cordes fait donc aller plus loin qu'aller tout droit — c'est la course du
  catch télévisé, et ça nourrit l'élan comme le combo 💨 *Course dans les cordes*. Le rebond ne vaut pas de corde à
  corde (sinon les cordes deviennent une autoroute) et ne paie jamais le dénivelé : on rebondit vers l'avant, pas
  par-dessus. Le **coin**, lui, coûte 2 : on y *monte*, et on y gagne de la hauteur pour les plongeons.
- Entrer dans le ring coûte 3 (cordes + dénivelé), en sortir 2. L'asymétrie est voulue : on bascule dehors d'un pas,
  c'est **revenir** qui coûte — et c'est là qu'est le compte de l'arbitre.
- **L'élan : le déplacement et le coup ne sont pas deux phases séparées.** Le coup porté vaut ce que vaut la course
  qui le précède. Un lutteur planté qui frappe son voisin n'a aucun poids.

  | Distance parcourue avant de frapper | Dégâts |
  | --- | --- |
  | aucune | −15 % |
  | 1 case | −5 % |
  | 2 cases | +5 % |
  | 3 cases | +15 % |
  | 4 cases ou plus | +25 % |

  Ça vaut pour les frappes, les aériens, les prises et les armes — pas pour les soumissions ni les provocations, et
  pas pour un lutteur étourdi, qui serait puni deux fois. Se replacer rapporte aussi jusqu'à 5 de momentum, et
  **le chemin compte autant que la destination** : c'est le trajet réel qui est mesuré, contournement compris.
  Sur des matchs simulés, la part des tours comportant un déplacement passe de **17 % à 63 %**.

- **Le statisme s'aggrave.** Un tour sur place est un choix tactique ; trois d'affilée, c'est un match qui s'enlise.
  Chaque tour passé immobile creuse le plancher des dégâts (−7 % de plus, jusqu'à trois tours) **et refroidit la
  salle** — dans le catch, le prix d'un match statique, c'est le public. Une seule case parcourue remet le compteur
  à zéro : l'ankylose ne se traîne pas, elle se secoue.

- **Ce que le coup fait à la grille**, pas seulement aux points de vie. Trois effets rendent le placement *défensif*
  autant qu'offensif :

  | effet | ce qu'il fait | exemples |
  | --- | --- | --- |
  | ➡️ **Ligne** | le coup continue tout droit derrière la cible | Clothesline, Spear, Buckshot Lariat |
  | 💥 **Zone** | les voisins de la cible prennent une fraction des dégâts | Running Senton, Frog Splash, Suicide Dive |
  | ↗️ **Recul** | la cible est projetée — vers les cordes, un coin, une table | Chokeslam, Poing K.-O., Big Boot |
  | ↙️ **Attirer** | l'inverse : arrache la cible de sa position | Arm drag, snapmare, superplex |

  La zone ne fait pas le tri : **un partenaire collé à la cible déguste aussi**. La prévision de combat le dit avant
  que vous confirmiez.
- **Deux jauges opposées.** Le **momentum** monte et ouvre des portes ; le **souffle** descend et les referme.
  Sans la seconde, la seule question d'un tour était « quel coup fait le plus mal », et la réponse ne changeait
  jamais.

  | | momentum ⚡ | souffle 😮‍💨 |
  | --- | --- | --- |
  | sens | monte quand on frappe | descend quand on frappe |
  | rôle | **ouvre** les paliers | les **referme** sous 25 |
  | coût d'un coup | palier signature/finisher seulement | 4 (base) à 22 (finisher), +3 en courant |
  | se refait | en frappant, en provoquant | +5 par tour, **+14 si on a soufflé** (attendre, provoquer) |

  À bout de souffle : −25 % de dégâts, −10 de précision, et **plus de signature ni de finisher**. C'est la prise de
  repos du catch : on ne peut pas enchaîner les gros coups, il faut reprendre son air — et l'adversaire le voit.

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

- **🔄 Le renversement.** *« Il l'a renversé ! »* — le moment le plus fiable du catch. Un gros mouvement lancé sur un
  adversaire encore frais peut se retourner contre son auteur : l'attaque échoue et **c'est l'attaquant qui encaisse**.

  | palier | risque de base |
  | --- | --- |
  | base | 2 % |
  | classe | 5 % |
  | spécialité | 7 % |
  | signature | 11 % |
  | finisher | **15 %** |

  Trois choses le rendent probable, et ce sont trois décisions : la **vitesse et la technique** du défenseur contre
  celles de l'attaquant ; le **souffle** (frapper sans appui, +5 % ; défendre à bout de forces, −4 %) ; et la
  **taille du mouvement** — un gros coup est lent, c'est justement le finisher qui se renverse. Une cible **au sol ou
  étourdie** ne renverse rien, sinon la chute ne voudrait plus rien dire.

  Le risque est affiché dans la prévision de combat : lancer son finisher trop tôt est un pari, pas une formalité.

- **Étourdissement** : un coup qui étourdit dure jusqu'à votre tour suivant, ce qui permet des enchaînements
  (doigt dans l'œil puis Elbow Drop, coup de pied retourné puis finisher, étourdir puis jeter par-dessus la corde).

## Stipulations

Les règles transversales d'un type de match : `dq` (disqualification), `countOut` (compte à l'extérieur),
`tables` (la table des commentateurs peut être brisée), `weapons` (armes déjà au sol), `underRing` (armes
disponibles **sous le ring**), `tenCount` (compte de dix sur un lutteur au sol).

- **La table des commentateurs ne se brise que si la stipulation l'autorise** (TLC, hardcore, street fight, Hell in
  a Cell). Ailleurs on s'écrase dessus — ça fait mal et ça fait du bruit — mais elle tient.
- **Les armes se cherchent sous le ring** : sortir, se placer contre le tablier, et fouiller. C'est légal ; s'en
  servir devant l'arbitre ne l'est pas (risque de DQ dans les matchs avec règles).
- Stipulations disponibles : match simple, par équipes, hardcore, **street fight (sans DQ)**, **Last Man Standing**
  (compte de dix), **soumission uniquement**, bataille royale, échelle, **TLC**, cage, **Hell in a Cell**,
  confrontation, survie.

## La chaleur de la foule

**La foule refroidit si on ne lui donne rien.** Chaque tour complet, la salle perd 18 % de sa chaleur (au moins 2
points) : une jauge pleine ne le reste pas toute seule. Ce qui compte n'est donc plus la chaleur *finale* — elle finit
toujours haut, le dernier tour d'un match est toujours un gros coup — mais la **moyenne tenue sur tout le match**,
affichée à côté de la jauge (`moy. 65`).

Elle ne descend jamais sous **10**, la valeur du coup d'envoi : la salle est venue, elle reste là. Ce plancher a été
trouvé en jouant, pas en simulant — dans le premier match de la saison, contre un jobber, un joueur qui se contentait
de passer son tour voyait la jauge tomber à zéro et y rester **81 %** du match. Une décrue à quatre points minimum
dépassait tout ce qu'un petit match rapporte : la règle punissait le match à faible enjeu, pas le joueur mou.

C'est cette moyenne que lisent la note du match, la recette du show, la note en étoiles des scénarios et la directive
« Foule en délire ». Mesurée sur 40 matchs : la moyenne s'étale de **35 à 76** (médiane 62), et la jauge ne passe plus
que **3 %** du match collée à 100 — contre **68 %** avant.

| | avant | après |
| --- | --- | --- |
| jauge saturée à 100 | 68 % du match | 3 % |
| chaleur retenue | 99–100 pour tout le monde | moyenne 40 → 76 (médiane 65) |
| directive « Foule en délire » | réalisée 100 % | réalisée 32 % |
| temps passé en main event | 91 % | 54 % |

## Les trois actes d'un match

La phase se déduit de l'état du match, pas d'un minuteur, et elle est affichée en haut de l'écran avec ce qu'elle
récompense. **Elle se lit sur les corps** : les points de vie, les cœurs dépensés, et le chrono en dernier recours. Un
match où les deux hommes sont frais est une ouverture, même au dixième tour ; un match où les cœurs sont partis est un
main event, même tôt. Un finisher pousse l'histoire d'un cran — il ne la verrouille plus sur l'acte III.

Sur 40 matchs, le temps de jeu se partage maintenant **23 % / 23 % / 54 %** entre les trois actes (ouverture jusqu'au
dixième tour environ, corps du match jusqu'au vingt-troisième, main event ensuite). Avant, 91 % du match se jouait en
main event : les trois actes existaient dans le code et nulle part ailleurs.

| Acte | Rôle | Effets |
| --- | --- | --- |
| 🔔 **Ouverture** | Build-up | Dégâts -15 %, momentum +35 %, chaleur -30 %, gros mouvements -15 % (personne n'y croit encore), tombés plus durs |
| 🔥 **Corps du match** | Prendre l'avantage | Valeurs normales, soumissions +8 % d'abandon : c'est le moment d'user, de marquer et de contrôler le terrain |
| 🏆 **Main event** | Tout donner | Dégâts +15 %, mouvements spectaculaires +15 %, chaleur +40 %, tombés +12 % |

## Le son — synthétisé, pas téléchargé

Le jeu n'avait **pas un seul son**. Pour du catch — la cloche, le claquement d'un corps sur le tapis, la salle —
c'est le manque qui s'entend le plus.

Tout est fabriqué au vol en **Web Audio** (`src/ui/sound.js`) : pas un octet de plus à télécharger, rien de neuf
dans le service worker, et ça marche hors ligne comme le reste. Un vrai fichier de foule ferait mieux — il pèserait
aussi plus lourd que tout le jeu réuni.

Les sons se branchent sur les **événements du moteur**, pas sur les clics : un coup sonne parce que le moteur a dit
« dégâts », donc les coups de l'IA sonnent aussi, et rien ne sonne quand une action est annulée.

**La foule est une jauge qu'on entend.** Une nappe de bruit rose dont le volume suit la chaleur de la salle, avec un
pic à chaque near-fall, chaque chute et chaque finisher. Depuis que la chaleur retombe pour de bon, on sent la salle
se refroidir sans quitter le plateau des yeux.

Le son se coupe depuis le menu ou depuis la barre du match, et le choix est retenu. Règle tenue dans tout le
fichier : **aucune fonction audio ne peut faire planter un match** — pas de Web Audio, contexte refusé, onglet en
arrière-plan, tout est avalé.

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
| 📣 La foule est debout | Attaquer avec 70+ de chaleur |
| 🪑 Décor complice | Frapper une cible acculée à un obstacle |
| 🔗 Enchaînement | Alterner les familles de coups sur la même cible |
| 💨 Course dans les cordes | **Traverser** les cordes en chemin (pas s'y arrêter) avant de frapper |
| 🌀 Pris à revers | **Arriver** exactement dans le dos — être déjà là ne compte pas |
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
- **Au sol** : à 0 PV un lutteur tombe et perd un tour. C'est là qu'on le **couvre**. Il se relève avec **55 % de ses
  PV** — le second souffle — et un **cœur ❤️ en moins**. Chaque kick-out en use aussi.

- **Le cœur est le PLAFOND du tombé**, pas un modificateur parmi d'autres. C'est la règle du catch : *« il s'est
  dégagé du finisher ! »*. Tant qu'il reste du cœur, aucun bonus — momentum, main event, finisher — ne fait passer
  une couverture.

  | cœur restant | plafond du tombé |
  | --- | --- |
  | plein | 15 % |
  | ¾ | 35 % |
  | ½ | 55 % |
  | ¼ | 75 % |
  | vide | 95 % |

  La courbe s'ouvre **à la fin** : les deux premières couvertures sont des faux départs, la dernière est un silence
  dans la salle. Couvrir un adversaire **debout** n'est pas un tombé mais un roll-up désespéré : plafonné à 15 %
  quoi qu'il arrive.

  **Un kick-out raté coûte quand même un cœur à celui qui se dégage.** Couvrir tôt n'est donc pas un tour perdu :
  c'est un investissement — et c'est la stratégie centrale d'un long match.

## Le rythme d'un match

Un match doit durer, mais avec des tours **rapides** : beaucoup de petites décisions, pas quinze tours de gros coups.
Un match long où il ne se passe rien est pire qu'un match de six tours.

| | au départ | aujourd'hui |
| --- | --- | --- |
| tours | 5,6 | **33,7** |
| coups qui touchent | 5,9 | **29,5** |
| chutes au sol | 1,0 | **3,3** |
| kick-outs | 1,2 | **1,8** |
| part d'un coup dans la barre de PV | 27 % | **10 %** |
| renversements | — | 2,2/match |
| mouvements distincts (135 matchs) | 72 | **93** |
| le coup le plus servi d'un match | 29 % de ses coups | **24 %** |

Sans limite de temps, la médiane est de **39 tours** et le 90ᵉ centile de 59 ; la limite est posée à 60, où elle ne
coupe plus qu'un match sur onze — et un « Broadway » de temps en temps, c'est du vrai catch.

## La main — on ne choisit pas, on pioche

Le menu à la Final Fantasy Tactics avait un défaut de fond : avec dix-huit mouvements par lutteur, la liste
s'allonge mais la **décision**, elle, ne devient jamais plus intéressante. Le meilleur coup du tour est presque
toujours le même que celui du tour précédent, et on déroule une routine au lieu de lutter.

Chaque lutteur a désormais **4 cartes en main** sur la vingtaine qu'il connaît.

| ce qui se pioche | ce qui ne se pioche jamais |
| --- | --- |
| classe, spécialité, course, cordes, usure — tout le reste | **les fondamentaux** (coup de poing, prise, Irish Whip, provoquer) sont toujours là ; la **signature** et le **finisher** s'ouvrent au momentum, pas au tirage |

**Ce qu'on ne joue pas, on le garde.** C'est la règle qui compte : tenir son Lariat lancé pendant trois tours en
cherchant ses quatre cases de course, c'est du catch ; une main rebattue chaque tour, ce serait du hasard.

Les cartes, le déplacement et l'histoire sont **la même affaire**. Une carte qui réclame quatre cases de course EST la
raison de traverser le ring, et le coup qui en sort EST le moment qu'on racontera. Survoler une carte **allume sur le
plateau les cases qui la débloquent** : la carte devient un itinéraire.

Rien qui passe ? **Jeter la main et repiocher** coûte le tour mais rend du souffle, comme une provocation. Le talon se
reconstitue avec la défausse.

| | menu | main |
| --- | --- | --- |
| mouvements distincts (135 matchs) | 93 | **107** |
| le coup le plus servi d'un match | 24 % de ses coups | **21 %** |
| tours | 33,7 | **34,8** |
| coups qui touchent | 29,5 | **30,5** |

Deux pièges trouvés en mesurant : mettre les **fondamentaux dans le talon** rendait 41 % des tours entièrement morts et
l'IA passait 56 % de son temps à jeter sa main ; et **noter la défausse dans la boucle de décision** la faisait
ramasser les bonus de position et battre de vraies attaques — quarante tours pour vingt coups. La défausse vit
maintenant dans le repli, là où on ne va que si rien d'autre ne vaut le coup.

## Le deck qui se construit — **en carrière, pas en exhibition**

La main a réglé la question du *tour* : on joue ce qu'on a. Mais d'un épisode à l'autre, le répertoire d'un lutteur ne
bougeait pas d'un pouce — le même à l'épisode 1 et au PPV. Il n'y avait rien à construire entre deux matchs, donc rien
à regretter dans un choix.

**Chaque match de carrière apprend un mouvement.** L'écran de résultat propose trois cartes (deux si on a perdu — une
raclée enseigne aussi, mais moins bien), et on peut toujours passer. La carte s'ajoute au deck de ce lutteur-là, et
elle est sauvegardée avec la saison.

**Le deck plafonne à 22 cartes.** Un lutteur commence la saison avec 13 à 19 cartes piochables (médiane 17) et la
saison compte huit épisodes : le plafond tombe donc vers le cinquième. Les premières cartes sont un cadeau, les
dernières sont un arbitrage — apprendre veut alors dire **oublier autre chose**, et c'est le joueur qui choisit quoi.
La signature et le finisher ne s'oublient jamais : ce sont les marques du personnage.

Ce que coûte réellement une carte de plus, mesuré sur 400 matchs simulés — le nombre de tours avant de **repiocher une
carte précise**, avec une main de quatre :

| taille du deck | 12 | 14 | 18 | 22 | 26 |
| --- | --- | --- | --- | --- | --- |
| tours d'attente | 7,7 | 9,4 | 13,0 | 15,7 | 17,6 |

C'est ça, l'arbitrage — et ce n'est **pas** « un gros deck joue moins varié » : mesuré sur soixante matchs, un deck de
22 sort même *plus* de coups différents qu'un deck de 18 (10,0 contre 8,8). Ce qu'on perd, c'est de pouvoir compter
sur une carte au moment précis où on en a besoin. Le deck se consulte et se taille entre deux épisodes, dans l'onglet
*Roster* du hub.

**Rien de tout ça en exhibition.** Un match d'exhibition ne lit pas la sauvegarde : il n'appelle jamais
`playerBonuses`, donc les lutteurs y partent toujours avec leur répertoire de fiche, exactement tel qu'il est écrit.
C'est voulu — une exhibition doit rester lisible et comparable, pas dépendre d'une partie en cours. Un test le
verrouille (`tests/deck.test.js`).

## L'usure ciblée — la stratégie longue

Un match de trente tours qui n'**accumule** rien n'a pas d'arc : le trentième tour ressemble au troisième, en plus
court. Chaque coup marque une partie du corps, avec deux seuils — **touchée** à 45, **hors service** à 85. L'usure ne
redescend jamais de tout le match.

| membre | touchée | hors service |
| --- | --- | --- |
| 🦵 Jambe | −2 AGI | −4 AGI, −1 MOV, **plus un seul mouvement aérien ni escalade**, et il ne se relève plus qu'à 38 % |
| 💪 Bras | −2 FOR | −4 FOR, les prises accrochent mal, **plus de renversement** |
| 🫁 Côtes | −1 DEF, souffle ×0,6 | −3 DEF, souffle ×0,3 : il ne reprend plus son air |
| 🤕 Tête | −1 TEC, −1 DEF | −3 TEC, −2 DEF, et il se fait compter plus facilement |

**Le paiement, c'est la soumission.** La chance d'abandon dépend d'abord de l'usure du membre *visé par la prise*,
ensuite des PV — et le cœur ❤️ la plafonne, comme pour le tombé. Une clé de jambe sur une jambe fraîche ne fait rien ;
la même après dix tours de travail finit le match. Les abandons passent de **4 % à 11 %** des fins.

Un coup qui **vise** le membre l'use quatre fois plus qu'un coup qui l'atteint au passage : sans cet écart, l'offensive
ordinaire mettait un membre hors service dans 90 % des matchs, et « hors service » ne racontait plus rien. Huit
mouvements existent pour ça, dont deux (*Coup dans le genou*, *Clé de poignet*) dans le **kit de base** — travailler un
membre doit être une stratégie, pas une classe.

Trois freins empêchent l'optimum de devenir une boucle : **la foule a déjà vu ce coup** (répéter un mouvement rapporte
de moins en moins de momentum et de chaleur), **il connaît la prise** (une soumission déjà tentée marche de moins en
moins bien sur la même cible), et **serrer une prise coûte du souffle**. Sans eux, 30 % de tous les coups du jeu
étaient le même chinlock.

## Les managers — quelqu'un au bord du ring

Un manager n'est pas un lutteur de plus : c'est une **menace permanente qui ne se joue que deux fois**, et son
intervention **coûte le tour** du lutteur. Personne n'intervient avant le tour 4.

| manager | ce qu'il fait |
| --- | --- |
| 🎩 Paul Lourdeur | prend le micro : +40 momentum, +25 souffle |
| 📣 Jimmy Lacravate | mégaphone dans le dos d'un adversaire acculé aux cordes : 14 dégâts, étourdi — **illégal** |
| 🧠 Bobby le Cerveau | occupe l'arbitre trois tours : tout devient légal |
| 💅 Sherri la Sensationnelle | tient la cheville : arrache d'une case, étourdit, +22 d'usure à la jambe — **illégal** |
| 🩺 Docteur Von Kayfabe | les sels : +18 % PV, souffle à bloc, étourdissement effacé |

Les interventions illégales usent **la même tolérance d'arbitre** que vos propres coups bas : rien n'interdit
d'envoyer Bobby occuper l'arbitre d'abord.

## Les rivalités — ils se souviennent

En exhibition un contre un, le résultat est **gardé dans le navigateur**. La prochaine fois que ces deux-là se
croisent, le match ne commence pas pareil : jusqu'à **+28 de chaleur** au coup d'envoi (la salle connaît l'histoire),
et **+20 momentum plus une rancune** pour celui qui a perdu la dernière fois. L'écran de préparation affiche le score,
la série en cours et la manchette du dernier match.

## L'histoire du match

À la fin, le jeu **écrit ce qui s'est passé** — le contexte, le membre sur lequel tout s'est joué, le moment où ça a
failli basculer, la fin — plus une note sur cinq étoiles. Rien n'est inventé : tout est tiré des temps forts réellement
enregistrés pendant le match.

> ★★★★☆ « **Bryan Danielsonne démonte la tête de Günter et le fait taper** »
>
> 🦴 **Le travail** — Bryan Danielsonne a trouvé la tête de Günter et n'a plus lâché : 🤕 hors service au tour 7.
> Les épaules au tapis pesaient soudain beaucoup plus lourd.
>
> 🔥 **Le tournant** — 🎩 Paul Lourdeur s'en est mêlé au tour 4. Bryan Danielsonne a placé LeBell Lock au tour 6.

La note est sévère par construction : sur 135 matchs simulés, la moyenne est de **3,1/5** et seul **1 %** décroche cinq
étoiles. Aller au bout du chrono, se faire disqualifier ou gagner par décompte coûtent des étoiles.
- **Soumissions** : peuvent faire abandonner une cible affaiblie. *Rope break* près des cordes (matchs avec arbitre).
- **Terrain** : coin = plongeons +25 %, cordes = étourdi, coin/marches/table/cage = dégâts sur Irish Whip, table qui casse.
- **Armes** (chaise, kendo, poubelle, batte) : illégales avec arbitre → il faut compter avec sa tolérance.

- **L'arbitre a une tolérance, et elle change d'un soir à l'autre.** En catch, ce n'est presque jamais une DQ du
  premier coup : il voit, il avertit, il compte — et il finit par en avoir assez.

  | arbitre | il remarque | il pardonne |
  | --- | --- | --- |
  | 🦓 pointilleux | ×1,5 | 2 avertissements |
  | 🦓 à l'ancienne | ×1,0 | 3 avertissements |
  | 🦓 complaisant | ×0,6 | 5 avertissements |

  Son état est affiché en haut de l'écran et dans la prévision de combat : on ne triche pas sans savoir combien il en
  reste. Un arbitre **distrait** ne voit rien du tout, et n'use donc pas sa patience.

  Les **heels** poussent leur chance là où les faces se rangent. Sur des matchs simulés, l'arbitre pointilleux produit
  six des sept disqualifications et le complaisant aucune : la tolérance décide vraiment.
- **Tag** : un seul lutteur légal par équipe ; tag avec un partenaire adjacent (soigne, +30 momentum, « HOT TAG »).
  Attaquer sans être légal = risque de DQ.
- **Compte à l'extérieur** : 6 tours sur le plancher = éliminé (matchs avec arbitre).

| Type | Condition de victoire |
| --- | --- |
| 🥇 Match simple / 🤝 Par équipes | premier tombé, soumission, count-out ou DQ décide |
| 🪑 Hardcore | idem, sans DQ ni compte, armes et tables partout, tombé n'importe où |
| 👑 Bataille royale | jeter les adversaires par-dessus la corde — **il faut les user d'abord** |
| 🪜 Échelle | grimper au centre **3 tours de suite** sans subir de dégâts |
| 🔒 Cage | tombé, soumission ou évasion (3 tours depuis un coin) |
| 😈 Hell in a Cell | **pas d'évasion** : tombé ou soumission, et les murs font mal |
| 🔟 Last Man Standing | au sol et incapable de répondre au compte — il se relève tant qu'il a du cœur ❤️ |
| 🔗 Soumission uniquement | le faire abandonner, et rien d'autre |
| ⏱️ Survie | tenir N tours face aux renforts |
| ⚔️ Confrontation | éliminer tous les adversaires |

### Les douze stipulations, mesurées

Personne ne les avait jamais mesurées. Aucune ne **plantait** — elles produisaient de mauvais matchs, ce qui est pire
parce que ça ne se voit pas. Cinq étaient cassées :

| stipulation | avant | après | ce qui n'allait pas |
| --- | --- | --- | --- |
| 🪜 Échelle / TLC | 7,3 tours · ★1,5 | **23 tours · ★2,3** | deux échelons : le premier arrivé gagnait sans être inquiété |
| 👑 Bataille royale | 11,4 tours · 6,6 coups · ★1,6 | **19,6 tours · 41,6 coups · ★2,9** | on sortait à 80 % de ses PV, et un « 1 contre 2 » n'est pas une bataille royale |
| 🤝 Par équipes | **73 % de DQ** | **20 % au chrono · ★3,5** | le partenaire illégal entrait dans le ring ; puis le soin du relais a fait un tapis roulant |
| 🔗 Soumission uniquement | **85 % au chrono** (57 tours) | **67 % par abandon · ★3,1** | sans tombé, rien ne faisait descendre le cœur : la seule route restait fermée |
| 🔟 Last Man Standing | 15,9 tours · ★2,2 | **47,4 tours · 97 % au compte · ★3,5** | deux tours au sol et c'était fini, alors que « se relever » EST la stipulation |
| 😈 Hell in a Cell | 60 % par évasion | **80 % par tombé · ★3,1** | il annonçait « pas d'évasion » et se terminait par une évasion six fois sur dix |

Trois principes en sont sortis, et ils valent pour toute nouvelle stipulation :

- **Le cœur ❤️ est l'horloge là où il n'y a pas de tombé.** Sans kick-outs il ne descend plus que d'un cran par relevé ;
  on en donne donc moitié moins à user.
- **L'arbitre arrête le match sauf si la stipulation a sa PROPRE façon d'éliminer** (par-dessus la corde, la ceinture).
  Le garde-fou était accroché à « pas de tombé », ce qui n'est pas la même question.
- **On use d'abord, on élimine ensuite.** Un homme frais s'accroche aux cordes, répond au compte et passe son relais.

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

- **Sprites** : grille **24×32**, en SVG à arêtes franches (`shape-rendering="crispEdges"`). Personne n'est dessiné
  entièrement à la main — un lutteur est *composé* à partir de sa description `look` :

  | couche | ce que ça change | exemples |
  | --- | --- | --- |
  | `build` | la carrure : le corps de base | normal, `heavy`, `slim`, `bighead`, colosse, féminin |
  | palette | peau, cheveux, tenue, accent — cinq emplacements de couleur | `skin`, `hair`, `attire`, `accent` |
  | `stance` | la posture : les bras sont effacés puis redessinés | `cross`, `hips`, `fists`, `wide`, `pocket`, `flex`, `triomphe`, `micro`, `salut` |
  | `face` | l'expression, en trois lignes | `scowl`, `grin`, `smirk`, `shout`, `blank`, `brow` |
  | `features` | vêtements et accessoires posés par-dessus | `bandana`, `mask`, `jacket`, `bat`, `beer`… |
  | `idle` | l'animation de repos | `breathe`, `bounce`, `sway`, `still` (mouvement CSS) ; `cantsee` (4 images), `stroke` (3 images) |

  Les vêtements ne sont pas des dessins séparés : ils **repeignent la peau** sur une tranche de lignes, bornée par la
  table des colonnes du torse, donc un t-shirt tombe juste sur le maigre comme sur le colosse. La découpe des bras se
  déduit elle aussi de cette table : une posture n'a jamais à connaître la carrure. Deux cadrages sur le même dessin :
  `full` (corps entier, pions du plateau) et `bust` (portrait, cartes et listes).
- **Aucune image externe** : tout est généré à la volée, donc ajouter un lutteur ne demande aucun fichier d'art —
  seulement une ligne de `look`.
- **Repos animé** : tout le monde bouge en CSS (respiration, balancement, petits bonds). Les gestes qui *sont* le
  personnage ont en plus une **suite d'images dessinées** — la main de John Sena qui balaie devant son visage,
  Chris Jerico qui lisse sa barbe. Les images sont empilées et défilent en `steps()`, chacune visible pendant sa
  tranche du cycle ; pas de minuterie JavaScript, donc dix pions restent en phase.
- **Habillage** : voyant « ON AIR » sur le bandeau de régie, guirlande de loges sur l'écran titre, menu contextuel
  coiffé d'un clap de cinéma (qui sert de poignée à la feuille d'actions sur mobile), onomatopées à contour épais pour
  les dégâts, bannière de tour en balayage diagonal.
- `prefers-reduced-motion` coupe les animations d'ambiance.

## La campagne, jouée de bout en bout

Comme les stipulations, elle n'avait jamais été mesurée. Cent saisons simulées plus tard, trois choses en sont
sorties.

**Le mode Scénarios plantait.** « Vendre » et « faire le job » n'existent que pour l'équipe du joueur, donc l'IA
adverse ne les voit jamais et personne ne leur avait écrit de score : elles tombaient dans la branche par défaut, qui
lit une cible qu'elles n'ont pas. Toute partie automatique en mode Scénarios s'arrêtait là — ce qui explique que le
mode n'ait jamais pu être mesuré. C'est le **troisième** bogue de cette famille (après la défausse et le mode
Scénarios) : la branche par défaut du score de l'IA renvoie désormais « presque rien » plutôt que de planter.

**Une saison sur quatre restait bloquée.** Il fallait *gagner* pour passer à l'épisode suivant, et six épisodes
différents se rejouaient six fois sans succès. Un mode histoire qui exige de rejouer un épisode quatre fois n'est pas
une histoire — et ça ne ressemble à rien de connu : un lutteur qui perd le mardi lutte quand même le mardi suivant.

> **Le show continue toujours.** Ce qui se paie, c'est le **public** : une défaite coûte 14 % de la salle, un finish
> non respecté (un « shoot ») coupe le cachet de moitié. L'enjeu redevient l'objectif de fans du PPV — porté de 1 500 à
> **2 000**, parce qu'à 1 500 huit saisons sur dix l'atteignaient sans effort.

| | avant | après |
| --- | --- | --- |
| saisons qui se terminent | 44 % | **100 %** |
| matchs joués pour 8 épisodes | 16,8 | **8,0** |
| argent inutilisé à l'arrivée | 13 468 $ | **1 687 $** |
| objectif du PPV atteint | 100 % | **46 % (Kayfabe) · 36 % (Scénarios)** |

**Les directives du Network ne décrivaient plus le jeu.** Elles avaient été écrites quand un match durait six tours.

| directive | avant | après |
| --- | --- | --- |
| Vite fait, bien fait | ≤ 8 tours — **réalisée 0 %** | ≤ 22 tours — 57 % |
| Faites durer le plaisir | ≥ 10 tours — toujours vraie | ≥ 40 tours |
| Foule en délire | 70+ de chaleur **finale** — **réalisée 100 %** | 70+ de chaleur **moyenne** — 32 % |
| Sans une égratignure | aucun lutteur au sol — 11 % | aucun cœur ❤️ perdu — 50 % |
| Hot tag | faire un tag — **100 %** | deux relais passés sous 40 % de PV |

Plus deux nouvelles, qui parlent des systèmes récents : **Le membre qui lâche** (mettre un membre adverse hors service)
et **On joue ce qu'on a** (ne jamais jeter sa main).

Le principe, écrit dans `src/data/directives.js` : *une directive impossible et une directive gratuite se valent — ni
l'une ni l'autre n'est une décision.* La cible est 25–75 % de réussite.

> **Attention à la mesure.** Les premiers relevés étaient faussés : tant qu'une défaite obligeait à rejouer l'épisode,
> les matchs *difficiles* étaient rejoués en boucle et pesaient cinq fois plus lourd dans la moyenne. Le bon
> échantillon, c'est huit matchs par saison, une fois chacun.

## Hub de promotion (entre les shows)

- **Le show** : 2 matchs bookables, adversaires, directives/scripts, récompenses ; choix de l'équipe.
- **Votre lutteur** : +1 stat / +10 PV contre de l'argent (max 5 par stat, chaque progression plus chère que la
  précédente), et son deck, qu'on peut y tailler.
- **Historique** ; sauvegarde automatique dans `localStorage`.

## Code

```
index.html, styles.css        interface (DOM pur)
src/main.js                   navigation entre écrans
src/pwa.js                    service worker, bouton d'installation
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
             deck.js          le deck qui se construit en carrière (offre de cartes, plafond, oubli)
             rank.js          le classement et les trois termes du match de championnat
             route.js         la carte à embranchements (nœuds, arêtes, vivier de matchs)
             unlocks.js       le vestiaire : les 23 conditions de déblocage et la progression
             week.js          les semaines sans match : repos, coulisses, boutique
             script.js        évaluation des directives et des scripts (étoiles)
src/ui/      title.js hub.js match.js cards.js tutorial.js dom.js
             sound.js         cloche, coups, foule — tout synthétisé en Web Audio, aucun fichier
             spriteart.js     les planches 24x32 (GÉNÉRÉ — ne pas éditer à la main)
             spritepixel.js   palette, postures, vêtements peints sur le corps, rendu SVG
             avatar.js        enrobage DOM des sprites (vignettes, pions, repos animé)
manifest.webmanifest, sw.js   installation et mode hors ligne (PWA)
icons/                        icônes d'application, générées par le moteur de sprites
tests/                        node:test — grille, moteur, gimmicks, types de matchs, chaleur, decks, carrière, route, vestiaire, PWA
```

Le moteur est indépendant du DOM et déterministe (seed) : `autoPlay(battle)` fait jouer l'IA contre l'IA, pratique
pour l'équilibrage.

### Ajouter un lutteur

1. Ajouter son signature et son finisher dans `src/data/moves.js` (`tier: 'signature'` / `'finisher'`).
2. Ajouter son gimmick dans `src/data/gimmicks.js` (n'importe quel sous-ensemble de hooks).
3. Ajouter l'entrée dans `src/data/wrestlers.js`. Les mouvements de base/classe/spécialité sont automatiques.

## Idées pour la suite

- Une difficulté montante entre les runs (l'Ascension de *Slay the Spire*, la Chaleur de *Hades*).
- L'accessibilité : jouer un match entièrement au clavier, rôles et labels ARIA.
- Des cartes qui ne sont pas que des mouvements : une carte qui change une règle du match pour un tour.
- Le deck d'un lutteur comme partie de son personnage : une carte gagnée contre un adversaire précis.
- Blessures, moral, contrats en mode Scénarios ; gestion des heels/faces (turns).
- Des musiques d'entrée ; animations de coups (sprites d'attaque) ; éditeur de lutteurs.
