// Création d'unités de combat à partir des définitions de lutteurs.
import { CLASSES, SPECIALTIES } from '../data/classes.js';
import { GIMMICKS } from '../data/gimmicks.js';
import { MOVES } from '../data/moves.js';

// Le fonds commun. Il s'est étoffé pour une raison : un long match a besoin
// d'un vocabulaire de remplissage — piétiner, un genou sur le crâne, un
// snapmare pour reprendre la position — et de mouvements de COURSE que tout
// le monde possède. `running_elbow` et `dropdown` n'existent pas à l'arrêt :
// les avoir dans le kit de base, c'est mettre une raison de bouger dans la
// main de chaque lutteur, y compris du jobber.
export const BASE_MOVES = ['punch', 'grapple', 'whip', 'taunt',
  'running_elbow', 'dropdown', 'snapmare', 'stomp_away', 'knee_drop'];

export function movesFor(def) {
  const cls = CLASSES[def.cls] || { moves: [] };
  const spec = SPECIALTIES[def.spec] || { moves: [] };
  // Dédupliqué : un même mouvement peut légitimement figurer dans deux viviers
  // (le chinlock est autant technicien que spécialiste de la soumission). Sans
  // ça il apparaîtrait deux fois dans la feuille d'actions.
  return [...new Set([...BASE_MOVES, ...cls.moves, ...spec.moves, def.signature, def.finisher])]
    .filter((m) => MOVES[m]);
}

// Les PV ne sont pas des points de vie, c'est la RÉSISTANCE avant la chute —
// et une chute n'est pas la fin, c'est un cœur en moins. Avec les valeurs
// brutes du roster (100-125) et les dégâts actuels, chaque reprise ne durait
// que trois coups : le lutteur se relevait pour se faire remettre au sol
// aussitôt. Le facteur se pose ici plutôt que dans les 33 fiches, pour garder
// les écarts entre lutteurs exactement tels qu'ils sont écrits.
const HP_SCALE = 1.5;

export function createUnit(def, team, x, y, opts = {}) {
  const bonus = opts.bonus || {};
  const boost = opts.boost || {};
  const stats = { ...def.stats };
  for (const k of ['str', 'agi', 'tec', 'cha', 'def', 'mov']) {
    stats[k] = (stats[k] || 0) + (bonus[k] || 0) + (boost.stats || 0);
  }
  const maxHp = Math.round((def.stats.hp + (bonus.hp || 0) + (boost.hp || 0)) * HP_SCALE);
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
