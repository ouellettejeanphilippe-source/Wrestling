import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, train, recruit, applyResult, buildMatch, currentShow, exhibitionMatch } from '../src/game/state.js';
import { evaluateScript, finishMatches } from '../src/game/script.js';
import { createBattle, autoPlay } from '../src/engine/battle.js';
import { WRESTLERS_BY_ID } from '../src/data/wrestlers.js';
import { SEASON } from '../src/data/campaign.js';

test('nouvelle partie : roster, agents libres, entraînement et recrutement', () => {
  const st = newGame({ promoName: 'Test', mode: 'kayfabe', starters: ['jean_sina', 'derby_allin', 'brian_danielsson'] });
  assert.equal(st.roster.length, 3);
  assert.equal(st.freeAgents.length, 3);
  assert.ok(!st.freeAgents.includes('jean_sina'));
  const money = st.money;
  assert.ok(train(st, 'jean_sina', 'str').ok);
  assert.equal(st.roster[0].bonus.str, 1);
  assert.ok(st.money < money);
  const id = st.freeAgents[0];
  st.money = 5000;
  assert.ok(recruit(st, id).ok);
  assert.equal(st.roster.length, 4);
  assert.ok(!st.freeAgents.includes(id));
});

test('mode kayfabe : la victoire fait avancer l’épisode, la défaite non', () => {
  const st = newGame({ promoName: 'T', mode: 'kayfabe', starters: ['jean_sina', 'derby_allin', 'brian_danielsson'] });
  const m = currentShow(st).matches[0];
  const b = createBattle({ match: buildMatch(st, m), playerTeam: [WRESTLERS_BY_ID.jean_sina], seed: 5 });
  b.result = { winner: 'player', reason: 'x', turns: 5 };
  const s = applyResult(st, b, m, ['jean_sina']);
  assert.ok(s.advance && st.showIndex === 1 && s.money > 0);
  const m2 = currentShow(st).matches[0];
  const b2 = createBattle({ match: buildMatch(st, m2), playerTeam: [WRESTLERS_BY_ID.jean_sina], seed: 5 });
  b2.result = { winner: 'enemy', reason: 'x', turns: 5 };
  const s2 = applyResult(st, b2, m2, ['jean_sina']);
  assert.ok(!s2.advance && st.showIndex === 1 && s2.fans <= 0);
});

test('mode scénarios : le finish et les spots donnent une note, un shoot plafonne à 1,5★', () => {
  const st = newGame({ promoName: 'T', mode: 'scenario', starters: ['jean_sina', 'derby_allin', 'brian_danielsson'] });
  const m = SEASON.shows[0].matches[1]; // le vétéran doit gagner par tombé après finisher
  const b = createBattle({ match: buildMatch(st, m), playerTeam: [WRESTLERS_BY_ID.jean_sina], seed: 5 });
  assert.equal(b.mode, 'scenario');
  b.result = { winner: 'player', reason: 'x', turns: 5 };
  b.stats.lastElimReason = 'pin';
  assert.ok(!finishMatches(b, m.script.finish));
  assert.ok(evaluateScript(b, m.script).stars <= 1.5);
  b.result = { winner: 'enemy', reason: 'x', turns: 5 };
  b.stats.finisherFinish = true; b.stats.sells = 3; b.stats.playerKickouts = 1; b.heat = 80;
  const ev = evaluateScript(b, m.script);
  assert.ok(ev.finishOk && ev.stars >= 4);
  const s = applyResult(st, b, m, ['jean_sina']);
  assert.ok(s.advance && s.script.stars >= 4 && st.showIndex === 1);
});

test('un match d’exhibition complet se joue de bout en bout', () => {
  const m = exhibitionMatch('hardcore', ['jon_moxie', 'gunter'], ['kenny_alpha', 'mjg'], 11);
  const b = createBattle({ match: m, playerTeam: [WRESTLERS_BY_ID.jon_moxie, WRESTLERS_BY_ID.gunter], seed: 11 });
  const r = autoPlay(b);
  assert.ok(r);
});
