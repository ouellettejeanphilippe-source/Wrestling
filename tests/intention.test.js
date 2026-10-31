// L'INTENTION ANNONCÉE
//
// Un adversaire dont on ne sait rien est un dé. Au début de votre tour, chaque
// adversaire debout annonce sa première carte, sur qui, et d'où ; sortir de
// sa portée fait partir le coup dans le vide. Ces tests verrouillent les
// trois morceaux : l'annonce existe et dit vrai, l'adversaire la tient, et
// l'esquive se paie.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, autoPlay, enemySteps, endPlayerPhase, endEnemyPhase, executeAction, moveUnit, planIntents } from '../src/engine/battle.js';
import { living } from '../src/engine/util.js';
import { WRESTLERS_BY_ID as W, WRESTLERS } from '../src/data/wrestlers.js';
import { HAND_SIZE, ENERGY_PER_TURN } from '../src/engine/hand.js';

const mk = (players, enemies, seed = 42, type = 'singles') => createBattle({
  match: { id: 't', title: 'T', type, enemies }, playerTeam: players.map((id) => W[id]), seed,
});

test('au début de votre tour, chaque adversaire debout annonce sa première carte', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const b = mk(['jean_sina'], ['gunter'], seed);
    const e = b.units.find((u) => u.team === 'enemy');
    assert.ok(e.intent, `graine ${seed} : une intention dès le coup d’envoi`);
    assert.ok(e.intent.id && e.intent.name && e.intent.icon, 'elle a un nom et une icône');
    assert.equal(e.hand.length, HAND_SIZE, 'la main qu’il jouera est déjà tirée');
    assert.equal(e.energy, ENERGY_PER_TURN);
  }
});

test('l’annonce est tirée de la main du tour suivant, pas de l’ancienne', () => {
  const b = mk(['jean_sina'], ['gunter'], 7);
  const e = b.units.find((u) => u.team === 'enemy');
  endPlayerPhase(b);
  for (const _ of enemySteps(b)) { /* consomme */ }
  endEnemyPhase(b);
  assert.ok(e.intent, 'nouvelle annonce au tour 2');
  assert.equal(e.hand.length, HAND_SIZE, 'main neuve');
  assert.equal(e.energy, ENERGY_PER_TURN, 'énergie pleine');
  assert.equal(e.handReady, true, 'et elle ne sera pas rebattue au début de sa phase');
  if (e.intent.id && !['pin', 'toss', 'teamwork', 'wait', 'taunt'].includes(e.intent.type)) {
    assert.ok(e.hand.includes(e.intent.id) || !['strike', 'grapple', 'aerial', 'submission'].includes(e.intent.type), 'la carte annoncée est dans sa main');
  }
});

test('il tient ce qu’il a annoncé quand la cible n’a pas bougé', () => {
  let tenues = 0, n = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const b = mk(['jean_sina'], ['gunter'], seed);
    const e = b.units.find((u) => u.team === 'enemy');
    const it = e.intent;
    if (!it || !it.targetUid) continue;
    n++;
    // Le joueur ne bouge pas : il souffle.
    for (const u of living(b, 'player')) executeAction(b, u, 'wait');
    endPlayerPhase(b);
    const steps = [...enemySteps(b)];
    const first = steps.find((s) => s.type === 'action' || s.type === 'whiff');
    if (first && first.type === 'action' && first.action.id === it.id && first.announced) tenues++;
  }
  assert.ok(n >= 8, `assez d’annonces ciblées pour mesurer (${n})`);
  assert.ok(tenues / n >= 0.75, `il joue ce qu’il a annoncé (${tenues}/${n})`);
});

