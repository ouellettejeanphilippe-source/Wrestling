// L'ÉLAN : le déplacement et le coup ne sont plus deux phases indépendantes.
// Ces tests verrouillent le lien — sans eux, un réglage de dégâts plus tard
// peut annuler l'incitation sans que rien ne casse.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, moveUnit, undoMove, computeDamage, elanMult, elanLabel, getReachable,
  activeCombos, comboContextFor, MOVE_MOMENTUM_CAP, ELAN_MIN, ELAN_MAX } from '../src/engine/battle.js';
import { planUnit } from '../src/engine/ai.js';
import { tileAt } from '../src/engine/grid.js';
import { WRESTLERS_BY_ID as W } from '../src/data/wrestlers.js';

const mk = (players, enemies) => createBattle({
  match: { id: 't', title: 'T', type: 'singles', enemies }, playerTeam: players.map((id) => W[id]), seed: 42,
});
const strike = { type: 'strike', power: 10, stat: 'str', acc: 100, range: [1, 1] };
// Fabrique un contexte de combo pour un trajet donné, sans avoir à déplacer
// réellement le lutteur case par case.
const ctxFor = (b, u, e, m, path) => comboContextFor(b, u, e, m,
  { x: path[path.length - 1].x, y: path[path.length - 1].y, path, travel: path.length - 1 });

test('l’élan monte avec la distance et plafonne', () => {
  assert.equal(elanMult(0, strike), ELAN_MIN);
  assert.equal(elanMult(4, strike), ELAN_MAX);
  assert.equal(elanMult(99, strike), ELAN_MAX);
  assert.ok(elanMult(2, strike) > elanMult(1, strike));
});

test('l’élan ne touche ni les soumissions ni les provocations', () => {
  for (const type of ['submission', 'taunt']) assert.equal(elanMult(0, { type }), 1);
});

test('un lutteur étourdi n’est pas puni deux fois', () => {
  const b = mk(['jean_sina'], ['gunter']);
  const u = b.units[0];
  u.statuses.dazed = 2;
  assert.equal(elanMult(0, strike, u), 1, 'pas de malus de plantage quand on est déjà étourdi');
});

test('courir avant de frapper fait plus mal que frapper sur place', () => {
  const b = mk(['jean_sina'], ['gunter']);
  const [u, e] = b.units;
  const planté = computeDamage(b, u, e, strike, { noRng: true, travel: 0 }).dmg;
  const lancé = computeDamage(b, u, e, strike, { noRng: true, travel: 4 }).dmg;
  assert.ok(lancé > planté, `${lancé} devrait dépasser ${planté}`);
  assert.ok(lancé / planté > 1.3, 'l’écart doit être sensible, pas décoratif');
});

test('se déplacer note le trajet réel et rapporte un peu de jauge', () => {
  const b = mk(['jean_sina'], ['gunter']);
  const u = b.units[0];
  const m0 = u.momentum;
  const cible = [...getReachable(b, u).values()].find((v) => !v.blocked && v.cost === 3);
  assert.ok(cible, 'il doit exister une case à trois points de mouvement');
  assert.ok(moveUnit(b, u, cible.x, cible.y));
  assert.ok(u.movedTiles >= 2, `trajet de ${u.movedTiles} cases`);
  assert.equal(u.movePath.length, u.movedTiles + 1, 'le trajet inclut la case de départ');
  assert.deepEqual(u.movePath[0], { x: u.prev.x, y: u.prev.y });
  assert.deepEqual(u.movePath[u.movePath.length - 1], { x: u.x, y: u.y });
  assert.equal(u.momentum, m0 + Math.min(MOVE_MOMENTUM_CAP, u.movedTiles));
});

test('annuler un déplacement rend la jauge et efface le trajet', () => {
  const b = mk(['jean_sina'], ['gunter']);
  const u = b.units[0];
  const m0 = u.momentum;
  assert.ok(moveUnit(b, u, u.x + 2, u.y) || moveUnit(b, u, u.x - 2, u.y));
  assert.ok(u.momentum > m0);
  undoMove(b, u);
  assert.equal(u.momentum, m0, 'pas de jauge gratuite en faisant aller-retour');
  assert.equal(u.movedTiles, 0);
  assert.equal(u.movePath, null);
});

test('« Pris à revers » se déclenche quand on contourne, pas de face', () => {
  const b = mk(['jean_sina'], ['gunter']);
  const [u, e] = b.units;
  e.x = u.x + 1; e.y = u.y;
  e.facing = 'nw';                                   // l'ennemi regarde vers le joueur
  const face = activeCombos(b, u, e, strike).some((c) => c.id === 'blindside');
  e.facing = 'se';                                   // il regarde ailleurs
  const dos = activeCombos(b, u, e, strike).some((c) => c.id === 'blindside');
  assert.equal(face, false, 'de face, pas de bonus');
  assert.equal(dos, true, 'dans le dos, bonus');
});

test('« Course dans les cordes » demande de TRAVERSER, pas de s’y arrêter', () => {
  const b = mk(['jean_sina'], ['gunter']);
  const [u, e] = b.units;
  const passe = [{ x: 0, y: 0 }, { x: b.grid.ring.rx0, y: b.grid.ring.ry0 + 2 }, { x: 1, y: 1 }];
  const finit = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: b.grid.ring.rx0, y: b.grid.ring.ry0 + 2 }];
  assert.equal(tileAt(b.grid, passe[1].x, passe[1].y), 'rope', 'la case du milieu doit bien être une corde');
  const combo = (path) => activeCombos(b, u, e, strike, ctxFor(b, u, e, strike, path))
    .some((c) => c.id === 'roperun');
  assert.equal(combo(passe), true, 'passer par les cordes déclenche la course');
  assert.equal(combo(finit), false, 's’y arrêter relève de « Rebond des cordes », pas de la course');
});

test('l’interface a de quoi annoncer l’élan avant de confirmer', () => {
  assert.equal(elanLabel(0, strike).good, false);
  assert.equal(elanLabel(4, strike).good, true);
  assert.equal(elanLabel(0, { type: 'submission' }), null);
});

test('l’IA préfère bouger plutôt que frapper sur place', () => {
  const b = mk(['jean_sina'], ['gunter']);
  const e = b.units.find((u) => u.team === 'enemy');
  const plan = planUnit(b, e);
  assert.ok(plan, 'l’IA doit produire un plan');
  assert.ok(plan.moveTo, 'un ennemi qui peut courir doit choisir de courir');
});
