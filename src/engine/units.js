// Création d'unités de combat à partir des définitions de lutteurs.
import { CLASSES, SPECIALTIES } from '../data/classes.js';
import { GIMMICKS } from '../data/gimmicks.js';
import { MOVES } from '../data/moves.js';

export const BASE_MOVES = ['punch', 'grapple', 'whip', 'taunt'];

export function movesFor(def) {
  const cls = CLASSES[def.cls] || { moves: [] };
  const spec = SPECIALTIES[def.spec] || { moves: [] };
  return [...BASE_MOVES, ...cls.moves, ...spec.moves, def.signature, def.finisher].filter((m) => MOVES[m]);
}

export function createUnit(def, team, x, y, opts = {}) {
  const bonus = opts.bonus || {};
  const boost = opts.boost || {};
  const stats = { ...def.stats };
  for (const k of ['str', 'agi', 'tec', 'cha', 'def', 'mov']) {
    stats[k] = (stats[k] || 0) + (bonus[k] || 0) + (boost.stats || 0);
  }
  const maxHp = def.stats.hp + (bonus.hp || 0) + (boost.hp || 0);
  const grit = (def.grit ?? 3) + (bonus.grit || 0);
  return {
    uid: opts.uid || `${def.id}-${team}-${x}-${y}`,
    id: def.id, name: def.name, nick: def.nick, team, x, y,
    // direction du regard : les deux camps se font face au coup d'envoi
    facing: opts.facing || (team === 'player' ? 'se' : 'nw'),
    hp: maxHp, maxHp, momentum: opts.momentum ?? 0, grit, maxGrit: grit,
    stats, cls: def.cls, spec: def.spec, gimmick: def.gimmick, alignment: def.alignment,
    moves: movesFor(def), weight: def.weight || 'heavy', color: def.color, initials: def.initials,
    // gabarit sur la grille : `size` accepte 2, [3, 2] ou { w, h }.
    // Par défaut les colosses tiennent sur 2×2, les autres sur une case.
    size: def.size || (def.weight === 'super' ? 2 : 1),
    statuses: {}, down: false, downTurns: 0, acted: false, moved: false, movedTiles: 0, movePath: null, moveMomentum: 0, static: 0, hadTurn: false,
    eliminated: false, elimReason: null, weapon: null, outsideCount: 0, climb: 0, legal: true,
    onlyPin: false, flags: {}, memory: {}, prev: null, boss: !!def.boss,
  };
}

export const unitGimmick = (unit) => GIMMICKS[unit.gimmick] || {};
