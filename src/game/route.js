// LA ROUTE VERS LA CEINTURE — LA CARTE, À LA SLAY THE SPIRE
//
// La carrière était une ligne droite : huit épisodes, toujours les mêmes,
// toujours dans le même ordre, avec les quinze mêmes matchs écrits en dur et
// pas un adversaire tiré au sort. Deux carrières se ressemblaient à la
// virgule près — et pour une structure de run, la rejouabilité n'est pas une
// option, c'est le moteur.
//
// Le modèle est celui de Slay the Spire, parce que la correspondance avec le
// catch tombe juste :
//
//   combat normal  →  un match de carte
//   élite          →  un main event contre un lutteur classé : ça rapporte le
//                     double au classement, et ça cogne
//   feu de camp    →  une semaine off : s'entraîner, ou travailler son deck
//   événement « ? »→  un angle en coulisses
//   boutique       →  le bureau du booker
//   boss           →  le champion du monde
//
// CE QU'ON NE JETTE PAS : les quatorze matchs de route écrits à la main, avec
// leurs scripts, leurs adversaires et leurs textes. Une carte qui tirerait des
// adversaires au hasard dans des stipulations au hasard produirait des matchs
// incohérents (« un chien enragé, quatre armes, deux tables » contre un
// voltigeur). On tire donc des MATCHS ENTIERS, et ce qui varie d'une carrière
// à l'autre, c'est lesquels, dans quel ordre, et ce qu'on choisit de faire
// entre eux.
import { createRng } from '../engine/rng.js';
import { SEASON } from '../data/campaign.js';

// Sept semaines de route, puis le titre. C'est la longueur d'avant — elle
// était bonne, une carrière tient en une petite quarantaine de minutes.
export const SEMAINES = 8;
export const SEMAINE_TITRE = SEMAINES - 1;   // index de la dernière ligne

export const NODE_TYPES = {
  match: { key: 'match', icon: '🤼', name: 'Match', desc: 'Un match de carte. Une victoire vous fait monter d’une place au classement.' },
  elite: { key: 'elite', icon: '⭐', name: 'Main event', desc: 'Un adversaire classé, devant une vraie salle. Ça rapporte DEUX places au classement — et il cogne deux fois plus fort.' },
  rest:  { key: 'rest',  icon: '🛋️', name: 'Semaine off', desc: 'Pas de match. Une séance d’entraînement offerte, ou une carte retirée du deck.' },
  event: { key: 'event', icon: '❓', name: 'En coulisses', desc: 'Un angle, une rencontre, une proposition. On ne sait jamais à l’avance.' },
  shop:  { key: 'shop',  icon: '💼', name: 'Bureau du booker', desc: 'On y achète ce qui se vend : un mouvement, un manager, du muscle.' },
  boss:  { key: 'boss',  icon: '🏆', name: 'Championnat du Monde', desc: 'Le dernier soir. La seule question de toute la carrière.' },
};

// LE VIVIER DE MATCHS, TRIÉ PAR L'AUTEUR LUI-MÊME. Dans chaque épisode écrit,
// le second match est le plus dur des deux — c'est dit dans ses textes et ça
// se lit dans ses récompenses. Le premier alimente donc les nœuds « match »,
// le second les nœuds « main event ». On n'invente pas une difficulté : on lit
// celle qui était déjà écrite.
function viviers() {
  const normal = [], elite = [];
  for (const show of SEASON.shows) {
    if (show.title_match) continue;
    show.matches.forEach((m, i) => (i === 0 ? normal : elite).push(m));
  }
  return { normal, elite };
}

// Un match pour cette semaine-là : on pioche autour de la position
// correspondante dans le vivier, jamais deux fois le même dans une carrière.
//
// LA FENÊTRE S'ÉLARGIT AVEC LA CARRIÈRE. À ±2 partout, la deuxième semaine
// pouvait servir la bataille royale à quatre adversaires de l'épisode 4 : la
// difficulté ne montait plus, elle tirait au sort. Les viviers ne font que
// sept matchs — au début, on reste collé à la semaine ; plus tard, l'écart
// entre deux matchs voisins est petit et on peut respirer.
const fenetre = (semaine) => (semaine <= 2 ? 1 : 2);

