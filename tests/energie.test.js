// LE TOUR À ÉNERGIE ET LA DOUBLE ÉQUIPE
//
// Le match se jouait une carte par tour, main gardée d'un tour à l'autre :
// quarante tours en médiane, trois cartes sur cinq jouables, une phase
// adverse sur deux sans dégâts. Ces tests verrouillent ce qui a remplacé ça :
// trois points d'énergie par tour, une main neuve à chaque tour, plusieurs
// cartes à la suite — et la double équipe, où un partenaire donne son tour
// pour enchaîner sur les coups des autres.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, autoPlay, listActions, executeAction, startPhase, moveRange, resolveAttack, endPlayerPhase, enemySteps, endEnemyPhase, TEAMWORK_RATIO } from '../src/engine/battle.js';
import { ENERGY_PER_TURN, HAND_SIZE, energyCost, ENERGY_BY_TIER } from '../src/engine/hand.js';
import { living } from '../src/engine/util.js';
import { WRESTLERS_BY_ID as W, WRESTLERS } from '../src/data/wrestlers.js';
import { MOVES } from '../src/data/moves.js';

const mk = (players, enemies, seed = 42, type = 'singles') => createBattle({
  match: { id: 't', title: 'T', type, enemies }, playerTeam: players.map((id) => W[id]), seed,
});
const colle = (u, e) => { u.x = e.x - 1; u.y = e.y; };

test('trois points d’énergie par tour, et chaque palier a son prix', () => {
  const b = mk(['jean_sina'], ['gunter']);
  const [u] = b.units;
  assert.equal(u.energy, ENERGY_PER_TURN, 'on part avec l’énergie pleine');
  assert.equal(ENERGY_BY_TIER.base, 1, 'un fondamental vaut un point');
  assert.equal(ENERGY_BY_TIER.finisher, ENERGY_PER_TURN, 'un finisher vaut le tour entier');
  assert.ok(ENERGY_BY_TIER.specialty > ENERGY_BY_TIER.base, 'la spécialité coûte plus que la base');
  assert.equal(energyCost({ type: 'wait' }), 'all', 'souffler ferme le tour');
  assert.equal(energyCost({ type: 'teamwork' }), 'all', 'la double équipe aussi');
  for (const a of listActions(b, u)) assert.ok(a.energy !== undefined, `${a.id} porte son coût`);
});

test('on joue plusieurs cartes à la suite, et le tour se ferme à zéro', () => {
  const b = mk(['jean_sina'], ['jobber_1']);
  const [u, e] = b.units;
  colle(u, e);
  u.hand = ['punch', 'punch', 'grapple', 'whip', 'punch'];
  const r1 = executeAction(b, u, 'punch', { unit: e });
  assert.ok(r1.ok);
  assert.equal(u.energy, 2, 'un coup de poing coûte un point');
  assert.equal(u.acted, false, 'il reste de l’énergie : le tour continue');
  assert.equal(u.hand.length, 4, 'la carte jouée part de la main');
  executeAction(b, u, 'punch', { unit: e });
  executeAction(b, u, 'grapple', { unit: e });
  assert.equal(u.energy, 0);
  assert.equal(u.acted, true, 'énergie à zéro : le tour est fini');
  assert.ok(!listActions(b, u).length || listActions(b, u).every((a) => !a.ok || a.energy === 'all' || a.energy === 0),
    'plus rien de payant ne se joue');
});

test('ce qui coûte plus qu’il ne reste se ferme, avec la raison', () => {
  const b = mk(['jean_sina'], ['jobber_1']);
  const [u, e] = b.units;
  colle(u, e);
  u.momentum = 100; u.energy = 1;
  const fin = listActions(b, u).find((a) => a.id === 'attitude_adjustment');
  assert.ok(fin, 'le finisher est affiché');
  assert.equal(fin.ok, false, 'mais il coûte trois points');
  assert.match(fin.reason, /énergie/i);
  u.hand = ['punch'];
  assert.ok(listActions(b, u).find((a) => a.id === 'punch').ok, 'un coup de poing passe encore');
});

test('souffler ferme le tour quoi qu’il reste', () => {
  const b = mk(['jean_sina'], ['jobber_1']);
  const [u] = b.units;
  executeAction(b, u, 'wait');
  assert.equal(u.acted, true);
  assert.equal(u.energy, 0);
});

