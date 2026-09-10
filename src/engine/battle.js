// Moteur de match : état, actions, résolution. Aucune dépendance au DOM.
import { tileAt, setTile, terrainAt, reachable, manhattan, key, isOutside, isOnRope, isOnTurnbuckle, isAdjacentToTerrain, inBounds, buildArena } from './grid.js';
import { MOVES, moveUnlock, moveCost } from '../data/moves.js';
import { GIMMICKS } from '../data/gimmicks.js';
import { WRESTLERS_BY_ID } from '../data/wrestlers.js';
import { MATCH_TYPES, WEAPONS } from '../data/matchTypes.js';
import { createUnit } from './units.js';
import { createRng } from './rng.js';
import { checkWin } from './rules.js';
import { planUnit } from './ai.js';
import { log, emit, living, alliesOf, enemiesOf, unitsWithin, unitAt, addMomentum, addHeat, heal, addStatus, setStatus, hasStatus, hpRatio, clamp } from './util.js';

const SPAWNS = {
  standard: { player: [[5, 4], [5, 5], [4, 4], [4, 5], [6, 3], [6, 6]], enemy: [[8, 4], [8, 5], [9, 4], [9, 5], [7, 6], [7, 3]] },
  ladder: { player: [[4, 4], [4, 5], [5, 3], [5, 6]], enemy: [[9, 4], [9, 5], [8, 3], [8, 6]] },
  tag: { player: [[5, 4], [3, 5], [3, 4]], enemy: [[8, 5], [10, 4], [10, 5]] },
  invasion: { enemy: [[1, 4], [1, 5], [1, 3], [1, 6], [0, 4]] },
};
const WEAPON_SPOTS = [[2, 4], [11, 5], [2, 5], [11, 4], [1, 2], [12, 7], [1, 7], [12, 2]];
const WEAPON_ORDER = ['chair', 'kendo', 'trash', 'bat', 'chair', 'kendo'];
const TIMED_STATUSES = ['dazed', 'cursed', 'finished'];

const gim = (u) => GIMMICKS[u.gimmick] || {};

export function createBattle({ match, playerTeam, seed = Date.now(), playerBonuses = {} }) {
  const rules = MATCH_TYPES[match.type];
  if (!rules) throw new Error(`Type de match inconnu : ${match.type}`);
  const grid = buildArena(rules.arena);
  const battle = {
    rng: createRng(seed), seed, grid, rules, match, mode: match.mode || 'kayfabe', script: match.script || null, units: [], items: [], turn: 1, phase: 'player', log: [], events: [],
    heat: 10, refDistracted: 0, result: null, lastElimination: null, reinforcementsDone: [],
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
    battle.units.push(u);
  });
  (match.enemies || []).forEach((e, i) => {
    const spec = typeof e === 'string' ? { id: e } : e;
    const def = WRESTLERS_BY_ID[spec.id];
    if (!def) throw new Error(`Lutteur inconnu : ${spec.id}`);
    const [x, y] = eSpawns[i] || eSpawns[eSpawns.length - 1];
    battle.units.push(createUnit(def, 'enemy', x, y, { boost: spec.boost || match.boost || {}, uid: `e${i}-${def.id}` }));
  });
  if (rules.tag) for (const team of ['player', 'enemy']) living(battle, team).forEach((u, i) => { u.legal = i === 0; });

  const nWeapons = rules.weapons || 0;
  WEAPON_SPOTS.filter(([x, y]) => tileAt(grid, x, y) === 'floor').slice(0, nWeapons).forEach(([x, y], i) => {
    battle.items.push({ x, y, weapon: { ...WEAPONS[WEAPON_ORDER[i % WEAPON_ORDER.length]] } });
  });

  log(battle, `🔔 DING DING DING ! ${match.title || rules.name} — ${rules.name}.`, 'big');
  for (const u of battle.units) if (gim(u).onMatchStart) gim(u).onMatchStart(battle, u);
  startPhase(battle, 'player');
  return battle;
}

