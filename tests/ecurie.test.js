// L'ÉCURIE
//
// Une carrière commence avec un lutteur — la tête d'affiche, celle qui compte
// pour la progression entre les carrières — et peut en signer jusqu'à deux
// autres parmi ceux qu'on a débloqués. À chaque match on choisit qui monte sur
// le ring ; la fatigue donne une raison de faire tourner ; le soir du titre, la
// tête d'affiche est obligatoire.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, recruit, recruitOffer, signCost, validateTeam, partnerOffer, playerBonuses, applyResult, buildMatch, takeNode, fatigueOf, fatigueHp, STABLE_MAX, FATIGUE_MAX, FATIGUE_HP, TITLE_MATCH_ID, weekNodes, train, trainCost, TRAINABLE, MAX_TRAIN } from '../src/game/state.js';
import { createBattle, autoPlay } from '../src/engine/battle.js';
import { buildRoute, isFight } from '../src/game/route.js';
import { SEASON } from '../src/data/campaign.js';
import { WRESTLERS_BY_ID as W, STARTER_CHOICES } from '../src/data/wrestlers.js';

const partie = (mode = 'kayfabe') => newGame({ promoName: 'T', mode, starters: ['jean_sina'] });
const DEBLOQUES = STARTER_CHOICES;
const gagne = (st, m, ids, node = { row: 0, col: 0, type: 'match' }, win = true) => {
  const b = createBattle({ match: buildMatch(st, m), playerTeam: ids.map((i) => W[i]), playerBonuses: playerBonuses(st), seed: 3 });
  b.result = { winner: win ? 'player' : 'enemy', reason: 'Tombé.', turns: 20 };
  return applyResult(st, b, m, ids, node);
};

test('une carrière commence avec un lutteur, et l’écurie en admet trois', () => {
  const st = partie();
  assert.equal(st.roster.length, 1);
  assert.equal(st.headliner, 'jean_sina');
  assert.equal(STABLE_MAX, 3);
});

test('signer coûte la moitié du salaire de fiche, et n’ouvre qu’aux lutteurs débloqués', () => {
  const st = partie();
  assert.equal(signCost({ salary: 900 }), 450);
  assert.equal(signCost({ salary: 500 }), 250);
  assert.equal(signCost({ salary: 300 }), 250, '250 $ au minimum');
  const offre = recruitOffer(st, DEBLOQUES);
  assert.ok(offre.length === DEBLOQUES.length - 1, 'tous sauf la tête d’affiche');
  assert.ok(offre.every((o) => o.id !== 'jean_sina' && o.cost >= 250));
  assert.deepEqual(offre.map((o) => o.cost), [...offre.map((o) => o.cost)].sort((a, b) => a - b), 'du moins cher au plus cher');
  const id = offre[0].id;
  const avant = st.money;
  const r = recruit(st, id, DEBLOQUES);
  assert.ok(r.ok, r.reason);
  assert.equal(st.roster.length, 2);
  assert.equal(st.money, avant - offre[0].cost);
  assert.equal(st.roster[1].id, id);
  assert.deepEqual(st.roster[1].cards, [], 'une entrée neuve, avec son deck');
  assert.equal(st.headliner, 'jean_sina', 'la tête d’affiche ne change pas');
});

test('on ne signe pas n’importe qui : pas déjà là, pas verrouillé, pas sans argent, pas au-delà de trois', () => {
  const st = partie();
  assert.ok(!recruit(st, 'jean_sina', DEBLOQUES).ok, 'déjà dans l’écurie');
  assert.ok(!recruit(st, 'gunter', DEBLOQUES).ok, 'Günter n’est pas débloqué');
  assert.ok(!recruit(st, 'inconnu', DEBLOQUES).ok);
  st.money = 10;
  assert.match(recruit(st, 'derby_allin', DEBLOQUES).reason, /argent/);
  st.money = 5000;
  assert.ok(recruit(st, 'derby_allin', DEBLOQUES).ok);
  assert.ok(recruit(st, 'becky_lunch', DEBLOQUES).ok);
  assert.equal(st.roster.length, STABLE_MAX);
  assert.match(recruit(st, 'clementine_cassidy', DEBLOQUES).reason, /complète/, 'trois, pas un de plus');
});

test('l’équipe : la bonne taille, personne en double, au moins un des vôtres', () => {
  const st = partie(); st.money = 5000; recruit(st, 'derby_allin', DEBLOQUES);
  const solo = { id: 'x', teamSize: 1 }, duo = { id: 'y', teamSize: 2 };
  assert.ok(validateTeam(st, solo, ['derby_allin']).ok, 'en solo, on choisit qui monte sur le ring');
  assert.ok(validateTeam(st, solo, ['jean_sina']).ok);
  assert.ok(!validateTeam(st, solo, ['jean_sina', 'derby_allin']).ok, 'trop nombreux');
  assert.ok(!validateTeam(st, duo, ['jean_sina']).ok, 'il manque quelqu’un');
  assert.ok(!validateTeam(st, duo, ['jean_sina', 'jean_sina']).ok, 'le même deux fois');
  assert.ok(validateTeam(st, duo, ['jean_sina', 'becky_lunch']).ok, 'un des vôtres et un partenaire d’un soir');
  assert.match(validateTeam(st, duo, ['becky_lunch', 'clementine_cassidy']).reason, /écurie/, 'deux partenaires et aucun des vôtres : non');
});

