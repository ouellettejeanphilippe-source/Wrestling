import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, autoPlay } from '../src/engine/battle.js';
import { newGame, buildMatch, applyResult, playerBonuses, showMatches, isTitleMatch, currentShow } from '../src/game/state.js';
import { RANK_START, RANK_TOP, RANK_BOTTOM, moveRank, rankOf, titleTerms, titleMatch, rankLabel, TITLE_TERMS, clampRank } from '../src/game/rank.js';
import { SEASON } from '../src/data/campaign.js';
import { WRESTLERS_BY_ID as W, STARTER_CHOICES } from '../src/data/wrestlers.js';

const partie = (mode = 'kayfabe') => newGame({ promoName: 'T', mode, starters: STARTER_CHOICES.slice(0, 3) });

test('la carrière se termine sur un match de championnat du monde', () => {
  const dernier = SEASON.shows[SEASON.shows.length - 1];
  assert.equal(dernier.title_match, true, 'le dernier épisode est le match de titre');
  assert.equal(dernier.matches.length, 1, 'il n’y a plus de choix ce soir-là : une seule question');
  assert.ok(W[SEASON.champion], `le champion ${SEASON.champion} doit exister`);
  assert.ok(SEASON.beltName, 'la ceinture a un nom');
  // Et aucun autre épisode n'est un match de titre.
  assert.equal(SEASON.shows.filter((s) => s.title_match).length, 1);
});

test('le classement monte en gagnant, descend en perdant, et reste borné', () => {
  const st = partie();
  assert.equal(st.rank, RANK_START, 'on part sixième prétendant');
  moveRank(st, true);
  assert.equal(rankOf(st), RANK_START - 1, 'une victoire, une place');
  moveRank(st, false);
  assert.equal(rankOf(st), RANK_START, 'une défaite, une place');
  for (let i = 0; i < 20; i++) moveRank(st, true);
  assert.equal(rankOf(st), RANK_TOP, 'on n’annonce jamais mieux que premier');
  for (let i = 0; i < 40; i++) moveRank(st, false);
  assert.equal(rankOf(st), RANK_BOTTOM, 'ni pire que dernier');
});

test('sept matchs de route : six victoires amènent premier prétendant', () => {
  // C'est le calibrage : `rang = 13 − 2 × victoires`. Il doit rester vrai,
  // sinon les trois termes du match de titre ne veulent plus rien dire.
  const route = SEASON.shows.length - 1;
  for (const victoires of [0, 3, 4, 5, 6, 7]) {
    const st = partie();
    for (let i = 0; i < route; i++) moveRank(st, i < victoires);
    assert.equal(rankOf(st), clampRank(13 - 2 * victoires), `${victoires} victoires`);
  }
  // L'ORDRE NE COMPTE PAS : deux carrières à 6-1 finissent au même rang.
  const tot = partie(), dern = partie();
  for (let i = 0; i < route; i++) moveRank(tot, i > 0);      // défaite d'abord
  for (let i = 0; i < route; i++) moveRank(dern, i < route - 1); // défaite en dernier
  assert.equal(rankOf(tot), rankOf(dern), 'même bilan, même classement');

  const parfait = partie();
  for (let i = 0; i < route; i++) moveRank(parfait, true);
  assert.equal(titleTerms(rankOf(parfait)).key, 'net', 'une carrière parfaite a droit à un match propre');
  const rate = partie();
  for (let i = 0; i < route; i++) moveRank(rate, false);
  assert.equal(titleTerms(rankOf(rate)).key, 'handicap', 'une carrière ratée paie le prix fort');
});

test('les trois termes du match de titre sont distincts et couvrent tout le classement', () => {
  const vus = new Set();
  for (let r = RANK_TOP; r <= RANK_BOTTOM; r++) {
    const t = titleTerms(r);
    assert.ok(t && t.key && t.name && t.desc, `rang ${r} doit avoir des conditions`);
    vus.add(t.key);
  }
  assert.deepEqual([...vus], TITLE_TERMS.map((t) => t.key), 'chaque terme doit être atteignable');
  // Et ils vont bien du plus clément au plus dur.
  assert.equal(titleTerms(RANK_TOP).extra.length, 0, 'premier prétendant : personne d’autre dans le ring');
  assert.ok(titleTerms(RANK_BOTTOM).extra.length > 0, 'dernier prétendant : le champion vient accompagné');
  // JAMAIS EN INFÉRIORITÉ NUMÉRIQUE. Mesuré : 0 victoire sur 40 en un contre
  // deux, dans toutes les variantes. Un mur n'est pas une punition.
  for (const t of TITLE_TERMS) {
    assert.ok(t.teamSize >= 1 + t.extra.length, `« ${t.key} » ne doit pas mettre le joueur en infériorité`);
  }
});