// ---------------------------------------------------------------- stats & portées
export function getStats(battle, unit) {
  const s = { ...unit.stats };
  const add = (m) => { if (m) for (const [k, v] of Object.entries(m)) s[k] = (s[k] || 0) + v; };
  if (gim(unit).selfStats) add(gim(unit).selfStats(battle, unit));
  for (const o of living(battle)) if (o !== unit && gim(o).auraStats) add(gim(o).auraStats(battle, o, unit));
  s.def -= unit.statuses.welt || 0;
  for (const k of Object.keys(s)) s[k] = Math.max(0, s[k]);
  return s;
}

export function moveRange(battle, unit) {
  let mov = unit.stats.mov;
  if (gim(unit).modMov) mov = gim(unit).modMov(battle, unit, mov);
  if (unit.statuses.dazed) mov -= 2;
  return Math.max(1, mov);
}

export function getReachable(battle, unit) {
  const r = reachable(battle.grid, battle.units, unit, moveRange(battle, unit));
  if (battle.rules.toss) for (const v of r.values()) if (isOutside(battle.grid, v.x, v.y)) v.blocked = true;
  return r;
}

export function moveUnit(battle, unit, x, y) {
  if (unit.acted || unit.moved || unit.down || unit.eliminated) return false;
  const n = getReachable(battle, unit).get(key(x, y));
  if (!n || n.blocked) return false;
  unit.prev = { x: unit.x, y: unit.y };
  unit.movedTiles = manhattan(unit, { x, y });
  unit.x = x; unit.y = y; unit.moved = true; unit.climb = 0;
  emit(battle, { type: 'move', uid: unit.uid, x, y });
  if (battle.rules.tag && !unit.legal && !isOutside(battle.grid, x, y) && !isOnRope(battle.grid, x, y) && !isOnTurnbuckle(battle.grid, x, y)) {
    log(battle, `⚠️ ${unit.name} entre dans le ring sans être légal. L’arbitre n’aime pas ça.`);
  }
  return true;
}
export function undoMove(battle, unit) {
  if (!unit.prev || unit.acted) return false;
  unit.x = unit.prev.x; unit.y = unit.prev.y; unit.prev = null; unit.moved = false; unit.movedTiles = 0;
  return true;
}