// L'UNICITÉ CÈDE DEVANT LA DIFFICULTÉ. La carte affecte un match à CHAQUE
// nœud — une quinzaine — alors que les viviers n'en contiennent que sept
// chacun. À unicité stricte, le vivier s'épuisait et la sixième semaine
// servait le squash de l'épisode 1 : l'écart entre la semaine et la
// difficulté montait jusqu'à six crans.
//
// On préfère donc un match encore inutilisé, mais on ne quitte JAMAIS la
// fenêtre pour en trouver un. Le joueur ne joue qu'un nœud par ligne : voir
// deux fois le même match dans une carrière reste rare, et de toute façon
// moins grave qu'un adversaire hors sujet.
function piocheMatch(rng, vivier, semaine, pris) {
  const cible = Math.min(vivier.length - 1, semaine);
  const f = fenetre(semaine);
  const proches = vivier.filter((m, i) => Math.abs(i - cible) <= f);
  const fenetreFinale = proches.length ? proches : vivier;
  const neufs = fenetreFinale.filter((m) => !pris.has(m.id));
  const choix = neufs.length ? neufs : fenetreFinale;
  if (!choix.length) return null;
  const m = choix[Math.floor(rng.next() * choix.length)];
  pris.add(m.id);
  return m;
}

// Ce qu'on peut trouver sur une ligne, et à quelle fréquence. Le match reste
// le cœur : une semaine sans match est une semaine sans classement, et c'est
// tout l'arbitrage.
const POIDS = [['match', 34], ['elite', 22], ['rest', 18], ['event', 16], ['shop', 10]];
function tireType(rng) {
  const total = POIDS.reduce((a, [, p]) => a + p, 0);
  let n = rng.next() * total;
  for (const [t, p] of POIDS) { n -= p; if (n <= 0) return t; }
  return 'match';
}

// LA CARTE. Une ligne par semaine, deux ou trois nœuds par ligne, et TOUJOURS
// au moins un match ou un main event : on doit pouvoir se battre chaque
// semaine. Les autres nœuds sont de vraies alternatives, avec leur coût — une
// semaine off ne fait pas monter au classement, et ça se paiera le soir du
// titre.
export function buildRoute(seed) {
  const rng = createRng(seed || 1);
  const { normal, elite } = viviers();
  const pris = new Set();
  const rows = [];

  for (let s = 0; s < SEMAINES; s++) {
    if (s === SEMAINE_TITRE) {
      rows.push([{ id: `s${s}n0`, row: s, col: 0, type: 'boss', match: SEASON.shows[SEASON.shows.length - 1].matches[0] }]);
      continue;
    }
    // La première semaine ne propose rien d'autre qu'un match : on commence
    // par lutter, pas par faire ses courses.
    const n = s === 0 ? 1 : (rng.next() < 0.45 ? 2 : 3);
    const types = [];
    for (let i = 0; i < n; i++) types.push(s === 0 ? 'match' : tireType(rng));
    if (!types.some((t) => t === 'match' || t === 'elite')) types[Math.floor(rng.next() * n)] = 'match';

    rows.push(types.map((type, col) => {
      const node = { id: `s${s}n${col}`, row: s, col, type };
      if (type === 'match') node.match = piocheMatch(rng, normal, s, pris);
      if (type === 'elite') { const m = piocheMatch(rng, elite, s, pris); node.match = m ? eliteMatch(m) : m; }
      return node;
    }));
  }

  relier(rng, rows);
  return { seed, rows };
}

