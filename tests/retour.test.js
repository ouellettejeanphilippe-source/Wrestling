// LE RETOUR VISUEL D'UN COUP
//
// Un coup, c'était une ligne de journal et un nombre qui flotte. L'écran sait
// maintenant faire s'élancer l'attaquant, reculer la cible, claquer une
// onomatopée et lancer la carte de la main vers la case visée — mais il ne
// peut le faire que si le moteur dit QUI frappe QUI, et d'où. Ces tests
// verrouillent cette information, et deux pièges de CSS.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createBattle, executeAction, resolveAttack, endPlayerPhase, enemySteps } from '../src/engine/battle.js';
import { WRESTLERS_BY_ID as W } from '../src/data/wrestlers.js';
import { MOVES } from '../src/data/moves.js';

const mk = (players, enemies, seed = 42) => createBattle({
  match: { id: 't', title: 'T', type: 'singles', enemies }, playerTeam: players.map((id) => W[id]), seed,
});
const racine = new URL('..', import.meta.url).pathname;

test('un coup dit qui frappe qui, d’où, et de quelle nature', () => {
  const b = mk(['jean_sina'], ['jobber_1']);
  const [u, e] = b.units;
  u.x = e.x - 1; u.y = e.y; u.hand = ['punch'];
  b.events.length = 0;
  executeAction(b, u, 'punch', { unit: e });
  const ev = b.events.find((x) => x.type === 'attack');
  assert.ok(ev, 'un événement d’attaque');
  assert.deepEqual(ev.from, { x: u.x, y: u.y }, 'il part de la case de l’attaquant');
  assert.deepEqual({ x: ev.x, y: ev.y }, { x: e.x, y: e.y }, 'et vise celle de la cible');
  assert.equal(ev.uid, u.uid); assert.equal(ev.tuid, e.uid);
  assert.equal(ev.kind, 'strike'); assert.equal(ev.tier, 'base'); assert.equal(ev.name, 'Coup de poing');
});

test('l’élan précède les dégâts, pour que l’écran puisse enchaîner élan puis recul', () => {
  const b = mk(['jean_sina'], ['jobber_1']);
  const [u, e] = b.units;
  u.x = e.x - 1; u.y = e.y; u.hand = ['punch']; e.statuses.dazed = 3;
  b.events.length = 0;
  for (let i = 0; i < 6 && !b.events.some((x) => x.type === 'damage'); i++) { u.acted = false; u.energy = 3; u.hand = ['punch']; executeAction(b, u, 'punch', { unit: e }); }
  const types = b.events.map((x) => x.type);
  assert.ok(types.indexOf('attack') >= 0 && types.indexOf('damage') > types.indexOf('attack'), `attack avant damage (${types.join(', ')})`);
});

test('un coup raté ou renversé s’élance quand même', () => {
  const b = mk(['jean_sina'], ['gunter']);
  const [u, e] = b.units;
  u.x = e.x - 1; u.y = e.y; b.events.length = 0;
  resolveAttack(b, u, e, MOVES.powerbomb);
  assert.ok(b.events.some((x) => x.type === 'attack'), 'peu importe l’issue, le coup est parti');
});

test('le coup dans le vide dit d’où il part et sur qui', () => {
  let vu = null;
  for (let seed = 1; seed <= 30 && !vu; seed++) {
    const b = mk(['rey_mysterioso'], ['gunter'], seed);
    const p = b.units.find((x) => x.team === 'player'), e = b.units.find((x) => x.team === 'enemy');
    if (!e.intent || !e.intent.targetUid) continue;
    p.x = 1; p.y = 1; p.acted = true;
    endPlayerPhase(b);
    for (const _ of enemySteps(b)) { /* consomme */ }
    vu = b.events.find((x) => x.type === 'whiff');
    if (vu) { assert.ok(vu.to && Number.isInteger(vu.to.x), 'la cible visée'); assert.equal(vu.tuid, p.uid); assert.ok(vu.uid); }
  }
  assert.ok(vu, 'au moins un coup dans le vide en trente matchs');
});

test('CSS : les textes flottants suivent l’angle de la caméra, et les impacts passent par-dessus les pions', () => {
  const css = readFileSync(`${racine}styles.css`, 'utf8');
  const bloc = css.slice(css.indexOf('@keyframes floatUpIso'), css.indexOf('@keyframes floatUpIso') + 700);
  assert.ok(bloc.includes('var(--iso-out)'), 'floatUpIso lit --iso-out');
  assert.ok(!/rotate\(-45deg\)/.test(bloc), 'plus de -45° en dur : il couchait les textes dès qu’on tournait la vue');
  // Les pions ont un z-index de 10 + x + y (jusqu'à 40 environ) : en dessous, l'onomatopée est cachée.
  const z = (sel) => Number((css.match(new RegExp(`${sel}[^}]*?z-index: (\\d+)`)) || [])[1]);
  assert.ok(z('\\.impact \\{') >= 100, '.impact au-dessus des pions');
  assert.ok(z('\\.float \\{') >= 100, '.float au-dessus des pions');
});

test('les animations de coup passent par `translate`, pas par `transform` (la contre-rotation isométrique reste intacte)', () => {
  const src = readFileSync(`${racine}src/ui/match.js`, 'utf8');
  const pousse = src.slice(src.indexOf('function pousse('), src.indexOf('function pousse(') + 600);
  assert.ok(/translate:/.test(pousse) && !/transform:/.test(pousse), 'pousse() anime `translate`');
  assert.ok(src.includes('REDUCED'), 'et respecte prefers-reduced-motion');
});
