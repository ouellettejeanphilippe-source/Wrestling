// Moteur de match : état, actions, résolution. Aucune dépendance au DOM.
import { tileAt, setTile, terrainAt, reachable, manhattan, key, pathIn, isOutside, isOnRope, isOnTurnbuckle, isAdjacentToTerrain, inBounds, buildArena, fits, sizeOf, occupies, facingTo, OPPOSITE, heightAt, climbOf } from './grid.js';
import { MOVES, moveUnlock, moveCost } from '../data/moves.js';
import { GIMMICKS } from '../data/gimmicks.js';
import { WRESTLERS_BY_ID } from '../data/wrestlers.js';
import { MATCH_TYPES, WEAPONS } from '../data/matchTypes.js';
import { createUnit } from './units.js';
import { createRng } from './rng.js';
import { matchPhase, isFlashy } from './phases.js';
import { COMBOS } from '../data/combos.js';
import { checkWin } from './rules.js';
import { planUnit } from './ai.js';
import { movePart, wearFrom, addWear, wearStats, wearLevel, wearRatio, wearTapBonus, wearPinBonus, wearReversePenalty, staminaFactor, wornParts, PARTS } from './wear.js';
import { log, emit, living, alliesOf, enemiesOf, unitsWithin, unitAt, addMomentum, addHeat, heal, addStatus, setStatus, hasStatus, hpRatio, clamp } from './util.js';

const SPAWNS = {
  standard: { player: [[7, 7], [7, 8], [6, 7], [6, 8], [8, 6], [8, 9]], enemy: [[12, 7], [12, 8], [13, 7], [13, 8], [11, 6], [11, 9]] },
  ladder: { player: [[7, 6], [7, 9], [6, 7], [6, 8]], enemy: [[12, 6], [12, 9], [13, 7], [13, 8]] },
  tag: { player: [[7, 7], [5, 10], [5, 9]], enemy: [[12, 7], [14, 8], [14, 7]] },
  invasion: { enemy: [[1, 7], [1, 8], [1, 6], [1, 9], [0, 7]] },
};
const WEAPON_SPOTS = [[4, 7], [15, 8], [4, 8], [15, 7], [2, 4], [16, 12], [2, 12], [16, 4]];
const WEAPON_ORDER = ['chair', 'kendo', 'trash', 'bat', 'chair', 'kendo'];
const TIMED_STATUSES = ['dazed', 'cursed', 'finished'];

const gim = (u) => GIMMICKS[u.gimmick] || {};
const HAZARD_TILES = ['table', 'steps', 'cage', 'barricade', 'turnbuckle'];

// Contexte utilisé par les combos : d'où part le coup, et la cible est-elle acculée ?
// ÉLAN — LE DÉPLACEMENT ET LE COUP NE SONT PLUS DEUX TOURS SÉPARÉS
//
// Un lutteur planté sur place qui frappe son voisin de palier n'a aucun poids.
// Ce n'est pas du catch, c'est un échange de tours. Le coup porté ce tour-ci
// est donc multiplié par la distance réellement parcourue avant de le donner :
// rien du tout à l'arrêt, un quart de plus après une course.
//
// C'est une carotte ET un bâton. Le bâton est petit (-15 %) et se contourne
// toujours : même au corps à corps, il reste une case voisine où se replacer.
// Ce qu'il interdit, c'est de ne jamais bouger.
const CHARGEABLE = new Set(['strike', 'aerial', 'grapple', 'weapon']);
// STATISME — l'immobilité s'aggrave
//
// Un tour sans bouger, c'est un choix tactique. Trois de suite, c'est un
// match qui s'enlise : le lutteur s'ankylose et la foule décroche. Le
// compteur monte à chaque tour passé sur place et retombe à zéro dès qu'on
// marche. Il creuse le plancher de l'élan et refroidit la salle — parce que
// le coût d'un match statique, dans le catch, c'est le public.
export const STATIC_MAX = 3;
const STATIC_DMG_STEP = 0.07;                     // de plancher perdu par tour
const STATIC_HEAT_STEP = 2;                       // de chaleur perdue par tour
export const staticFloor = (n) => ELAN_MIN - STATIC_DMG_STEP * Math.min(STATIC_MAX, n || 0);
export const ELAN_FULL = 4;                       // cases pour l'élan maximum
export const ELAN_MIN = 0.85, ELAN_MAX = 1.25;

export function elanMult(travel, move, unit = null) {
  if (!move || !CHARGEABLE.has(move.type)) return 1;
  // Étourdi, on ne court pas : la punition serait double.
  if (unit && unit.statuses && unit.statuses.dazed) return 1;
  const t = Math.max(0, Math.min(ELAN_FULL, travel || 0));
  // Le plancher s'enfonce avec les tours passés sur place ; le plafond, lui,
  // ne bouge pas — une vraie course efface l'ankylose d'un coup.
  const floor = unit ? staticFloor(unit.static) : ELAN_MIN;
  return floor + (ELAN_MAX - floor) * (t / ELAN_FULL);
}
// Ce que l'interface annonce avant de confirmer : un mot et un multiplicateur.
export function elanLabel(travel, move, unit = null) {
  const mult = elanMult(travel, move, unit);
  if (mult === 1) return null;
  const t = Math.max(0, travel || 0);
  const stat = (unit && unit.static) || 0;
  const name = t === 0 ? (stat >= 2 ? 'Ankylosé' : 'Planté')
    : t >= ELAN_FULL ? 'Pleine course' : t >= 2 ? 'Élan' : 'Appui';
  return { name, travel: t, mult, good: mult > 1, static: stat };
}

export const comboContextFor = (battle, attacker, target, move, pos) =>
  comboContext(battle, attacker, target, move, pos);

function comboContext(battle, attacker, target, move, pos = null) {
  const g = battle.grid;
  const from = pos || attacker;
  const tile = tileAt(g, from.x, from.y);
  // Le trajet de ce tour-ci fait partie du contexte au même titre que le
  // terrain : c'est ce qui permet à un combo de récompenser la course, pas
  // seulement la case d'arrivée.
  const path = pos ? (pos.path || null) : attacker.movePath;
  const travel = pos && pos.travel != null ? pos.travel : (attacker.movedTiles || 0);
  return {
    fromCorner: tile === 'turnbuckle',
    fromRope: tile === 'rope',
    targetPinnedToHazard: HAZARD_TILES.some((t) => isAdjacentToTerrain(g, target.x, target.y, t)),
    travel,
    // Traversé les cordes en chemin, sans forcément s'y arrêter : c'est le
    // rebond du catch télévisé.
    crossedRope: !!path && path.length > 1
      && path.slice(0, -1).some((p) => tileAt(g, p.x, p.y) === 'rope'),
    // Arrivé DANS LE DOS, pas simplement hors de son champ de vision. Avec
    // quatre orientations, « tout sauf de face » couvre trois angles sur
    // quatre : le combo se déclenchait sur 76 % des coups, ce n'était plus une
    // récompense mais une prime automatique. Le vrai contournement, c'est
    // l'orientation opposée — un angle sur quatre.
    blindside: !!target.facing && facingTo(target, from) === OPPOSITE[target.facing],
    phase: matchPhase(battle),
  };
}

// Combos déclenchés par un coup qui touche. Les multiplicateurs se cumulent, plafonnés.
export function activeCombos(battle, attacker, target, move, ctx = null) {
  const context = ctx || comboContext(battle, attacker, target, move);
  return COMBOS.filter((c) => {
    try { return c.when(battle, attacker, target, move, context); } catch { return false; }
  });
}
export function comboDamageMult(combos) {
  return Math.min(1.8, combos.reduce((m, c) => m * (c.dmg || 1), 1));
}

export function createBattle({ match, playerTeam, seed = Date.now(), playerBonuses = {} }) {
  const rules = MATCH_TYPES[match.type];
  if (!rules) throw new Error(`Type de match inconnu : ${match.type}`);
  const grid = buildArena(rules.arena);
  const battle = {
    rng: createRng(seed), seed, grid, rules, match, mode: match.mode || 'kayfabe', script: match.script || null, units: [], items: [], turn: 1, phase: 'player', log: [], events: [],
    heat: 10, refDistracted: 0, result: null, lastElimination: null, reinforcementsDone: [],
    // L'arbitre du soir : sa tolérance change d'un match à l'autre, et elle
    // fait partie de ce qu'on lit avant de décider de tricher.
    ref: makeReferee(createRng(seed ^ 0x9e37)),
    stats: { tables: 0, kickouts: 0, tags: 0, weaponsUsed: 0, playerWeaponHits: 0, highSpots: 0, finishers: 0, playerDowned: 0, playerStandUps: 0, playerTaunts: 0, playerTosses: 0, hazardWhips: 0, finisherFinish: false, lastElimReason: null, damageDealt: 0, sells: 0, playerKickouts: 0, playerTookFinisher: 0 },
  };
  battle.api = {
    applyDamage: (t, dmg, src, opts) => applyDamage(battle, t, dmg, src, opts),
    isOutside: (u) => isOutside(grid, u.x, u.y),
  };

  const spawnSet = rules.tag ? SPAWNS.tag : SPAWNS[rules.arena] || SPAWNS.standard;
  const pSpawns = match.playerSpawns || spawnSet.player;
  const eSpawns = match.enemySpawns || (match.type === 'survival' ? SPAWNS.invasion.enemy : spawnSet.enemy);

  playerTeam.forEach((def, i) => {
    const [x, y] = pSpawns[i] || pSpawns[pSpawns.length - 1];
    const u = createUnit(def, 'player', x, y, { bonus: playerBonuses[def.id] || {}, uid: `p${i}-${def.id}` });
    placeUnit(battle, u, x, y);
    battle.units.push(u);
  });
  (match.enemies || []).forEach((e, i) => {
    const spec = typeof e === 'string' ? { id: e } : e;
    const def = WRESTLERS_BY_ID[spec.id];
    if (!def) throw new Error(`Lutteur inconnu : ${spec.id}`);
    const [x, y] = eSpawns[i] || eSpawns[eSpawns.length - 1];
    const u = createUnit(def, 'enemy', x, y, { boost: spec.boost || match.boost || {}, uid: `e${i}-${def.id}` });
    placeUnit(battle, u, x, y);
    battle.units.push(u);
  });
  if (rules.tag) for (const team of ['player', 'enemy']) living(battle, team).forEach((u, i) => { u.legal = i === 0; });

  // Armes cachées sous le ring : il faudra aller les chercher au bord du tablier.
  battle.underRing = rules.underRing ?? 0;
  const nWeapons = rules.weapons || 0;
  WEAPON_SPOTS.filter(([x, y]) => tileAt(grid, x, y) === 'floor').slice(0, nWeapons).forEach(([x, y], i) => {
    battle.items.push({ x, y, weapon: { ...WEAPONS[WEAPON_ORDER[i % WEAPON_ORDER.length]] } });
  });

  log(battle, `🔔 DING DING DING ! ${match.title || rules.name} — ${rules.name}.`, 'big');
  for (const u of battle.units) if (gim(u).onMatchStart) gim(u).onMatchStart(battle, u);
  startPhase(battle, 'player');
  return battle;
}