test('sortir de sa portée fait partir le coup dans le vide, et ça se paie', () => {
  let esquives = 0, n = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const b = mk(['rey_mysterioso'], ['gunter'], seed);
    const p = b.units.find((u) => u.team === 'player'), e = b.units.find((u) => u.team === 'enemy');
    const it = e.intent;
    if (!it || !it.targetUid || !['strike', 'grapple', 'aerial'].includes(it.type)) continue;
    n++;
    // On téléporte le joueur à l'autre bout de l'aréna : hors de tout ce que
    // l'adversaire peut atteindre, même en courant.
    p.x = 1; p.y = 1; p.acted = true;
    const momentum = p.momentum, cartes = e.hand.length;
    endPlayerPhase(b);
    const steps = [...enemySteps(b)];
    const whiff = steps.find((s) => s.type === 'whiff');
    if (!whiff) continue;
    esquives++;
    assert.ok(b.log.some((l) => /dans le vide/.test(l.text)), 'le journal le raconte');
    assert.ok(p.momentum >= momentum + 6, 'celui qui a vu venir gagne de la jauge');
    assert.ok(e.hand.length < cartes || e.discard.includes(it.id), 'la carte est perdue');
    assert.equal(b.stats.playerDodges, 1);
  }
  assert.ok(n >= 6, `assez de coups annoncés pour mesurer (${n})`);
  assert.ok(esquives / n >= 0.6, `hors de portée, le coup part dans le vide (${esquives}/${n})`);
});

test('un pas de côté ne suffit pas : il vise, il ne récite pas', () => {
  // Le déplacement annoncé est recalculé si la cible a bougé d'une case :
  // l'esquive doit se gagner, sinon l'IA ne gagnait plus qu'un match sur cinq.
  //
  // UNE NUANCE, TROUVÉE QUAND LA MAIN S'EST DÉVERROUILLÉE : les cartes lourdes
  // de classe et de spécialité (powerbomb, body slam, gut wrench…) n'ont pas de
  // pas d'approche. Quand l'adversaire arrive au bout de son déplacement, un
  // pas de côté les envoie dans le vide — environ une fois sur quatre. C'est
  // de la lecture de placement, et c'est voulu : les coups de base, eux, ont
  // un pas et rattrapent toujours.
  let touches = 0, n = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const b = mk(['jean_sina'], ['gunter'], seed);
    const p = b.units.find((u) => u.team === 'player'), e = b.units.find((u) => u.team === 'enemy');
    const it = e.intent;
    if (!it || !it.targetUid || !['strike', 'grapple'].includes(it.type)) continue;
    n++;
    const reach = [...b.api ? [] : []];
    // Un pas de côté, dans le ring.
    const ok = moveUnit(b, p, p.x, p.y + 1) || moveUnit(b, p, p.x, p.y - 1) || moveUnit(b, p, p.x - 1, p.y);
    if (!ok) { n--; continue; }
    executeAction(b, p, 'wait');
    endPlayerPhase(b);
    const steps = [...enemySteps(b)];
    const first = steps.find((s) => s.type === 'action' || s.type === 'whiff');
    if (first && first.type === 'action' && first.announced) touches++;
  }
  assert.ok(n >= 6, `assez de cas (${n})`);
  assert.ok(touches / n >= 0.6, `il rattrape presque toujours un pas de côté (${touches}/${n})`);
  assert.ok(touches < n, 'mais pas toujours : une carte sans pas se laisse esquiver');
});

test('un adversaire au sol n’annonce rien, et le joueur n’annonce jamais', () => {
  const b = mk(['jean_sina'], ['gunter'], 9);
  const p = b.units.find((u) => u.team === 'player'), e = b.units.find((u) => u.team === 'enemy');
  e.down = true;
  planIntents(b);
  assert.equal(e.intent, null, 'au sol : rien à annoncer');
  assert.equal(p.intent, undefined, 'vos lutteurs n’ont pas d’intention');
});

test('l’IA reste un adversaire : elle gagne encore un match sur trois contre une IA qui ne lit pas les bulles', () => {
  const ids = WRESTLERS.filter((w) => !w.npc).map((w) => w.id);
  let enemy = 0, n = 40, vides = 0;
  for (let seed = 1; seed <= n; seed++) {
    const b = mk([ids[seed % ids.length]], [ids[(seed * 7 + 3) % ids.length]], seed);
    autoPlay(b, 400);
    if (b.result && b.result.winner === 'enemy') enemy++;
    vides += b.stats.dodges || 0;
  }
  assert.ok(enemy / n >= 0.3, `l’adversaire gagne encore (${enemy}/${n})`);
  assert.ok(vides / n <= 1.5, `peu de coups dans le vide par accident (${(vides / n).toFixed(2)} par match)`);
});
