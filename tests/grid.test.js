import test from 'node:test';
import assert from 'node:assert/strict';
import { buildArena, tileAt, reachable, isOutside, TERRAIN } from '../src/engine/grid.js';

test('l’aréna standard a un ring entouré de cordes et de coins', () => {
  const g = buildArena('standard');
  assert.equal(tileAt(g, 3, 2), 'turnbuckle');
  assert.equal(tileAt(g, 10, 7), 'turnbuckle');
  assert.equal(tileAt(g, 5, 2), 'rope');
  assert.equal(tileAt(g, 5, 4), 'ring');
  assert.equal(tileAt(g, 12, 4), 'table');
  assert.equal(tileAt(g, 0, 3), 'ramp');
  assert.ok(isOutside(g, 1, 4));
  assert.ok(!isOutside(g, 5, 4));
});

test('la cage entoure le ring et le reste est vide', () => {
  const g = buildArena('cage');
  assert.equal(tileAt(g, 2, 4), 'cage');
  assert.equal(tileAt(g, 0, 0), 'void');
  assert.equal(tileAt(g, 5, 4), 'ring');
  assert.ok(!TERRAIN.cage.passable);
});

test('les cordes coûtent plus cher et les ennemis bloquent le passage', () => {
  const g = buildArena('standard');
  const me = { x: 5, y: 4, team: 'player', flags: {} };
  const enemy = { x: 6, y: 4, team: 'enemy' };
  const r = reachable(g, [me, enemy], me, 2);
  assert.ok(!r.has('7,4'), 'ne peut pas traverser un ennemi en ligne droite avec 2 de mouvement');
  assert.ok(!r.has('6,4'), 'la case de l’ennemi est inaccessible');
  assert.ok(r.has('4,3'));
  const r2 = reachable(g, [me], { x: 4, y: 4, team: 'player', flags: {} }, 2);
  assert.equal(r2.get('3,4').cost, 2, 'entrer dans les cordes coûte 2');
  assert.ok(!r2.has('2,4'), 'sortir du ring en un tour de 2 MOV est impossible');
});
