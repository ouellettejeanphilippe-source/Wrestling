// IA ennemie : pour chaque tuile atteignable, évalue toutes les actions possibles et choisit la meilleure.
import { manhattan, tileAt, isOutside, stepToward } from './grid.js';
import { enemiesOf, hpRatio } from './util.js';
import { listActions, getReachable, hitChance, computeDamage, moveRange } from './battle.js';

export function planUnit(battle, unit) {
  const reach = getReachable(battle, unit);
  const tiles = unit.moved ? [reach.get(`${unit.x},${unit.y}`)] : [...reach.values()].filter((v) => !v.blocked);
  let best = null;
  for (const t of tiles) {
    const pos = { x: t.x, y: t.y };
    const actions = listActions(battle, unit, pos);
    for (const a of actions) {
      if (!a.ok) continue;
      for (const tg of a.targets) {
        let score = scoreAction(battle, unit, pos, a, tg);
        if (score == null) continue;
        score -= t.cost * 0.5;
        score += positional(battle, unit, pos);
        if (!best || score > best.score) {
          best = { score, moveTo: pos.x !== unit.x || pos.y !== unit.y ? pos : null, action: { id: a.id, target: tg.unit ? { unit: tg.unit } : null } };
        }
      }
    }
  }
  if (best && best.score > 15) return best;
  return fallback(battle, unit);
}

function scoreAction(battle, unit, pos, a, tg) {
  const rules = battle.rules;
  const enemies = enemiesOf(battle, unit);
  switch (a.type) {
    case 'pin': return tg.chance < 0.25 ? tg.chance * 40 : 200 + tg.chance * 400;
    case 'toss': return tg.chance < 0.25 ? tg.chance * 40 : 180 + tg.chance * 400;
    case 'climb': {
      const near = enemies.filter((e) => !e.down && manhattan(e, pos) <= 2).length;
      let s = rules.victory === 'belt' ? 130 : hpRatio(unit) < 0.4 ? 160 : 45;
      s += unit.climb * 220 - near * 55;
      return s;
    }
    case 'tag': return hpRatio(unit) < 0.45 ? 220 : 8;
    case 'taunt': return unit.momentum >= 100 ? 0 : 12 + (100 - unit.momentum) * 0.12 + ((a.move && a.move.effects && a.move.effects.heat) || 0) * 0.5;
    case 'wait': return 1;
    case 'pickup': return rules.dq ? 12 : 70;
    case 'special': {
      if (a.id === 'whip') return scoreWhip(battle, unit, pos, tg.unit);
      return tg.unit.momentum >= 50 ? 45 : 5;
    }
    default: {
      const m = a.move, t = tg.unit;
      const hit = hitChance(battle, unit, t, m) / 100;
      const { dmg } = computeDamage(battle, unit, t, m, { noRng: true, pos });
      let s = hit * dmg * 2;
      if (!t.down && dmg >= t.hp) s += 90;
      if (m.tier === 'finisher') s += 30 + (t.hp <= dmg * 1.3 ? 70 : 0);
      if (m.type === 'submission') s += hit * Math.max(0, (1 - hpRatio(t)) * 0.6 - t.grit * 0.06) * 250;
      if (m.effects && m.effects.illegal && rules.dq && battle.refDistracted <= 0) s -= 45;
      if (m.type === 'weapon' && rules.dq && battle.refDistracted <= 0) s -= 30;
      if (t.down && !(m.requires && m.requires.targetDown)) s *= 0.6;
      if (t.climb > 0) s += 200;
      if (rules.tag && !unit.legal) s -= 60;
      return s;
    }
  }
}

function scoreWhip(battle, unit, pos, target) {
  const g = battle.grid;
  const dx = Math.sign(target.x - pos.x), dy = Math.sign(target.y - pos.y);
  let s = 12;
  for (let i = 1; i <= 2; i++) {
    const tile = tileAt(g, target.x + dx * i, target.y + dy * i);
    if (tile === 'table') return 140;
    if (tile === 'cage' || tile === 'barricade') return 85;
    if (tile === 'steps') return 80;
    if (tile === 'turnbuckle') return 70;
    if (tile === 'rope') { s = battle.rules.toss ? 60 : 28; break; }
    if (battle.rules.toss && isOutside(g, target.x + dx * i, target.y + dy * i)) return 230;
    if (tile === 'void') break;
  }
  return s;
}

function positional(battle, unit, pos) {
  const rules = battle.rules, g = battle.grid;
  let s = 0;
  if (rules.countOut > 0 && isOutside(g, pos.x, pos.y)) s -= 35;
  if (rules.toss && ['rope', 'turnbuckle'].includes(tileAt(g, pos.x, pos.y))) s -= 30;
  if (rules.cage && hpRatio(unit) < 0.4 && tileAt(g, pos.x, pos.y) === 'turnbuckle') s += 25;
  return s;
}

function fallback(battle, unit) {
  const g = battle.grid;
  const enemies = enemiesOf(battle, unit);
  let goal = null;
  if (battle.rules.victory === 'belt') goal = findTile(g, 'ladder');
  else if (battle.rules.cage && hpRatio(unit) < 0.4) goal = nearestTile(g, unit, 'turnbuckle');
  if (!goal && enemies.length) {
    goal = enemies.slice().sort((a, b) => (b.down - a.down) || manhattan(a, unit) - manhattan(b, unit))[0];
  }
  const mov = moveRange(battle, unit);
  const step = goal && !unit.moved ? stepToward(g, battle.units, unit, goal, mov) : null;
  const moveTo = step && (step.x !== unit.x || step.y !== unit.y) ? { x: step.x, y: step.y } : null;
  const pos = moveTo || { x: unit.x, y: unit.y };
  const actions = listActions(battle, unit, pos);
  const climb = actions.find((a) => a.type === 'climb' && a.ok);
  if (climb) return { moveTo, action: { id: climb.id, target: null }, score: 0 };
  const pickup = actions.find((a) => a.type === 'pickup' && a.ok);
  if (pickup && !battle.rules.dq) return { moveTo, action: { id: pickup.id, target: null }, score: 0 };
  const taunts = actions.filter((a) => a.type === 'taunt' && a.ok).sort((a, b) => (b.move.momentum || 0) - (a.move.momentum || 0));
  if (taunts.length && unit.momentum < 80) return { moveTo, action: { id: taunts[0].id, target: null }, score: 0 };
  return { moveTo, action: { id: 'wait', target: null }, score: 0 };
}

function findTile(g, type) {
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (tileAt(g, x, y) === type) return { x, y };
  return null;
}
function nearestTile(g, unit, type) {
  let best = null, bd = Infinity;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (tileAt(g, x, y) === type) { const d = manhattan(unit, { x, y }); if (d < bd) { bd = d; best = { x, y }; } }
  return best;
}