test('le soir du titre, la tête d’affiche est obligatoire — c’est sa ceinture', () => {
  const st = partie(); st.money = 5000; recruit(st, 'derby_allin', DEBLOQUES);
  st.showIndex = SEASON.shows.length - 1;
  const titre = { id: TITLE_MATCH_ID, teamSize: 1 };
  assert.match(validateTeam(st, titre, ['derby_allin']).reason, /Sena|tête|voyage/i);
  assert.ok(validateTeam(st, titre, ['jean_sina']).ok);
});

test('les partenaires d’un soir ne sont jamais ceux de l’écurie', () => {
  const st = partie(); st.money = 5000; recruit(st, 'derby_allin', DEBLOQUES);
  const offre = partnerOffer(st, { row: 2, col: 0 }, DEBLOQUES, 6);
  assert.ok(!offre.includes('jean_sina') && !offre.includes('derby_allin'), `${offre.join(', ')} : l’écurie n’est pas un renfort`);
});

test('la fatigue : on en prend un niveau en luttant, on en perd un au vestiaire, trois au plus', () => {
  const st = partie(); st.money = 5000; recruit(st, 'derby_allin', DEBLOQUES);
  const m = SEASON.shows[0].matches[0];
  const [a, b] = st.roster;
  assert.equal(fatigueOf(a), 0);
  for (let i = 1; i <= 5; i++) {
    gagne(st, { ...m, teamSize: 1 }, ['jean_sina']);
    assert.equal(fatigueOf(a), Math.min(i, FATIGUE_MAX), `tête d’affiche après ${i} matchs`);
    assert.equal(fatigueOf(b), 0, 'l’autre reste reposé');
  }
  assert.equal(fatigueOf(a), FATIGUE_MAX, 'plafonnée');
  gagne(st, { ...m, teamSize: 1 }, ['derby_allin']);
  assert.equal(fatigueOf(a), FATIGUE_MAX - 1, 'au vestiaire, elle en perd un');
  assert.equal(fatigueOf(b), 1);
});

test('une semaine sans match récupère un niveau, une semaine off les rend tous', () => {
  const st = partie(); st.money = 5000; recruit(st, 'derby_allin', DEBLOQUES);
  for (const r of st.roster) r.fatigue = 3;
  takeNode(st, { row: 0, col: 0, type: 'event' });
  assert.deepEqual(st.roster.map(fatigueOf), [2, 2], 'les coulisses en enlèvent un');
  takeNode(st, { row: 1, col: 0, type: 'shop' });
  assert.deepEqual(st.roster.map(fatigueOf), [1, 1]);
  for (const r of st.roster) r.fatigue = 3;
  takeNode(st, { row: 2, col: 0, type: 'rest' });
  assert.deepEqual(st.roster.map(fatigueOf), [0, 0], 'une semaine off remet tout le monde à zéro');
});

test('la fatigue retire des PV au match, 7 % par niveau, à celui qui l’a seulement', () => {
  const st = partie(); st.money = 5000; recruit(st, 'derby_allin', DEBLOQUES);
  const [a, b] = st.roster;
  const pv = (id) => createBattle({ match: { id: 't', title: 'T', type: 'singles', enemies: ['jobber_1'] }, playerTeam: [W[id]], playerBonuses: playerBonuses(st), seed: 4 }).units[0].maxHp;
  const frais = pv('jean_sina');
  a.fatigue = 2;
  const fatigue = pv('jean_sina');
  assert.equal(fatigueHp(a), Math.round(W.jean_sina.stats.hp * FATIGUE_HP * 2));
  assert.ok(fatigue < frais, 'moins de PV quand on est fatigué');
  assert.ok(Math.abs((frais - fatigue) / frais - 0.14) < 0.03, `environ −14 % (${frais} → ${fatigue})`);
  assert.equal(pv('derby_allin'), createBattle({ match: { id: 't', title: 'T', type: 'singles', enemies: ['jobber_1'] }, playerTeam: [W.derby_allin], playerBonuses: playerBonuses(partie()), seed: 4 }).units[0].maxHp, 'le reposé n’est pas touché');
  b.fatigue = 0;
});

test('les signés s’entraînent, apprennent des cartes et gardent leur fiche chacun de leur côté', () => {
  const st = partie(); st.money = 5000; recruit(st, 'derby_allin', DEBLOQUES);
  const m = SEASON.shows[0].matches[0];
  assert.ok(train(st, 'derby_allin', 'str').ok);
  assert.equal(st.roster[1].bonus.str, 1);
  assert.equal(st.roster[0].bonus.str, 0, 'la tête d’affiche n’a pas bougé');
  const sum = gagne(st, { ...m, teamSize: 2 }, ['jean_sina', 'derby_allin']);
  assert.equal(sum.cards.length, 2, 'chacun des deux lutteurs a droit à son offre de cartes');
  assert.equal(st.roster[0].wins, 1); assert.equal(st.roster[1].wins, 1);
  const b = playerBonuses(st);
  assert.ok(b.derby_allin && b.jean_sina, 'le moteur reçoit les bonus des deux');
});