// Un gabarit 2×2 ne tient pas forcément sur le point d'apparition prévu : on
// cherche la case libre la plus proche où il rentre.
function placeUnit(battle, unit, x, y) {
  unit.x = x; unit.y = y;
  if (fits(battle.grid, battle.units, unit, x, y, { anyUnitBlocks: true })) return true;
  for (let r = 1; r <= 6; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
      if (fits(battle.grid, battle.units, unit, x + dx, y + dy, { anyUnitBlocks: true })) {
        unit.x = x + dx; unit.y = y + dy; return true;
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------- stats & portées
export function getStats(battle, unit) {
  const s = { ...unit.stats };
  const add = (m) => { if (m) for (const [k, v] of Object.entries(m)) s[k] = (s[k] || 0) + v; };
  // L'usure ciblée passe par ici, et seulement par ici : un membre abîmé doit
  // se sentir partout — précision, dégâts, portée de déplacement — sans que
  // chaque appelant ait à y penser.
  add(wearStats(unit));
  if (gim(unit).selfStats) add(gim(unit).selfStats(battle, unit));
  for (const o of living(battle)) if (o !== unit && gim(o).auraStats) add(gim(o).auraStats(battle, o, unit));
  s.def -= unit.statuses.welt || 0;
  for (const k of Object.keys(s)) s[k] = Math.max(0, s[k]);
  return s;
}

export function moveRange(battle, unit) {
  let mov = unit.stats.mov + wearStats(unit).mov;
  if (gim(unit).modMov) mov = gim(unit).modMov(battle, unit, mov);
  if (unit.statuses.dazed) mov -= 2;
  return Math.max(1, mov);
}

export function getReachable(battle, unit) {
  const r = reachable(battle.grid, battle.units, unit, moveRange(battle, unit));
  if (battle.rules.toss) for (const v of r.values()) if (isOutside(battle.grid, v.x, v.y)) v.blocked = true;
  return r;
}

export const MOVE_MOMENTUM_CAP = 5;

export function moveUnit(battle, unit, x, y) {
  if (unit.acted || unit.moved || unit.down || unit.eliminated) return false;
  const reach = getReachable(battle, unit);
  const n = reach.get(key(x, y));
  if (!n || n.blocked) return false;
  unit.prev = { x: unit.x, y: unit.y, facing: unit.facing };
  // Le chemin RÉEL, pas la distance à vol d'oiseau : contourner les marches,
  // c'est courir, et l'élan doit le compter. Le trajet sert aussi aux combos —
  // passer dans les cordes en chemin n'est pas la même chose que s'y arrêter.
  unit.movePath = pathIn(reach, x, y);
  unit.movedTiles = Math.max(0, unit.movePath.length - 1);
  // Se replacer rapporte un peu de jauge, comme une provocation : rester
  // immobile ne doit jamais être le choix confortable.
  unit.moveMomentum = Math.min(MOVE_MOMENTUM_CAP, unit.movedTiles);
  addMomentum(battle, unit, unit.moveMomentum);
  // Courir coûte du souffle. C'est le contrepoids de l'élan : on ne traverse
  // pas l'aréna à chaque tour sans le payer.
  unit.moveStamina = unit.movedTiles * STAMINA_MOVE;
  spendStamina(battle, unit, unit.moveStamina);
  unit.facing = facingTo(unit, { x, y });          // on regarde là où on va
  unit.x = x; unit.y = y; unit.moved = true; unit.climb = 0;
  emit(battle, { type: 'move', uid: unit.uid, x, y });
  if (battle.rules.tag && !unit.legal && !isOutside(battle.grid, x, y) && !isOnRope(battle.grid, x, y) && !isOnTurnbuckle(battle.grid, x, y)) {
    log(battle, `⚠️ ${unit.name} entre dans le ring sans être légal. L’arbitre n’aime pas ça.`);
  }
  return true;
}
export function undoMove(battle, unit) {
  if (!unit.prev || unit.acted) return false;
  unit.x = unit.prev.x; unit.y = unit.prev.y; unit.facing = unit.prev.facing || unit.facing;
  addMomentum(battle, unit, -(unit.moveMomentum || 0));
  unit.stamina = clamp(unit.stamina + (unit.moveStamina || 0), 0, unit.maxStamina);
  unit.prev = null; unit.moved = false; unit.movedTiles = 0;
  unit.movePath = null; unit.moveMomentum = 0; unit.moveStamina = 0;
  return true;
}

// Distance parcourue ce tour, au vrai sens : celle de la tuile candidate
// quand l'IA simule un déplacement, celle déjà faite sinon.
const travelOf = (unit, pos) => (pos && pos.travel != null ? pos.travel : (unit.movedTiles || 0));
const crossedRopeIn = (battle, unit, pos) => {
  const path = (pos && pos.path) || unit.movePath;
  return !!path && path.length > 1
    && path.slice(0, -1).some((p) => tileAt(battle.grid, p.x, p.y) === 'rope');
};

// ---------------------------------------------------------------- le souffle
//
// Ce que coûte un coup, par palier. Un finisher vide un cinquième du souffle :
// on ne le lance pas deux fois de suite, il faut se refaire.
export const STAMINA_COST = { base: 4, class: 7, specialty: 10, signature: 16, finisher: 22 };
export const STAMINA_MOVE = 1;                  // par case parcourue
export const STAMINA_LOW = 25;                  // sous ce seuil, on est cuit
export const STAMINA_REST = 14;                 // en soufflant (attendre, provoquer)
export const STAMINA_TICK = 5;                  // récupération passive par tour

export const STAMINA_SUBMISSION = 6;            // serrer une prise, ça vide
export const staminaCost = (move) => {
  if (!move) return 0;
  const base = STAMINA_COST[move.tier] ?? STAMINA_COST.base;
  // Les mouvements de course coûtent plus : c'est une course, pas un pas.
  // Une prise de soumission aussi, et c'est le vrai garde-fou contre le
  // matraquage : serrer un chinlock à chaque tour essouffle en quatre tours,
  // et à bout de souffle les gros mouvements se referment. C'est un coût
  // SYSTÉMIQUE, pas un malus posé sur la prise — le lutteur qui vit sur ses
  // prises de repos n'a plus de quoi finir le match.
  return base + ((move.requires && move.requires.ran) ? 3 : 0) + (move.type === 'submission' ? STAMINA_SUBMISSION : 0);
};
export const winded = (u) => u.stamina < STAMINA_LOW;
export function spendStamina(battle, unit, n) {
  const avant = unit.stamina;
  unit.stamina = clamp(unit.stamina - n, 0, unit.maxStamina);
  if (avant >= STAMINA_LOW && winded(unit)) {
    log(battle, `😮‍💨 ${unit.name} est à bout de souffle — ses coups portent moins et ses gros mouvements se referment.`);
  }
}

// LA FOULE A DÉJÀ VU CE COUP
//
// Un match est un spectacle : le douzième chinlock ne fait plus lever
// personne. Répéter un mouvement rapporte de moins en moins de momentum et de
// chaleur — c'est la version « public » de la lassitude des prises de
// soumission, et elle s'applique à tout le monde, joueur compris.
//
// Ce n'est pas un malus de dégâts : le coup fait toujours aussi mal. Ce qui
// s'épuise, c'est ce qu'il RACONTE.
export const NOVELTY_DECAY = 0.86, NOVELTY_FLOOR = 0.35;
export const moveUses = (unit, move) => ((unit.memory.used || {})[move.id] || 0);
export const novelty = (unit, move) =>
  Math.max(NOVELTY_FLOOR, Math.pow(NOVELTY_DECAY, moveUses(unit, move)));
function countUse(unit, move) {
  if (!move || !move.id) return;
  unit.memory.used = unit.memory.used || {};
  unit.memory.used[move.id] = moveUses(unit, move) + 1;
}

// ---------------------------------------------------------------- liste des actions
function targetOk(battle, move, e, pos) {
  const req = move.requires || {};
  const g = battle.grid;
  if (req.targetDown && !e.down) return false;
  if (req.targetDownOrDazed && !e.down && !e.statuses.dazed) return false;
  if (req.targetOnRope && tileAt(g, e.x, e.y) !== 'rope') return false;
  if (req.targetDazedOrCorner && !e.statuses.dazed && tileAt(g, e.x, e.y) !== 'turnbuckle') return false;
  if (req.targetNearTable && !isAdjacentToTerrain(g, e.x, e.y, 'table')) return false;
  return true;
}

export function listActions(battle, unit, pos = null) {
  const p = pos || { x: unit.x, y: unit.y };
  const actions = [];
  if (battle.result || unit.eliminated || unit.down) return actions;
  const g = battle.grid, rules = battle.rules;
  const enemies = enemiesOf(battle, unit), allies = alliesOf(battle, unit);
  const tile = tileAt(g, p.x, p.y);
  // Un coin est une jonction de cordes : les mouvements « depuis les cordes » y fonctionnent aussi.
  const onTb = tile === 'turnbuckle', onRope = tile === 'rope' || tile === 'turnbuckle';
  const inRange = (t, [lo, hi]) => { const d = manhattan(p, t); return d >= lo && d <= hi; };
  const wait = { id: 'wait', name: 'Attendre', tier: 'base', type: 'wait', desc: 'Termine le tour de ce lutteur. Récupère 4 PV.', targets: [{ self: true }], ok: true };

  if (unit.onlyPin) {
    const targets = enemies.filter((e) => manhattan(p, e) === 1 && canPin(battle, unit, e).ok).map((e) => ({ unit: e, chance: pinChance(battle, unit, e) }));
    actions.push({ id: 'pin', name: 'COUVRIR !', tier: 'base', type: 'pin', desc: 'Tombé immédiat après le finisher.', targets, ok: targets.length > 0, reason: 'Personne à couvrir' });
    actions.push(wait);
    return actions;
  }

  for (const mid of unit.moves) {
    const m = MOVES[mid];
    if (!m) continue;
    const unlock = moveUnlock(m), cost = moveCost(m);
    const a = { id: mid, name: m.name, tier: m.tier, type: m.type, desc: m.desc || '', cost, unlock, move: m, targets: [], ok: true, reason: '' };
    const req = m.requires || {};
    if (unit.momentum < Math.max(unlock, cost)) { a.ok = false; a.reason = `🔒 Momentum ${Math.max(unlock, cost)} requis (vous : ${unit.momentum})`; }
    else if (req.turnbuckle && !onTb && !unit.flags.ignoreTurnbuckle) { a.ok = false; a.reason = 'Doit être sur un coin'; }
    else if (req.attackerOnRope && !onRope) { a.ok = false; a.reason = 'Doit être sur les cordes'; }
    // `ran` : ce mouvement N'EXISTE PAS sans course. Là où l'élan est un
    // dégradé, c'est un interrupteur — la moitié du catalogue de la vitesse
    // et des cordes ne s'ouvre qu'en mouvement.
    else if (req.ran && travelOf(unit, pos) < req.ran) {
      a.ok = false; a.reason = `Doit avoir couru ${req.ran} cases ce tour (vous : ${travelOf(unit, pos)})`;
    }
    else if (req.crossedRope && !crossedRopeIn(battle, unit, pos)) { a.ok = false; a.reason = 'Doit avoir traversé les cordes en chemin'; }
    // À bout de souffle, les grands mouvements se referment. C'est ce qui
    // impose le rythme : on ne peut pas enchaîner les finishers, il faut
    // reprendre son air — et l'adversaire le voit.
    else if (winded(unit) && ['signature', 'finisher'].includes(m.tier)) {
      a.ok = false; a.reason = `😮‍💨 Trop essoufflé (${Math.round(unit.stamina)}/${STAMINA_LOW} requis)`;
    }
    // UNE JAMBE HORS SERVICE NE VOLE PLUS. C'est la porte que referme l'usure
    // ciblée, et c'est la raison pour laquelle travailler la jambe d'un
    // voltigeur est un plan de match à part entière : on ne lui retire pas des
    // points de vie, on lui retire son vocabulaire.
    else if (m.type === 'aerial' && wearLevel(unit, 'legs') >= 2) {
      a.ok = false; a.reason = '🦵 Jambe hors service — plus question de voler';
    }
    if (m.type === 'taunt') a.targets = [{ self: true }];
    else if (mid === 'whip') {
      a.targets = enemies.filter((e) => manhattan(p, e) === 1 && !e.down && (!gim(e).canBeWhipped || gim(e).canBeWhipped(battle, e))).map((e) => ({ unit: e, hit: hitChance(battle, unit, e, m, { pos: p }) }));
      if (a.ok && !a.targets.length) { a.ok = false; a.reason = 'Aucune cible debout adjacente'; }
    } else if (m.type === 'special') {
      a.targets = enemies.filter((e) => inRange(e, m.range)).map((e) => ({ unit: e }));
    } else {
      a.targets = enemies.filter((e) => inRange(e, m.range) && targetOk(battle, m, e, p)).map((e) => ({ unit: e, hit: hitChance(battle, unit, e, m, { pos: p }) }));
    }
    if (a.ok && !a.targets.length) {
      a.ok = false;
      a.reason = req.targetDownOrDazed ? 'Cible au sol ou étourdie requise' : req.targetDown ? 'Cible au sol requise' : req.targetOnRope ? 'Cible sur les cordes requise' : req.targetNearTable ? 'Cible adjacente à une table requise' : req.targetDazedOrCorner ? 'Cible étourdie ou dans un coin requise' : 'Aucune cible à portée';
    }
    actions.push(a);
  }

  if (unit.weapon) {
    const targets = enemies.filter((e) => manhattan(p, e) === 1).map((e) => ({ unit: e, hit: hitChance(battle, unit, e, weaponMove(battle, unit), { pos: p }) }));
    actions.push({ id: 'weapon', name: `${unit.weapon.icon} Frapper : ${unit.weapon.name} (${unit.weapon.uses})`, tier: 'base', type: 'weapon', move: weaponMove(battle, unit), desc: rules.dq ? 'Gros dégâts. Illégal : risque de DQ si l’arbitre regarde.' : 'Gros dégâts. Légal ici.', targets, ok: targets.length > 0, reason: 'Aucune cible adjacente' });
  }
  if (!rules.noPin) {
    const targets = enemies.filter((e) => manhattan(p, e) === 1 && canPin(battle, unit, e).ok).map((e) => ({ unit: e, chance: pinChance(battle, unit, e) }));
    let reason = 'Aucune cible adjacente';
    const adj = enemies.find((e) => manhattan(p, e) === 1);
    if (adj) reason = canPin(battle, unit, adj).reason || reason;
    actions.push({ id: 'pin', name: 'Tombé (1-2-3)', tier: 'base', type: 'pin', desc: 'Tenter le tombé. Bien plus efficace sur une cible au sol ou après un finisher. Chaque kick-out use le cœur de la cible.', targets, ok: targets.length > 0, reason });
  }
  if (rules.toss) {
    const targets = enemies.filter((e) => manhattan(p, e) === 1 && ['rope', 'turnbuckle'].includes(tileAt(g, e.x, e.y))).map((e) => ({ unit: e, chance: tossChance(battle, unit, e) }));
    actions.push({ id: 'toss', name: 'Jeter par-dessus la corde', tier: 'base', type: 'toss', desc: 'La cible doit être sur les cordes ou dans un coin. Plus facile si elle est affaiblie ou au sol.', targets, ok: targets.length > 0, reason: 'Cible adjacente sur les cordes requise' });
  }
  // RENTRER DANS LE RING
  //
  // Sans cette action, un lutteur jeté au plancher pouvait être PHYSIQUEMENT
  // incapable de remonter : le tablier coûte trois points de déplacement et le
  // tapis un quatrième, si bien qu'un lutteur étourdi (-2) ou à la jambe
  // abîmée (-1) restait bloqué dehors à se faire compter — pendant que
  // l'adversaire, penché par-dessus la corde, continuait de le frapper. C'est
  // ce qui produisait un match sur sept par décompte.
  //
  // Se rouler sous la corde du bas n'est pas un exploit athlétique : c'est ce
  // que fait n'importe qui. Ça coûte le tour, pas la portée.
  const rentree = rollInTarget(battle, unit, p);
  if (rentree) {
    actions.push({
      id: 'rollin', name: '↩️ Rentrer dans le ring', tier: 'base', type: 'rollin',
      desc: 'Se rouler sous la corde du bas. Termine le tour, mais remet fin au décompte.',
      targets: [{ self: true }], ok: true, dest: rentree,
    });
  }
  const item = battle.items.find((i) => i.x === p.x && i.y === p.y);
  if (item && !unit.weapon) actions.push({ id: 'pickup', name: `${item.weapon.icon} Ramasser : ${item.weapon.name}`, tier: 'base', type: 'pickup', desc: `+${item.weapon.power} dégâts, ${item.weapon.uses} utilisations.`, targets: [{ self: true }], ok: true });
  // Sous le ring : accessible depuis l'extérieur, au bord du tablier.
  if (battle.underRing > 0 && !unit.weapon) {
    const apron = isOutside(g, p.x, p.y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => ['rope', 'turnbuckle'].includes(tileAt(g, p.x + dx, p.y + dy)));
    actions.push({
      id: 'scavenge', name: '🔦 Chercher sous le ring', tier: 'base', type: 'scavenge',
      desc: battle.rules.dq
        ? 'Sortez une arme de sous le tablier. La chercher est légal ; s’en servir devant l’arbitre, non.'
        : 'Sortez une arme de sous le tablier. Tout est légal ici.',
      targets: [{ self: true }], ok: apron, reason: apron ? null : 'Il faut être à l’extérieur, contre le tablier du ring',
    });
  }
  if (rules.tag && unit.legal) {
    const partners = allies.filter((a) => !a.legal && !a.down && manhattan(p, a) === 1).map((u) => ({ unit: u }));
    actions.push({ id: 'tag', name: '🤝 Tag !', tier: 'base', type: 'tag', desc: 'Passe le relais à un partenaire adjacent : il devient légal, soigne 15 % et gagne 30 momentum.', targets: partners, ok: partners.length > 0, reason: 'Partenaire non adjacent' });
  }
  // Grimper avec une jambe morte, non plus : dans un match d'échelle, travailler
  // la jambe EST la façon de gagner.
  const jambeHs = wearLevel(unit, 'legs') >= 2;
  if (rules.cage && onTb) actions.push({ id: 'climb', name: `🧗 Escalader la cage (${unit.climb}/2)`, tier: 'base', type: 'climb', desc: 'Deux tours consécutifs sans subir de dégâts pour s’évader.', targets: [{ self: true }], ok: !jambeHs, reason: '🦵 Jambe hors service — impossible de grimper' });
  if (rules.victory === 'belt' && tile === 'ladder') actions.push({ id: 'climb', name: `🪜 Grimper l’échelle (${unit.climb}/2)`, tier: 'base', type: 'climb', desc: 'Deux tours consécutifs sans subir de dégâts pour décrocher la ceinture.', targets: [{ self: true }], ok: !jambeHs, reason: '🦵 Jambe hors service — impossible de grimper' });
  if (battle.mode === 'scenario' && unit.team === 'player') {
    actions.push({ id: 'sell', name: '🎭 Vendre (prendre un bump)', tier: 'script', type: 'sell', desc: 'Spot coopératif : perd 8 % PV, +12 chaleur, +10 momentum aux ennemis adjacents. Compte pour le script.', targets: [{ self: true }], ok: hpRatio(unit) > 0.12, reason: 'Trop amoché pour vendre' });
    const fin = (battle.script && battle.script.finish) || {};
    if (fin.winner === 'enemy') {
      const method = fin.method || 'any';
      const adj = enemies.filter((e) => manhattan(p, e) === 1 && !e.down);
      let ok = adj.length > 0, reason = 'Adversaire adjacent requis';
      if (ok && fin.finisher && !unit.statuses.finished) { ok = false; reason = 'Le script exige d’encaisser son finisher d’abord'; }
      if (ok && method === 'toss' && !['rope', 'turnbuckle'].includes(tile)) { ok = false; reason = 'Doit être sur les cordes'; }
      if (ok && method === 'pin' && rules.noPin) { ok = false; reason = 'Pas de tombé dans ce match'; }
      const label = method === 'submission' ? 'Abandonner (faire le job)' : method === 'toss' ? 'Passer par-dessus la corde (faire le job)' : 'Prendre le tombé (faire le job)';
      actions.push({ id: 'job', name: `📜 ${label}`, tier: 'script', type: 'job', desc: 'Le finish prévu par le script : votre lutteur perd volontairement. Réalisez les spots avant !', targets: adj.map((e) => ({ unit: e })), ok, reason });
    }
  }
  actions.push(wait);
  return actions;
}

// La case de ring libre la plus proche, quand on est au plancher contre le
// tablier. `null` si on n'est pas dehors, pas au bord, ou si tout est occupé.
function rollInTarget(battle, unit, p) {
  const g = battle.grid;
  if (!isOutside(g, p.x, p.y)) return null;
  const auBord = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    .some(([dx, dy]) => ['rope', 'turnbuckle'].includes(tileAt(g, p.x + dx, p.y + dy)));
  if (!auBord) return null;
  let best = null, bd = Infinity;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (tileAt(g, x, y) !== 'ring') continue;
    const d = manhattan(p, { x, y });
    if (d >= bd) continue;
    if (!fits(g, battle.units, unit, x, y, { anyUnitBlocks: true })) continue;
    bd = d; best = { x, y };
  }
  return best;
}

function weaponMove(battle, unit) {
  const w = unit.weapon;
  return { id: 'weapon', name: w.name, tier: 'base', type: 'weapon', stat: 'str', power: w.power, acc: 85, range: [1, 1], momentum: 12, effects: { illegal: !!battle.rules.dq } };
}

// ---------------------------------------------------------------- exécution
export function executeAction(battle, unit, actionId, target = null) {
  const a = listActions(battle, unit).find((x) => x.id === actionId);
  if (!a) return { ok: false, reason: 'Action inconnue' };
  if (!a.ok) return { ok: false, reason: a.reason };
  let tgt = null;
  if (target && target.unit) {
    tgt = target.unit;
    if (!a.targets.some((t) => t.unit === tgt)) return { ok: false, reason: 'Cible invalide' };
  } else if (a.targets.length && a.targets[0].unit) {
    return { ok: false, reason: 'Cible requise' };
  }
  // On se tourne vers sa cible avant d'agir : le sprite suit le regard.
  if (tgt) unit.facing = facingTo(unit, tgt);
  let result = {};
  switch (a.type) {
    case 'taunt': result = doTaunt(battle, unit, a.move); break;
    case 'special': result = a.id === 'whip' ? irishWhip(battle, unit, tgt, a.move) : doSpecial(battle, unit, tgt, a.move); break;
    case 'pin': result = attemptPin(battle, unit, tgt); break;
    case 'toss': result = attemptToss(battle, unit, tgt); break;
    case 'weapon': {
      result = resolveAttack(battle, unit, tgt, a.move);
      if (unit.weapon) { unit.weapon.uses -= 1; if (unit.weapon.uses <= 0) { log(battle, `${unit.weapon.name} de ${unit.name} se brise.`); unit.weapon = null; } }
      break;
    }
    case 'scavenge': {
      if (battle.underRing > 0) {
        battle.underRing--;
        const pool = WEAPON_ORDER.filter((w) => WEAPONS[w]);
        const pick = pool[Math.floor(battle.rng.next() * pool.length)] || 'chair';
        unit.weapon = { ...WEAPONS[pick] };
        addHeat(battle, 8);
        log(battle, `🔦 ${unit.name} plonge sous le ring et en ressort ${unit.weapon.name} ! (${battle.underRing} objet(s) restant(s))`, 'big');
      }
      break;
    }
    case 'pickup': {
      const idx = battle.items.findIndex((i) => i.x === unit.x && i.y === unit.y);
      if (idx >= 0) { unit.weapon = battle.items[idx].weapon; battle.items.splice(idx, 1); log(battle, `${unit.name} ramasse ${unit.weapon.name}.`); }
      break;
    }
    case 'rollin': {
      const d = a.dest;
      unit.x = d.x; unit.y = d.y; unit.climb = 0; unit.outsideCount = 0;
      unit.facing = facingTo(unit, enemiesOf(battle, unit)[0] || d);
      emit(battle, { type: 'move', uid: unit.uid, x: d.x, y: d.y });
      log(battle, `↩️ ${unit.name} se roule sous la corde du bas et revient dans le ring.`);
      break;
    }
    case 'tag': result = tagPartner(battle, unit, tgt); break;
    case 'climb': result = doClimb(battle, unit); break;
    case 'wait': heal(battle, unit, 4); unit.rested = true; break;
    case 'sell': {
      applyDamage(battle, unit, unit.maxHp * 0.08, null, { self: true });
      addHeat(battle, 12); battle.stats.sells++;
      for (const e of unitsWithin(battle, unit, 1).filter((x) => x.team !== unit.team)) addMomentum(battle, e, 10);
      log(battle, `🎭 ${unit.name} vend le coup comme un pro. La foule y croit.`);
      break;
    }
    case 'job': {
      const method = (battle.script.finish.method || 'any');
      const reason = method === 'submission' ? 'submission' : method === 'toss' ? 'toss' : 'pin';
      battle.stats.finisherFinish = hasStatus(unit, 'finished');
      log(battle, reason === 'submission' ? `🏳️ ${unit.name} tape. ${tgt.name} gagne, comme prévu au script.` : reason === 'toss' ? `🚀 ${unit.name} passe par-dessus la corde. ${tgt.name} gagne, comme prévu.` : `UN ! DEUX ! TROIS ! ${unit.name} fait le job pour ${tgt.name}.`, 'big');
      addHeat(battle, 15);
      eliminate(battle, unit, reason);
      break;
    }
    default: result = resolveAttack(battle, unit, tgt, a.move); break;
  }
  if (result && result.freePin) { unit.acted = false; unit.onlyPin = true; }
  else { unit.acted = true; unit.onlyPin = false; }
  unit.prev = null;
  checkWin(battle);
  return { ok: true, ...result };
}

function doTaunt(battle, unit, move) {
  // Provoquer, c'est aussi reprendre son air : le lutteur qui joue avec la
  // foule est celui qui souffle. Les deux vont ensemble dans le vrai catch.
  unit.rested = true;
  addMomentum(battle, unit, move.momentum || 30);
  const eff = move.effects || {};
  addHeat(battle, Math.round(getStats(battle, unit).cha / 3) + (eff.heat || 0));
  if (eff.distractRef) { battle.refDistracted = eff.distractRef + 1; log(battle, `👀 ${unit.name} distrait l’arbitre. Il ne verra rien pendant un moment.`); }
  if (eff.allyMomentum) for (const a of unitsWithin(battle, unit, 2, unit.team)) addMomentum(battle, a, eff.allyMomentum);
  if (unit.team === 'player') battle.stats.playerTaunts++;
  log(battle, `📣 ${unit.name} : ${move.name} ! (+${move.momentum} momentum)`);
  if (gim(unit).onTaunt) gim(unit).onTaunt(battle, unit);
  emit(battle, { type: 'taunt', x: unit.x, y: unit.y });
  return {};
}

function doSpecial(battle, unit, target, move) {
  const eff = move.effects || {};
  if (eff.drainMomentum) { addMomentum(battle, target, -eff.drainMomentum); addMomentum(battle, unit, 10); addHeat(battle, 3); log(battle, `🗯️ ${unit.name} insulte ${target.name} : -${eff.drainMomentum} momentum.`); }
  return {};
}

export function hitChance(battle, attacker, target, move, opts = {}) {
  if (target.down) return 100;
  // `pos` : la case d'où le coup partira (l'IA et la prévision évaluent des
  // déplacements pas encore joués ; sans ça, l'avantage de hauteur serait
  // calculé depuis la position actuelle).
  const from = opts.pos || attacker;
  const A = getStats(battle, attacker), D = getStats(battle, target);
  // L'écart d'agilité est plafonné : un colosse touche encore un voltigeur.
  // Une prise s'esquive moins bien qu'une frappe : quand on est attrapé, on est attrapé.
  const grabby = move.type === 'grapple' || move.type === 'submission';
  let c = (move.acc ?? 90) + clamp(A.agi - D.agi, -12, 12) * (grabby ? 1.2 : 2.2);
  if (target.statuses.dazed) c += 25;
  // Le relief compte : frapper d'en haut est plus facile, d'en bas plus dur.
  c += clamp(heightAt(battle.grid, from.x, from.y) - heightAt(battle.grid, target.x, target.y), -3, 3) * 6;
  if (attacker.statuses.cursed) c -= 25;
  if (attacker.statuses.dazed) c -= 10;
  if (winded(attacker)) c -= 10;
  // Un bras hors service ne tient pas une prise : c'est la contrepartie
  // directe du travail au bras, et elle ne touche que ce qui s'attrape.
  if (grabby) c -= wearLevel(attacker, 'arms') * 7;
  if (gim(attacker).modHitChance) c = gim(attacker).modHitChance(battle, attacker, attacker, target, move, c, 'attacker');
  if (gim(target).modHitChance) c = gim(target).modHitChance(battle, target, attacker, target, move, c, 'target');
  return clamp(Math.round(c), 25, 100);
}

// LE POIDS D'UN COUP
//
// Un match doit tenir trente tours, pas quinze. Le levier n'est pas la barre
// de PV — l'allonger rend les coups mous et la lecture pénible — mais ce que
// chaque coup y prend. À 27 % de la barre, quatre coups suffisaient : il n'y
// avait pas de place pour une histoire.
//
// Le facteur s'applique à la fin, sur le total, pour que la STRUCTURE reste
// intacte : un critique vaut toujours une fois et demie la moyenne du moment,
// un finisher domine toujours une prise de base. On raccourcit le pas, pas la
// foulée.
export const DAMAGE_SCALE = 0.5;

export function computeDamage(battle, attacker, target, move, opts = {}) {
  const A = getStats(battle, attacker), D = getStats(battle, target);
  const eff = move.effects || {};
  const pos = opts.pos || attacker;
  const atk = A[move.stat || 'str'];
  let dmg = (move.power || 0) + atk * 1.3 - D.def * 0.9 * (eff.ignoreDef ? 1 - eff.ignoreDef : 1);
  // Un mouvement aérien tire sa force du dénivelé : depuis un coin (3) sur une
  // cible au tapis (2), c'est +1 ; depuis le tablier vers le plancher, c'est +2.
  const drop = heightAt(battle.grid, pos.x, pos.y) - heightAt(battle.grid, target.x, target.y);
  if (move.type === 'aerial' && drop > 0) dmg *= 1 + Math.min(3, drop) * 0.22;
  else if (drop > 0) dmg *= 1 + Math.min(3, drop) * 0.07;
  if (eff.charge && (opts.travel ?? attacker.movedTiles) >= 3) dmg += 8;
  // L'élan : le trajet de ce tour-ci pèse sur le coup qui le termine.
  dmg *= elanMult(opts.travel ?? attacker.movedTiles, move, attacker);
  // À bout de souffle, on frappe sans appui.
  if (winded(attacker)) dmg *= 0.75;
  // ON TAPE SUR LA ROUE VOILÉE. Frapper un membre déjà entamé fait un peu plus
  // mal que frapper du neuf : c'est le paiement de l'usure ciblée pour qui n'a
  // pas de prise de soumission. Volontairement modeste — à 15 %, les matchs
  // perdaient quatre tours sans gagner une seule chute de plus : ça les
  // raccourcissait au lieu de les densifier.
  dmg *= 1 + wearLevel(target, movePart(move)) * 0.07;
  // Les bonus « cible au sol » et « cible étourdie » passent désormais par les combos.
  if (gim(attacker).modOutDamage) dmg = gim(attacker).modOutDamage(battle, attacker, target, move, dmg);
  if (gim(target).modInDamage) dmg = gim(target).modInDamage(battle, target, attacker, move, dmg);
  const phase = matchPhase(battle);
  dmg *= 0.8 * phase.dmg * (isFlashy(move) ? phase.flashy : 1);
  dmg *= comboDamageMult(activeCombos(battle, attacker, target, move, opts.ctx || comboContext(battle, attacker, target, move, pos)));
  let crit = false;
  if (!opts.noRng) {
    if (battle.rng.chance(0.04 + A.tec * 0.007)) { crit = true; dmg *= 1.5; }
    dmg *= 0.9 + battle.rng.next() * 0.2;
  }
  return { dmg: Math.max(1, Math.round(dmg * DAMAGE_SCALE)), crit };
}

// LE RENVERSEMENT
//
// « Il l'a renversé ! » — c'est le moment le plus fiable du catch, et le
// moteur ne l'avait pas. Sans lui, lancer son finisher n'est jamais un pari :
// on attend d'avoir la jauge et on appuie. Avec lui, un gros mouvement lancé
// sur un adversaire encore frais peut se retourner contre son auteur.
//
// Trois choses le rendent probable, et ce sont trois décisions :
//   · la VITESSE et la TECHNIQUE du défenseur contre celles de l'attaquant ;
//   · le SOUFFLE — on ne renverse pas à bout de forces, et on se fait
//     renverser quand on frappe sans appui ;
//   · la TAILLE du mouvement. Un gros coup est lent : c'est justement le
//     finisher qui se renverse, pas le coup de poing.
//
// Une cible au sol ou étourdie ne renverse rien : sinon le knockdown ne
// voudrait plus rien dire.
const REVERSE_BY_TIER = { base: 0.02, class: 0.05, specialty: 0.07, signature: 0.11, finisher: 0.15 };

export function reverseChance(battle, attacker, target, move) {
  if (!move || target.down || target.statuses.dazed || target.eliminated) return 0;
  if (['taunt', 'special'].includes(move.type)) return 0;
  const A = getStats(battle, attacker), D = getStats(battle, target);
  let c = REVERSE_BY_TIER[move.tier] ?? REVERSE_BY_TIER.base;
  c += clamp((D.tec + D.agi) - (A.tec + A.agi), -8, 8) * 0.006;
  if (winded(attacker)) c += 0.05;              // il frappe sans appui
  if (winded(target)) c -= 0.04;                // il n'a plus les jambes
  if (target.statuses.finished) c -= 0.05;      // encore sonné par le dernier gros coup
  c -= wearReversePenalty(target);              // on ne renverse pas avec un bras mort
  return clamp(c, 0, 0.35);
}

export function resolveAttack(battle, attacker, target, move) {
  spendStamina(battle, attacker, staminaCost(move));
  // Le renversement se joue AVANT le jet de précision : ce n'est pas un coup
  // raté, c'est un coup retourné.
  const rev = reverseChance(battle, attacker, target, move);
  if (rev > 0 && battle.rng.chance(rev)) {
    const { dmg } = computeDamage(battle, target, attacker, move, { noRng: true });
    const riposte = Math.max(1, Math.round(dmg * 0.6));
    log(battle, `🔄 RENVERSÉ ! ${target.name} retourne ${move.name} contre ${attacker.name} : ${riposte} dégâts.`, 'big');
    emit(battle, { type: 'reverse', x: attacker.x, y: attacker.y });
    applyDamage(battle, attacker, riposte, target, { move });
    addMomentum(battle, target, 20);
    addHeat(battle, 12);
    battle.stats.reversals = (battle.stats.reversals || 0) + 1;
    checkWin(battle);
    return { hit: false, reversed: true, chance: rev };
  }
  // On se tourne vers qui on frappe. Sans ça, un lutteur gardait l'orientation
  // de son dernier déplacement : son dos traînait dans n'importe quelle
  // direction et « Pris à revers » se déclenchait par accident une fois sur
  // deux. Le contournement ne vaut que si la cible regarde vraiment ailleurs.
  attacker.facing = facingTo(attacker, target);
  attacker.momentum = Math.max(0, attacker.momentum - moveCost(move));
  if (!target.down && gim(target).onAttacked && gim(target).onAttacked(battle, target, attacker, move)) {
    checkWin(battle);
    return { countered: true };
  }
  const chance = hitChance(battle, attacker, target, move);
  if (battle.rng.next() * 100 >= chance) {
    log(battle, `${attacker.name} rate ${move.name} sur ${target.name} (${chance} %).`, 'miss');
    emit(battle, { type: 'miss', x: target.x, y: target.y });
    const eff = move.effects || {};
    if (eff.selfDamageOnMiss) { log(battle, `${attacker.name} s’écrase au sol ! (-${eff.selfDamageOnMiss})`); applyDamage(battle, attacker, eff.selfDamageOnMiss, null, { self: true }); }
    if (gim(attacker).onMiss) gim(attacker).onMiss(battle, attacker, target, move);
    addHeat(battle, -2);
    return { hit: false, chance };
  }
  const ctx = comboContext(battle, attacker, target, move);
  const combos = activeCombos(battle, attacker, target, move, ctx);
  const { dmg, crit } = computeDamage(battle, attacker, target, move, { ctx });
  const eff = move.effects || {};
  const wasDown = target.down;
  const fromCorner = move.type === 'aerial' && isOnTurnbuckle(battle.grid, attacker.x, attacker.y);
  log(battle, `${attacker.name} → ${move.name} sur ${target.name} : ${dmg} dégâts${crit ? ' — CRITIQUE !' : ''}${fromCorner ? ' (depuis le coin !)' : ''}`, move.tier === 'finisher' ? 'finisher' : crit ? 'crit' : '');
  applyDamage(battle, target, dmg, attacker, { move, crit });
  const phase = matchPhase(battle);
  const neuf = novelty(attacker, move);
  countUse(attacker, move);
  addMomentum(battle, attacker, Math.round((move.momentum ?? 10) * phase.momentum * neuf));
  addMomentum(battle, target, 5);
  for (const c of combos) {
    if (c.momentum) addMomentum(battle, attacker, c.momentum);
    if (c.heat) addHeat(battle, Math.round(c.heat * phase.heat));
  }
  if (combos.length) {
    log(battle, `${combos.map((c) => `${c.icon} ${c.name}`).join(' + ')} !`, 'combo');
    emit(battle, { type: 'combo', x: target.x, y: target.y, names: combos.map((c) => c.name) });
  }
  const baseHeat = move.tier === 'finisher' ? 15 : move.tier === 'signature' ? 8 : move.type === 'aerial' ? 6 : 2;
  addHeat(battle, Math.round((baseHeat + (eff.heat || 0)) * phase.heat * neuf));
  if (eff.selfMomentum) addMomentum(battle, attacker, eff.selfMomentum);
  if (fromCorner) { battle.stats.highSpots++; }
  if (move.type === 'weapon') { battle.stats.weaponsUsed++; if (attacker.team === 'player') battle.stats.playerWeaponHits++; }
  if (!target.eliminated) {
    if (eff.daze) setStatus(battle, target, 'dazed', eff.daze + 1);
    if (eff.welt) addStatus(battle, target, 'welt', eff.welt, 4);
    if (eff.push) pushUnit(battle, target, Math.sign(target.x - attacker.x), Math.sign(target.y - attacker.y), eff.push, attacker);
    // Attirer : le recul à l'envers. Arrache l'adversaire des cordes, le sort
    // d'un coin, le ramène au centre — la position se dispute dans les deux
    // sens, pas seulement en se repoussant.
    if (eff.pull) pushUnit(battle, target, Math.sign(attacker.x - target.x), Math.sign(attacker.y - target.y), eff.pull, attacker);
    if (eff.breakTable) {
      const n = battle.grid;
      for (const [nx, ny] of [[target.x + 1, target.y], [target.x - 1, target.y], [target.x, target.y + 1], [target.x, target.y - 1]]) {
        if (tileAt(n, nx, ny) === 'table') { setTile(n, nx, ny, 'debris'); battle.stats.tables++; addHeat(battle, 25); log(battle, `💥 ${target.name} PASSE À TRAVERS LA TABLE !!!`, 'big'); break; }
      }
    }
  }
  // ---------------------------------------------------- portée élargie
  // Les coups qui ne touchent pas qu'une personne. Ils font du PLACEMENT une
  // question défensive : rester aligné ou agglutiné coûte cher, et pas
  // seulement pour celui qu'on visait.
  spreadHit(battle, attacker, target, move, dmg);
  if (eff.selfDamage) applyDamage(battle, attacker, eff.selfDamage, null, { self: true, silent: true });
  let freePin = false;
  if (move.tier === 'finisher' && !target.eliminated) {
    setStatus(battle, target, 'finished', 2);
    battle.stats.finishers++;
    if (target.team === 'player') battle.stats.playerTookFinisher++;
    if (target.down && !battle.rules.noPin && manhattan(attacker, target) === 1 && canPin(battle, attacker, target).ok) { freePin = true; log(battle, `${attacker.name} peut couvrir immédiatement !`); }
  }
  if (move.type === 'submission' && !target.eliminated) attemptSubmission(battle, attacker, target, move);
  attacker.memory.lastHit = { uid: target.uid, type: move.type };
  if (gim(attacker).onHit) gim(attacker).onHit(battle, attacker, target, move, dmg);
  if (eff.illegal && !target.eliminated) checkDq(battle, attacker, 0.35, move.name);
  if (battle.rules.tag && !attacker.legal && !attacker.eliminated) checkDq(battle, attacker, 0.25, 'attaque sans être légal');
  checkWin(battle);
  return { hit: true, dmg, crit, chance, freePin: freePin && !battle.result && !attacker.eliminated };
}

// PORTÉE ÉLARGIE : LIGNE, ZONE, RECUL
//
// `line: n`    le coup continue tout droit derrière la cible sur n cases.
// `splash: f`  les voisins de la cible prennent la fraction f des dégâts.
// `push: n`    la cible recule de n cases — déjà géré plus haut, mais c'est
//              la même famille : ce que le coup fait à la GRILLE, pas
//              seulement aux points de vie.
//
// Les dégâts secondaires ne sont pas recalculés coup par coup : ils dérivent
// de ce qu'a encaissé la cible principale. Recalculer ferait intervenir la
// défense et les gimmicks de chacun, donc des combos en cascade et un coût en
// O(n²) pour un effet que personne ne peut anticiper à l'écran.
const SPLASH_DEFAULT = 0.5, LINE_FALLOFF = 0.7;

function spreadHit(battle, attacker, target, move, dmg) {
  const eff = move.effects || {};
  if (!eff.line && !eff.splash) return;
  const touched = [];
  if (eff.line) {
    // La direction du coup, prolongée : c'est l'axe attaquant → cible.
    const dx = Math.sign(target.x - attacker.x), dy = Math.sign(target.y - attacker.y);
    if (dx || dy) {
      let part = dmg;
      for (let i = 1; i <= eff.line; i++) {
        part = Math.round(part * LINE_FALLOFF);
        if (part < 1) break;
        const u = unitAt(battle, target.x + dx * i, target.y + dy * i);
        if (!u || u === attacker || u.eliminated || touched.some((t) => t.u === u)) continue;
        touched.push({ u, part });
      }
    }
  }
  if (eff.splash) {
    const frac = eff.splash === true ? SPLASH_DEFAULT : eff.splash;
    const part = Math.round(dmg * frac);
    if (part >= 1) {
      for (const u of unitsWithin(battle, target, 1)) {
        if (u === attacker || u === target || u.eliminated || touched.some((t) => t.u === u)) continue;
        touched.push({ u, part });
      }
    }
  }
  for (const { u, part } of touched) {
    log(battle, `↳ ${u.name} est pris dans le mouvement : ${part} dégâts.`);
    emit(battle, { type: 'splash', x: u.x, y: u.y });
    applyDamage(battle, u, part, attacker, { move: { ...move, type: 'collision' } });
  }
  if (touched.length) addHeat(battle, 4);
}

export function applyDamage(battle, target, amount, source, opts = {}) {
  if (target.eliminated) return 0;
  amount = Math.max(0, Math.round(amount));
  target.hp = Math.max(0, target.hp - amount);
  target.climb = 0;
  emit(battle, { type: 'damage', x: target.x, y: target.y, amount, crit: !!opts.crit });
  // L'USURE S'ACCUMULE ICI, au seul endroit où passent tous les dégâts : les
  // coups, les éclaboussures, les collisions, les marches d'acier. Elle est
  // proportionnelle à ce qui a été encaissé, plus le bonus propre au
  // mouvement — c'est ce qui distingue un coup dans le genou d'un coup de
  // poing qui atterrit sur la même jambe par hasard.
  if (!opts.self && amount > 0) {
    const u = wearFrom(opts.move, amount);
    const crossed = u && addWear(target, u.part, u.n);
    if (crossed) {
      log(battle, crossed.level >= 2
        ? `${crossed.icon} ${crossed.name.toUpperCase()} HORS SERVICE ! ${target.name} ${crossed.broken}.`
        : `${crossed.icon} ${target.name} ${crossed.hurt} — sa ${crossed.short} a pris.`, crossed.level >= 2 ? 'big' : '');
    }
  }
  if (source && gim(target).onDamaged) gim(target).onDamaged(battle, target, source, opts.move, amount);
  if (source && source.team === 'player') battle.stats.damageDealt += amount;
  if (target.hp <= 0 && !target.down) downUnit(battle, target);
  return amount;
}

function downUnit(battle, unit) {
  if (gim(unit).beforeDown && gim(unit).beforeDown(battle, unit)) return;
  unit.down = true; unit.downTurns = 0; unit.hp = 0; unit.climb = 0;
  delete unit.statuses.dazed;
  if (unit.grit <= 0 && !battle.rules.noPin && scriptAllowsElimination(battle, unit, 'stoppage')) {
    log(battle, `🛑 ARRÊT DE L’ARBITRE ! ${unit.name} n’a plus rien à donner.`, 'big');
    addHeat(battle, 15);
    eliminate(battle, unit, 'stoppage');
    return;
  }
  if (unit.team === 'player') battle.stats.playerDowned++;
  log(battle, `💫 ${unit.name} est au sol !`, 'down');
  emit(battle, { type: 'down', x: unit.x, y: unit.y });
  addHeat(battle, 5);
}

function standUp(battle, u) {
  u.down = false; u.downTurns = 0;
  // Le second souffle. À 30 % on repartait avec une vie et demie de coup : le
  // lutteur se relevait pour se faire remettre au sol aussitôt. À 55 % il a de
  // quoi raconter une reprise — et il lui reste un cœur de moins pour le faire.
  // Une jambe hors service ne relève pas son homme : le second souffle est
  // amputé. C'est le paiement du travail de jambe pour qui n'a pas de prise
  // de soumission — on ne finit pas l'adversaire, on l'empêche de revenir.
  const jambe = wearLevel(u, 'legs') >= 2 ? 0.38 : 0.55;
  u.hp = Math.max(1, Math.round(u.maxHp * jambe) + u.grit * 3);
  u.grit = Math.max(0, u.grit - 1);
  addMomentum(battle, u, 25);
  if (u.team === 'player') battle.stats.playerStandUps++;
  log(battle, `🔥 ${u.name} se relève ! (${u.hp} PV, cœur ${u.grit})`, 'standup');
  addHeat(battle, 8);
  if (gim(u).onStandUp) gim(u).onStandUp(battle, u);
}

export function eliminate(battle, unit, reason) {
  if (unit.eliminated) return;
  unit.eliminated = true; unit.elimReason = reason; unit.down = false;
  battle.lastElimination = unit;
  battle.stats.lastElimReason = reason;
  emit(battle, { type: 'eliminated', x: unit.x, y: unit.y, uid: unit.uid });
  checkWin(battle);
}

// ---------------------------------------------------------------- tombé / soumission / toss
export function canPin(battle, pinner, target) {
  const r = battle.rules;
  if (r.noPin) return { ok: false, reason: 'Pas de tombé dans ce match' };
  if (r.tag && !pinner.legal) return { ok: false, reason: 'Vous n’êtes pas le lutteur légal' };
  if (r.tag && !target.legal) return { ok: false, reason: 'La cible n’est pas le lutteur légal' };
  if (r.countOut > 0 && isOutside(battle.grid, target.x, target.y)) return { ok: false, reason: 'Le tombé ne compte que dans le ring' };
  if (!target.down && !target.statuses.finished && hpRatio(target) > 0.6) return { ok: false, reason: 'La cible est trop fraîche (au sol, sous 60 % PV ou après un finisher)' };
  return { ok: true };
}

// Mode Scénarios : l'adversaire « travaille » le match. Une élimination du joueur qui contredit le script
// reste possible (un « shoot »), mais bien moins probable.
export function scriptAllowsElimination(battle, target, method) {
  if (battle.mode !== 'scenario' || !battle.script || target.team !== 'player') return true;
  const fin = battle.script.finish || {};
  if (fin.winner !== 'enemy') return false;
  if (fin.method && fin.method !== 'any' && fin.method !== method) return false;
  if (fin.finisher && !target.statuses.finished) return false;
  return true;
}
const SCRIPT_PENALTY = 0.3;

// LE TOMBÉ EST UNE HISTOIRE, PAS UN JET DE DÉ
//
// Un tombé à froid ne marche jamais : c'est le principe même du catch. Ce qui
// décide, c'est le CŒUR — combien de fois l'adversaire s'est déjà relevé. La
// première couverture doit se solder par un kick-out à un, la dernière par un
// silence dans la salle.
//
// Avant, une cible au sol partait à 55 % : le premier knockdown finissait le
// match. Sur 60 matchs simulés, il y avait exactement UNE chute par match et
// tout se terminait au premier tombé — un match de catch qui dure six tours.
export function pinChance(battle, pinner, target) {
  const gritLeft = target.maxGrit ? target.grit / target.maxGrit : 0;
  // Couvrir quelqu'un DEBOUT n'est pas un tombé, c'est un roll-up désespéré :
  // ça reste marginal quoi qu'il arrive. Tous les bonus — momentum, phase,
  // finisher — ne s'appliquent qu'à une cible au sol. Sans cette séparation,
  // un bonus de phase de +0,12 posé sur une base de 0,12 la doublait, et les
  // matchs se terminaient sur une couverture à 34 % d'un adversaire debout
  // qui n'était jamais tombé.
  if (!target.down) {
    let r = 0.02 + (1 - hpRatio(target)) * 0.08;
    if (gim(pinner).modPinChance) r = gim(pinner).modPinChance(battle, pinner, pinner, target, r, 'pinner');
    if (gim(target).modPinChance) r = gim(target).modPinChance(battle, target, pinner, target, r, 'target');
    if (!scriptAllowsElimination(battle, target, 'pin')) r *= SCRIPT_PENALTY;
    return clamp(r, 0.02, 0.15);
  }
  // La courbe du cœur n'est pas droite : elle s'ouvre à la fin. Linéaire, le
  // deuxième knockdown suffisait déjà à conclure. Au carré, les deux premières
  // couvertures sont des faux départs et la salle n'y croit qu'au bout.
  const used = 1 - gritLeft;
  let c = 0.10 + used * used * 0.60;
  if (target.statuses.finished) c += 0.25;
  c += wearPinBonus(target);                    // une tête qui ne suit plus se fait compter
  c += (pinner.momentum / 100) * 0.08;
  const saves = alliesOf(battle, target).filter((a) => !a.down && manhattan(a, target) === 1).length;
  c -= saves * 0.2;
  if (gim(pinner).modPinChance) c = gim(pinner).modPinChance(battle, pinner, pinner, target, c, 'pinner');
  if (gim(target).modPinChance) c = gim(target).modPinChance(battle, target, pinner, target, c, 'target');
  c += matchPhase(battle).pin;
  // LE CŒUR EST UN PLAFOND, PAS UN TERME
  //
  // C'est la règle du catch : « il s'est dégagé du finisher ! ». Tant qu'il
  // reste du cœur, aucun bonus — momentum, main event, finisher — ne fait
  // passer un tombé. Sans ce plafond, un +0,12 de phase posé sur une base de
  // 0,14 la doublait, et le match se terminait au premier knockdown pendant
  // que la courbe du cœur ne servait à rien.
  c = Math.min(c, 0.15 + used * 0.80);
  if (!scriptAllowsElimination(battle, target, 'pin')) c *= SCRIPT_PENALTY;
  return clamp(c, 0.03, 0.95);
}

function attemptPin(battle, pinner, target) {
  const c = pinChance(battle, pinner, target);
  const roll = battle.rng.next();
  log(battle, `${pinner.name} couvre ${target.name}… (${Math.round(c * 100)} %)`);
  if (roll < c) {
    if (!scriptAllowsElimination(battle, target, 'pin')) log(battle, `😱 ${pinner.name} ne respecte pas le script : c’est un SHOOT !`, 'big');
    eliminate(battle, target, 'pin');
    battle.stats.finisherFinish = hasStatus(target, 'finished');
    addHeat(battle, 20);
    log(battle, `UN ! DEUX ! TROIS !!! ${target.name} est épinglé !`, 'big');
    emit(battle, { type: 'pin', x: target.x, y: target.y, count: 3 });
    return { success: true, chance: c };
  }
  const near = roll < c + 0.15 ? 3 : roll < c + 0.35 ? 2 : 1;
  target.grit = Math.max(0, target.grit - 1);
  battle.stats.kickouts++;
  if (target.team === 'player') battle.stats.playerKickouts++;
  addHeat(battle, near === 3 ? 15 : 8);
  addMomentum(battle, target, 15);
  log(battle, near === 3 ? `UN ! DEUX ! TR— KICK OUT À 2,9 !!! ${target.name} refuse de perdre !` : near === 2 ? `UN ! DEUX ! … KICK OUT ! ${target.name} se dégage.` : `UN… ${target.name} se dégage facilement.`, 'big');
  emit(battle, { type: 'pin', x: target.x, y: target.y, count: near === 3 ? 2.9 : near === 2 ? 2 : 1 });
  return { success: false, chance: c };
}

// LA CHANCE D'ABANDON, en un seul endroit
//
// Elle vit ici plutôt que dans `attemptSubmission` pour que l'IA et la
// prévision lisent EXACTEMENT le même nombre que celui qui sera tiré. Quand
// les deux formules vivaient séparément, l'IA surestimait ses prises et
// matraquait la même de quinze tours de suite.
export const SUB_FATIGUE = 0.78;          // ce qu'il reste de la prise à chaque reprise
export const subAttempts = (target, move) => ((target.memory.subs || {})[move.id] || 0);

export function tapChance(battle, attacker, target, move) {
  const A = getStats(battle, attacker);
  const worn = Math.max(0, 0.65 - hpRatio(target)) / 0.65;
  // LE PAIEMENT DE L'USURE CIBLÉE. Une clé de jambe sur une jambe fraîche ne
  // fait rien ; la même après dix tours de travail finit le match. Avant, seul
  // le total de PV comptait : la prise de soumission était un coup comme un
  // autre, et « travailler la jambe » n'existait pas comme plan.
  const cible = wearTapBonus(target, movePart(move));
  // LE CŒUR GARDE AUSSI CETTE PORTE. Comme pour le tombé : tant qu'il reste du
  // cœur, on ne fait abandonner personne. C'est ce qui empêche une prise de
  // repos à 25 % de conclure un match au douzième tour.
  let c = worn * 0.25 + cible + A.tec * 0.008 - target.grit * 0.10 + ((move.effects || {}).tapBonus || 0) + (target.down ? 0.12 : 0);
  // IL CONNAÎT LA PRISE. Une soumission ratée ne coûtait rien : l'IA reprenait
  // la même à chaque tour et le chinlock représentait 30 % de tous les coups du
  // jeu. Ce n'est pas du catch, c'est une boucle.
  //
  if (gim(attacker).modTapChance) c = gim(attacker).modTapChance(battle, attacker, attacker, target, c, 'attacker');
  if (gim(target).modTapChance) c = gim(target).modTapChance(battle, target, attacker, target, c, 'target');
  c += matchPhase(battle).wear;
  if (!scriptAllowsElimination(battle, target, 'submission')) c *= SCRIPT_PENALTY;
  // La lassitude s'applique EN DERNIER, sur le nombre final. Appliquée au
  // milieu, le bonus de phase repassait par-dessus et posait un plancher : la
  // prise redevenait rentable au tour suivant et la boucle repartait.
  c *= Math.pow(SUB_FATIGUE, subAttempts(target, move));
  return clamp(c, 0, 0.9);
}

function attemptSubmission(battle, attacker, target, move) {
  const g = battle.grid;
  const nearRope = ['rope', 'turnbuckle'].includes(tileAt(g, target.x, target.y)) || isAdjacentToTerrain(g, target.x, target.y, 'rope') || isAdjacentToTerrain(g, target.x, target.y, 'turnbuckle');
  if (nearRope && battle.rules.dq) {
    log(battle, `🪢 ROPE BREAK ! ${target.name} attrape les cordes, l’arbitre sépare.`);
    addMomentum(battle, target, 10);
    return { ropeBreak: true };
  }
  const c = tapChance(battle, attacker, target, move);
  target.memory.subs = target.memory.subs || {};
  target.memory.subs[move.id] = subAttempts(target, move) + 1;
  const roll = battle.rng.next();
  if (roll < c) {
    if (!scriptAllowsElimination(battle, target, 'submission')) log(battle, `😱 ${attacker.name} ne respecte pas le script : c’est un SHOOT !`, 'big');
    eliminate(battle, target, 'submission');
    battle.stats.finisherFinish = move.tier === 'finisher';
    addHeat(battle, 20);
    log(battle, `🏳️ TAP OUT !!! ${target.name} abandonne sur ${move.name} !`, 'big');
    return { tapped: true };
  }
  if (roll < c + 0.15) target.grit = Math.max(0, target.grit - 1);
  // Se dégager d'une prise, c'est un moment : la salle y croit et le lutteur
  // repart avec quelque chose. C'est aussi ce qui fait qu'une prise ratée
  // n'est pas gratuite pour celui qui l'a tentée.
  addMomentum(battle, target, 12);
  log(battle, `${target.name} tient bon dans ${move.name} (${Math.round(c * 100)} %).`);
  return { tapped: false };
}

export function tossChance(battle, unit, target) {
  const A = getStats(battle, unit), D = getStats(battle, target);
  let c = 0.28 + (1 - hpRatio(target)) * 0.5 + (A.str - D.str) * 0.03 + (target.down ? 0.25 : 0) + (target.statuses.dazed ? 0.15 : 0);
  if (target.weight === 'light') c += 0.15;
  if (target.weight === 'super') c -= 0.2;
  if (gim(unit).modTossChance) c = gim(unit).modTossChance(battle, unit, c, 'attacker');
  if (gim(target).modTossChance) c = gim(target).modTossChance(battle, target, c, 'target');
  if (!scriptAllowsElimination(battle, target, 'toss')) c *= SCRIPT_PENALTY;
  return clamp(c, 0.05, 0.95);
}

function attemptToss(battle, unit, target) {
  const c = tossChance(battle, unit, target);
  log(battle, `${unit.name} tente de jeter ${target.name} par-dessus la corde… (${Math.round(c * 100)} %)`);
  if (battle.rng.chance(c)) {
    eliminate(battle, target, 'toss');
    if (unit.team === 'player') battle.stats.playerTosses++;
    addHeat(battle, 15);
    log(battle, `🚀 PAR-DESSUS LA TROISIÈME CORDE ! ${target.name} est éliminé !`, 'big');
    return { success: true };
  }
  addMomentum(battle, target, 10);
  log(battle, `${target.name} s’accroche aux cordes !`);
  return { success: false };
}

// ---------------------------------------------------------------- whip / push
function irishWhip(battle, unit, target, move) {
  const chance = hitChance(battle, unit, target, move);
  if (battle.rng.next() * 100 >= chance) { log(battle, `${target.name} renverse l’Irish Whip de ${unit.name} !`, 'miss'); return { hit: false }; }
  log(battle, `${unit.name} projette ${target.name} !`);
  addMomentum(battle, unit, 5);
  pushUnit(battle, target, Math.sign(target.x - unit.x), Math.sign(target.y - unit.y), 2, unit);
  return { hit: true };
}

const footprintAt = (unit, x, y) => {
  const { w, h } = sizeOf(unit), out = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) out.push({ x: x + dx, y: y + dy });
  return out;
};
const isBig = (unit) => { const { w, h } = sizeOf(unit); return w > 1 || h > 1; };

export function pushUnit(battle, target, dx, dy, dist, source) {
  const g = battle.grid;
  let x = target.x, y = target.y, moved = 0;
  const credit = () => { if (source && source.team === 'player') battle.stats.hazardWhips++; };
  for (let i = 0; i < dist; i++) {
    const nx = x + dx, ny = y + dy;
    if (!inBounds(g, nx, ny)) break;
    const t = terrainAt(g, nx, ny);
    const tileName = tileAt(g, nx, ny);
    // pour un colosse, c'est tout le gabarit qui doit tenir sur la case d'arrivée
    let occ = null;
    for (const cell of footprintAt(target, nx, ny)) { occ = unitAt(battle, cell.x, cell.y); if (occ && occ !== target) break; occ = null; }
    if (!occ && isBig(target) && !fits(g, battle.units, target, nx, ny)) {
      log(battle, `${target.name} est trop massif pour passer par là.`);
      break;
    }
    if (occ) {
      log(battle, `${target.name} percute ${occ.name} !`);
      applyDamage(battle, occ, 6, source, { move: { type: 'collision' } });
      applyDamage(battle, target, 6, source, { move: { type: 'collision' } });
      break;
    }
    if (!t.passable) {
      if (t.hazard) {
        if (t.breakable && !battle.rules.tables) {
          // La table des commentateurs n'est pas au menu ce soir : on s'écrase
          // dessus (ça fait mal, ça fait du bruit) mais elle tient.
          log(battle, `${target.name} s’écrase sur la table des commentateurs — elle tient bon ! (pas de tables dans ce match)`);
          addHeat(battle, 6);
          credit();
          applyDamage(battle, target, 10, source, { move: { type: 'hazard' } });
          break;
        }
        if (t.breakable) {
          setTile(g, nx, ny, 'debris'); battle.stats.tables++; addHeat(battle, 25);
          log(battle, `💥 ${target.name} PASSE À TRAVERS LA TABLE !!!`, 'big');
          x = nx; y = ny; moved++;
        } else {
          log(battle, `${target.name} s’écrase contre ${t.name} !`);
          addHeat(battle, 8);
        }
        credit();
        applyDamage(battle, target, t.hazard, source, { move: { type: 'hazard' } });
      }
      break;
    }
    if (battle.rules.toss && t.outside && !isOutside(g, x, y)) {
      const c = source ? tossChance(battle, source, target) : 0.5;
      if (battle.rng.chance(c)) {
        log(battle, `🚀 ${target.name} PASSE PAR-DESSUS LA CORDE sur la projection ! (${Math.round(c * 100)} %)`, 'big');
        eliminate(battle, target, 'toss');
        if (source && source.team === 'player') battle.stats.playerTosses++;
        addHeat(battle, 15);
        return moved;
      }
      log(battle, `${target.name} s’accroche aux cordes de justesse ! (${Math.round(c * 100)} %)`);
      break;
    }
    // chute : quitter le tablier pour le plancher, ça se paie
    const fall = heightAt(g, x, y) - heightAt(g, nx, ny);
    x = nx; y = ny; moved++;
    if (fall >= 2) {
      target.x = x; target.y = y;
      const dmg = 6 + fall * 4;
      setStatus(battle, target, 'dazed', 1);
      credit(); addHeat(battle, 10);
      log(battle, `🪂 ${target.name} bascule de ${fall} niveaux et s’écrase au sol ! (-${dmg}, étourdi)`, 'big');
      applyDamage(battle, target, dmg, source, { move: { type: 'hazard' } });
      break;
    }
    if (tileName === 'rope') { setStatus(battle, target, 'dazed', 1); log(battle, `${target.name} est projeté dans les cordes ! (étourdi)`); break; }
    if (tileName === 'turnbuckle') { setStatus(battle, target, 'dazed', 1); credit(); target.x = x; target.y = y; applyDamage(battle, target, 10, source, { move: { type: 'hazard' } }); log(battle, `${target.name} s’écrase dans le coin ! (-10, étourdi)`); break; }
    if (tileName === 'steps') { credit(); target.x = x; target.y = y; applyDamage(battle, target, t.hazard, source, { move: { type: 'hazard' } }); log(battle, `${target.name} percute les marches d’acier ! (-${t.hazard})`); break; }
  }
  if (!target.eliminated) { target.x = x; target.y = y; target.climb = 0; emit(battle, { type: 'move', uid: target.uid, x, y }); }
  return moved;
}

// ---------------------------------------------------------------- tag / climb / DQ
function tagPartner(battle, unit, partner) {
  unit.legal = false; partner.legal = true;
  heal(battle, partner, partner.maxHp * 0.15);
  addMomentum(battle, partner, 30);
  battle.stats.tags++;
  addHeat(battle, 10);
  log(battle, `🤝 ${hpRatio(unit) < 0.4 ? 'HOT TAG !!!' : 'TAG !'} ${partner.name} entre dans le match, tout frais !`, 'big');
  return {};
}

function doClimb(battle, unit) {
  unit.climb += 1;
  const belt = battle.rules.victory === 'belt';
  if (unit.climb >= 2) {
    if (belt) { unit.flags.belt = true; log(battle, `🏆 ${unit.name} DÉCROCHE LA CEINTURE !!!`, 'big'); }
    else { unit.flags.escaped = true; log(battle, `🧗 ${unit.name} S’ÉVADE DE LA CAGE !!!`, 'big'); }
    addHeat(battle, 25);
  } else {
    log(battle, `${unit.name} ${belt ? 'grimpe l’échelle' : 'escalade la cage'}… (1/2) Frappez-le !`);
    addHeat(battle, 8);
  }
  checkWin(battle);
  return {};
}

// L'ARBITRE A UNE TOLÉRANCE
//
// Un arbitre de catch ne disqualifie presque jamais au premier coup. Il voit,
// il avertit, il compte jusqu'à cinq — et il finit par en avoir assez. C'est
// ce qui rend la triche jouable : on tire sur la corde jusqu'à ce qu'elle
// casse, et on sait combien il en reste.
//
// Avant, chaque acte illégal était un lancer de dé indépendant : 25 % de
// perdre le match sur-le-champ, sans avertissement, sans mémoire. Un lutteur
// sournois n'avait aucune marge et l'IA n'avait aucun moyen de doser.
//
// `oeil` multiplie la flagrance de l'acte : ce que l'arbitre REMARQUE.
// `patience` est le nombre d'actes remarqués qu'il laisse passer avant de
// siffler la fin.
export const REFEREES = [
  { id: 'strict', name: 'pointilleux', oeil: 1.5, patience: 2,
    trait: 'Il voit tout et n’a pas d’humour.' },
  { id: 'normal', name: 'à l’ancienne', oeil: 1.0, patience: 3,
    trait: 'Il laisse lutter, mais il compte.' },
  { id: 'lax', name: 'complaisant', oeil: 0.6, patience: 5,
    trait: 'Il regarde souvent ailleurs. Profitez-en.' },
];

export function makeReferee(rng) {
  const r = REFEREES[Math.min(REFEREES.length - 1, Math.floor(rng.next() * REFEREES.length))];
  return { ...r, patience: r.patience, maxPatience: r.patience, vus: 0 };
}
// Ce que l'interface doit annoncer avant qu'on triche.
export function refState(battle) {
  const r = battle.ref;
  if (!battle.rules.dq) return { free: true, label: 'Aucune règle ici' };
  if (battle.refDistracted > 0) return { blind: true, label: 'Arbitre distrait — il ne verra rien' };
  const reste = r.patience;
  return {
    label: reste <= 1 ? 'Dernier avertissement !' : `${reste} avertissement${reste > 1 ? 's' : ''} avant DQ`,
    reste, danger: reste <= 1, name: r.name, trait: r.trait,
  };
}

function checkDq(battle, unit, base, what) {
  // Le libellé sert à écrire la phrase de l'arbitre. Le mettre en majuscule
  // faisait planter le moteur quand il manquait, là où l'ancien code se
  // contentait d'un texte bizarre : un journal moche ne doit pas arrêter un
  // match.
  what = what || 'ce qu’il vient de faire';
  if (!battle.rules.dq) return false;
  if (battle.refDistracted > 0) { log(battle, `👀 L’arbitre ne voit pas ${what}.`); return false; }
  const ref = battle.ref;
  let c = base * ref.oeil;
  if (gim(unit).modDqChance) c = gim(unit).modDqChance(battle, unit, c);
  if (!battle.rng.chance(clamp(c, 0.02, 0.95))) {
    log(battle, `L’arbitre n’a rien vu : ${what}.`);
    return false;
  }
  ref.vus++;
  ref.patience--;
  if (ref.patience > 0) {
    log(battle, `⚠️ AVERTISSEMENT ! L’arbitre a vu ${what} de ${unit.name}. Encore ${ref.patience} et c’est fini.`, 'big');
    addHeat(battle, 6);
    return false;
  }
  log(battle, `🚨 DISQUALIFICATION ! ${what.charAt(0).toUpperCase()}${what.slice(1)} de trop : l’arbitre siffle la fin.`, 'big');
  eliminate(battle, unit, 'dq');
  return true;
}

// ---------------------------------------------------------------- phases
function tickStatuses(battle, team) {
  for (const u of living(battle, team)) {
    for (const s of TIMED_STATUSES) if (u.statuses[s]) { u.statuses[s]--; if (u.statuses[s] <= 0) delete u.statuses[s]; }
  }
}

export function startPhase(battle, team) {
  battle.phase = team;
  if (battle.refDistracted > 0) battle.refDistracted--;
  if (team === 'player') spawnReinforcements(battle);
  for (const u of living(battle, team)) {
    // On lit le tour qui vient de s'écouler AVANT de le remettre à zéro. Deux
    // cas ne comptent pas : le tout premier tour d'un lutteur — il n'a encore
    // rien eu à décider, et createBattle ouvre déjà une phase — et un lutteur
    // au sol, qui ne choisit pas de rester par terre.
    if (u.hadTurn && !u.down) {
      if (u.moved) u.static = 0;
      else {
        u.static = Math.min(STATIC_MAX, (u.static || 0) + 1);
        if (u.static >= 2) {
          addHeat(battle, -STATIC_HEAT_STEP);
          if (u.static === 2) log(battle, `😴 ${u.name} campe sur place — la foule commence à décrocher.`);
        }
      }
    }
    // On reprend son air à chaque tour. Celui qui a soufflé (attendre,
    // provoquer) en récupère bien plus : c'est la prise de repos du catch,
    // et c'est ce qui rend un long match jouable au lieu d'épuisant.
    u.stamina = clamp(u.stamina + (u.rested ? STAMINA_REST : STAMINA_TICK) * staminaFactor(u), 0, u.maxStamina);
    u.rested = false;
    u.hadTurn = true;
    u.acted = false; u.moved = false; u.movedTiles = 0; u.movePath = null; u.moveMomentum = 0; u.prev = null; u.onlyPin = false;
    if (u.down) {
      if (u.downTurns === 0) {
        u.downTurns = 1; u.acted = true;
        log(battle, battle.rules.tenCount ? `🔟 L’arbitre compte sur ${u.name}… un, deux, trois…` : `${u.name} est toujours au sol…`);
      } else if (battle.rules.tenCount) {
        // Last Man Standing : deux tours au sol = le compte de dix va au bout.
        log(battle, `🔟 …HUIT ! NEUF ! DIX ! ${u.name} n’a pas répondu au compte.`, 'big');
        eliminate(battle, u, 'stoppage');
        continue;
      } else standUp(battle, u);
    }
    if (battle.rules.countOut > 0) {
      if (isOutside(battle.grid, u.x, u.y)) {
        u.outsideCount++;
        if (u.outsideCount >= battle.rules.countOut) { log(battle, `🔟 ${u.name} est COMPTÉ À L’EXTÉRIEUR !`, 'big'); eliminate(battle, u, 'countout'); continue; }
        if (u.outsideCount >= battle.rules.countOut - 2) log(battle, `⚠️ L’arbitre compte ${u.outsideCount} sur ${u.name} ! (limite ${battle.rules.countOut})`);
      } else u.outsideCount = 0;
    }
    if (!u.down) addMomentum(battle, u, 5);
    if (gim(u).onTurnStart) gim(u).onTurnStart(battle, u);
  }
  checkWin(battle);
}

function spawnReinforcements(battle) {
  for (const r of battle.match.reinforcements || []) {
    if (battle.reinforcementsDone.includes(r) || r.turn > battle.turn) continue;
    battle.reinforcementsDone.push(r);
    r.enemies.forEach((e, i) => {
      const spec = typeof e === 'string' ? { id: e } : e;
      const def = WRESTLERS_BY_ID[spec.id];
      let [x, y] = r.spawns[i] || r.spawns[0];
      if (unitAt(battle, x, y)) {
        const free = [[x + 1, y], [x, y + 1], [x, y - 1], [x + 1, y + 1], [x + 1, y - 1]].find(([a, b]) => inBounds(battle.grid, a, b) && terrainAt(battle.grid, a, b).passable && !unitAt(battle, a, b));
        if (free) [x, y] = free;
      }
      const u = createUnit(def, 'enemy', x, y, { boost: spec.boost || {}, uid: `r${battle.turn}-${i}-${def.id}` });
      u.momentum = 20;
      battle.units.push(u);
      if (gim(u).onMatchStart) gim(u).onMatchStart(battle, u);
    });
    log(battle, `🚨 RUN-IN ! ${r.enemies.length} renfort(s) arrivent par la rampe !`, 'big');
    addHeat(battle, 10);
  }
}

export function endPlayerPhase(battle) {
  if (battle.result) return;
  tickStatuses(battle, 'player');
  startPhase(battle, 'enemy');
}

// Générateur d'étapes ennemies : l'UI peut animer chaque étape ; les tests consomment tout d'un coup.
export function* enemySteps(battle) {
  for (const u of [...living(battle, 'enemy')]) {
    let guard = 0;
    while (!u.acted && !u.eliminated && !u.down && !battle.result && guard++ < 3) {
      const plan = planUnit(battle, u);
      if (plan.moveTo && moveUnit(battle, u, plan.moveTo.x, plan.moveTo.y)) yield { type: 'move', unit: u, to: plan.moveTo };
      const r = executeAction(battle, u, plan.action.id, plan.action.target);
      if (!r.ok) { executeAction(battle, u, 'wait'); }
      yield { type: 'action', unit: u, action: plan.action, result: r };
    }
  }
}

export function endEnemyPhase(battle) {
  if (battle.result) return;
  tickStatuses(battle, 'enemy');
  battle.turn++;
  startPhase(battle, 'player');
}

export function runEnemyPhase(battle) {
  for (const _ of enemySteps(battle)) { /* consomme */ }
  endEnemyPhase(battle);
}

// Boucle complète IA contre IA (tests et équilibrage).
export function autoPlay(battle, maxTurns = 40) {
  while (!battle.result && battle.turn <= maxTurns) {
    for (const u of [...living(battle, 'player')]) {
      let guard = 0;
      while (!u.acted && !u.eliminated && !u.down && !battle.result && guard++ < 3) {
        const plan = planUnit(battle, u);
        if (plan.moveTo) moveUnit(battle, u, plan.moveTo.x, plan.moveTo.y);
        const r = executeAction(battle, u, plan.action.id, plan.action.target);
        if (!r.ok) executeAction(battle, u, 'wait');
      }
    }
    if (battle.result) break;
    endPlayerPhase(battle);
    if (battle.result) break;
    runEnemyPhase(battle);
  }
  return battle.result;
}

export { checkWin };
export { movePart, wearLevel, wearRatio, wornParts, wearTapBonus, PARTS } from './wear.js';