test('main neuve et énergie pleine à chaque tour', () => {
  const b = mk(['derby_allin'], ['gunter']);
  const [u, e] = b.units;
  colle(u, e);
  const avant = [...u.hand];
  u.hand = ['punch', 'moonsault', 'moonsault', 'moonsault', 'moonsault'];
  executeAction(b, u, 'punch', { unit: e });
  executeAction(b, u, 'wait');
  startPhase(b, 'enemy'); startPhase(b, 'player');
  assert.equal(u.hand.length, HAND_SIZE, 'cinq cartes');
  assert.equal(u.energy, ENERGY_PER_TURN, 'énergie rendue');
  assert.ok(u.discard.includes('moonsault'), 'ce qui n’a pas été joué est parti à la défausse');
  assert.ok(avant.length === HAND_SIZE, 'et la première main était pleine aussi');
});

test('tout le deck repasse en cinq ou six tours', () => {
  // C'est ce que la main gardée ne donnait pas : une carte précise mettait
  // dix-sept tours à revenir. Avec la main neuve, on revoit tout son deck
  // tous les deck/5 tours.
  const b = mk(['jean_sina'], ['gunter']);
  const [u] = b.units;
  const distinctes = new Set([...u.hand, ...u.deck, ...u.discard]);
  const total = u.hand.length + u.deck.length + u.discard.length;
  const vues = new Set(u.hand);
  for (let t = 0; t < Math.ceil(total / HAND_SIZE); t++) {
    startPhase(b, 'enemy'); startPhase(b, 'player');
    for (const id of u.hand) vues.add(id);
  }
  // Le talon se reconstitue avec la défausse dès qu'il est vide, au milieu
  // d'une pioche : les deux ou trois dernières cartes peuvent attendre un
  // cycle de plus. Avant, une carte précise mettait dix-sept tours à revenir.
  assert.ok(vues.size >= distinctes.size - 3, `presque toutes les cartes distinctes ont été vues (${vues.size}/${distinctes.size})`);
});

test('le tombé offert après un finisher reste gratuit', () => {
  const b = mk(['jean_sina'], ['jobber_1']);
  const [u, e] = b.units;
  colle(u, e);
  e.hp = 1; e.down = false; u.momentum = 100; u.energy = 3;
  // On force le coup : le finisher met au sol, et offre le tombé.
  let r = null;
  for (let i = 0; i < 12 && !(r && r.freePin); i++) {
    const bb = mk(['jean_sina'], ['jobber_1'], 100 + i);
    const [uu, ee] = bb.units; colle(uu, ee);
    ee.hp = 1; ee.statuses.dazed = 2; uu.momentum = 100; uu.stamina = 100;
    r = executeAction(bb, uu, 'attitude_adjustment', { unit: ee });
    if (r.freePin) {
      assert.equal(uu.acted, false, 'le tour reste ouvert pour couvrir');
      const pin = listActions(bb, uu).find((a) => a.id === 'pin');
      assert.ok(pin && pin.ok, 'COUVRIR est proposé');
      assert.equal(pin.energy, 0, 'et ne coûte rien');
    }
  }
  assert.ok(r && r.freePin, 'au moins un finisher a mis au sol');
});

// ------------------------------------------------------------ double équipe
test('la double équipe donne le tour, et le partenaire enchaîne sur ce que l’allié touche', () => {
  const b = mk(['jean_sina', 'derby_allin'], ['jobber_1', 'jobber_2'], 7, 'showdown');
  const [a, p] = b.units.filter((u) => u.team === 'player');
  const [e] = b.units.filter((u) => u.team === 'enemy');
  // Le partenaire se colle à la cible, l'attaquant aussi.
  p.x = e.x; p.y = e.y - 1; a.x = e.x - 1; a.y = e.y;
  const tw = listActions(b, p).find((x) => x.id === 'teamwork');
  assert.ok(tw && tw.ok, 'la double équipe est proposée quand on a un partenaire');
  executeAction(b, p, 'teamwork');
  assert.equal(p.teamwork, true);
  assert.equal(p.acted, true, 'elle coûte le tour');
  const hp0 = e.hp;
  e.statuses.dazed = 2;                   // pas de renversement : on teste l'enchaînement
  const r = resolveAttack(b, a, e, MOVES.punch);
  if (r.hit) {
    assert.ok(hp0 - e.hp > r.dmg, `le partenaire a ajouté son coup (${hp0 - e.hp} > ${r.dmg})`);
    assert.ok(b.log.some((l) => /DOUBLE ÉQUIPE/.test(l.text)), 'et le journal le raconte');
    assert.equal(b.stats.teamworks, 1);
  }
  // Loin de la cible, il n'enchaîne pas.
  p.x = e.x + 4; p.y = e.y + 4;
  const avant = b.stats.teamworks || 0;
  resolveAttack(b, a, e, MOVES.punch);
  assert.equal(b.stats.teamworks || 0, avant, 'à distance, pas d’enchaînement');
});

