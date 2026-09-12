// LE RYTHME D'UN MATCH
//
// Un match doit durer une trentaine de tours, mais avec des tours RAPIDES :
// beaucoup de petites décisions, pas quinze tours de gros coups. Ces tests
// verrouillent les trois pièces qui produisent ce rythme — le souffle qui
// impose de doser, le renversement qui rend chaque gros coup risqué, et les
// garde-fous de densité qui empêchent un match long mais vide.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, autoPlay, listActions, resolveAttack, endPlayerPhase, endEnemyPhase,
  reverseChance, winded, staminaCost, computeDamage, hitChance, moveUnit, undoMove,
  STAMINA_LOW, STAMINA_REST, DAMAGE_SCALE } from '../src/engine/battle.js';
import { planUnit } from '../src/engine/ai.js';
import { WRESTLERS_BY_ID as W } from '../src/data/wrestlers.js';
import { MOVES } from '../src/data/moves.js';

const mk = (players, enemies, seed = 42) => createBattle({
  match: { id: 't', title: 'T', type: 'singles', enemies }, playerTeam: players.map((id) => W[id]), seed,
});

// ------------------------------------------------------------------ souffle
test('un gros mouvement coûte plus de souffle qu’un petit', () => {
  const paliers = ['base', 'class', 'specialty', 'signature', 'finisher']
    .map((tier) => staminaCost({ tier }));
  for (let i = 1; i < paliers.length; i++) assert.ok(paliers[i] > paliers[i - 1], 'le coût monte avec le palier');
  assert.ok(staminaCost({ tier: 'base', requires: { ran: 3 } }) > staminaCost({ tier: 'base' }),
    'courir coûte en plus');
});

test('à bout de souffle, les signatures et finishers se referment', () => {
  const b = mk(['jean_sina'], ['gunter']);
  const [u, e] = b.units;
  e.x = u.x + 1; e.y = u.y; u.momentum = 100;
  const gros = () => listActions(b, u).filter((a) => ['signature', 'finisher'].includes(a.tier) && a.ok).length;
  assert.ok(gros() > 0, 'frais et à pleine jauge, ils sont ouverts');
  u.stamina = STAMINA_LOW - 1;
  assert.equal(gros(), 0, 'essoufflé, ils se referment');
  assert.ok(listActions(b, u).some((a) => a.tier === 'base' && a.ok), 'les coups de base restent');
});

test('à bout de souffle on frappe moins fort et moins juste', () => {
  const b = mk(['jean_sina'], ['gunter']);
  const [u, e] = b.units;
  e.x = u.x + 1; e.y = u.y;
  const m = { tier: 'base', type: 'strike', power: 20, stat: 'str', acc: 90, range: [1, 1] };
  const frais = computeDamage(b, u, e, m, { noRng: true }).dmg;
  const justesseFraiche = hitChance(b, u, e, m);
  u.stamina = 5;
  assert.equal(winded(u), true);
  assert.ok(computeDamage(b, u, e, m, { noRng: true }).dmg < frais, 'les dégâts baissent');
  assert.ok(hitChance(b, u, e, m) < justesseFraiche, 'la précision aussi');
});

test('souffler en rend plus que de continuer à frapper', () => {
  const b = mk(['jean_sina'], ['gunter']);
  const u = b.units[0];
  u.stamina = 40;
  endPlayerPhase(b); endEnemyPhase(b);
  const passif = u.stamina;
  u.stamina = 40; u.rested = true;
  endPlayerPhase(b); endEnemyPhase(b);
  assert.ok(u.stamina > passif, `souffler rend plus (${u.stamina} contre ${passif})`);
  assert.ok(u.stamina - 40 <= STAMINA_REST, 'mais pas plus que le forfait de repos');
});

test('annuler un déplacement rend le souffle dépensé', () => {
  const b = mk(['jean_sina'], ['gunter']);
  const u = b.units[0];
  const s0 = u.stamina;
  assert.ok(moveUnit(b, u, u.x + 2, u.y) || moveUnit(b, u, u.x - 2, u.y));
  assert.ok(u.stamina < s0, 'courir coûte du souffle');
  undoMove(b, u);
  assert.equal(u.stamina, s0, 'annuler le rend — sinon l’aller-retour est une pompe à fatigue');
});

// ------------------------------------------------------------- renversement
test('plus le mouvement est gros, plus il se renverse', () => {
  const b = mk(['rey_mysterioso'], ['gunter']);
  const [u, e] = b.units;
  const par = ['punch', 'kneestrike', 'six_one_nine', 'rko']
    .filter((id) => MOVES[id]).map((id) => reverseChance(b, u, e, MOVES[id]));
  assert.ok(par[par.length - 1] > par[0], 'un finisher se renverse plus qu’un coup de poing');
});

