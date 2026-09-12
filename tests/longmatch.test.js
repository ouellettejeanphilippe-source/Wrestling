// UN MATCH DOIT DURER
//
// Avant ces règles, un match simulé tenait 5,6 tours, 5,9 coups et UNE chute :
// le premier knockdown suivi du premier tombé terminait tout. Ces tests
// verrouillent les trois leviers qui en font un vrai match — le cœur comme
// plafond du tombé, le second souffle, et les mouvements qui n'existent qu'en
// mouvement.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, pinChance, listActions, executeAction, moveUnit, autoPlay,
  resolveAttack, endPlayerPhase } from '../src/engine/battle.js';
import { planUnit } from '../src/engine/ai.js';
import { WRESTLERS_BY_ID as W } from '../src/data/wrestlers.js';
import { MOVES } from '../src/data/moves.js';
import { movesFor } from '../src/engine/units.js';

const mk = (type, players, enemies) => createBattle({
  match: { id: 't', title: 'T', type, enemies }, playerTeam: players.map((id) => W[id]), seed: 42,
});
const down = (u) => { u.hp = 0; u.down = true; u.downTurns = 0; };

test('le cœur est le PLAFOND du tombé : à cœur plein, rien ne passe', () => {
  const b = mk('singles', ['jean_sina'], ['gunter']);
  const [s, g] = b.units;
  down(g);
  const plein = pinChance(b, s, g);
  assert.ok(plein <= 0.15, `à cœur plein le tombé plafonne (${plein})`);
  // même avec tous les bonus du jeu empilés
  g.statuses.finished = 2; s.momentum = 100; b.turn = 12; b.heat = 90;
  assert.ok(pinChance(b, s, g) <= 0.15, 'ni finisher, ni momentum, ni main event ne percent le plafond');
});

test('le tombé s’ouvre à mesure que le cœur s’use, et s’accélère à la fin', () => {
  const b = mk('singles', ['jean_sina'], ['gunter']);
  const [s, g] = b.units;
  down(g);
  const par = [];
  for (let reste = g.maxGrit; reste >= 0; reste--) { g.grit = reste; par.push(pinChance(b, s, g)); }
  for (let i = 1; i < par.length; i++) assert.ok(par[i] > par[i - 1], 'chaque cœur perdu ouvre le tombé');
  assert.ok(par[par.length - 1] > 0.6, 'sans cœur, le tombé passe vraiment');
  // courbe convexe : les deux premiers cœurs coûtent moins que les deux derniers
  const debut = par[1] - par[0], fin = par[par.length - 1] - par[par.length - 2];
  assert.ok(fin > debut, 'la courbe s’ouvre à la fin, elle n’est pas droite');
});

test('couvrir un adversaire DEBOUT reste marginal quoi qu’il arrive', () => {
  const b = mk('singles', ['jean_sina'], ['gunter']);
  const [s, g] = b.units;
  g.hp = 1; s.momentum = 100; b.turn = 12; b.heat = 90; g.statuses.finished = 2;
  assert.ok(pinChance(b, s, g) <= 0.15, 'un roll-up sur un adversaire debout n’est pas un tombé');
});

test('le second souffle rend de quoi raconter une reprise', () => {
  const b = mk('singles', ['jean_sina'], ['jobber_1']);
  const j = b.units.find((u) => u.team === 'enemy');
  const grit0 = j.grit;
  down(j);
  endPlayerPhase(b); b.turn++; endPlayerPhase(b);
  assert.ok(!j.down, 'il se relève');
  assert.ok(j.hp >= j.maxHp * 0.5, `au moins la moitié des PV (${j.hp}/${j.maxHp})`);
  assert.equal(j.grit, grit0 - 1, 'et un cœur en moins');
});

test('les mouvements de course n’existent pas à l’arrêt', () => {
  const b = mk('singles', ['jean_sina'], ['gunter']);
  const [s, g] = b.units;
  g.x = s.x + 1; g.y = s.y;
  const coureurs = movesFor(W.jean_sina).filter((m) => (MOVES[m].requires || {}).ran);
  assert.ok(coureurs.length, 'le kit de base doit contenir des mouvements de course');
  const immobile = listActions(b, s).find((a) => a.id === coureurs[0]);
  assert.equal(immobile.ok, false, 'planté : indisponible');
  assert.match(immobile.reason, /couru/);
  s.movedTiles = 9;
  assert.equal(listActions(b, s).find((a) => a.id === coureurs[0]).ok, true, 'après la course : disponible');
});

test('« attirer » ramène la cible vers soi, « repousser » l’éloigne', () => {
  const b = mk('singles', ['jean_sina'], ['gunter']);
  const [s, g] = b.units;
  s.x = 7; s.y = 7; g.x = 9; g.y = 7;
  const base = { type: 'grapple', power: 5, stat: 'str', acc: 100, range: [1, 3] };
  resolveAttack(b, s, g, { ...base, effects: { pull: 1 } });
  assert.equal(g.x, 8, 'attiré d’une case vers l’attaquant');
  resolveAttack(b, s, g, { ...base, effects: { push: 1 } });
  assert.equal(g.x, 9, 'repoussé d’une case');
});

test('en match par équipes, l’IA n’entre pas dans le ring sans être légale', () => {
  const b = mk('tag', ['jean_sina', 'cody_roads'], ['gunter', 'randy_python']);
  const illegal = b.units.find((u) => u.team === 'enemy' && !u.legal);
  assert.ok(illegal, 'il doit y avoir un partenaire illégal');
  const plan = planUnit(b, illegal);
  const action = plan.action && plan.action.id;
  const m = MOVES[action];
  assert.ok(!m || !['strike', 'grapple', 'aerial', 'submission'].includes(m.type),
    `le partenaire illégal ne doit pas attaquer (il a choisi ${action})`);
});

test('un match simulé dure : c’est le garde-fou contre le retour aux six tours', () => {
  let tours = 0, chutes = 0;
  const n = 20;
  for (let seed = 1; seed <= n; seed++) {
    const b = createBattle({ match: { id: 't', title: 'T', type: 'singles', enemies: ['gunter'] },
      playerTeam: [W.jean_sina], seed });
    autoPlay(b, 600);
    tours += b.turn;
    chutes += b.log.filter((l) => /est au sol/.test(l.text || l)).length;
    assert.ok(b.result, `le match ${seed} doit se conclure`);
  }
  assert.ok(tours / n >= 9, `un match doit tenir au moins neuf tours (${(tours / n).toFixed(1)})`);
  assert.ok(chutes / n >= 2, `il faut plus d’une chute par match (${(chutes / n).toFixed(1)})`);
});