// ---------------------------------------------------------------- liste des actions
function targetOk(battle, move, e, pos) {
  const req = move.requires || {};
  const g = battle.grid;
  if (req.targetDown && !e.down) return false;
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
  const onTb = tile === 'turnbuckle', onRope = tile === 'rope';
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
    if (m.type === 'taunt') a.targets = [{ self: true }];
    else if (mid === 'whip') {
      a.targets = enemies.filter((e) => manhattan(p, e) === 1 && !e.down && (!gim(e).canBeWhipped || gim(e).canBeWhipped(battle, e))).map((e) => ({ unit: e, hit: hitChance(battle, unit, e, m) }));
      if (a.ok && !a.targets.length) { a.ok = false; a.reason = 'Aucune cible debout adjacente'; }
    } else if (m.type === 'special') {
      a.targets = enemies.filter((e) => inRange(e, m.range)).map((e) => ({ unit: e }));
    } else {
      a.targets = enemies.filter((e) => inRange(e, m.range) && targetOk(battle, m, e, p)).map((e) => ({ unit: e, hit: hitChance(battle, unit, e, m) }));
    }
    if (a.ok && !a.targets.length) {
      a.ok = false;
      a.reason = req.targetDown ? 'Cible au sol requise' : req.targetOnRope ? 'Cible sur les cordes requise' : req.targetNearTable ? 'Cible adjacente à une table requise' : req.targetDazedOrCorner ? 'Cible étourdie ou dans un coin requise' : 'Aucune cible à portée';
    }
    actions.push(a);
  }

  if (unit.weapon) {
    const targets = enemies.filter((e) => manhattan(p, e) === 1).map((e) => ({ unit: e, hit: hitChance(battle, unit, e, weaponMove(battle, unit)) }));
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
  const item = battle.items.find((i) => i.x === p.x && i.y === p.y);
  if (item && !unit.weapon) actions.push({ id: 'pickup', name: `${item.weapon.icon} Ramasser : ${item.weapon.name}`, tier: 'base', type: 'pickup', desc: `+${item.weapon.power} dégâts, ${item.weapon.uses} utilisations.`, targets: [{ self: true }], ok: true });
  if (rules.tag && unit.legal) {
    const partners = allies.filter((a) => !a.legal && !a.down && manhattan(p, a) === 1).map((u) => ({ unit: u }));
    actions.push({ id: 'tag', name: '🤝 Tag !', tier: 'base', type: 'tag', desc: 'Passe le relais à un partenaire adjacent : il devient légal, soigne 15 % et gagne 30 momentum.', targets: partners, ok: partners.length > 0, reason: 'Partenaire non adjacent' });
  }
  if (rules.cage && onTb) actions.push({ id: 'climb', name: `🧗 Escalader la cage (${unit.climb}/2)`, tier: 'base', type: 'climb', desc: 'Deux tours consécutifs sans subir de dégâts pour s’évader.', targets: [{ self: true }], ok: true });
  if (rules.victory === 'belt' && tile === 'ladder') actions.push({ id: 'climb', name: `🪜 Grimper l’échelle (${unit.climb}/2)`, tier: 'base', type: 'climb', desc: 'Deux tours consécutifs sans subir de dégâts pour décrocher la ceinture.', targets: [{ self: true }], ok: true });
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
    case 'pickup': {
      const idx = battle.items.findIndex((i) => i.x === unit.x && i.y === unit.y);
      if (idx >= 0) { unit.weapon = battle.items[idx].weapon; battle.items.splice(idx, 1); log(battle, `${unit.name} ramasse ${unit.weapon.name}.`); }
      break;
    }
    case 'tag': result = tagPartner(battle, unit, tgt); break;
    case 'climb': result = doClimb(battle, unit); break;
    case 'wait': heal(battle, unit, 4); break;
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

export function hitChance(battle, attacker, target, move) {
  if (target.down) return 100;
  const A = getStats(battle, attacker), D = getStats(battle, target);
  let c = (move.acc ?? 90) + (A.agi - D.agi) * 3;
  if (target.statuses.dazed) c += 25;
  if (attacker.statuses.cursed) c -= 25;
  if (attacker.statuses.dazed) c -= 10;
  if (gim(attacker).modHitChance) c = gim(attacker).modHitChance(battle, attacker, attacker, target, move, c, 'attacker');
  if (gim(target).modHitChance) c = gim(target).modHitChance(battle, target, attacker, target, move, c, 'target');
  return clamp(Math.round(c), 25, 100);
}

export function computeDamage(battle, attacker, target, move, opts = {}) {
  const A = getStats(battle, attacker), D = getStats(battle, target);
  const eff = move.effects || {};
  const pos = opts.pos || attacker;
  const atk = A[move.stat || 'str'];
  let dmg = (move.power || 0) + atk * 1.3 - D.def * 0.9 * (eff.ignoreDef ? 1 - eff.ignoreDef : 1);
  if (move.type === 'aerial' && isOnTurnbuckle(battle.grid, pos.x, pos.y)) dmg *= 1.25;
  if (eff.charge && attacker.movedTiles >= 3) dmg += 8;
  if (target.down) dmg *= 1.1;
  if (target.statuses.dazed) dmg *= 1.15;
  if (gim(attacker).modOutDamage) dmg = gim(attacker).modOutDamage(battle, attacker, target, move, dmg);
  if (gim(target).modInDamage) dmg = gim(target).modInDamage(battle, target, attacker, move, dmg);
  dmg *= 0.8;
  let crit = false;
  if (!opts.noRng) {
    if (battle.rng.chance(0.05 + A.tec * 0.01)) { crit = true; dmg *= 1.5; }
    dmg *= 0.9 + battle.rng.next() * 0.2;
  }
  return { dmg: Math.max(1, Math.round(dmg)), crit };
}

export function resolveAttack(battle, attacker, target, move) {
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
  const { dmg, crit } = computeDamage(battle, attacker, target, move);
  const eff = move.effects || {};
  const wasDown = target.down;
  const fromCorner = move.type === 'aerial' && isOnTurnbuckle(battle.grid, attacker.x, attacker.y);
  log(battle, `${attacker.name} → ${move.name} sur ${target.name} : ${dmg} dégâts${crit ? ' — CRITIQUE !' : ''}${fromCorner ? ' (depuis le coin !)' : ''}`, move.tier === 'finisher' ? 'finisher' : crit ? 'crit' : '');
  applyDamage(battle, target, dmg, attacker, { move, crit });
  addMomentum(battle, attacker, move.momentum ?? 10);
  addMomentum(battle, target, 5);
  addHeat(battle, move.tier === 'finisher' ? 15 : move.tier === 'signature' ? 8 : move.type === 'aerial' ? 6 : 2 + (eff.heat || 0));
  if (eff.heat) addHeat(battle, eff.heat);
  if (eff.selfMomentum) addMomentum(battle, attacker, eff.selfMomentum);
  if (fromCorner) { battle.stats.highSpots++; }
  if (move.type === 'weapon') { battle.stats.weaponsUsed++; if (attacker.team === 'player') battle.stats.playerWeaponHits++; }
  if (!target.eliminated) {
    if (eff.daze) setStatus(battle, target, 'dazed', eff.daze);
    if (eff.welt) addStatus(battle, target, 'welt', eff.welt, 4);
    if (eff.push) pushUnit(battle, target, Math.sign(target.x - attacker.x), Math.sign(target.y - attacker.y), eff.push, attacker);
    if (eff.breakTable) {
      const n = battle.grid;
      for (const [nx, ny] of [[target.x + 1, target.y], [target.x - 1, target.y], [target.x, target.y + 1], [target.x, target.y - 1]]) {
        if (tileAt(n, nx, ny) === 'table') { setTile(n, nx, ny, 'debris'); battle.stats.tables++; addHeat(battle, 25); log(battle, `💥 ${target.name} PASSE À TRAVERS LA TABLE !!!`, 'big'); break; }
      }
    }
  }
  if (eff.selfDamage) applyDamage(battle, attacker, eff.selfDamage, null, { self: true, silent: true });
  let freePin = false;
  if (move.tier === 'finisher' && !target.eliminated) {
    setStatus(battle, target, 'finished', 2);
    battle.stats.finishers++;
    if (target.team === 'player') battle.stats.playerTookFinisher++;
    if (target.down && !battle.rules.noPin && manhattan(attacker, target) === 1 && canPin(battle, attacker, target).ok) { freePin = true; log(battle, `${attacker.name} peut couvrir immédiatement !`); }
  }
  if (move.type === 'submission' && !target.eliminated) attemptSubmission(battle, attacker, target, move);
  if (gim(attacker).onHit) gim(attacker).onHit(battle, attacker, target, move, dmg);
  if (eff.illegal && !target.eliminated) checkDq(battle, attacker, 0.35, move.name);
  if (battle.rules.tag && !attacker.legal && !attacker.eliminated) checkDq(battle, attacker, 0.25, 'attaque sans être légal');
  checkWin(battle);
  return { hit: true, dmg, crit, chance, freePin: freePin && !battle.result && !attacker.eliminated };
}

export function applyDamage(battle, target, amount, source, opts = {}) {
  if (target.eliminated) return 0;
  amount = Math.max(0, Math.round(amount));
  target.hp = Math.max(0, target.hp - amount);
  target.climb = 0;
  emit(battle, { type: 'damage', x: target.x, y: target.y, amount, crit: !!opts.crit });
  if (source && gim(target).onDamaged) gim(target).onDamaged(battle, target, source, opts.move, amount);
  if (source && source.team === 'player') battle.stats.damageDealt += amount;
  if (target.hp <= 0 && !target.down) downUnit(battle, target);
  return amount;
}

function downUnit(battle, unit) {
  if (gim(unit).beforeDown && gim(unit).beforeDown(battle, unit)) return;
  unit.down = true; unit.downTurns = 0; unit.hp = 0; unit.climb = 0;
  delete unit.statuses.dazed;
  if (unit.team === 'player') battle.stats.playerDowned++;
  log(battle, `💫 ${unit.name} est au sol !`, 'down');
  emit(battle, { type: 'down', x: unit.x, y: unit.y });
  addHeat(battle, 5);
}

function standUp(battle, u) {
  u.down = false; u.downTurns = 0;
  u.hp = Math.max(1, Math.round(u.maxHp * 0.3) + u.grit * 3);
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

export function pinChance(battle, pinner, target) {
  let c = target.down ? 0.55 : 0.05 + (1 - hpRatio(target)) * 0.3;
  if (target.statuses.finished) c += 0.3;
  c += (pinner.momentum / 100) * 0.1;
  c -= target.grit * 0.07;
  const saves = alliesOf(battle, target).filter((a) => !a.down && manhattan(a, target) === 1).length;
  c -= saves * 0.2;
  if (gim(pinner).modPinChance) c = gim(pinner).modPinChance(battle, pinner, pinner, target, c, 'pinner');
  if (gim(target).modPinChance) c = gim(target).modPinChance(battle, target, pinner, target, c, 'target');
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

function attemptSubmission(battle, attacker, target, move) {
  const g = battle.grid;
  const nearRope = ['rope', 'turnbuckle'].includes(tileAt(g, target.x, target.y)) || isAdjacentToTerrain(g, target.x, target.y, 'rope') || isAdjacentToTerrain(g, target.x, target.y, 'turnbuckle');
  if (nearRope && battle.rules.dq) {
    log(battle, `🪢 ROPE BREAK ! ${target.name} attrape les cordes, l’arbitre sépare.`);
    addMomentum(battle, target, 10);
    return { ropeBreak: true };
  }
  const A = getStats(battle, attacker);
  let c = (1 - hpRatio(target)) * 0.5 + A.tec * 0.012 - target.grit * 0.07 + ((move.effects || {}).tapBonus || 0) + (target.down ? 0.15 : 0);
  if (gim(attacker).modTapChance) c = gim(attacker).modTapChance(battle, attacker, attacker, target, c, 'attacker');
  if (gim(target).modTapChance) c = gim(target).modTapChance(battle, target, attacker, target, c, 'target');
  if (!scriptAllowsElimination(battle, target, 'submission')) c *= SCRIPT_PENALTY;
  c = clamp(c, 0, 0.9);
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
  log(battle, `${target.name} tient bon dans ${move.name} (${Math.round(c * 100)} %).`);
  return { tapped: false };
}

export function tossChance(battle, unit, target) {
  const A = getStats(battle, unit), D = getStats(battle, target);
  let c = 0.25 + (1 - hpRatio(target)) * 0.5 + (A.str - D.str) * 0.03 + (target.down ? 0.25 : 0);
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

export function pushUnit(battle, target, dx, dy, dist, source) {
  const g = battle.grid;
  let x = target.x, y = target.y, moved = 0;
  const credit = () => { if (source && source.team === 'player') battle.stats.hazardWhips++; };
  for (let i = 0; i < dist; i++) {
    const nx = x + dx, ny = y + dy;
    if (!inBounds(g, nx, ny)) break;
    const t = terrainAt(g, nx, ny);
    const tileName = tileAt(g, nx, ny);
    const occ = unitAt(battle, nx, ny);
    if (occ) {
      log(battle, `${target.name} percute ${occ.name} !`);
      applyDamage(battle, occ, 6, source, { move: { type: 'collision' } });
      applyDamage(battle, target, 6, source, { move: { type: 'collision' } });
      break;
    }
    if (!t.passable) {
      if (t.hazard) {
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
    x = nx; y = ny; moved++;
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

function checkDq(battle, unit, base, what) {
  if (!battle.rules.dq) return false;
  if (battle.refDistracted > 0) { log(battle, `L’arbitre ne voit pas ${what}.`); return false; }
  let c = base;
  if (gim(unit).modDqChance) c = gim(unit).modDqChance(battle, unit, c);
  if (battle.rng.chance(c)) {
    log(battle, `🚨 DISQUALIFICATION ! L’arbitre a vu ${what} de ${unit.name} !`, 'big');
    eliminate(battle, unit, 'dq');
    return true;
  }
  log(battle, `L’arbitre a raté ${what}… (${Math.round(c * 100)} % de risque)`);
  return false;
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
    u.acted = false; u.moved = false; u.movedTiles = 0; u.prev = null; u.onlyPin = false;
    if (u.down) {
      if (u.downTurns === 0) { u.downTurns = 1; u.acted = true; log(battle, `${u.name} est toujours au sol…`); }
      else standUp(battle, u);
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
