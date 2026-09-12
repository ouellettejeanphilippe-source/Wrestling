// IA ennemie : pour chaque tuile atteignable, évalue toutes les actions possibles et choisit la meilleure.
import { manhattan, tileAt, isOutside, stepToward, heightAt, pathIn, occupies } from './grid.js';
import { enemiesOf, hpRatio } from './util.js';
import { listActions, getReachable, hitChance, computeDamage, moveRange, tapChance, novelty, DAMAGE_SCALE } from './battle.js';
import { movePart, wearFrom, wearOf, WEAR_MAX, WEAR_HURT, WEAR_BROKEN } from './wear.js';
import { matchPhase } from './phases.js';
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
        score += positional(battle, unit, pos, a);
        if (!best || score > best.score) {
          best = { score, moveTo: pos.x !== unit.x || pos.y !== unit.y ? pos : null, action: { id: a.id, target: tg.unit ? { unit: tg.unit } : null } };
        }
      }
    }
  }
  // Ce seuil sépare « j'ai un vrai coup à jouer » de « je me replace ». Il
  // était ABSOLU (15) et calibré sur l'ancienne échelle de dégâts : le jour où
  // les coups ont été divisés par deux, la moitié des attaques sont passées
  // dessous et l'IA s'est mise à marcher en rond. Trente tours, neuf coups.
  // Il suit désormais l'échelle : un réglage d'équilibrage ne doit pas rendre
  // l'adversaire passif dans son dos.
  if (best && best.score > 15 * DAMAGE_SCALE) return best;
  return fallback(battle, unit);
}

// Les scores d'action se comparent à celui d'un coup, qui vaut `touche × dégâts
// × 2`. Toutes les constantes ci-dessous ont donc été calibrées sur une échelle
// de dégâts donnée — et le jour où les coups ont été divisés par deux, elles
// sont devenues deux fois trop attirantes. Résultat : 70 % des décisions de
// l'IA étaient « se coucher au passage », un mouvement sans dégâts, parce que
// son 45 fixe battait toutes les attaques.
//
// Elles suivent maintenant l'échelle. Le tombé et la projection par-dessus la
// corde en sont exclus volontairement : gagner le match doit primer.
const E = (n) => n * DAMAGE_SCALE;

