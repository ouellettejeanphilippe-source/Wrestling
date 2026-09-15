import test from 'node:test';
import assert from 'node:assert/strict';
import { UNLOCKS, UNLOCK_BY_ID, STARTERS, emptyProgress, finishCareer, locker, unlockHint, isUnlocked, loadProgress } from '../src/game/unlocks.js';
import { newGame, careerRun, recordFeats, emptyFeats, applyResult, buildMatch, playerBonuses } from '../src/game/state.js';
import { createBattle } from '../src/engine/battle.js';
import { WRESTLERS, WRESTLERS_BY_ID as W, STARTER_CHOICES } from '../src/data/wrestlers.js';
import { SEASON } from '../src/data/campaign.js';

const jouables = WRESTLERS.filter((w) => !w.npc && !w.boss);

test('tout lutteur jouable est soit au départ, soit débloquable — jamais ni l’un ni l’autre', () => {
  for (const w of jouables) {
    const depart = STARTERS.includes(w.id);
    const cond = !!UNLOCK_BY_ID[w.id];
    assert.ok(depart || cond, `${w.id} est injouable à vie : ni de départ, ni débloquable`);
    assert.ok(!(depart && cond), `${w.id} est à la fois de départ et à débloquer`);
    assert.ok(unlockHint(w.id), `${w.id} doit dire comment on l’obtient`);
  }
  assert.equal(STARTERS.length + UNLOCKS.length, jouables.length, 'le compte doit tomber juste');
  assert.equal(new Set(UNLOCKS.map((u) => u.id)).size, UNLOCKS.length, 'pas deux conditions pour le même lutteur');
  for (const u of UNLOCKS) assert.ok(W[u.id], `${u.id} doit exister au roster`);
});

// LA VRAIE QUESTION : chaque condition peut-elle tomber ? Une condition
// impossible ne rend pas le jeu difficile, elle rend un lutteur injouable —
// c'est exactement ce qui était arrivé au seuil « 3 tables » (médiane
// mesurée : zéro). On construit donc, pour chaque condition, la carrière qui
// devrait la remplir, et on exige qu'elle la remplisse.
const bilan = (over = {}) => ({
  headliner: 'jean_sina', champion: false, terms: 'avantage', rank: 5, mode: 'kayfabe',
  fans: 0, money: 0, ...over,
  feats: { ...emptyFeats(), ...(over.feats || {}) },
});

const CAS = {
  hulk_gogane: bilan({ champion: true, headliner: 'jean_sina' }),
  pendu_paige: bilan({ champion: true, headliner: 'derby_allin' }),
  gm_punk: bilan({ champion: true, headliner: 'brian_danielsson' }),
  randy_python: bilan({ champion: true, headliner: 'pierre_frette' }),
  kenny_alpha: bilan({ champion: true, headliner: 'clementine_cassidy' }),
  rhea_ripplay: bilan({ champion: true, headliner: 'becky_lunch' }),
  cody_roads: bilan({ terms: 'net' }),
  bill_osprey: bilan({ feats: { winsByType: { ladder: 1 } } }),
  stingue: bilan({ feats: { winsByType: { cage: 1 } } }),
  jon_moxie: bilan({ feats: { tables: 1 } }),
  gunter: bilan({ feats: { submissionWins: 3 } }),
  curve_stricklande: bilan({ feats: { tossWins: 1 } }),
  dannemaison: bilan({ feats: { cheapWins: 1 } }),
  fray_wyatt: bilan({ feats: { stoppageWins: 1 } }),
  le_geant: bilan({ feats: { beatGiant: true } }),
  kris_gericault: bilan({ feats: { eliteWins: 3 } }),
  rey_mysterioso: bilan({ feats: { smallestDeckWin: 12 } }),
  tonie_tempete: bilan({ fans: 2500 }),
  logan_pole: bilan({ money: 4000 }),
  seth_rollmops: bilan({ mode: 'scenario' }),
  mjg: bilan({ champion: true, terms: 'handicap' }),
  entrepreneur: bilan({ champion: true }),
  ronan_rains: bilan({ champion: true, headliner: 'becky_lunch' }),
};

test('chaque condition de déblocage peut réellement tomber', () => {
  for (const u of UNLOCKS) {
    const run = CAS[u.id];
    assert.ok(run, `il manque un cas de test pour « ${u.id} »`);
    // Les deux conditions « au long cours » ont besoin d'un passé.
    const passe = u.id === 'entrepreneur' ? { ...emptyProgress(), belts: 1 }
      : u.id === 'ronan_rains' ? { ...emptyProgress(), beltHeadliners: ['a', 'b', 'c', 'd'] }
        : emptyProgress();
    assert.equal(u.check(run, passe), true, `« ${u.by} » ne tombe jamais`);
  }
});

test('et aucune ne tombe sur une carrière vide', () => {
  // Le symétrique : une condition qui se remplit toute seule ne récompense
  // rien. On joue une carrière où il ne se passe strictement rien.
  const rien = bilan({ terms: 'handicap' });
  const donnes = UNLOCKS.filter((u) => u.check(rien, emptyProgress()));
  assert.deepEqual(donnes.map((u) => u.id), [], 'aucun lutteur ne doit s’offrir pour rien');
});

test('la moitié des conditions ne demandent pas la ceinture', () => {
  // Une carrière ratée doit servir à quelque chose, sinon perdre veut dire
  // avoir perdu quarante minutes.
  const sansCeinture = UNLOCKS.filter((u) => {
    const run = CAS[u.id];
    return run && !run.champion;
  });
  assert.ok(sansCeinture.length >= UNLOCKS.length / 2,
    `il faut de quoi progresser en perdant (${sansCeinture.length}/${UNLOCKS.length})`);
});

