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
  tossChance, tagChance, heartIsTheClock, subIsTheRoute } from '../src/engine/battle.js';
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
    // Un match qui se règle en dix tours n'est pas un match : c'est ce que
    // faisaient l'échelle (7,3), le TLC (7,3) et la bataille royale (11,4).
    if (moy(tours) < 15) echecs.push(`${type} : ${moy(tours).toFixed(1)} tours, trop court`);
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

test('trois échelons partout : le premier arrivé ne gagne plus tout seul', () => {
  for (const type of ['ladder', 'tlc', 'cage']) {
    const b = createBattle({ match: exhibitionMatch(type, ['jean_sina'], ['gunter']), playerTeam: [W.jean_sina], seed: 5 });
    assert.equal(climbNeeded(b), 3, `${type} : trois tours d’escalade`);
  }
});

test('chaque stipulation garde la limite de temps qui lui va', () => {
  // Un match par équipes a quatre corps à user au lieu de deux ; à 60 tours,
  // la moitié d'entre eux se terminaient au chrono.
  for (const type of ['tag', 'last_man_standing', 'submission_only']) {
    assert.ok(MATCH_TYPES[type].maxTurns > 60, `${type} est une forme longue`);
  }
  assert.equal(MATCH_TYPES.singles.maxTurns, undefined, 'le match simple garde la limite par défaut');
});
