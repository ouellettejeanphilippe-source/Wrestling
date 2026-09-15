// État de la promotion (campagne) : roster, argent, fans, progression, sauvegarde.
import { WRESTLERS, WRESTLERS_BY_ID } from '../data/wrestlers.js';
import { SEASON } from '../data/campaign.js';
import { MATCH_TYPES } from '../data/matchTypes.js';
import { createRng } from '../engine/rng.js';
import { avgHeat } from '../engine/util.js';
import { evaluateDirectives, evaluateScript } from './script.js';
import { deckBonus, cardOffer, deckSize, DECK_MAX, OFFRE } from './deck.js';
import { moveRank, titleMatch, RANK_START, rankOf } from './rank.js';
import { buildRoute, openNodes, nodeAt, isFight, rankStep, rankLoss, SEMAINE_TITRE } from './route.js';

export const SAVE_KEY = 'ppw-save-v1';
export const TRAIN_COST = 150;
// CE QUE COÛTE LA PROGRESSION SUIVANTE. Le palier était de 25 $ quand une
// carrière avait trois lutteurs : l'argent se partageait, et chacun finissait
// avec cinq points de bonus environ. Depuis qu'une carrière n'a QU'UN homme,
// la même recette lui donnait quinze points — trois fois plus fort qu'avant,
// et la ceinture tombait 55 fois sur 100 au lieu de 30.
//
// On ne baisse pas les revenus (le public et l'argent servent à autre chose) :
// on rend chaque progression plus chère que la précédente. Se spécialiser
// reste possible, tout maximiser ne l'est plus.
export const TRAIN_STEP = 100;
// Ce qu'une défaite coûte en public. C'est la seule pression de la saison
// depuis qu'un épisode perdu ne se rejoue plus : elle doit se sentir.
export const LOSS_FANS = 0.14;
export const MAX_TRAIN = 5;
export const TRAINABLE = [['str', 'FOR', 1], ['agi', 'AGI', 1], ['tec', 'TEC', 1], ['def', 'DEF', 1], ['cha', 'CHA', 1], ['hp', 'PV', 10]];

// CE QU'UNE CARRIÈRE RETIENT. Les conditions de déblocage se lisent là-dessus
// (`src/game/unlocks.js`) : elles doivent pouvoir récompenser une MANIÈRE de
// jouer — finir par soumission, casser des tables, battre un colosse — et pas
// seulement le fait d'avoir gagné.
export const emptyFeats = () => ({
  wins: 0, losses: 0, eliteWins: 0,
  tables: 0, submissionWins: 0, tossWins: 0, cheapWins: 0, stoppageWins: 0,
  beatGiant: false, smallestDeckWin: 0, maxStars: 0,
  winsByType: {}, restWeeks: 0,
});

// Les colosses : ceux qu'on n'attrape pas et qu'on ne projette pas.
const estColosse = (def) => !!def && (def.spec === 'giant' || def.weight === 'super');

export function newGame({ promoName, mode, starters }) {
  const seed = Date.now() % 1000000;
  const state = {
    version: 1, promoName: promoName || 'PPW — Parodie Pro Wrestling', mode: mode || 'kayfabe', showIndex: 0,
    // UNE CARRIÈRE EST CELLE D'UN SEUL LUTTEUR. Le roster n'a qu'une entrée :
    // c'est lui qu'on entraîne, c'est son deck qui grossit, c'est sa fiche de
    // victoires. Les matchs par équipes existent toujours, mais comme une
    // OPTION de la carte, avec un partenaire pour la soirée (voir `week.js`).
    money: 800, fans: 100, seed, roster: [rosterEntry(starters[0])], history: [], finished: false, ending: null,
    // La carrière commence huitième prétendant. Sept matchs de route pour
    // remonter, et le huitième soir décide de tout. Une sauvegarde d'avant le
    // classement n'a pas ce champ : tous les lecteurs retombent sur RANK_START.
    rank: RANK_START,
    // LA ROUTE. Une carte à embranchements tirée à la graine de la partie :
    // deux carrières ne passent jamais par les mêmes semaines. `path` est la
    // liste des nœuds déjà joués — c'est elle qui dit où l'on peut aller.
    route: buildRoute(seed), path: [],
    // LA TÊTE D'AFFICHE : le lutteur dont c'est la carrière. Les deux autres
    // sont ses partenaires. C'est lui qui compte pour la progression entre les
    // carrières (`unlocks.js`) — « gagner la ceinture avec X » veut dire
    // quelque chose de précis.
    headliner: starters[0],
    feats: emptyFeats(),
  };
  return state;
}

