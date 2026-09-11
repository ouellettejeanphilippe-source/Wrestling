import test from 'node:test';
import assert from 'node:assert/strict';
import { buildArena, tileAt, reachable, isOutside, TERRAIN } from '../src/engine/grid.js';

test('l’aréna standard a un ring entouré de cordes et de coins', () => {
  const g = buildArena('standard');
  assert.equal(g.w, 20); assert.equal(g.h, 16);
  // le ring est carré : 10×10 cordes comprises
  assert.equal(g.ring.rx1 - g.ring.rx0, g.ring.ry1 - g.ring.ry0);
  assert.equal(tileAt(g, 5, 3), 'turnbuckle');
  assert.equal(tileAt(g, 14, 12), 'turnbuckle');
  assert.equal(tileAt(g, 9, 3), 'rope');
  assert.equal(tileAt(g, 9, 7), 'ring');
  assert.equal(tileAt(g, 17, 8), 'table');
  assert.equal(tileAt(g, 0, 5), 'ramp');
  assert.ok(isOutside(g, 2, 7));
  assert.ok(!isOutside(g, 9, 7));
});

test('la cage entoure le ring et le reste est vide', () => {
  const g = buildArena('cage');
  assert.equal(tileAt(g, 3, 7), 'cage');
  assert.equal(tileAt(g, 0, 0), 'void');
  assert.equal(tileAt(g, 9, 7), 'ring');
  assert.ok(!TERRAIN.cage.passable);
});

test('les cordes coûtent plus cher et les ennemis bloquent le passage', () => {
  const g = buildArena('standard');
  const me = { x: 7, y: 7, team: 'player', flags: {} };
  const enemy = { x: 8, y: 7, team: 'enemy' };
  const r = reachable(g, [me, enemy], me, 2);
  assert.ok(!r.has('9,7'), 'ne peut pas traverser un ennemi en ligne droite avec 2 de mouvement');
  assert.ok(!r.has('8,7'), 'la case de l’ennemi est inaccessible');
  assert.ok(r.has('7,6'));
  const r2 = reachable(g, [me], { x: 6, y: 7, team: 'player', flags: {} }, 2);
  assert.equal(r2.get('5,7').cost, 2, 'entrer dans les cordes coûte 2');
  assert.ok(!r2.has('4,7'), 'sortir du ring en un tour de 2 MOV est impossible');
});

// --------------------------------------------------------------- gabarits 2×2
test('gabarit 2×2 : occupation, distance et déplacement', async () => {
  const { buildArena, manhattan, occupies, fits, reachable, key } = await import('../src/engine/grid.js');
  const g = buildArena('standard');
  const geant = { x: 6, y: 5, size: 2, team: 'player', flags: {} };
  const petit = { x: 8, y: 5, size: 1, team: 'enemy', flags: {} };

  // le colosse couvre bien ses quatre cases
  assert.ok(occupies(geant, 6, 5) && occupies(geant, 7, 6) && !occupies(geant, 8, 5));
  // son gabarit touche le petit : corps à corps malgré des ancres à 2 cases
  assert.equal(manhattan(geant, petit), 1);
  assert.equal(manhattan(petit, geant), 1);

  // il ne rentre pas là où une case du gabarit est infranchissable (barricade en y=0)
  assert.ok(!fits(g, [], geant, 7, 0));
  // ni là où il chevaucherait un adversaire
  assert.ok(!fits(g, [petit], geant, 7, 5));
  assert.ok(fits(g, [petit], geant, 6, 8));

  // ses cases atteignables excluent celles où le gabarit ne tient pas
  const reach = reachable(g, [geant, petit], geant, 4);
  const arrivee = reach.get(key(7, 5));
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

// ------------------------------------------------------------------- relief
test('le plateau a du relief : le ring est une plateforme qu’il faut escalader', async () => {
  const { buildArena, heightAt, reachable, key } = await import('../src/engine/grid.js');
  const g = buildArena('standard');
  assert.equal(heightAt(g, 2, 7), 0, 'le plancher est au niveau zéro');
  assert.equal(heightAt(g, 4, 13), 1, 'les marches d’acier sont à mi-hauteur');
  assert.equal(heightAt(g, 9, 7), 2, 'le tapis est surélevé');
  assert.equal(heightAt(g, 5, 3), 3, 'les coins dominent le ring');

  // depuis le plancher, entrer dans le ring coûte le terrain PLUS le dénivelé
  const u = { x: 4, y: 8, team: 'player', flags: {} };
  const petit = reachable(g, [], u, 3);
  assert.ok(!petit.has(key(5, 8)), '3 MOV ne suffisent pas à grimper sur le tablier');
  const grand = reachable(g, [], u, 4);
  assert.ok(grand.has(key(5, 8)), '4 MOV suffisent : 2 de cordes + 2 de dénivelé');
  // le coin culmine trop haut pour qu'on y saute depuis le plancher : il faut
  // passer par le tapis, donc en faire le tour — beaucoup plus loin.
  const coin = reachable(g, [], { x: 4, y: 12, team: 'player', flags: {} }, 5);
  assert.ok(!coin.has(key(5, 12)), 'pas de saut de trois niveaux depuis le plancher');
  const longTour = reachable(g, [], { x: 4, y: 12, team: 'player', flags: {} }, 12);
  assert.ok(longTour.has(key(5, 12)), 'mais on y grimpe depuis le tapis');
});

test('relief : on ne saute pas d’une hauteur impossible, et frapper d’en haut aide', async () => {
  const { buildArena, setHeight, reachable, key } = await import('../src/engine/grid.js');
  const { createBattle, hitChance } = await import('../src/engine/battle.js');
  const { WRESTLERS_BY_ID } = await import('../src/data/wrestlers.js');
  const { MOVES } = await import('../src/data/moves.js');

  const g = buildArena('standard');
  setHeight(g, 8, 7, 9);                       // une falaise au milieu du tapis
  const u = { x: 7, y: 7, team: 'player', flags: {} };
  const r = reachable(g, [], u, 9);
  assert.ok(!r.has(key(8, 7)), 'personne ne grimpe neuf niveaux d’un pas');

  const b = createBattle({ match: { id: 't', title: 'T', type: 'singles', enemies: ['jobber_1'] }, playerTeam: [WRESTLERS_BY_ID.derby_allin], seed: 7 });
  const a = b.units.find((x) => x.team === 'player'), d = b.units.find((x) => x.team === 'enemy');
  a.x = 5; a.y = 3; d.x = 6; d.y = 4;           // attaquant dans le coin (3), cible au tapis (2)
  const haut = hitChance(b, a, d, MOVES.powerbomb);
  a.x = 6; a.y = 5;                             // même niveau que la cible
  const plat = hitChance(b, a, d, MOVES.powerbomb);
  assert.ok(haut > plat, 'frapper depuis le coin doit être plus précis');
});