test('une cible au sol ou étourdie ne renverse rien', () => {
  const b = mk(['jean_sina'], ['gunter']);
  const [u, e] = b.units;
  const m = MOVES.rko || MOVES.powerbomb;
  assert.ok(reverseChance(b, u, e, m) > 0);
  e.statuses.dazed = 2;
  assert.equal(reverseChance(b, u, e, m), 0, 'étourdi : aucun renversement');
  delete e.statuses.dazed; e.down = true;
  assert.equal(reverseChance(b, u, e, m), 0, 'au sol non plus — sinon la chute ne vaudrait rien');
});

test('frapper à bout de souffle se fait renverser davantage', () => {
  const b = mk(['jean_sina'], ['gunter']);
  const [u, e] = b.units;
  const m = MOVES.powerbomb;
  const frais = reverseChance(b, u, e, m);
  u.stamina = 5;
  assert.ok(reverseChance(b, u, e, m) > frais, 'sans appui, on se fait retourner');
});

test('un renversement retourne le coup contre son auteur', () => {
  const b = mk(['jean_sina'], ['gunter']);
  const [u, e] = b.units;
  e.x = u.x + 1; e.y = u.y;
  b.rng.chance = () => true;                       // le renversement tombe à coup sûr
  const hp0 = u.hp, hpCible = e.hp;
  const r = resolveAttack(b, u, e, MOVES.powerbomb);
  assert.equal(r.reversed, true);
  assert.ok(u.hp < hp0, 'c’est l’attaquant qui encaisse');
  assert.equal(e.hp, hpCible, 'et la cible ne prend rien');
});

// ------------------------------------------------------------------ densité
test('un match dure une trentaine de tours ET reste dense', () => {
  const ids = ['jean_sina', 'gunter', 'rey_mysterioso', 'ronan_rains'];
  let tours = 0, coups = 0, chutes = 0, finis = 0;
  const n = 16;
  for (let seed = 1; seed <= n; seed++) {
    const b = mk([ids[seed % 2]], [ids[2 + seed % 2]], seed);
    autoPlay(b, 999);
    tours += b.turn;
    if (b.result) finis++;
    for (const l of b.log) {
      const t = l.text || l;
      if (/ dégâts/.test(t)) coups++;
      if (/est au sol/.test(t)) chutes++;
    }
  }
  assert.equal(finis, n, 'tous les matchs se concluent');
  assert.ok(tours / n >= 20, `au moins vingt tours (${(tours / n).toFixed(1)})`);
  // La densité est le garde-fou contre « long mais vide » : un match de trente
  // tours où il ne se passe rien est pire qu'un match de six.
  assert.ok(coups / n >= 15, `au moins quinze coups qui touchent (${(coups / n).toFixed(1)})`);
  assert.ok(chutes / n >= 3, `au moins trois chutes (${(chutes / n).toFixed(1)})`);
});

test('l’IA ne provoque pas sur place à l’autre bout du ring', () => {
  const b = mk(['jean_sina'], ['gunter']);
  const e = b.units.find((u) => u.team === 'enemy');
  const plan = planUnit(b, e);
  assert.ok(plan.moveTo, 'hors de portée, elle doit avancer');
});

test('les scores de l’IA suivent l’échelle de dégâts', () => {
  // Le piège : une constante fixe calibrée sur une ancienne échelle. En
  // divisant les dégâts par deux, « se coucher au passage » (45 fixe, zéro
  // dégât) est devenu 70 % des décisions de l'IA.
  const b = mk(['jean_sina'], ['gunter']);
  const e = b.units.find((u) => u.team === 'enemy');
  e.x = b.units[0].x + 1; e.y = b.units[0].y;
  b.units[0].momentum = 100;
  const choix = {};
  for (let i = 0; i < 40; i++) {
    const p = planUnit(b, b.units[0]);
    choix[p.action.id] = (choix[p.action.id] || 0) + 1;
  }
  const top = Object.entries(choix).sort((a, b2) => b2[1] - a[1])[0];
  assert.ok(!['dropdown', 'insult'].includes(top[0]),
    `l’IA ne doit pas se rabattre sur un mouvement sans dégâts (${top[0]})`);
  assert.ok(DAMAGE_SCALE > 0 && DAMAGE_SCALE <= 1);
});