// LES ARÊTES. Chaque nœud mène à un ou deux nœuds de la semaine suivante, et
// aucun nœud n'est orphelin : sans cette garantie, la carte peut proposer un
// chemin qui ne mène nulle part, ce qui est pire que pas de carte du tout.
function relier(rng, rows) {
  for (let s = 0; s < rows.length - 1; s++) {
    const ici = rows[s], apres = rows[s + 1];
    for (const node of ici) {
      const proche = Math.round((node.col / Math.max(1, ici.length - 1)) * (apres.length - 1));
      const liens = new Set([proche]);
      // AU MOINS DEUX PORTES QUAND LA LIGNE SUIVANTE LE PERMET. Mesuré avant :
      // seules 33 % des semaines offraient un vrai choix, parce qu'un nœud ne
      // menait souvent qu'à un seul autre. Une carte où l'on ne choisit qu'une
      // semaine sur trois n'est pas une carte, c'est un couloir avec des
      // embranchements décoratifs.
      if (apres.length > 1) {
        const voisin = (d) => Math.max(0, Math.min(apres.length - 1, proche + d));
        liens.add(voisin(rng.next() < 0.5 ? -1 : 1));
        if (liens.size < 2) liens.add(voisin(-1) === proche ? voisin(1) : voisin(-1));
        if (apres.length > 2 && rng.next() < 0.3) liens.add(voisin(rng.next() < 0.5 ? -2 : 2));
      }
      node.next = [...liens].sort((a, b) => a - b);
    }
    // Personne d'orphelin : tout nœud sans entrée se fait adopter par le nœud
    // de la ligne d'avant qui lui est le plus proche.
    for (let c = 0; c < apres.length; c++) {
      if (ici.some((n) => n.next.includes(c))) continue;
      const parent = ici.reduce((best, n) => {
        const d = Math.abs(Math.round((n.col / Math.max(1, ici.length - 1)) * (apres.length - 1)) - c);
        return (!best || d < best.d) ? { n, d } : best;
      }, null).n;
      parent.next = [...new Set([...parent.next, c])].sort((a, b) => a - b);
    }
  }
  for (const node of rows[rows.length - 1]) node.next = [];
}

export const nodeAt = (route, row, col) => ((route.rows[row] || [])[col] || null);

// Où peut-on aller cette semaine ? Tant qu'on n'a rien joué, toute la
// première ligne ; ensuite, seulement là où mène le nœud d'où l'on vient.
export function openNodes(route, path) {
  if (!route) return [];
  if (!path || !path.length) return route.rows[0].map((_, col) => col);
  const dernier = path[path.length - 1];
  const precedent = nodeAt(route, dernier.row, dernier.col);
  return precedent ? precedent.next : [];
}

export const isFight = (type) => type === 'match' || type === 'elite' || type === 'boss';
// Ce qu'un nœud rapporte au classement. Le main event en vaut deux : c'est la
// raison de le prendre, et le risque est la contrepartie.
export const rankStep = (type) => (type === 'elite' ? 2 : 1);

// ET CE QU'IL COÛTE QUAND ON PERD : toujours une place, jamais deux.
//
// L'asymétrie n'est pas une faveur, c'est ce qui rend le nœud jouable. Avec un
// coût symétrique et 40 % de victoires, l'espérance du main event était PIRE
// que celle d'un match de carte (−0,2 place contre −0,3) : le nœud « risqué et
// payant » était juste le mauvais choix, toujours. Perdre un main event serré
// contre un lutteur classé ne doit pas enterrer une carrière — c'est le gagner
// qui doit la faire.
export const rankLoss = () => 1;

// UN MAIN EVENT DOIT ÊTRE UN MAIN EVENT. Mesuré avant ce bonus : 65 % de
// victoires sur les nœuds « élite » contre 67 % sur les nœuds « match ». Le
// vivier des seconds matchs est à peine plus dur que celui des premiers — pas
// de quoi faire un risque. C'était donc deux places au classement offertes,
// et « prendre l'élite » n'était pas une décision, c'était la bonne réponse.
//
// L'adversaire d'un main event arrive comme le champion arrive à son match de
// titre : plus frais, meilleur partout.
export const ELITE_BOOST = { hp: 10, stats: 1 };
export function eliteMatch(match) {
  return {
    ...match,
    enemies: match.enemies.map((e) => {
      const base = typeof e === 'string' ? { id: e } : e;
      const boost = base.boost || {};
      return { ...base, boost: { ...boost, hp: (boost.hp || 0) + ELITE_BOOST.hp, stats: (boost.stats || 0) + ELITE_BOOST.stats } };
    }),
  };
}
