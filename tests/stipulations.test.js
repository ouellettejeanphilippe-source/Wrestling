// LES DOUZE STIPULATIONS
//
// Personne ne les avait jamais mesurées. Aucune ne PLANTAIT — elles
// produisaient juste de mauvais matchs, ce qui est pire, parce que ça ne se
// voit pas : un match d'échelle qui dure sept tours, une bataille royale où on
// sort à 80 % de ses points de vie, un match à soumission uniquement qui va au
// chrono quatre fois sur cinq. Ce fichier est le garde-fou qui aurait attrapé
// les cinq.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, autoPlay, listActions, executeAction, climbNeeded,
  tossChance, tagChance, heartIsTheClock, subIsTheRoute, tapChance, TAG_DAMAGE } from '../src/engine/battle.js';
import { MOVES } from '../src/data/moves.js';
import { WRESTLERS, WRESTLERS_BY_ID as W } from '../src/data/wrestlers.js';
import { EXHIBITION_TYPES } from '../src/data/campaign.js';
import { MATCH_TYPES } from '../src/data/matchTypes.js';
import { exhibitionMatch } from '../src/game/state.js';
import { rateMatch } from '../src/game/story.js';

const roster = WRESTLERS.filter((w) => !w.npc && !w.boss);
// Chaque stipulation se joue dans le format où elle a un sens. Une bataille
// royale à un contre deux n'est pas une bataille royale : le joueur se fait
// encercler et sortir en treize tours.
const tailleDe = (type) => (type === 'tag' ? 2 : type === 'battle_royal' ? 3 : 1);
const foesDe = (type, n) => (type === 'battle_royal' ? n + 1 : n);

function jouer(type, seed) {
  const n = tailleDe(type), e = foesDe(type, n);
  const p = [];
  for (let k = 0; k < n + e; k++) p.push(roster[(seed * 7 + k * 11) % roster.length]);
  if (new Set(p.map((w) => w.id)).size !== p.length) return null;
  const match = exhibitionMatch(type, p.slice(0, n).map((w) => w.id), p.slice(n).map((w) => w.id));
  const b = createBattle({ match, playerTeam: p.slice(0, n), seed: 500 + seed * 41 });
  const r = autoPlay(b, 400);
  return { b, r };
}

test('les douze stipulations produisent toutes un vrai match', () => {
  const echecs = [];
  for (const type of EXHIBITION_TYPES) {
    const tours = [], notes = [];
    let chrono = 0, n = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const j = jouer(type, seed);
      if (!j) continue;
      n++;
      assert.ok(j.r, `${type} (graine ${seed}) : le match doit se conclure`);
      tours.push(j.b.turn);
      notes.push(rateMatch(j.b));
      if (/Limite de temps/.test(j.r.reason)) chrono++;
    }
    const moy = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
    // Un match qui se règle en cinq tours n'est pas un match : c'est ce que
    // faisaient l'échelle (7,3) et le TLC (7,3) à l'époque des tours à un
    // coup. Avec le tour à énergie, tout se joue entre dix et quinze tours.
    if (moy(tours) < 8) echecs.push(`${type} : ${moy(tours).toFixed(1)} tours, trop court`);
    // Et un match qui va au chrono une fois sur deux n'a pas de conclusion :
    // c'était le cas de la soumission uniquement (85 %) et du tag (88 %).
    if (chrono / n > 0.45) echecs.push(`${type} : ${Math.round(chrono / n * 100)} % au chrono`);
    if (moy(notes) < 2) echecs.push(`${type} : note ${moy(notes).toFixed(1)}`);
  }
  assert.deepEqual(echecs, [], echecs.join('\n'));
});

test('chaque stipulation se gagne par sa propre route', () => {
  // Le piège : une stipulation dont la route annoncée n'est jamais celle qui
  // décide. Hell in a Cell annonçait « pas d'évasion » et se terminait par une
  // évasion six fois sur dix.
  const attendu = {
    ladder: /ceinture/i, tlc: /ceinture/i,
    last_man_standing: /compte|arrêté|pouvait plus/i,
    submission_only: /abandonn/i,
    battle_royal: /corde|éliminé/i,
  };
  for (const [type, motif] of Object.entries(attendu)) {
    let bonnes = 0, n = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const j = jouer(type, seed);
      if (!j || !j.r) continue;
      n++;
      if (motif.test(j.r.reason)) bonnes++;
    }
    assert.ok(bonnes / n >= 0.5, `${type} : seulement ${bonnes}/${n} matchs gagnés par sa route annoncée`);
  }
});

