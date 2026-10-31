// LES CARTES TACTIQUES
//
// Un deck de coups, c'est un menu : on joue le meilleur. Un tiers de Slay the
// Spire ne fait pas de dégâts — garde, pioche, mouvement — et c'est ce tiers
// qui fait les décisions. Trois cartes qui ne frappent personne : Se couvrir,
// Reprendre sa course, Plan de match.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, autoPlay, listActions, executeAction, moveUnit, moveRange, applyDamage, startPhase } from '../src/engine/battle.js';
import { energyCost } from '../src/engine/hand.js';
import { WRESTLERS_BY_ID as W, WRESTLERS } from '../src/data/wrestlers.js';
import { MOVES } from '../src/data/moves.js';
import { isCard } from '../src/engine/hand.js';
import { CARD_POOL } from '../src/game/deck.js';

const mk = (players, enemies, seed = 42) => createBattle({
  match: { id: 't', title: 'T', type: 'singles', enemies }, playerTeam: players.map((id) => W[id]), seed,
});

test('les trois cartes tactiques existent, coûtent un point, et se piochent', () => {
  for (const id of ['brace', 'regroup', 'game_plan']) {
    assert.equal(MOVES[id].type, 'tactic', `${id} n’est pas un coup`);
    assert.ok(isCard(id), `${id} se pioche`);
    assert.ok(CARD_POOL.includes(id), `${id} peut être offerte après un match`);
    assert.equal(energyCost({ move: MOVES[id], type: 'tactic' }), 1, `${id} coûte un point d’énergie`);
  }
  // Chaque classe en a au moins une dans son kit : aucune n'est réservée à la boutique.
  const kits = WRESTLERS.filter((w) => !w.npc).map((w) => mk([w.id], ['jobber_1']).units[0].moves);
  assert.ok(kits.every((m) => ['brace', 'regroup', 'game_plan'].some((id) => m.includes(id))), 'tous les lutteurs ont une carte tactique');
});

test('Se couvrir : le prochain coup reçu fait moitié moins, une seule fois', () => {
  const b = mk(['jean_sina'], ['gunter']);
  const [u, e] = b.units;
  u.hand = ['brace', 'punch'];
  assert.ok(listActions(b, u).find((a) => a.id === 'brace').ok);
  executeAction(b, u, 'brace');
  assert.equal(u.guard, true);
  assert.equal(listActions(b, u).find((a) => a.id === 'brace'), undefined, 'jouée, elle a quitté la main');
  const hp0 = u.hp;
  applyDamage(b, u, 40, e, {});
  assert.equal(hp0 - u.hp, 20, 'le coup fait moitié moins');
  assert.equal(u.guard, false, 'la garde est consommée');
  const hp1 = u.hp;
  applyDamage(b, u, 40, e, {});
  assert.equal(hp1 - u.hp, 40, 'le coup suivant passe plein pot');
});

test('la garde ne protège pas de ce qu’on se fait soi-même, et tombe au tour suivant', () => {
  const b = mk(['jean_sina'], ['gunter']);
  const [u, e] = b.units;
  u.guard = true;
  const hp0 = u.hp;
  applyDamage(b, u, 10, null, { self: true });
  assert.equal(hp0 - u.hp, 10, 'les dégâts qu’on s’inflige passent entiers');
  assert.equal(u.guard, true, 'et ne consomment pas la garde');
  startPhase(b, 'enemy'); startPhase(b, 'player');
  assert.equal(u.guard, false, 'elle ne dure pas au-delà du tour suivant');
});

test('Reprendre sa course redonne un déplacement, avec des cases de plus', () => {
  const b = mk(['jean_sina'], ['jobber_1']);
  const [u] = b.units;
  u.hand = ['regroup', 'punch'];
  const base = moveRange(b, u);
  assert.ok(moveUnit(b, u, u.x - 1, u.y), 'un premier déplacement');
  assert.equal(u.moved, true);
  assert.equal(moveUnit(b, u, u.x - 1, u.y), false, 'pas deux sans la carte');
  executeAction(b, u, 'regroup');
  assert.equal(u.moved, false, 'le droit de se déplacer est revenu');
  assert.equal(moveRange(b, u), base + 2, 'avec deux cases de plus');
  assert.ok(moveUnit(b, u, u.x - 1, u.y), 'un second déplacement');
  assert.equal(moveRange(b, u), base, 'le bonus ne vaut que pour un déplacement');
});

test('Plan de match pioche deux cartes de plus', () => {
  const b = mk(['jean_sina'], ['jobber_1']);
  const [u] = b.units;
  u.hand = ['game_plan', 'punch', 'grapple'];
  executeAction(b, u, 'game_plan');
  // 3 en main, 1 jouée, 2 piochées : 4.
  assert.equal(u.hand.length, 4, `la main a gagné deux cartes (${u.hand.length})`);
  assert.ok(!u.hand.includes('game_plan'), 'la carte jouée est partie');
  assert.equal(u.energy, 2, 'elle a coûté un point');
  assert.equal(u.acted, false, 'et le tour continue');
});

test('l’IA joue ces cartes au lieu de les garder mortes en main', () => {
  const ids = WRESTLERS.filter((w) => !w.npc).map((w) => w.id);
  let garde = 0, course = 0, plan = 0;
  const n = 30;
  for (let seed = 1; seed <= n; seed++) {
    const b = mk([ids[seed % ids.length]], [ids[(seed * 7 + 3) % ids.length]], seed);
    autoPlay(b, 300);
    garde += b.log.filter((l) => /se couvre :/.test(l.text)).length;
    course += b.log.filter((l) => /reprend sa course/.test(l.text)).length;
    plan += b.log.filter((l) => /repense son tour/.test(l.text)).length;
  }
  assert.ok(garde / n >= 0.5, `se couvrir est joué (${(garde / n).toFixed(2)} par match)`);
  assert.ok(course + plan > 0, 'et les deux autres aussi, de temps en temps');
  assert.ok(garde / n <= 4, 'sans que la garde devienne le seul coup du match');
});
