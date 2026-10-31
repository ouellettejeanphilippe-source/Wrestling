# CLAUDE.md — travailler dans ce dépôt

Jeu tactique de catch sur grille, en JavaScript pur (modules ES), sans dépendance ni build. **Tout est en
français** : code, commentaires, commits, tests, documentation. On garde ça.

## Commandes

```bash
npm start     # serveur statique sur :8080 (scripts/serve.js)
npm test      # node --test tests/*.test.js — 216 tests, ~45 s, à lancer avant tout commit
node .claude/skills/pixel-art/scripts/measure.mjs [id]   # mesure les palettes des sprites
```

Pas de linter ni de formateur configuré. Node ≥ 18 (la CI tourne en 22).

## Où est quoi

Lire la section **Code** du `README.md` pour la carte complète. En bref :

- `src/engine/` — le moteur de match, **sans DOM, déterministe à la seed**. `battle.js` est le gros fichier ;
  `hand.js` (la main, l'énergie, le coût des cartes), `wear.js` (l'usure), `ai.js` (l'adversaire), `rules.js`
  (les fins). Le tour est celui d'un deck-builder : main neuve de 5 à chaque tour, 3 points d'énergie, plusieurs
  cartes à la suite ; `acted` ne passe à vrai que quand l'énergie est à zéro ou qu'une action ferme le tour.
  L'adversaire **annonce** sa première carte au début du tour du joueur (`planIntents`, `unit.intent`) : sa main
  du tour suivant est tirée à la fin de sa phase (`handReady`), et `enemySteps` tient l'annonce ou fait partir le
  coup dans le vide (`whiff`). La direction du jeu : *Fights in Tight Spaces*, en grand espace et avec les props.
- `src/data/` — tout le contenu : lutteurs, mouvements, gimmicks, stipulations, combos, managers, campagne.
- `src/game/` — la carrière hors match : route, classement, deck, vestiaire, sauvegarde, histoire du match.
- `src/ui/` — les écrans. `match.js` est l'écran de match, construit autour de la main (un clic sur la carte, un
  clic sur la cible ; le plateau est cadré sur l'action) ; `spriteart.js` + `spritepixel.js` + `avatar.js` sont
  les sprites. Attention : `Element.append` écrit « [object …] » pour un tableau et « null » pour une branche vide ;
  dans `match.js`, passer par `put(parent, …)` ou par `h()`.
- `tests/` — la plupart mesurent le **jeu** (longueur des matchs, taux de ceinture sur cent carrières) et pas des
  fonctions. Un test qui casse après un réglage d'équilibrage dit souvent quelque chose de vrai.
- `docs/journal-de-conception.md` — l'historique des décisions, avec les mesures qui les ont justifiées. À lire
  avant de retoucher un système pour ne pas refaire un essai déjà mesuré et retiré.

## Règles du dépôt

1. **Mesurer avant et après tout réglage.** `autoPlay(battle)` et `createBattle({ match, playerTeam, seed })`
   permettent de simuler des dizaines de matchs en quelques secondes (voir `tests/rythme.test.js` pour la
   construction d'un match). Un changement d'équilibrage sans chiffres avant/après n'est pas un changement, c'est
   un pari. Les constantes de l'IA sont calibrées sur `DAMAGE_SCALE` : toucher à l'échelle des dégâts sans elles
   rend l'adversaire passif (c'est déjà arrivé, voir `src/engine/ai.js`).
2. **Tout nouveau module `src/**/*.js` doit être listé dans `sw.js`** (`ASSETS`), sinon le jeu casse hors ligne
   sans erreur visible. `tests/pwa.test.js` le vérifie. Incrémenter `VERSION` dans `sw.js` quand on change des
   fichiers servis.
3. **Chemins relatifs partout** (`./…`) : en ligne le jeu est servi depuis `/Wrestling/`.
4. **Les commentaires expliquent le pourquoi**, souvent avec la mesure qui a motivé la règle. On continue dans ce
   ton ; on ne supprime pas un commentaire qui documente une décision sans remplacer la décision.
5. **Sprites** : charger le skill `pixel-art` (`.claude/skills/pixel-art/SKILL.md`) **avant** de toucher à
   `spriteart.js`, `spritepixel.js`, au `look` d'un lutteur ou à quoi que ce soit qui produise des pixels. Il
   contient le catalogue des erreurs déjà commises.
6. **Ajouter un lutteur** = mouvements + gimmick + fiche + condition de déblocage (`src/game/unlocks.js`). Sans la
   dernière, il n'existe qu'en exhibition (c'est le cas de The Roc, volontairement : c'est le champion).
7. **Sauvegardes** : `ppw-save-v1` (carrière), `ppw-unlocks-v1` (vestiaire), `ppw-rivalries-v1` (rivalités) dans
   `localStorage`. Changer le format d'une sauvegarde demande une migration ou une nouvelle clé.
8. `index.html` ne charge que `src/main.js` ; pas de bundler, donc pas d'import de paquet npm.
9. **Jamais de photo de vrai lutteur dans le dépôt.** Le roster parodie de vrais lutteurs et sera remplacé par des
   personnages originaux avant la v1. Pour les reconnaître, l'application les télécharge sur l'appareil, à la
   demande (`src/ui/visages.js`, API de Wikipédia et de Commons, licences libres seulement, attribution affichée) ;
   `tests/visages.test.js` interdit toute image hors `icons/`. Le dossier `local/` est ignoré par git.

## État du jeu (octobre 2026)

Le README a une section **« Où en est le jeu — honnêtement »** avec les mesures avant/après le tour à énergie :
match simple de 40 à 12-16 tours en médiane, phases adverses sans dégâts de 50 à 30 %, fins au chrono de 23 à 0 %.
Les priorités restantes y sont listées dans l'ordre (retour visuel d'un coup, un rôle pour le momentum entre la
signature et le finisher, carrière en équipe, match à relais trop long).
Toute session qui touche au match devrait faire bouger au moins un de ces chiffres, et le dire. Les scripts de
mesure sont faciles à refaire : `createBattle` + `autoPlay` sur soixante graines, voir `tests/energie.test.js` et
`tests/rythme.test.js`.

## Vérifier dans le navigateur

Chromium et Playwright sont disponibles dans les sessions cloud. Pour sauter le tutoriel en test automatisé :
`localStorage.setItem('ppw-tutorial-seen', '1')` avant de lancer un match. Les cases du plateau sont
`.cell[data-x][data-y]` ; en vue isométrique, cliquer au centre de la boîte englobante tombe souvent sur une case
voisine, donc déclencher `el.click()` directement sur la case visée.