test('Hell in a Cell tient sa promesse : enfermés, pas d’évasion', () => {
  const b = createBattle({ match: exhibitionMatch('hell_in_cell', ['jean_sina'], ['gunter']), playerTeam: [W.jean_sina], seed: 5 });
  assert.ok(b.rules.cage, 'les murs sont là');
  assert.notEqual(b.rules.victory, 'fall_or_escape', 'mais la porte est fermée');
  const u = b.units[0];
  // Depuis n'importe quelle case de l'aréna, coins compris, l'escalade ne doit
  // jamais être proposée.
  for (let y = 0; y < b.grid.h; y++) for (let x = 0; x < b.grid.w; x++) {
    u.x = x; u.y = y;
    assert.equal(listActions(b, u).find((a) => a.id === 'climb'), undefined,
      `escalade proposée en ${x},${y}`);
  }
});

test('on ne jette pas par-dessus la corde un homme frais', () => {
  const b = createBattle({ match: exhibitionMatch('battle_royal', ['jean_sina'], ['gunter']), playerTeam: [W.jean_sina], seed: 5 });
  const [u, e] = b.units;
  e.hp = e.maxHp;
  const frais = tossChance(b, u, e);
  // Étourdir ne suffit pas : projeter dans les cordes étourdit à tous les
  // coups, si bien qu'à deux adversaires l'un projetait et l'autre jetait.
  e.statuses.dazed = 2;
  assert.ok(tossChance(b, u, e) <= 0.1, 'même étourdi, il s’accroche');
  delete e.statuses.dazed;
  e.hp = Math.round(e.maxHp * 0.2);
  assert.ok(tossChance(b, u, e) > frais + 0.3, 'usé, en revanche, il passe');
});

test('le cœur est l’horloge là où il n’y a pas de tombé', () => {
  const normal = createBattle({ match: exhibitionMatch('singles', ['jean_sina'], ['gunter']), playerTeam: [W.jean_sina], seed: 5 });
  const sansTombe = createBattle({ match: exhibitionMatch('submission_only', ['jean_sina'], ['gunter']), playerTeam: [W.jean_sina], seed: 5 });
  assert.equal(heartIsTheClock(normal), false);
  assert.equal(heartIsTheClock(sansTombe), true);
  assert.equal(subIsTheRoute(sansTombe), true);
  assert.ok(sansTombe.units[0].maxGrit < normal.units[0].maxGrit,
    'sans tombé, le cœur fait ce travail tout seul : on lui en donne moitié moins');
  // Last Man Standing aussi, mais là on ne tape pas : on ne répond plus.
  const lms = createBattle({ match: exhibitionMatch('last_man_standing', ['jean_sina'], ['gunter']), playerTeam: [W.jean_sina], seed: 5 });
  assert.equal(heartIsTheClock(lms), true);
  assert.equal(subIsTheRoute(lms), false, 'on n’abandonne pas dans un Last Man Standing');
});

test('le ring se coupe : un lutteur à bout ne passe pas toujours le relais', () => {
  const b = createBattle({ match: exhibitionMatch('tag', ['jean_sina', 'derby_allin'], ['gunter', 'mjg']), playerTeam: [W.jean_sina, W.derby_allin], seed: 5 });
  const u = b.units.find((x) => x.legal && x.team === 'player');
  u.hp = u.maxHp;
  assert.equal(tagChance(b, u), 1, 'frais, il passe toujours');
  u.hp = Math.round(u.maxHp * 0.1);
  const abime = tagChance(b, u);
  assert.ok(abime < 0.7, `à bout, la main ne se touche pas toujours (${Math.round(abime * 100)} %)`);
  u.statuses.dazed = 1;
  assert.ok(tagChance(b, u) < abime, 'et étourdi, encore moins');
});

test('grimper : deux échelons quand ça se dispute, trois quand ça se fuit', () => {
  // L'ÉCHELLE SE DISPUTE. Personne ne monte avec un adversaire debout à côté
  // de lui, et une projection fait redescendre. À trois échelons, avec trois
  // cartes par tour en face, neuf matchs sur douze allaient au chrono ; à
  // deux, dix sur douze finissent par la ceinture.
  for (const type of ['ladder', 'tlc']) {
    const b = createBattle({ match: exhibitionMatch(type, ['jean_sina'], ['gunter']), playerTeam: [W.jean_sina], seed: 5 });
    assert.equal(climbNeeded(b), 2, `${type} : deux échelons, mais il faut faire de la place`);
  }
  // LA CAGE SE FUIT, et personne ne vous y bloque : là, la longueur EST la
  // difficulté. À deux, l'évasion passait de 70 à 88 % et le match tombait de
  // 22 à 15 tours.
  const cage = createBattle({ match: exhibitionMatch('cage', ['jean_sina'], ['gunter']), playerTeam: [W.jean_sina], seed: 5 });
  assert.equal(climbNeeded(cage), 3, 'cage : trois tours d’escalade');
});