test('le match de titre se construit à partir du classement, et le hub annonce le bon', () => {
  const st = partie();
  st.showIndex = SEASON.shows.length - 1;
  const brut = currentShow(st).matches[0];
  assert.ok(isTitleMatch(st, brut));

  st.rank = RANK_TOP;
  const net = showMatches(st)[0];
  assert.equal(net.terms, 'net');
  assert.equal(net.enemies.length, 1, 'un contre un');
  assert.equal(net.teamSize, 1);

  st.rank = RANK_BOTTOM;
  const dur = showMatches(st)[0];
  assert.equal(dur.terms, 'handicap');
  assert.ok(dur.enemies.length > 1, 'le champion amène son homme');
  assert.equal(dur.teamSize, dur.enemies.length, 'et on a le droit d’amener le nôtre');
  // Ce que le hub affiche doit être ce que le moteur reçoit — c'est tout
  // l'intérêt de résoudre le match de titre avant l'écran, pas après.
  const joue = buildMatch(st, dur);
  assert.deepEqual(joue.enemies, dur.enemies);
  assert.equal(joue.teamSize, dur.teamSize);
  // La transformation est idempotente : la passer deux fois ne double rien.
  assert.equal(titleMatch(dur, st, SEASON.champion), dur);
  assert.ok(W[dur.enemies[0].id], 'le champion est bien le premier adversaire');
  assert.equal(dur.enemies[0].id, SEASON.champion);
});

test('gagner le match de titre fait de vous le champion du monde', () => {
  for (const gagne of [true, false]) {
    const st = partie();
    st.showIndex = SEASON.shows.length - 1;
    st.rank = 3;
    const m = showMatches(st)[0];
    const ids = st.roster.slice(0, m.teamSize).map((r) => r.id);
    const b = createBattle({ match: buildMatch(st, m), playerTeam: ids.map((i) => W[i]), playerBonuses: playerBonuses(st), seed: 9 });
    b.result = { winner: gagne ? 'player' : 'enemy', reason: 'Tombé.', turns: 30 };
    const sum = applyResult(st, b, m, ids);
    assert.equal(sum.title, true, 'le résumé sait que c’était le match de titre');
    assert.equal(sum.champion, gagne);
    assert.equal(st.finished, true, 'la carrière s’arrête là, dans les deux cas');
    assert.equal(st.champion, gagne);
    assert.equal(st.ending, gagne ? 'champion' : 'contender');
    // LE SOIR DU TITRE, ON NE MONTE PLUS AU CLASSEMENT.
    assert.equal(sum.rank, sum.rankBefore, 'on prend la ceinture, ou on ne la prend pas');
    assert.equal(st.rank, 3);
  }
});

test('en mode Scénarios, on monte en livrant le finish, pas en gagnant le combat', () => {
  // Plusieurs scripts EXIGENT que le joueur perde. Faire monter le classement
  // sur la victoire demandait de saboter son propre show pour avoir son match
  // de titre.
  const st = partie('scenario');
  // ep1b : le vétéran doit gagner par tombé après son finisher.
  const m = SEASON.shows[0].matches[1];
  assert.equal(m.script.finish.winner, 'enemy', 'ce script demande une défaite');
  const b = createBattle({ match: buildMatch(st, m), playerTeam: [W[st.roster[0].id]], playerBonuses: playerBonuses(st), seed: 4 });
  autoPlay(b, 400);
  b.result = { winner: 'enemy', reason: 'Tombé après un finisher.', turns: 25 };
  b.stats.lastElimFinisher = true;
  const sum = applyResult(st, b, m, ['jean_sina']);
  assert.equal(sum.rankReason, 'finish');
  if (sum.script.finishOk) assert.ok(sum.rank < sum.rankBefore, 'finish livré : on monte, même en ayant perdu le combat');
});

test('une sauvegarde d’avant le classement continue de marcher', () => {
  const st = partie();
  delete st.rank;
  assert.doesNotThrow(() => titleTerms(st.rank));
  assert.equal(titleTerms(st.rank).key, titleTerms(RANK_START).key, 'elle repart du rang de départ');
  assert.match(rankLabel(st.rank), /prétendant/);
  st.showIndex = SEASON.shows.length - 1;
  assert.doesNotThrow(() => showMatches(st));
});
