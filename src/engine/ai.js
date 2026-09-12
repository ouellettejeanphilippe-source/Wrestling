// IA ennemie : pour chaque tuile atteignable, évalue toutes les actions possibles et choisit la meilleure.
import { manhattan, tileAt, isOutside, stepToward, heightAt, pathIn, occupies } from './grid.js';
import { enemiesOf, hpRatio } from './util.js';
import { listActions, getReachable, hitChance, computeDamage, moveRange } from './battle.js';
import { MOVES } from '../data/moves.js';

export function planUnit(battle, unit) {
  const reach = getReachable(battle, unit);
  const tiles = unit.moved ? [reach.get(`${unit.x},${unit.y}`)] : [...reach.values()].filter((v) => !v.blocked);
  let best = null;
  for (const t of tiles) {
    // La tuile candidate porte son trajet : sans lui, l'IA calcule les dégâts
    // avec l'élan qu'elle a MAINTENANT, pas celui qu'elle aurait après le
    // déplacement — et elle conclut qu'avancer ne sert à rien.
    const path = pathIn(reach, t.x, t.y);
    const pos = { x: t.x, y: t.y, path, travel: Math.max(0, path.length - 1) };
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
    // Aller fouiller sous le ring : intéressant quand les armes sont légales,
    // et seulement si on n'est pas en train de se faire compter à l'extérieur.
    case 'scavenge': return rules.dq ? 6 : rules.countOut > 0 ? 10 : 55;
    case 'special': {
      if (a.id === 'whip') return scoreWhip(battle, unit, pos, tg.unit);
      return tg.unit.momentum >= 50 ? 45 : 5;
    }
    default: {
      const m = a.move, t = tg.unit;
      const hit = hitChance(battle, unit, t, m, { pos }) / 100;
      const { dmg } = computeDamage(battle, unit, t, m, { noRng: true, pos, travel: pos.travel });
      let s = hit * dmg * 2;
      s += spreadValue(battle, unit, pos, t, m, dmg) * hit;
      if (!t.down && dmg >= t.hp) s += 90;
      if (m.tier === 'finisher') s += 30 + (t.hp <= dmg * 1.3 ? 70 : 0);
      if (m.type === 'submission') s += hit * Math.max(0, (1 - hpRatio(t)) * 0.6 - t.grit * 0.06) * 250;
      if (m.effects && m.effects.illegal && rules.dq && battle.refDistracted <= 0) s -= 45;
      if (m.type === 'weapon' && rules.dq && battle.refDistracted <= 0) s -= 30;
      if (t.down && !(m.requires && m.requires.targetDown)) s *= 0.6;
      if (t.climb > 0) s += 200;
      // Attaquer sans être légal, c'est 25 % de DQ par coup. Un malus fixe ne
      // pesait rien face au score d'un gros mouvement : le partenaire illégal
      // entrait dans le ring à chaque tour et perdait le match. Avec des
      // matchs deux fois plus longs, ça passait de 38 % à 68 % des fins.
      // C'est désormais un quasi-veto : on n'y va que si rien d'autre ne vaut
      // le coup, ou si l'arbitre regarde ailleurs.
      if (rules.tag && !unit.legal && battle.refDistracted <= 0) s = Math.min(s * 0.15, 12);
      s -= (a.cost || 0) * 0.35;
      return s;
    }
  }
}

// Ce que le coup touche EN PLUS de sa cible. Sans ça l'IA voit une ligne et
// une éclaboussure comme des coups ordinaires, et ne se place jamais pour
// balayer deux adversaires d'un coup. Le malus allié est plus lourd que le
// bonus ennemi : une erreur de tir sur son partenaire coûte plus cher qu'un
// bonus manqué.
function spreadValue(battle, unit, pos, target, move, dmg) {
  const eff = move.effects || {};
  if (!eff.line && !eff.splash) return 0;
  const pris = new Set();
  if (eff.line) {
    const dx = Math.sign(target.x - pos.x), dy = Math.sign(target.y - pos.y);
    if (dx || dy) for (let i = 1; i <= eff.line; i++) {
      const u = battle.units.find((v) => !v.eliminated && occupies(v, target.x + dx * i, target.y + dy * i));
      if (u && u !== unit && u !== target) pris.add(u);
    }
  }
  if (eff.splash) {
    for (const u of battle.units) {
      if (u === unit || u === target || u.eliminated) continue;
      if (manhattan(u, target) === 1) pris.add(u);
    }
  }
  let s = 0;
  for (const u of pris) s += u.team === unit.team ? -dmg * 0.9 : dmg * 0.7;
  return s;
}

function scoreWhip(battle, unit, pos, target) {
  const g = battle.grid;
  const dx = Math.sign(target.x - pos.x), dy = Math.sign(target.y - pos.y);
  // Projeter une cible déjà étourdie n'apporte rien : évite les boucles de projections.
  const mult = target.statuses.dazed ? 0.25 : 1;
  let s = 8;
  for (let i = 1; i <= 2; i++) {
    const tile = tileAt(g, target.x + dx * i, target.y + dy * i);
    if (tile === 'table') return 140 * mult;
    if (tile === 'cage' || tile === 'barricade') return 85 * mult;
    if (tile === 'steps') return 80 * mult;
    if (tile === 'turnbuckle') return 70 * mult;
    if (tile === 'rope') { s = battle.rules.toss ? 60 : 14; break; }
    if (battle.rules.toss && isOutside(g, target.x + dx * i, target.y + dy * i)) return 230 * mult;
    if (tile === 'void') break;
  }
  return s * mult;
}

// Un lutteur dont le kit exige un coin ou les cordes gagne à s'y placer.
function perchValue(battle, unit, pos) {
  const tile = tileAt(battle.grid, pos.x, pos.y);
  if (tile !== 'turnbuckle' && tile !== 'rope') return 0;
  let best = 0;
  for (const id of unit.moves) {
    const m = MOVES[id];
    if (!m || !m.requires) continue;
    const needsCorner = m.requires.turnbuckle && !unit.flags.ignoreTurnbuckle;
    const needsRope = m.requires.attackerOnRope;
    if (!needsCorner && !needsRope) continue;
    if (needsCorner && tile !== 'turnbuckle') continue;
    if (unit.momentum < (m.unlock ?? 0)) continue;
    const enemies = enemiesOf(battle, unit).filter((e) => manhattan(e, pos) <= m.range[1]);
    if (!enemies.length) continue;
    best = Math.max(best, 18 + (m.power || 0) * 0.6);
  }
  return best;
}

function positional(battle, unit, pos) {
  const rules = battle.rules, g = battle.grid;
  let s = perchValue(battle, unit, pos);
  // Prendre la hauteur : on y frappe plus juste et on encaisse moins. On ne
  // compare qu'aux adversaires proches, sinon un lutteur irait se percher au
  // bout de l'aréna pour un bonus théorique.
  const near = enemiesOf(battle, unit).filter((e) => manhattan(e, pos) <= 4);
  if (near.length) {
    const mine = heightAt(g, pos.x, pos.y);
    const theirs = near.reduce((a, e) => a + heightAt(g, e.x, e.y), 0) / near.length;
    s += Math.max(-12, Math.min(12, (mine - theirs) * 7));
  }
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
