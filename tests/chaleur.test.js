import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, autoPlay, endPlayerPhase, enemySteps, endEnemyPhase } from '../src/engine/battle.js';
import { exhibitionMatch, buildMatch, newGame, playerBonuses } from '../src/game/state.js';
import { avgHeat, coolCrowd, addHeat, HEAT_DECAY, HEAT_DECAY_MIN, HEAT_FLOOR } from '../src/engine/util.js';
import { SEASON } from '../src/data/campaign.js';
import { WRESTLERS_BY_ID as W } from '../src/data/wrestlers.js';

const vide = () => ({ heat: 100, stats: { heatSum: 0, heatTurns: 0 }, turn: 1 });

test('la foule refroidit toute seule, proportionnellement', () => {
  const b = vide();
  coolCrowd(b);
  assert.equal(b.heat, 100 - 100 * HEAT_DECAY, 'une salle pleine perd le plus');
  const chaud = b.heat;
  coolCrowd(b);
  assert.ok(100 - chaud > chaud - b.heat, 'une salle déjà tiède retombe moins vite');
  // Et chaque relevé nourrit la moyenne.
  assert.equal(b.stats.heatTurns, 2);
  assert.ok(avgHeat(b) > 0 && avgHeat(b) < 100);
});

test('une salle n’est jamais vide : la chaleur a un plancher', () => {
  const b = { heat: HEAT_FLOOR + 1, stats: { heatSum: 0, heatTurns: 0 }, turn: 1 };
  for (let i = 0; i < 40; i++) coolCrowd(b);
  assert.equal(b.heat, HEAT_FLOOR, 'la salle est venue, elle reste là');
  assert.ok(HEAT_DECAY_MIN < 4, 'une décrue trop raide punit le petit match, pas le joueur mou');
});

test('la chaleur moyenne dit autre chose que la chaleur finale', () => {
  const b = createBattle({ match: exhibitionMatch('singles', ['jean_sina'], ['gunter']), playerTeam: [W.jean_sina], seed: 21 });
  autoPlay(b, 400);
  assert.ok(b.stats.heatTurns > 5, 'la moyenne se relève tour par tour');
  // C'est TOUT l'intérêt : la jauge finit haut presque à chaque fois, la
  // moyenne non. Si les deux disaient la même chose, la mesure ne servirait
  // à rien — et c'est exactement ce qui clochait avant.
  assert.ok(avgHeat(b) < b.heat - 5, 'la moyenne est nettement sous le pic final');
  assert.ok(avgHeat(b) > HEAT_FLOOR, 'un vrai match réchauffe la salle');
});

test('un joueur qui ne fait rien ne tue pas la salle — mais ne la lève pas non plus', () => {
  // Trouvé en jouant : dans le premier match de la saison, un joueur passif
  // voyait la jauge à zéro 81 % du match.
  const st = newGame({ promoName: 'T', mode: 'kayfabe', starters: ['jean_sina', 'derby_allin', 'brian_danielsson'] });
  const md = SEASON.shows[0].matches[0];
  const b = createBattle({ match: buildMatch(st, md), playerTeam: [W.jean_sina], playerBonuses: playerBonuses(st), seed: 903 });
  let mortes = 0, tours = 0;
  for (let t = 0; t < 40 && !b.result; t++) {
    endPlayerPhase(b);
    for (const _ of enemySteps(b)) { if (b.result) break; }
    if (!b.result) endEnemyPhase(b);
    tours++; if (b.heat <= 0) mortes++;
  }
  assert.ok(tours > 10, 'le match doit vraiment se dérouler');
  assert.equal(mortes, 0, 'la jauge ne tombe jamais à zéro');
  assert.ok(avgHeat(b) < 40, 'ne rien faire ne lève pas une salle pour autant');
});

test('le pic et le tour d’allumage sont enregistrés', () => {
  const b = { heat: 0, turn: 7, stats: { heatSum: 0, heatTurns: 0, heatPeak: 0, heatTurn: 0 } };
  addHeat(b, 80);
  assert.equal(b.stats.heatPeak, 80);
  assert.equal(b.stats.heatTurn, 7, 'le tour où la salle s’est levée');
  b.turn = 12; addHeat(b, -50); addHeat(b, 10);
  assert.equal(b.stats.heatPeak, 80, 'le pic ne redescend pas');
  assert.equal(b.stats.heatTurn, 7, 'ni le tour d’allumage');
});