test('une sauvegarde d’avant l’écurie continue de marcher', () => {
  const st = partie();
  for (const r of st.roster) delete r.fatigue;
  assert.equal(fatigueOf(st.roster[0]), 0);
  assert.doesNotThrow(() => playerBonuses(st));
  assert.doesNotThrow(() => takeNode(st, { row: 0, col: 0, type: 'rest' }));
  assert.ok(validateTeam(st, { id: 'x', teamSize: 1 }, ['jean_sina']).ok);
});

// ----------------------------------------------------- l'écurie ne casse pas le jeu
// Mesuré sur 60 carrières par politique : tête d'affiche seule 33 % de ceintures,
// écurie qui recrute et fait tourner 37 % (six points d'erreur) ; sans fatigue,
// c'était 37 contre 30 — la fatigue est ce qui donne un sens à l'écurie. On
// verrouille donc une fourchette, pas deux nombres.
function carriere(seed, ecurie) {
  const st = newGame({ promoName: 'T', mode: 'kayfabe', starters: [STARTER_CHOICES[seed % STARTER_CHOICES.length]] });
  st.seed = seed; st.route = buildRoute(seed); st.path = [];
  let matchs = 0;
  while (!st.finished && matchs < 12) {
    if (ecurie && st.roster.length < 3) {
      const c = recruitOffer(st, DEBLOQUES).find((o) => o.cost <= st.money - 100);
      if (c && (st.roster.length === 1 || st.money > c.cost + 500)) recruit(st, c.id, DEBLOQUES);
    }
    const noeuds = weekNodes(st);
    const noeud = noeuds.find((n) => n.type === 'match') || noeuds.find((n) => isFight(n.type));
    if (!noeud) { takeNode(st, noeuds[0]); continue; }
    const m = noeud.match, taille = m.teamSize || 1;
    const tries = [...st.roster].sort((a, b) => (ecurie ? fatigueOf(a) - fatigueOf(b) : 0) || (a.id === st.headliner ? -1 : 1));
    let ids = tries.slice(0, taille).map((r) => r.id);
    if (noeud.type === 'boss' && !ids.includes(st.headliner)) ids = [st.headliner, ...ids.filter((i) => i !== st.headliner)].slice(0, taille);
    if (ids.length < taille) ids = [...ids, ...partnerOffer(st, noeud, DEBLOQUES, 4).filter((i) => !ids.includes(i))].slice(0, taille);
    if (ids.length < taille || !validateTeam(st, buildMatch(st, m), ids).ok) { takeNode(st, noeud); continue; }
    const b = createBattle({ match: buildMatch(st, m), playerTeam: ids.map((i) => W[i]), playerBonuses: playerBonuses(st), seed: seed * 31 + matchs });
    autoPlay(b, 400);
    applyResult(st, b, m, ids, noeud);
    matchs++;
    for (let g = 0; g < 8; g++) {
      const cand = st.roster.filter((r) => TRAINABLE.some(([k, , s]) => r.bonus[k] / s < MAX_TRAIN)).sort((a, b2) => a.trainings - b2.trainings)[0];
      if (!cand || st.money < trainCost(cand) + (ecurie && st.roster.length < 2 ? 450 : 0)) break;
      train(st, cand.id, TRAINABLE.find(([k, , s]) => cand.bonus[k] / s < MAX_TRAIN)[0]);
    }
  }
  return { fini: st.finished, ceinture: st.champion === true, taille: st.roster.length };
}

test('une carrière en écurie va jusqu’au bout et ne change pas l’équilibre de la ceinture', () => {
  const N = 24;
  const solo = Array.from({ length: N }, (_, i) => carriere(i * 13 + 5, false));
  const duo = Array.from({ length: N }, (_, i) => carriere(i * 13 + 5, true));
  assert.ok(solo.every((c) => c.fini) && duo.every((c) => c.fini), 'toutes les carrières se terminent');
  assert.ok(duo.some((c) => c.taille >= 2), 'l’écurie recrute pour de vrai');
  assert.ok(solo.every((c) => c.taille === 1));
  const taux = (xs) => xs.filter((c) => c.ceinture).length / xs.length;
  assert.ok(taux(solo) > 0.1 && taux(solo) < 0.7, `solo ${Math.round(taux(solo) * 100)} %`);
  assert.ok(taux(duo) > 0.1 && taux(duo) < 0.7, `écurie ${Math.round(taux(duo) * 100)} %`);
  assert.ok(Math.abs(taux(solo) - taux(duo)) < 0.3, `l’écurie n’écrase ni ne perd (${Math.round(taux(solo) * 100)} % contre ${Math.round(taux(duo) * 100)} %)`);
});