// Une sauvegarde d'avant la carte n'a pas de route : on lui en fabrique une à
// sa propre graine, et on la place à la semaine où elle en était.
export function ensureRoute(state) {
  if (!state.route) { state.route = buildRoute(state.seed || 1); state.path = state.path || []; }
  if (!state.path) state.path = [];
  return state.route;
}

// Les nœuds ouverts cette semaine, prêts à afficher : type, match résolu,
// et de quoi les distinguer d'un coup d'œil.
export function weekNodes(state) {
  ensureRoute(state);
  const row = state.path.length;
  if (row >= state.route.rows.length) return [];
  return openNodes(state.route, state.path)
    .map((col) => nodeAt(state.route, row, col))
    .filter(Boolean)
    .map((node) => (node.type === 'boss'
      ? { ...node, match: titleMatch(node.match, state, SEASON.champion) }
      : node));
}

// Avancer d'une semaine : on note par où l'on est passé, et la semaine
// courante suit la longueur du chemin. C'est le seul endroit qui fait avancer
// la carrière — match joué, semaine off ou passage au bureau du booker.
export function takeNode(state, node) {
  ensureRoute(state);
  state.path.push({ row: node.row, col: node.col, type: node.type });
  state.showIndex = state.path.length;
  if (state.showIndex > SEMAINE_TITRE) state.showIndex = SEMAINE_TITRE;
}

// `cards` : les mouvements appris en carrière (voir `deck.js`). `forgotten` :
// ceux de son répertoire d'origine qu'il a laissé tomber pour faire de la
// place. Les deux sont absents d'une sauvegarde d'avant les decks, et tout le
// code les traite comme des listes vides — une vieille partie continue.
export const rosterEntry = (id) => ({ id, bonus: { str: 0, agi: 0, tec: 0, def: 0, cha: 0, hp: 0 }, wins: 0, losses: 0, trainings: 0, cards: [], forgotten: [] });