function scoreAction(battle, unit, pos, a, tg) {
  const rules = battle.rules;
  const enemies = enemiesOf(battle, unit);
  switch (a.type) {
    case 'pin': {
      // Un tombé raté n'est pas un tour perdu : le kick-out COÛTE UN CŒUR à
      // l'adversaire, et le cœur est le plafond du tombé suivant. Couvrir tôt,
      // c'est investir — c'est même la stratégie centrale d'un long match.
      // L'IA ne le voyait pas : en dessous de 25 % elle ne couvrait jamais, et
      // le near-fall, qui est le cœur du spectacle, n'arrivait pas.
      const c = tg.chance;
      if (c >= 0.25) return 200 + c * 400;
      const usure = tg.unit.grit > 0 && tg.unit.down ? E(55) : 0;
      return c * 40 + usure;
    }
    case 'toss': return tg.chance < 0.25 ? tg.chance * 40 : 180 + tg.chance * 400;
    case 'climb': {
      const near = enemies.filter((e) => !e.down && manhattan(e, pos) <= 2).length;
      let s = rules.victory === 'belt' ? 130 : hpRatio(unit) < 0.4 ? 160 : 45;
      s += unit.climb * 220 - near * 55;
      return E(s);
    }
    case 'tag': return E(hpRatio(unit) < 0.45 ? 220 : 8);
    case 'taunt': return E(unit.momentum >= 100 ? 0 : 12 + (100 - unit.momentum) * 0.12 + ((a.move && a.move.effects && a.move.effects.heat) || 0) * 0.5);
    case 'wait': return 1;
    // Le décompte qui monte est ce qui doit la ramener, pas une préférence
    // vague : à zéro c'est un tour perdu, à cinq c'est le match.
    case 'rollin': return E(8 + (unit.outsideCount || 0) * 48);
    // LE MANAGER : deux cartouches pour tout le match. Le piège serait de les
    // griller au premier tour parce que le score est bon dans l'absolu — donc
    // il est pondéré par le MOMENT. En ouverture, la foule n'y croit pas et il
    // reste tout le match pour s'en servir ; en main event, c'est maintenant
    // ou jamais.
    case 'manager': {
      const m = a.manager, t = tg.unit;
      let s = 0;
      switch (m.ability) {
        // Du momentum ne vaut que s'il y a quelque chose à en faire tout de
        // suite : sinon le manager offre une jauge que le lutteur aurait
        // gagnée tout seul en frappant.
        case 'promo': {
          const portee = enemies.some((e) => manhattan(e, pos) <= 3);
          s = portee ? 25 + (100 - unit.momentum) * 0.55 : 10;
          break;
        }
        case 'smelling_salts':
          s = (1 - hpRatio(unit)) * 190 + (unit.stamina < 30 ? 45 : 0) + (unit.statuses.dazed ? 40 : 0);
          break;
        case 'distract': {
          const outils = unit.weapon || unit.moves.some((id) => MOVES[id] && MOVES[id].effects && MOVES[id].effects.illegal);
          s = rules.dq ? (outils ? 110 : 45) : 15;
          break;
        }
        case 'cheap_shot': s = t ? 95 + (t.hp <= 20 ? 60 : 0) : 0; break;
        case 'rope_hold': s = t ? 80 + (wearOf(t, 'legs') > 40 ? 45 : 0) : 0; break;
        default: s = 20;
      }
      const acte = { early: 0.55, mid: 1, late: 1.25 }[matchPhase(battle).key] || 1;
      // Tricher par procuration use la même corde que tricher soi-même.
      if (m.illegal && rules.dq && battle.refDistracted <= 0) s *= 1 - 0.5 * risqueArbitre(battle, unit);
      return E(s * acte);
    }
    case 'pickup': return E(rules.dq ? 12 : 70);
    // Aller fouiller sous le ring : intéressant quand les armes sont légales,
    // et seulement si on n'est pas en train de se faire compter à l'extérieur.
    case 'scavenge': return E(rules.dq ? 6 : rules.countOut > 0 ? 10 : 55);
    case 'special': {
      if (a.id === 'whip') return E(scoreWhip(battle, unit, pos, tg.unit));
      return E(tg.unit.momentum >= 50 ? 45 : 5);
    }
    default: {
      const m = a.move, t = tg.unit;
      const hit = hitChance(battle, unit, t, m, { pos }) / 100;
      const { dmg } = computeDamage(battle, unit, t, m, { noRng: true, pos, travel: pos.travel });
      let s = hit * dmg * 2;
      s += spreadValue(battle, unit, pos, t, m, dmg) * hit;
      if (!t.down && dmg >= t.hp) s += 90;
      if (m.tier === 'finisher') s += 30 + (t.hp <= dmg * 1.3 ? 70 : 0);
      // La soumission suit exactement la formule d'abandon, usure ciblée
      // comprise. Sans ça, l'IA ne voyait pas que sa clé de jambe vaut trois
      // fois plus après dix tours de travail sur cette jambe — et le seul
      // vrai plan long du catch restait un plan que personne ne jouait.
      if (m.type === 'submission') s += hit * tapChance(battle, unit, t, m) * 250;
      // Ce que le coup laisse SUR LE CORPS, en plus de ce qu'il retire aux PV.
      s += wearValue(battle, unit, t, m, dmg) * hit;
      // La prudence se mesure à ce qu'il reste de patience à l'arbitre. Tant
      // qu'il y a de la marge, tricher est un calcul ; au dernier
      // avertissement, c'est jeter le match.
      if (rules.dq && battle.refDistracted <= 0) {
        const marge = risqueArbitre(battle, unit);
        if (m.effects && m.effects.illegal) s -= 45 * marge;
        if (m.type === 'weapon') s -= 30 * marge;
      }
      if (t.down && !(m.requires && m.requires.targetDown)) s *= 0.6;
      if (t.climb > 0) s += 200;
      // Attaquer sans être légal, c'est 25 % de DQ par coup. Un malus fixe ne
      // pesait rien face au score d'un gros mouvement : le partenaire illégal
      // entrait dans le ring à chaque tour et perdait le match. Avec des
      // matchs deux fois plus longs, ça passait de 38 % à 68 % des fins.
      // C'est désormais un quasi-veto : on n'y va que si rien d'autre ne vaut
      // le coup, ou si l'arbitre regarde ailleurs.
      // Entrer sans être légal : même logique. Un arbitre complaisant qui a
      // encore trois avertissements en réserve, ça se tente — c'est du catch.
      // Au dernier, c'est perdre le match sur un coup de sang.
      if (rules.tag && !unit.legal && battle.refDistracted <= 0) {
        const marge = risqueArbitre(battle, unit);
        s = marge >= 0.9 ? Math.min(s * 0.15, 12) : s * (1 - 0.55 * marge);
      }
      // Elle joue un SPECTACLE, pas un solveur. Un mouvement déjà servi rapporte
      // moins de momentum et moins de chaleur (le moteur s'en charge), et l'IA
      // doit le voir : sans ce terme, elle trouvait la meilleure prise du tour
      // et la rejouait jusqu'à la fin — 22 % de tous les coups du jeu étaient
      // le même chinlock. Borné, pour qu'un finisher reste un finisher.
      s *= Math.max(0.45, novelty(unit, m));
      s -= (a.cost || 0) * 0.35;
      return s;
    }
  }
}