test('on ne grimpe pas avec quelqu’un debout sur le dos', () => {
  // La seule chose qui interrompait une escalade, c'était d'encaisser des
  // dégâts — ce qui supposait que l'adversaire ait toujours un coup sous la
  // main. Depuis que TOUT est une carte, il lui arrive de n'avoir rien à
  // jouer, et l'échelle devenait une autoroute : 98 % de ceintures en 14 tours.
  const b = createBattle({ match: exhibitionMatch('ladder', ['jean_sina'], ['gunter']), playerTeam: [W.jean_sina], seed: 5 });
  const moi = b.units.find((u) => u.team === 'player'), lui = b.units.find((u) => u.team === 'enemy');
  moi.x = 9; moi.y = 7;                         // sur l'échelle
  lui.x = 20; lui.y = 0; lui.eliminated = true; // personne à côté
  const libre = listActions(b, moi).find((a) => a.id === 'climb');
  assert.ok(libre && libre.ok, 'seul, on monte');
  lui.eliminated = false; lui.x = moi.x + 1; lui.y = moi.y;
  const gene = listActions(b, moi).find((a) => a.id === 'climb');
  assert.equal(gene.ok, false, 'avec quelqu’un debout à côté, non');
  assert.match(gene.reason, /à côté/);
  // Mais un homme sonné ne retient personne : c'est ce qui redonne leur raison
  // d'être aux effets d'étourdissement.
  lui.statuses.dazed = 2;
  assert.ok(listActions(b, moi).find((a) => a.id === 'climb').ok, 'sonné, il ne retient plus');
  lui.statuses.dazed = 0; lui.down = true;
  assert.ok(listActions(b, moi).find((a) => a.id === 'climb').ok, 'au sol non plus');
});

test('chaque stipulation garde la limite de temps qui lui va', () => {
  // Un match par équipes a quatre corps à user au lieu de deux ; à 60 tours,
  // la moitié d'entre eux se terminaient au chrono.
  // (Les valeurs ont suivi le tour à énergie : la limite par défaut est à 40,
  // les formes longues au-dessus.)
  for (const type of ['tag', 'last_man_standing', 'submission_only']) {
    assert.ok(MATCH_TYPES[type].maxTurns > 40, `${type} est une forme longue`);
  }
  assert.equal(MATCH_TYPES.singles.maxTurns, undefined, 'le match simple garde la limite par défaut');
});

test('par équipes : un match tient en vingt-cinq à trente tours, pas en quarante-cinq', () => {
  // TROUVÉ PAR LE ROBOT DE TEST. Un match par équipes de la carrière dépassait
  // vingt-quatre tours et quatre-vingts gestes pour un simple de quatorze tours.
  // Mesure sur 120 matchs : médiane 43 tours et 17 % au chrono avant le
  // multiplicateur de dégâts (TAG_DAMAGE), médiane 25 et 2 % après.
  assert.ok(TAG_DAMAGE > 1, 'le tag frappe plus fort que le simple');
  const tours = []; let chrono = 0;
  for (let seed = 1; seed <= 24; seed++) {
    const j = jouer('tag', seed);
    if (!j) continue;
    tours.push(j.b.turn);
    if (/Limite de temps/.test(j.r.reason)) chrono++;
  }
  tours.sort((a, b) => a - b);
  const mediane = tours[Math.floor(tours.length / 2)];
  assert.ok(mediane <= 34, `médiane ${mediane} tours : trop long`);
  assert.ok(chrono / tours.length <= 0.12, `${chrono}/${tours.length} au chrono`);
});

test('soumission uniquement : personne ne tape au premier tour, ni sur un adversaire frais', () => {
  // Le robot de test a vu un match finir au tour 1 sur un seul geste : 9 sur
  // 500 matchs finissaient au premier tour, 23 sur 500 avant le troisième,
  // l'adversaire encore à 80-95 % de ses PV. Une prise use le membre AVANT le
  // jet d'abandon : on ne peut donc pas lire le « travail déjà fait » dans
  // l'usure, d'où un plancher sur le tour et sur les PV.
  const b = createBattle({ match: exhibitionMatch('submission_only', ['jean_sina'], ['gunter']), playerTeam: [W.jean_sina], seed: 9 });
  const [moi, lui] = [b.units.find((u) => u.team === 'player'), b.units.find((u) => u.team === 'enemy')];
  const prise = MOVES.armbar || MOVES.chinlock;
  assert.ok(prise, 'une prise de soumission existe');
  b.turn = 1; lui.hp = lui.maxHp * 0.4;
  assert.equal(tapChance(b, moi, lui, prise), 0, 'tour 1 : jamais, même sur un adversaire à 40 %');
  b.turn = 4; lui.hp = lui.maxHp;
  assert.equal(tapChance(b, moi, lui, prise), 0, 'adversaire frais : jamais');
  // Le cœur verrouille l'abandon (voir tapChance) : on le vide pour ne tester
  // que les deux planchers, et que la porte s'ouvre bien quand ils sont levés.
  lui.grit = 0; lui.hp = lui.maxHp * 0.4;
  assert.ok(tapChance(b, moi, lui, prise) > 0, 'travaillé, sans cœur, au tour 4 : la porte s’ouvre');
  b.turn = 2;
  assert.equal(tapChance(b, moi, lui, prise), 0, 'et elle se referme au tour 2');
});
