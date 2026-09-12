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

## Hub de promotion (entre les shows)

- **Le show** : 2 matchs bookables, adversaires, directives/scripts, récompenses ; choix de l'équipe.
- **Roster & entraînement** : +1 stat / +10 PV contre de l'argent (max 5 par stat).
- **Agents libres** : 3 recrues par épisode, salaire payé à la signature.
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
             script.js        évaluation des directives et des scripts (étoiles)
src/ui/      title.js hub.js match.js cards.js tutorial.js dom.js
             spriteart.js     les planches 24x32 (GÉNÉRÉ — ne pas éditer à la main)
             spritepixel.js   palette, postures, vêtements peints sur le corps, rendu SVG
             avatar.js        enrobage DOM des sprites (vignettes, pions, repos animé)
manifest.webmanifest, sw.js   installation et mode hors ligne (PWA)
icons/                        icônes d'application, générées par le moteur de sprites
tests/                        node:test — grille, moteur, gimmicks, types de matchs, campagne, PWA
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
