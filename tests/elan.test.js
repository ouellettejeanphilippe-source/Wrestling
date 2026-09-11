// L'ÉLAN : le déplacement et le coup ne sont plus deux phases indépendantes.
// Ces tests verrouillent le lien — sans eux, un réglage de dégâts plus tard
// peut annuler l'incitation sans que rien ne casse.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, moveUnit, undoMove, computeDamage, elanMult, elanLabel, getReachable,
  activeCombos, comboContextFor, resolveAttack, endPlayerPhase, endEnemyPhase,
  MOVE_MOMENTUM_CAP, ELAN_MIN, ELAN_MAX, STATIC_MAX, staticFloor } from '../src/engine/battle.js';
import { MOVES } from '../src/data/moves.js';
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

test('« Pris à revers » demande le dos ET le déplacement', () => {
  const b = mk(['jean_sina'], ['gunter']);
  const [u, e] = b.units;
  e.x = u.x + 1; e.y = u.y;                       // le joueur est à l'ouest de l'ennemi
  const combo = (facing, travel) => {
    e.facing = facing;
    const ctx = comboContextFor(b, u, e, strike, { x: u.x, y: u.y, path: null, travel });
    return activeCombos(b, u, e, strike, ctx).some((c) => c.id === 'blindside');
  };
  assert.equal(combo('nw', 1), false, 'l’ennemi regarde vers nous : pas de bonus');
  assert.equal(combo('sw', 1), false, 'de flanc non plus — il faut le dos, pas « tout sauf de face »');
  assert.equal(combo('se', 1), true, 'il regarde à l’opposé : contourné');
  assert.equal(combo('se', 0), false, 'être déjà derrière ne compte pas : il faut y arriver');
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

// ---------------------------------------------------------------- statisme
// L'immobilité s'aggrave : un tour sur place est un choix, trois d'affilée
// est un match qui s'enlise.

test('le statisme creuse le plancher de l’élan, pas son plafond', () => {
  assert.equal(staticFloor(0), ELAN_MIN);
  assert.ok(staticFloor(1) < staticFloor(0));
  assert.ok(staticFloor(3) < staticFloor(2));
  assert.equal(staticFloor(9), staticFloor(STATIC_MAX), 'le creux a un fond');
  const b = mk(['jean_sina'], ['gunter']);
  const u = b.units[0];
  u.static = STATIC_MAX;
  assert.ok(elanMult(0, strike, u) < ELAN_MIN, 'planté et ankylosé fait moins mal que planté');
  assert.equal(elanMult(4, strike, u), ELAN_MAX, 'une vraie course efface l’ankylose');
});

test('le compteur monte tour après tour et retombe dès qu’on marche', () => {
  const b = mk(['jean_sina'], ['gunter']);
  const u = b.units[0];
  const tour = () => { endPlayerPhase(b); endEnemyPhase(b); };
  assert.equal(u.static, 0);
  tour(); assert.equal(u.static, 1);
  tour(); assert.equal(u.static, 2);
  tour(); assert.equal(u.static, 3);
  tour(); assert.equal(u.static, STATIC_MAX, 'plafonné');
  assert.ok(moveUnit(b, u, u.x + 1, u.y) || moveUnit(b, u, u.x - 1, u.y));
  tour();
  assert.equal(u.static, 0, 'une case suffit à repartir de zéro');
});

test('un match qui s’enlise refroidit la salle', () => {
  const b = mk(['jean_sina'], ['gunter']);
  b.heat = 60;
  for (let i = 0; i < 4; i++) { endPlayerPhase(b); endEnemyPhase(b); }
  assert.ok(b.heat < 60, `la chaleur devait baisser, elle est à ${b.heat}`);
});

test('un lutteur au sol ne se fait pas compter comme immobile', () => {
  const b = mk(['jean_sina'], ['gunter']);
  const u = b.units[0];
  u.down = true; u.downTurns = 1;
  endPlayerPhase(b); endEnemyPhase(b);
  assert.equal(u.static, 0, 'il ne choisit pas de rester par terre');
});

// ------------------------------------------------------ portée élargie
test('un coup en ligne touche ce qui est aligné derrière la cible', () => {
  const b = mk(['jean_sina'], ['gunter', 'randy_python']);
  const [u, a, c] = b.units;
  u.x = 7; u.y = 7; a.x = 8; a.y = 7; c.x = 9; c.y = 7;   // tous alignés
  const hp = c.hp;
  const ligne = { ...strike, effects: { line: 1 } };
  resolveAttack(b, u, a, ligne);
  assert.ok(c.hp < hp, 'le troisième lutteur devait encaisser aussi');
});

test('un coup de zone touche les voisins de la cible, alliés compris', () => {
  const b = mk(['jean_sina'], ['gunter', 'randy_python']);
  const [u, a, c] = b.units;
  u.x = 7; u.y = 7; a.x = 8; a.y = 7; c.x = 8; c.y = 8;   // c. est voisin de a.
  const hp = c.hp;
  resolveAttack(b, u, a, { ...strike, effects: { splash: 0.5 } });
  assert.ok(c.hp < hp, 'le voisin devait être pris dans le mouvement');
  assert.ok(a.maxHp - a.hp > c.maxHp - c.hp, 'la cible principale encaisse plus que l’éclaboussure');
});

test('un coup sans ligne ni zone ne touche que sa cible', () => {
  const b = mk(['jean_sina'], ['gunter', 'randy_python']);
  const [u, a, c] = b.units;
  u.x = 7; u.y = 7; a.x = 8; a.y = 7; c.x = 9; c.y = 7;
  const hp = c.hp;
  resolveAttack(b, u, a, strike);
  assert.equal(c.hp, hp);
});

test('le catalogue attache bien ligne, zone et recul à de vrais mouvements', () => {
  const avec = (k) => Object.values(MOVES).filter((m) => m.effects && m.effects[k]).length;
  assert.ok(avec('line') >= 2, 'au moins deux mouvements traversants');
  assert.ok(avec('splash') >= 3, 'au moins trois mouvements de zone');
  assert.ok(avec('push') >= 8, 'le recul doit être répandu, pas anecdotique');
});