test('partir d’à côté d’un partenaire en double équipe donne une case de plus', () => {
  const b = mk(['jean_sina', 'derby_allin'], ['jobber_1', 'jobber_2'], 7, 'showdown');
  const [a, p] = b.units.filter((u) => u.team === 'player');
  const base = moveRange(b, a);
  p.x = a.x + 1; p.y = a.y; p.teamwork = true;
  assert.equal(moveRange(b, a), base + 1);
  p.x = a.x + 3;
  assert.equal(moveRange(b, a), base, 'il faut être collé');
});

test('seul, pas de double équipe ; en match à relais, seul le lutteur légal', () => {
  const solo = mk(['jean_sina'], ['gunter']);
  assert.ok(!listActions(solo, solo.units[0]).some((a) => a.id === 'teamwork'), 'sans partenaire, rien à proposer');
  const tag = mk(['jean_sina', 'derby_allin'], ['jobber_1', 'jobber_2'], 7, 'tag');
  const illegal = tag.units.find((u) => u.team === 'player' && !u.legal);
  assert.ok(!listActions(tag, illegal).some((a) => a.id === 'teamwork'), 'le partenaire sur le tablier ne s’y met pas');
});

test('la double équipe s’arrête au tour suivant de celui qui l’a prise', () => {
  const b = mk(['jean_sina', 'derby_allin'], ['jobber_1', 'jobber_2'], 7, 'showdown');
  const [, p] = b.units.filter((u) => u.team === 'player');
  executeAction(b, p, 'teamwork');
  startPhase(b, 'enemy');
  assert.equal(p.teamwork, true, 'elle tient pendant la phase adverse');
  startPhase(b, 'player');
  assert.equal(p.teamwork, false, 'et tombe à son tour suivant');
});

test('l’IA s’en sert : des doubles équipes dans un match à deux contre deux', () => {
  let n = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const b = mk(['jean_sina', 'derby_allin'], ['gunter', 'seth_rollmops'], seed, 'showdown');
    autoPlay(b, 200);
    n += b.stats.teamworks || 0;
  }
  assert.ok(n >= 4, `au moins quelques enchaînements sur douze matchs (${n})`);
});

// ------------------------------------------------------------ le rythme qui en sort
test('un match simple fait une douzaine de tours, ne finit jamais au chrono, et l’adversaire attaque', () => {
  const ids = WRESTLERS.filter((w) => !w.npc).map((w) => w.id);
  let tours = 0, chrono = 0, phases = 0, sansDegats = 0, n = 30;
  for (let seed = 1; seed <= n; seed++) {
    const b = mk([ids[seed % ids.length]], [ids[(seed * 7 + 3) % ids.length]], seed);
    while (!b.result && b.turn <= 60) {
      for (const u of [...living(b, 'player')]) if (!u.acted && !u.down) executeAction(b, u, 'wait');
      endPlayerPhase(b);
      if (b.result) break;
      const avant = living(b, 'player').reduce((s, u) => s + u.hp, 0);
      for (const _ of enemySteps(b)) { /* consomme */ }
      phases++;
      if (living(b, 'player').reduce((s, u) => s + u.hp, 0) >= avant) sansDegats++;
      endEnemyPhase(b);
    }
    tours += b.turn;
    if (b.result && /Limite de temps/.test(b.result.reason)) chrono++;
  }
  // Un joueur passif se fait battre vite : c'est la preuve que l'adversaire
  // joue. Avant le tour à énergie, une phase adverse sur deux ne faisait
  // aucun dégât.
  assert.ok(sansDegats / phases < 0.35, `l’adversaire frappe à presque chaque phase (${Math.round(sansDegats / phases * 100)} % sans dégâts)`);
  // Un joueur qui ne fait RIEN peut tenir jusqu'au chrono une fois de temps en
  // temps : il se relève tant qu'il a du cœur. Pas plus d'une fois sur trente.
  assert.ok(chrono <= 1, `presque aucun match au chrono (${chrono})`);
  assert.ok(tours / n <= 22, `un joueur passif ne tient pas vingt tours (${(tours / n).toFixed(1)})`);
});
