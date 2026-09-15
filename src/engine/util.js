// Petites fonctions partagées par le moteur, l'IA et les gimmicks (aucune dépendance sur battle.js).
import { manhattan, occupies } from './grid.js';

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function log(battle, text, cls = '') {
  battle.log.push({ turn: battle.turn, phase: battle.phase, text, cls });
  if (battle.log.length > 400) battle.log.shift();
}
export function emit(battle, ev) { battle.events.push(ev); }

// LES TEMPS FORTS — la matière première de l'histoire du match
//
// Le journal raconte tout, dans l'ordre, et c'est précisément ce qui le rend
// inutilisable pour raconter : il n'y a pas de hiérarchie. Un temps fort est
// une donnée STRUCTURÉE — qui, quoi, à quel tour — qu'on pourra relire à la
// fin pour écrire trois lignes qui ressemblent à un match plutôt qu'à un
// relevé de compteur.
export function beat(battle, kind, data = {}) {
  if (!battle.beats) battle.beats = [];
  battle.beats.push({ turn: battle.turn, kind, ...data });
  if (battle.beats.length > 300) battle.beats.shift();
}

export const living = (battle, team) => battle.units.filter((u) => !u.eliminated && (!team || u.team === team));
export const alliesOf = (battle, unit) => living(battle, unit.team).filter((u) => u !== unit);
export const enemiesOf = (battle, unit) => living(battle, unit.team === 'player' ? 'enemy' : 'player');
export const unitsWithin = (battle, unit, range, team = null) =>
  living(battle, team).filter((u) => u !== unit && manhattan(u, unit) <= range);
export const unitAt = (battle, x, y) => battle.units.find((u) => !u.eliminated && occupies(u, x, y)) || null;

export function addMomentum(battle, unit, n) {
  unit.momentum = clamp(Math.round(unit.momentum + n), 0, 100);
}
// LA CHALEUR EST UNE JAUGE QUI RETOMBE
//
// Elle ne faisait que monter : 100 atteint au douzième tour, et 68 % du match
// passé à saturation. Une jauge toujours pleine ne mesure rien — elle ne
// pouvait servir ni de directive (« finir avec 70+ » : réalisée 100 fois sur
// 100), ni de note, ni de repère d'acte. Pire, elle emportait les trois actes
// avec elle : 91 % du temps de jeu se passait en « main event ».
//
// Le public se lasse. Chaque tour qui passe lui reprend une part de son
// attention — proportionnelle, parce qu'une salle déjà froide ne refroidit
// plus beaucoup, et qu'une salle debout retombe vite si on ne lui donne rien.
export const HEAT_DECAY = 0.18, HEAT_DECAY_MIN = 2, HEAT_FLOOR = 10;

// ET UNE SALLE N'EST JAMAIS VIDE. Trouvé en jouant : dans le premier match de
// la saison, contre un jobber, un joueur qui se contente de passer son tour
// voyait la jauge tomber à zéro et y rester 81 % du match. La décrue à
// quatre points minimum dépassait tout ce qu'un petit match rapporte — la
// règle punissait donc le match à faible enjeu, pas le joueur mou. Le plancher
// est celui du coup d'envoi : la salle est venue, elle reste là.

// CE QUI DISTINGUE UN MATCH, C'EST LA CHALEUR MOYENNE — PAS LA FINALE.
//
// Les dernières secondes d'un match sont pleines de tombés, de kick-outs et
// d'une élimination : la jauge finit à 100 quoi qu'il arrive, même quand la
// salle s'est ennuyée pendant trente tours. Tous ceux qui lisaient
// `battle.heat` à l'arrivée — le cachet de la campagne, la note en étoiles du
// mode Scénarios — lisaient donc toujours le même nombre.
//
// On relève la jauge à chaque tour, et c'est cette moyenne qui sert de mesure.
export function coolCrowd(battle) {
  const perte = Math.max(HEAT_DECAY_MIN, battle.heat * HEAT_DECAY);
  battle.heat = clamp(battle.heat - perte, HEAT_FLOOR, 100);
  if (battle.stats) {
    battle.stats.heatSum = (battle.stats.heatSum || 0) + battle.heat;
    battle.stats.heatTurns = (battle.stats.heatTurns || 0) + 1;
  }
}

// La chaleur moyenne du match, de 0 à 100. C'est LA mesure de ce qu'a valu le
// spectacle ; `battle.heat` n'est que l'instant présent.
export function avgHeat(battle) {
  const s = battle.stats || {};
  return s.heatTurns ? s.heatSum / s.heatTurns : battle.heat;
}

export function addHeat(battle, n) {
  // Le plancher vaut aussi ici : trouvé en jouant, la jauge descendait à 6 ou
  // 8 parce que certaines pénalités passent par `addHeat` et court-circuitaient
  // le plancher de la décrue. Une salle qui est venue reste là.
  battle.heat = clamp(battle.heat + n, HEAT_FLOOR, 100);
  if (!battle.stats) return;
  // Le PIC, pas la valeur finale : un match peut se terminer sur un temps
  // mort après avoir mis la salle debout, et c'est quand même arrivé.
  if (battle.heat > (battle.stats.heatPeak || 0)) battle.stats.heatPeak = battle.heat;
  // Et la VITESSE à laquelle elle s'est levée la première fois.
  if (!battle.stats.heatTurn && battle.heat >= 70) battle.stats.heatTurn = battle.turn;
}
export function heal(battle, unit, n) {
  const before = unit.hp;
  unit.hp = clamp(unit.hp + Math.round(n), 0, unit.maxHp);
  const gained = unit.hp - before;
  if (gained > 0) emit(battle, { type: 'heal', x: unit.x, y: unit.y, amount: gained });
  return gained;
}
export function addStatus(battle, unit, name, n, max = 99) {
  unit.statuses[name] = clamp((unit.statuses[name] || 0) + n, 0, max);
  if (unit.statuses[name] <= 0) delete unit.statuses[name];
}
export function setStatus(battle, unit, name, n) {
  if (name === 'dazed' && unit.flags && unit.flags.noDaze) return;
  unit.statuses[name] = Math.max(unit.statuses[name] || 0, n);
}
export const hasStatus = (unit, name) => (unit.statuses[name] || 0) > 0;
export const hpRatio = (unit) => (unit.maxHp ? unit.hp / unit.maxHp : 0);