test('terminer une carrière compte, débloque, et ne redonne jamais deux fois', () => {
  let p = emptyProgress();
  assert.equal(p.wrestlers.length, STARTERS.length);
  const r1 = finishCareer(p, bilan({ champion: true, headliner: 'jean_sina' }));
  assert.ok(r1.unlocked.some((u) => u.id === 'hulk_gogane'));
  assert.equal(r1.progress.careers, 1);
  assert.equal(r1.progress.belts, 1);
  assert.deepEqual(r1.progress.beltHeadliners, ['jean_sina']);
  p = r1.progress;
  // La même carrière une seconde fois ne redonne pas le même lutteur.
  const r2 = finishCareer(p, bilan({ champion: true, headliner: 'jean_sina' }));
  assert.ok(!r2.unlocked.some((u) => u.id === 'hulk_gogane'), 'pas deux fois le même');
  assert.equal(r2.progress.careers, 2);
  assert.equal(r2.progress.belts, 2);
  assert.deepEqual(r2.progress.beltHeadliners, ['jean_sina'], 'la même tête d’affiche ne compte qu’une fois');
  // Et la progression d'origine n'est pas modifiée au passage.
  assert.equal(p.careers, 1, 'finishCareer ne doit pas muter ce qu’on lui donne');
});

test('cinq têtes d’affiche sacrées ouvrent le haut de l’affiche', () => {
  let p = emptyProgress();
  for (const id of STARTERS.slice(0, 5)) p = finishCareer(p, bilan({ champion: true, headliner: id })).progress;
  assert.ok(isUnlocked(p, 'ronan_rains'), 'cinq ceintures, cinq lutteurs différents');
  assert.ok(isUnlocked(p, 'entrepreneur'), 'et deux ceintures suffisent pour l’autre');
});

test('une condition qui plante ne bloque pas le reste', () => {
  // Les conditions sont des données ; une erreur dans l'une d'elles ne doit
  // pas emporter la fin de carrière du joueur.
  const p = emptyProgress();
  assert.doesNotThrow(() => finishCareer(p, { headliner: 'jean_sina', champion: true }));
});

test('le vestiaire se lit toujours, même abîmé', () => {
  const tout = locker(emptyProgress());
  assert.equal(tout.length, jouables.length);
  assert.equal(tout.filter((x) => x.unlocked).length, STARTERS.length);
  for (const x of tout) assert.ok(x.hint, `${x.def.id} doit afficher sa condition`);
  // Une progression trafiquée ne doit jamais verrouiller les lutteurs de départ.
  const abime = finishCareer({ ...emptyProgress(), wrestlers: ['inconnu'] }, bilan()).progress;
  assert.ok(Array.isArray(abime.wrestlers));
});

test('les exploits se notent sur ce que le moteur a vraiment enregistré', () => {
  const st = newGame({ promoName: 'T', mode: 'kayfabe', starters: STARTER_CHOICES.slice(0, 3) });
  const m = SEASON.shows[0].matches[0];
  const b = createBattle({ match: buildMatch(st, m), playerTeam: [W[st.roster[0].id]], playerBonuses: playerBonuses(st), seed: 4 });
  b.result = { winner: 'player', reason: 'Soumission.', turns: 20 };
  b.stats.lastElimReason = 'submission';
  b.stats.tables = 2;
  recordFeats(st, b, m, { type: 'elite' }, true, [st.roster[0].id]);
  assert.equal(st.feats.wins, 1);
  assert.equal(st.feats.eliteWins, 1, 'un main event compte comme tel');
  assert.equal(st.feats.submissionWins, 1);
  assert.equal(st.feats.tables, 2);
  assert.equal(st.feats.winsByType[m.type], 1);
  assert.ok(st.feats.smallestDeckWin > 0, 'la taille du deck de la tête d’affiche est notée');

  // Une défaite ne remplit rien, sauf ce qui s'est quand même passé.
  const avant = { ...st.feats };
  const b2 = createBattle({ match: buildMatch(st, m), playerTeam: [W[st.roster[0].id]], playerBonuses: playerBonuses(st), seed: 5 });
  b2.result = { winner: 'enemy', reason: 'Tombé.', turns: 20 };
  b2.stats.lastElimReason = 'pin'; b2.stats.tables = 1;
  recordFeats(st, b2, m, { type: 'match' }, false, [st.roster[0].id]);
  assert.equal(st.feats.wins, avant.wins, 'une défaite n’ajoute pas de victoire');
  assert.equal(st.feats.losses, 1);
  assert.equal(st.feats.tables, avant.tables + 1, 'mais la table est bien passée');
});

test('le bilan d’une carrière ne contient que des faits', () => {
  const st = newGame({ promoName: 'T', mode: 'scenario', starters: STARTER_CHOICES.slice(0, 3) });
  st.champion = true; st.terms = 'net'; st.fans = 1234; st.money = 99;
  const run = careerRun(st);
  assert.equal(run.headliner, st.roster[0].id, 'la tête d’affiche est le premier choisi');
  assert.equal(run.champion, true);
  assert.equal(run.mode, 'scenario');
  assert.equal(run.fans, 1234);
  assert.ok(run.feats && typeof run.feats.wins === 'number');
  // Aucune condition ne doit se trouver dans le bilan : elles vivent ailleurs.
  assert.equal(typeof run.check, 'undefined');
});
