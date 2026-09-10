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

// --------------------------------------------------------------- gabarits 2×2
test('gabarit 2×2 : occupation, distance et déplacement', async () => {
  const { buildArena, manhattan, occupies, fits, reachable, key } = await import('../src/engine/grid.js');
  const g = buildArena('standard');
  const geant = { x: 4, y: 3, size: 2, team: 'player', flags: {} };
  const petit = { x: 6, y: 3, size: 1, team: 'enemy', flags: {} };

  // le colosse couvre bien ses quatre cases
  assert.ok(occupies(geant, 4, 3) && occupies(geant, 5, 4) && !occupies(geant, 6, 3));
  // son gabarit touche le petit : corps à corps malgré des ancres à 2 cases
  assert.equal(manhattan(geant, petit), 1);
  assert.equal(manhattan(petit, geant), 1);

  // il ne rentre pas là où une case du gabarit est infranchissable (barricade en y=0)
  assert.ok(!fits(g, [], geant, 5, 0));
  // ni là où il chevaucherait un adversaire
  assert.ok(!fits(g, [petit], geant, 5, 3));
  assert.ok(fits(g, [petit], geant, 4, 5));

  // ses cases atteignables excluent celles où le gabarit ne tient pas
  const reach = reachable(g, [geant, petit], geant, 4);
  const arrivee = reach.get(key(5, 3));
  assert.ok(!arrivee || arrivee.blocked, 'ne doit pas pouvoir s’arrêter sur l’adversaire');
});

test('gabarit 2×2 : un colosse réel apparaît et joue sans casser le moteur', async () => {
  const { createBattle, autoPlay } = await import('../src/engine/battle.js');
  const { WRESTLERS_BY_ID } = await import('../src/data/wrestlers.js');
  const { exhibitionMatch } = await import('../src/game/state.js');
  const { unitAt } = await import('../src/engine/util.js');
  const geantDef = WRESTLERS_BY_ID.le_geant;
  assert.equal(geantDef.weight, 'super');
  const match = exhibitionMatch('singles', ['le_geant'], ['jean_sina']);
  const b = createBattle({ match, playerTeam: [geantDef], seed: 12 });
  const geant = b.units.find((u) => u.id === 'le_geant');
  assert.equal(geant.size, 2);
  // on le retrouve depuis n'importe laquelle de ses quatre cases
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    assert.equal(unitAt(b, geant.x + dx, geant.y + dy), geant);
  }
  const res = autoPlay(b, 60);
  assert.ok(res === null || res.winner, 'le match doit se dérouler jusqu’au bout');
});