export function save(state) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* stockage indisponible */ }
}
export function load() {
  try { const raw = localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }

export const currentShow = (state) => SEASON.shows[state.showIndex] || null;

// LES MATCHS DE L'ÉPISODE, TELS QU'ILS SERONT JOUÉS. Le hub doit annoncer le
// match de titre avec ses vraies conditions — ses vrais adversaires et le
// nombre de lutteurs qu'il faut amener — sinon l'écran promet un contre un et
// le moteur en sert un autre.
export function showMatches(state) {
  const show = currentShow(state);
  if (!show) return [];
  return show.title_match ? show.matches.map((m) => titleMatch(m, state, SEASON.champion)) : show.matches;
}
export const rosterDefs = (state) => state.roster.map((r) => WRESTLERS_BY_ID[r.id]);
// Ce que la campagne transmet au moteur pour chaque lutteur : les bonus
// d'entraînement ET son deck. L'exhibition n'appelle jamais cette fonction :
// c'est ce qui exclut les decks du mode exhibition, sans un seul `if`.
export const playerBonuses = (state) => Object.fromEntries(state.roster.map((r) => [r.id, { ...r.bonus, ...deckBonus(r) }]));

// LES PARTENAIRES D'UN SOIR. Il n'y a plus d'agents libres à recruter : une
// carrière n'a qu'un lutteur, et personne ne rejoint son roster. Ce qui existe,
// c'est du monde qui accepte de faire équipe le temps d'une soirée — et ce
// monde-là, ce sont les lutteurs qu'on a DÉBLOQUÉS. Chaque nom gagné au
// vestiaire sert donc deux fois : on peut faire sa carrière, et on peut
// l'appeler en renfort.
//
// Le vivier arrive d'en haut (l'interface lit la progression) plutôt que d'être
// lu ici : `state.js` ne touche pas au stockage du navigateur.
export function partnerOffer(state, node, eligibles, combien = 3) {
  const rng = createRng((state.seed || 1) + node.row * 811 + node.col * 53);
  const pool = (eligibles || []).filter((id) => id !== state.headliner && WRESTLERS_BY_ID[id]);
  return rng.shuffle(pool).slice(0, combien);
}

export function train(state, id, stat) {
  const r = state.roster.find((x) => x.id === id);
  const spec = TRAINABLE.find((t) => t[0] === stat);
  if (!r || !spec) return { ok: false, reason: 'Invalide' };
  const cost = TRAIN_COST + r.trainings * TRAIN_STEP;
  if (state.money < cost) return { ok: false, reason: 'Pas assez d’argent' };
  const current = r.bonus[stat] / spec[2];
  if (current >= MAX_TRAIN) return { ok: false, reason: 'Maximum atteint' };
  state.money -= cost;
  r.bonus[stat] += spec[2];
  r.trainings += 1;
  return { ok: true, cost };
}
export const trainCost = (r) => TRAIN_COST + r.trainings * TRAIN_STEP;

export function buildMatch(state, matchDef) {
  // LE MATCH DE TITRE SE CONSTRUIT AU DERNIER MOMENT, à partir du classement :
  // c'est le seul endroit du jeu où la route parcourue change ce qui vous
  // attend dans le ring.
  const def = isTitleMatch(state, matchDef) ? titleMatch(matchDef, state, SEASON.champion) : matchDef;
  return { ...def, mode: state.mode, script: state.mode === 'scenario' ? def.script : null };
}

// Le match de championnat se reconnaît à son identifiant, pas à la semaine où
// on se trouve : avec une carte à embranchements, la position ne suffit plus
// (et deux carrières n'arrivent pas au titre par le même chemin).
export const TITLE_MATCH_ID = SEASON.shows[SEASON.shows.length - 1].matches[0].id;
export function isTitleMatch(state, matchDef) {
  return !!matchDef && matchDef.id === TITLE_MATCH_ID;
}

// Les exploits d'un match, versés dans le compteur de la carrière. Tout se lit
// sur ce que le moteur a réellement enregistré : `lastElimReason` dit COMMENT
// le dernier lutteur est sorti, et c'est la seule source fiable — le texte de
// `result.reason` est écrit pour être lu, pas pour être analysé.
export function recordFeats(state, battle, matchDef, node, won, teamIds = []) {
  const f = state.feats = state.feats || emptyFeats();
  const type = (node && node.type) || matchDef.nodeType || 'match';
  if (!won) { f.losses = (f.losses || 0) + 1; f.tables += battle.stats.tables || 0; return; }
  f.wins = (f.wins || 0) + 1;
  if (type === 'elite') f.eliteWins = (f.eliteWins || 0) + 1;
  f.tables += battle.stats.tables || 0;
  f.winsByType[matchDef.type] = (f.winsByType[matchDef.type] || 0) + 1;

  switch (battle.stats.lastElimReason) {
    case 'submission': f.submissionWins++; break;
    case 'toss': f.tossWins++; break;
    case 'stoppage': f.stoppageWins++; break;
    case 'dq': case 'countout': f.cheapWins++; break;
    default: break;
  }
  // Un colosse battu, c'est un colosse qu'on a mis au tapis — pas un colosse
  // qui se trouvait dans la salle.
  for (const e of matchDef.enemies || []) {
    const def = WRESTLERS_BY_ID[typeof e === 'string' ? e : e.id];
    if (!estColosse(def)) continue;
    const u = battle.units.find((x) => x.team === 'enemy' && x.id === def.id);
    if (u && u.eliminated) f.beatGiant = true;
  }
  // Le plus petit deck avec lequel on a gagné : c'est une manière de jouer, et
  // elle mérite d'ouvrir une porte.
  // On ne récompense pas un deck resserré si son propriétaire est resté au
  // vestiaire : la tête d'affiche doit avoir lutté ce soir-là.
  const tete = state.roster.find((r) => r.id === state.headliner);
  if (tete && teamIds.includes(tete.id)) {
    const taille = deckSize(tete);
    if (!f.smallestDeckWin || taille < f.smallestDeckWin) f.smallestDeckWin = taille;
  }
}

// Applique le résultat d'un match de campagne. Renvoie un résumé pour l'écran de résultat.
export function applyResult(state, battle, matchDef, teamIds, node = null) {
  const won = battle.result.winner === 'player';
  const summary = { won, matchTitle: matchDef.title, money: 0, fans: 0, directives: [], script: null, advance: false, message: '' };
  if (state.mode === 'scenario') {
    const ev = evaluateScript(battle, matchDef.script);
    summary.script = ev;
    // EN MODE SCÉNARIOS, LA QUALITÉ EST LE PRODUIT. Le cachet suivait les
    // étoiles mais avec un coefficient calé sur rien : une saison de bookeur
    // finissait à 1 206 fans là où une saison de lutteur en faisait 2 001, et
    // l'objectif du PPV devenait inatteignable dans un mode sur deux. Un show
    // à cinq étoiles doit rapporter le double d'un show moyen, et une saison
    // bien bookée doit tirer autant qu'une saison bien luttée.
    summary.money = Math.round(matchDef.reward.money * (ev.stars / 5) * 1.8);
    summary.fans = Math.round(matchDef.reward.fans * (ev.stars / 5) * 2);
    // Le show continue, quelle qu'ait été la note — comme en Kayfabe. Un
    // verrou à 2,5★ bloquait la saison au premier épisode raté ; ce qui se
    // paie, c'est le cachet et le public, pas le droit de continuer.
    //
    // Un finish non respecté reste ce qu'il est : un « shoot ». Le Network
    // coupe la moitié du cachet et une partie de la salle s'en va.
    summary.advance = true;
    if (!ev.finishOk) {
      summary.money = Math.round(summary.money * 0.5);
      summary.fans = Math.round(summary.fans * 0.5) - Math.round(state.fans * LOSS_FANS);
    }
    summary.message = !ev.finishOk
      ? 'Vous n’avez pas respecté le finish. Le Network parle de « shoot » — cachet coupé de moitié, et la salle vous en veut.'
      : ev.stars >= 4.5 ? 'Match de l’année ! Le Network est aux anges.'
        : ev.stars >= 2.5 ? 'Épisode validé par le Network.'
          : 'Note basse. Le Network diffuse quand même, en soupirant.';
  } else {
    // UNE DÉFAITE FAIT AVANCER LE SHOW. Avant, il fallait GAGNER pour passer à
    // l'épisode suivant — et sur 30 saisons simulées, une sur quatre restait
    // bloquée : six épisodes différents se rejouaient six fois sans succès.
    // Un mode histoire qui exige de rejouer un épisode quatre fois n'est pas
    // une histoire, c'est un mur. Et ça ne ressemble à rien de connu : un
    // lutteur qui perd le mardi lutte quand même le mardi suivant.
    //
    // La saison continue donc toujours ; ce qui se paie, c'est le PUBLIC. Le
    // véritable enjeu redevient l'objectif de fans du PPV, qui ne se décroche
    // qu'en gagnant l'essentiel de ses matchs.
    summary.directives = won ? evaluateDirectives(battle, matchDef.directives) : [];
    const bonus = summary.directives.filter((d) => d.done).reduce((a, d) => ({ money: a.money + d.reward.money, fans: a.fans + d.reward.fans }), { money: 0, fans: 0 });
    // LA CHALEUR MOYENNE, PAS LA FINALE. La jauge finit à 100 dans 99 % des
    // matchs (les dernières secondes sont pleines de tombés et de kick-outs) :
    // le cachet ne dépendait donc de rien. La moyenne, elle, va de 34 à 77.
    const heatMult = 0.7 + avgHeat(battle) / 150;
    summary.money = won ? Math.round(matchDef.reward.money * heatMult + bonus.money) : Math.round(matchDef.reward.money * 0.3);
    summary.fans = won ? Math.round(matchDef.reward.fans * heatMult + bonus.fans) : -Math.round(state.fans * LOSS_FANS);
    summary.advance = true;
    summary.message = won
      ? 'Victoire ! Le show continue.'
      : 'Défaite. Le show continue — mais une partie de la salle ne reviendra pas.';
  }
  // CE QUE LA CARRIÈRE RETIENT DE CE MATCH. On le note ici, au seul endroit
  // qui voit à la fois le match, son type et son résultat.
  recordFeats(state, battle, matchDef, node, won, teamIds);
  state.money += summary.money;
  state.fans = Math.max(0, state.fans + summary.fans);
  for (const r of state.roster) if (teamIds.includes(r.id)) { if (won) r.wins++; else r.losses++; }
  // UN MATCH APPREND QUELQUE CHOSE. C'est ce qui manquait entre deux épisodes :
  // le répertoire d'un lutteur était le même au premier et au huitième. On
  // gagne trois cartes au choix, on en gagne deux quand on a perdu — une
  // raclée enseigne aussi, mais moins bien. (Rien de tout ça en exhibition :
  // `applyResult` n'existe qu'en campagne.)
  summary.cards = teamIds.map((id) => {
    const entry = state.roster.find((r) => r.id === id);
    if (!entry) return null;
    const offer = cardOffer(state, id).slice(0, won ? OFFRE : OFFRE - 1);
    if (!offer.length) return null;
    return { id, name: (WRESTLERS_BY_ID[id] || {}).name || id, offer, deck: deckSize(entry), max: DECK_MAX, mustForget: deckSize(entry) >= DECK_MAX };
  }).filter(Boolean);
  // LE CLASSEMENT BOUGE À CHAQUE MATCH DE ROUTE, jamais au match de titre : le
  // soir du PPV, on ne monte plus au classement, on prend la ceinture ou on
  // ne la prend pas.
  const titre = isTitleMatch(state, matchDef);
  summary.title = titre;
  // CE QUI FAIT MONTER AU CLASSEMENT N'EST PAS LE MÊME MÉTIER DANS LES DEUX
  // MODES. En Kayfabe on est le lutteur : on monte en gagnant. En Scénarios on
  // est le bookeur, et plusieurs scripts EXIGENT qu'on perde — y faire monter
  // le classement sur la victoire demandait au joueur de saboter son propre
  // show pour avoir son match de titre. On y monte donc en livrant le finish
  // demandé, qui est la monnaie de ce mode.
  const monte = state.mode === 'scenario' ? !!(summary.script && summary.script.finishOk) : won;
  if (!titre) {
    const avant = rankOf(state);
    // UN MAIN EVENT VAUT DEUX PLACES. C'est la raison de le prendre sur la
    // carte, et l'adversaire plus dur en est la contrepartie.
    const type = (node && node.type) || matchDef.nodeType || 'match';
    const pas = monte ? rankStep(type) : rankLoss(type);
    for (let i = 0; i < pas; i++) summary.rank = moveRank(state, monte);
    summary.rankBefore = avant;
    summary.rankStep = pas;
    summary.rankReason = state.mode === 'scenario' ? 'finish' : 'victoire';
  } else {
    summary.rank = rankOf(state);
    summary.rankBefore = summary.rank;
    summary.champion = won;
  }
  state.history.push({ show: state.showIndex + 1, match: matchDef.title, won, stars: summary.script ? summary.script.stars : null, money: summary.money, fans: summary.fans, turns: battle.turn, title: titre });
  if (summary.advance) {
    takeNode(state, node || { row: state.path ? state.path.length : 0, col: 0, type: titre ? 'boss' : (matchDef.nodeType || 'match') });
    if (titre) {
      state.finished = true;
      // UNE SEULE QUESTION À LA FIN : la ceinture, ou pas. Le total de fans
      // n'est plus le verdict, seulement une mention sur l'écran de fin.
      state.champion = won;
      state.ending = won ? 'champion' : 'contender';
      state.sellout = state.fans >= SEASON.finalFansGoal;
      state.terms = matchDef.terms || 'net';
    }
  }
  return summary;
}

// LE BILAN D'UNE CARRIÈRE, tel que la progression entre les parties le lit
// (`src/game/unlocks.js`). Il ne contient QUE des faits : qui, quoi, combien —
// aucune condition, aucun jugement. Les conditions vivent dans `unlocks.js`,
// et c'est ce qui permet d'en ajouter sans toucher au reste.
export function careerRun(state) {
  return {
    headliner: state.headliner,
    champion: state.champion === true,
    terms: state.terms || 'net',
    rank: rankOf(state),
    mode: state.mode,
    fans: state.fans,
    money: state.money,
    feats: state.feats || emptyFeats(),
  };
}

// Le quatrième argument accepte un nombre (l'ancienne graine) ou un objet
// d'options : { seed, managers: { player, enemy }, rivalry }. L'exhibition est
// devenue le mode où l'on choisit tout — adversaire, manager, et où l'histoire
// entre les deux lutteurs se poursuit d'un match à l'autre.
export function exhibitionMatch(type, playerIds, enemyIds, opts = {}) {
  const o = typeof opts === 'number' ? { seed: opts } : (opts || {});
  const rules = MATCH_TYPES[type];
  return {
    id: 'exhibition', title: `Exhibition — ${rules.name}`, type, teamSize: playerIds.length, enemies: enemyIds, directives: [], reward: { money: 0, fans: 0 },
    desc: rules.desc, mode: 'kayfabe', seed: o.seed, turns: 8,
    managers: o.managers || null, rivalry: o.rivalry || null,
    reinforcements: type === 'survival' ? [{ turn: 3, enemies: ['invader'], spawns: [[0, 7]] }, { turn: 6, enemies: ['invader'], spawns: [[0, 7]] }] : undefined,
  };
}
