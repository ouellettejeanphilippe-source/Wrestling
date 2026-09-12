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
export function addHeat(battle, n) {
  battle.heat = clamp(battle.heat + n, 0, 100);
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
