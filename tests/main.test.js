// LA MAIN
//
// On ne choisit plus le meilleur coup parmi dix-huit, on joue ce qu'on a
// pioché. Ces tests verrouillent les trois choses sans lesquelles le système
// se retourne contre le jeu : les fondamentaux toujours disponibles (une
// mauvaise main ne doit jamais être une impasse), ce qu'on garde d'un tour à
// l'autre (sinon on ne peut poursuivre aucun plan), et la soupape.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, autoPlay, listActions, executeAction, startPhase } from '../src/engine/battle.js';
import { planUnit } from '../src/engine/ai.js';
import { isCard, availableMoves, buildDeck, deckState, ALWAYS, HAND_SIZE } from '../src/engine/hand.js';
import { WRESTLERS_BY_ID as W } from '../src/data/wrestlers.js';
import { MOVES } from '../src/data/moves.js';

const mk = (players, enemies, seed = 42) => createBattle({
  match: { id: 't', title: 'T', type: 'singles', enemies }, playerTeam: players.map((id) => W[id]), seed,
});
const colle = (b) => { const [u, e] = b.units; u.x = e.x - 1; u.y = e.y; return [u, e]; };

test('les fondamentaux ne se piochent jamais', () => {
  for (const id of ['punch', 'grapple', 'whip', 'taunt']) {
    assert.equal(isCard(id), false, `${id} doit rester toujours disponible`);
    assert.ok(ALWAYS.has(id) || MOVES[id].type === 'taunt');
  }
  // La signature et le finisher non plus : ils se méritent à la jauge.
  assert.equal(isCard('coffin_drop'), false, 'un finisher ne se tire pas au sort');
  assert.equal(isCard('derby_crossbody'), false, 'une signature non plus');
  // Tout le reste est une carte.
  assert.equal(isCard('moonsault'), true);
  assert.equal(isCard('chop_block'), true);
});

test('on démarre avec une main pleine, et le talon contient le reste du répertoire', () => {
  const b = mk(['derby_allin'], ['gunter']);
  const [u] = b.units;
  assert.equal(u.hand.length, HAND_SIZE, 'main pleine au coup d’envoi');
  const d = deckState(u);
  assert.equal(d.main + d.talon + d.defausse, buildDeck(u).length, 'aucune carte perdue en route');
  for (const id of u.hand) assert.ok(isCard(id), `${id} est bien une carte`);
});

test('une mauvaise main n’est jamais une impasse', () => {
  const b = mk(['derby_allin'], ['gunter']);
  const [u, e] = colle(b);
  u.hand = [];                                   // le pire cas : plus rien en main
  const acts = listActions(b, u).filter((a) => a.ok);
  assert.ok(acts.some((a) => a.id === 'punch'), 'frapper reste possible');
  assert.ok(acts.some((a) => a.id === 'grapple'), 'attraper aussi');
  assert.ok(acts.some((a) => a.id === 'taunt'), 'et provoquer');
  // Et l'IA ne se bloque pas non plus.
  const plan = planUnit(b, u);
  assert.ok(plan && plan.action && plan.action.id, 'elle trouve toujours quelque chose à faire');
});

test('ce qu’on ne joue pas, on le garde : c’est ce qui permet un plan', () => {
  const b = mk(['jean_sina'], ['gunter']);
  const [u, e] = colle(b);
  // Une carte conditionnelle qu'on ne peut pas jouer tout de suite.
  u.hand = ['bodyslam', 'chop_block', 'snapmare', 'stomp_away'];
  const garde = [...u.hand];
  u.momentum = 40;
  executeAction(b, u, 'punch', { unit: e });     // on joue un fondamental
  assert.deepEqual(u.hand, garde, 'jouer une base ne touche pas à la main');

  u.acted = false;
  executeAction(b, u, 'bodyslam', { unit: e });  // on joue une carte
  assert.ok(!u.hand.includes('bodyslam'), 'la carte jouée part à la défausse');
  assert.ok(u.discard.includes('bodyslam'));
  assert.ok(u.hand.includes('chop_block'), 'le reste de la main est intact — le plan tient');
});

test('on repioche au début de son tour, jusqu’à la taille de main', () => {
  const b = mk(['jean_sina'], ['gunter']);
  const [u] = b.units;
  u.hand = u.hand.slice(0, 1);
  u.hadTurn = true;
  startPhase(b, 'player');
  assert.equal(u.hand.length, HAND_SIZE, 'la main est refaite');
});

test('jeter sa main coûte le tour et fait souffler', () => {
  const b = mk(['jean_sina'], ['gunter']);
  const [u] = colle(b);
  const avant = [...u.hand];
  const a = listActions(b, u).find((x) => x.id === 'redraw');
  assert.ok(a && a.ok, 'la soupape existe toujours');
  u.stamina = 40;
  executeAction(b, u, 'redraw');
  assert.equal(u.hand.length, HAND_SIZE, 'on repioche autant');
  assert.equal(u.rested, true, 'et on reprend son souffle, comme en provoquant');
  assert.equal(u.acted, true, 'mais ça coûte le tour');
  for (const id of avant) assert.ok(u.discard.includes(id) || u.hand.includes(id), 'aucune carte perdue');
});

test('le talon se reconstitue avec la défausse : on ne tombe jamais à court', () => {
  const b = mk(['jean_sina'], ['gunter']);
  const [u] = b.units;
  const total = buildDeck(u).length;
  for (let i = 0; i < 40; i++) {
    u.hand = [];
    startPhase(b, 'player');
    assert.ok(u.hand.length > 0, `tour ${i} : il reste toujours des cartes`);
    u.discard.push(...u.hand);
    u.hand = [];
  }
  assert.ok(total > 0);
});

test('la main change ce que l’IA a sous la main, sans la bloquer', () => {
  // Garde-fou global : avec une main, un match complet doit toujours se
  // conclure, et l'IA doit passer l'essentiel de ses tours à lutter — pas à
  // jeter ses cartes. C'est le piège exact qui s'est produit une fois : la
  // défausse notée dans la boucle principale battait les vraies attaques, et
  // 56 % des tours étaient des défausses pour des matchs de quarante tours et
  // vingt coups.
  let coups = 0, tours = 0, finis = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const b = mk(['brian_danielsson'], ['gunter'], seed);
    autoPlay(b, 200);
    if (b.result) finis++;
    tours += b.turn;
    for (const l of b.log) if (/ dégâts/.test(l.text)) coups++;
  }
  assert.equal(finis, 8, 'tous les matchs se concluent');
  assert.ok(coups / tours > 0.5, `il se passe quelque chose la plupart des tours (${(coups / tours).toFixed(2)} coup/tour)`);
});

test('la variété : la main empêche de matraquer le même mouvement', () => {
  const b = mk(['brian_danielsson'], ['gunter'], 11);
  autoPlay(b, 200);
  const par = new Map();
  let total = 0;
  for (const l of b.log) {
    const m = /→ (.+?) sur /.exec(l.text);
    if (m) { par.set(m[1], (par.get(m[1]) || 0) + 1); total++; }
  }
  assert.ok(total >= 10, 'le match a de la matière');
  const pire = Math.max(...par.values()) / total;
  assert.ok(pire <= 0.45, `aucun mouvement ne monopolise le match (${(pire * 100) | 0} %)`);
  assert.ok(par.size >= 8, `et le vocabulaire est large (${par.size} mouvements)`);
});