// CHOISIR UN MEMBRE ET S'Y TENIR
//
// Sans ce terme, l'IA répartit ses coups au hasard des opportunités et
// n'arrive jamais à rien : l'usure ciblée existe dans le moteur mais personne
// ne la joue. Avec, elle fait ce que fait un vrai heel — elle trouve la jambe,
// elle y revient, et elle attend sa prise.
//
// La valeur d'un point d'usure n'est pas constante : elle monte à l'approche
// d'un seuil (c'est le palier qui change quelque chose, pas le point) et elle
// dépend de ce que le membre vaut CONTRE CETTE CIBLE — une jambe morte ne
// coûte pas la même chose à un voltigeur qu'à un colosse.
function partWorth(battle, unit, target, part) {
  let w = 10;
  // Le paiement : une prise de soumission sur le membre qu'on travaille.
  if (unit.moves.some((id) => MOVES[id] && MOVES[id].type === 'submission' && movePart(MOVES[id]) === part)) w += 34;
  if (part === 'legs') {
    if (target.moves.some((id) => MOVES[id] && MOVES[id].type === 'aerial')) w += 16;
    if (battle.rules.victory === 'belt' || battle.rules.cage) w += 22;
    w += 8;                                   // et le second souffle amputé
  }
  if (part === 'head' && !battle.rules.noPin) w += 12;
  if (part === 'torso') w += 6;
  return w;
}

function wearValue(battle, unit, target, move, dmg) {
  const u = wearFrom(move, dmg);
  if (!u) return 0;
  const now = wearOf(target, u.part);
  if (now >= WEAR_MAX) return 0;
  const gain = Math.min(WEAR_MAX - now, u.n);
  const apres = now + gain;
  let palier = 0;
  if (now < WEAR_HURT && apres >= WEAR_HURT) palier += 0.5;
  if (now < WEAR_BROKEN && apres >= WEAR_BROKEN) palier += 1;
  return (gain / WEAR_MAX + palier) * partWorth(battle, unit, target, u.part) * 0.6;
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

// 0 = l'arbitre a toute sa patience, 1 = il est au bout. Sert de coefficient
// de prudence à tout ce qui est illégal.
//
// Le tempérament entre dedans : un heel pousse sa chance là où un face se
// range. Sans ça, tout le monde reculait au premier avertissement et la
// disqualification disparaissait du jeu — ce n'est pas moins faux qu'une DQ
// à tous les coups.
function risqueArbitre(battle, unit) {
  const r = battle.ref;
  if (!r || !r.maxPatience) return 1;
  const marge = 1 - (r.patience - 1) / r.maxPatience;
  const temperament = unit && unit.alignment === 'heel' ? 0.55
    : unit && unit.alignment === 'face' ? 1.15 : 1;
  return Math.max(0, Math.min(1, marge * temperament));
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

function positional(battle, unit, pos, action = null) {
  const rules = battle.rules, g = battle.grid;
  let s = perchValue(battle, unit, pos);
  // SE RAPPROCHER VAUT QUELQUE CHOSE. Tant que personne n'est à portée, aucun
  // terme du score ne distinguait une case d'une autre — et comme se déplacer
  // coûte des points, l'IA provoquait sur place à cinq cases de l'adversaire.
  // Elle avance maintenant en posant son personnage, ce qui est précisément
  // ce que fait un lutteur au début d'un match.
  const cible = enemiesOf(battle, unit).filter((e) => !e.eliminated)
    .sort((a, b) => manhattan(a, pos) - manhattan(b, pos))[0];
  if (cible) {
    const d = manhattan(cible, pos);
    if (d > 1) s += Math.max(0, 14 - d * 2);
  }
  // Prendre la hauteur : on y frappe plus juste et on encaisse moins. On ne
  // compare qu'aux adversaires proches, sinon un lutteur irait se percher au
  // bout de l'aréna pour un bonus théorique.
  const near = enemiesOf(battle, unit).filter((e) => manhattan(e, pos) <= 4);
  if (near.length) {
    const mine = heightAt(g, pos.x, pos.y);
    const theirs = near.reduce((a, e) => a + heightAt(g, e.x, e.y), 0) / near.length;
    s += Math.max(-12, Math.min(12, (mine - theirs) * 7));
  }
  // Le compte qui monte est une URGENCE, pas une gêne. Un malus fixe ne
  // distinguait pas « je viens de sortir » de « l'arbitre en est à cinq », et
  // un lutteur ralenti par une jambe abîmée se faisait compter sans réagir.
  //
  // Il ne s'applique PAS à l'action qui sert justement à rentrer : elle se
  // joue depuis la case extérieure, donc le malus la frappait de plein fouet
  // et la faisait passer sous le seuil. L'IA voyait « rentrer dans le ring » à
  // -49 et attendait sur place jusqu'au décompte. Un garde-fou qui punit le
  // remède est pire que pas de garde-fou du tout.
  const rentre = action && action.type === 'rollin';
  if (rules.countOut > 0 && isOutside(g, pos.x, pos.y) && !rentre) s -= 35 + (unit.outsideCount || 0) * 30;
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
