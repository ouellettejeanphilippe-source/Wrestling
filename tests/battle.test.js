import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, listActions, executeAction, moveUnit, computeDamage, pinChance, hitChance, pushUnit, endPlayerPhase, runEnemyPhase, autoPlay, getStats } from '../src/engine/battle.js';
import { WRESTLERS_BY_ID, WRESTLERS } from '../src/data/wrestlers.js';
import { MOVES } from '../src/data/moves.js';
import { CLASSES, SPECIALTIES } from '../src/data/classes.js';
import { GIMMICKS } from '../src/data/gimmicks.js';
import { SEASON } from '../src/data/campaign.js';
import { movesFor } from '../src/engine/units.js';

const W = WRESTLERS_BY_ID;
const mk = (type, players, enemies, extra = {}) => createBattle({ match: { id: 't', title: 'Test', type, enemies, ...extra }, playerTeam: players.map((id) => W[id]), seed: 42 });
const findP = (b, id) => b.units.find((u) => u.id === id && u.team === 'player');
const findE = (b, id) => b.units.find((u) => u.id === id && u.team === 'enemy');
const place = (u, x, y) => { u.x = x; u.y = y; };

test('les données sont cohérentes : classes, spécialités, gimmicks et mouvements existent', () => {
  for (const w of WRESTLERS) {
    assert.ok(CLASSES[w.cls], `${w.id}: classe ${w.cls}`);
    assert.ok(SPECIALTIES[w.spec], `${w.id}: spécialité ${w.spec}`);
    assert.ok(GIMMICKS[w.gimmick], `${w.id}: gimmick ${w.gimmick}`);
    assert.ok(MOVES[w.signature] && MOVES[w.signature].tier === 'signature', `${w.id}: signature ${w.signature}`);
    assert.ok(MOVES[w.finisher] && MOVES[w.finisher].tier === 'finisher', `${w.id}: finisher ${w.finisher}`);
    const moves = movesFor(w);
    assert.ok(moves.includes('punch') && moves.includes('taunt'), 'mouvements de base');
    assert.equal(moves.filter((m) => MOVES[m].tier === 'class').length, 3, `${w.id}: 3 mouvements de classe`);
    assert.equal(moves.filter((m) => MOVES[m].tier === 'specialty').length, 2, `${w.id}: 2 mouvements de spécialité`);
  }
  for (const show of SEASON.shows) for (const m of show.matches) {
    for (const e of m.enemies) assert.ok(W[typeof e === 'string' ? e : e.id], `${m.id}: ennemi inconnu`);
    assert.ok(m.script && m.script.finish && m.script.beats.length, `${m.id}: script`);
  }
});

test('un match se crée avec les bonnes équipes et les armes selon le type', () => {
  const b = mk('hardcore', ['jean_sina'], ['jon_moxie']);
  assert.equal(b.units.length, 2);
  assert.equal(b.items.length, 4);           // hardcore : les armes traînent déjà au sol
  assert.ok(b.underRing > 0);                // et il y en a d'autres sous le ring
  const s = mk('singles', ['jean_sina'], ['jobber_1']);
  assert.equal(s.items.length, 0);           // match simple : rien ne traîne…
  assert.equal(s.underRing, 2);              // …mais il y a de quoi faire sous le tablier
  const c = mk('cage', ['jean_sina'], ['le_geant']);
  assert.equal(c.items.length, 0);
});

test('les dégâts dépendent des stats, du coin et de la défense', () => {
  const b = mk('singles', ['derby_allin'], ['jobber_1']);
  const d = findP(b, 'derby_allin'), j = findE(b, 'jobber_1');
  const flat = computeDamage(b, d, j, MOVES.moonsault, { noRng: true }).dmg;
  place(d, 4, 3);
  const corner = computeDamage(b, d, j, MOVES.moonsault, { noRng: true }).dmg;
  assert.ok(corner > flat, 'plongeon depuis le coin plus fort');
  const strong = mk('singles', ['jean_sina'], ['gunter']);
  const s = findP(strong, 'jean_sina'), g = findE(strong, 'gunter');
  const vsGunter = computeDamage(strong, s, g, MOVES.punch, { noRng: true }).dmg;
  const vsJobber = computeDamage(b, findP(b, 'derby_allin'), j, MOVES.punch, { noRng: true }).dmg;
  assert.ok(vsGunter < vsJobber + 10, 'la DEF réduit les dégâts');
  assert.ok(computeDamage(b, d, j, MOVES.punch, { noRng: true }).dmg >= 1);
});

test('portée et prérequis des mouvements filtrent les cibles', () => {
  const b = mk('singles', ['derby_allin'], ['jobber_1']);
  const d = findP(b, 'derby_allin'), j = findE(b, 'jobber_1');
  place(d, 6, 5); place(j, 9, 5);
  let acts = listActions(b, d);
  assert.ok(!acts.find((a) => a.id === 'punch').ok, 'trop loin pour un coup de poing');
  assert.ok(!acts.find((a) => a.id === 'moonsault').ok, 'moonsault exige un coin');
  place(d, 4, 3); place(j, 5, 4);
  acts = listActions(b, d);
  assert.ok(!acts.find((a) => a.id === 'moonsault').ok, 'moonsault verrouillé sans momentum (palier classe)');
  d.momentum = 30;
  acts = listActions(b, d);
  assert.ok(acts.find((a) => a.id === 'moonsault').ok, 'moonsault depuis le coin à portée 2 avec 30 momentum');
  assert.ok(!acts.find((a) => a.id === 'crossbody').ok, 'spécialité verrouillée sous 45');
  assert.ok(!acts.find((a) => a.id === 'coffin_drop').ok, 'finisher sans momentum');
  d.momentum = 100;
  assert.ok(listActions(b, d).find((a) => a.id === 'coffin_drop').ok);
  assert.ok(listActions(b, d).find((a) => a.id === 'crossbody').ok);
});

test('échelle de momentum : un mouvement coûte son palier et en rapporte s’il touche', () => {
  const b = mk('singles', ['jean_sina'], ['jobber_1']);
  const s = findP(b, 'jean_sina'), j = findE(b, 'jobber_1');
  place(s, 6, 5); place(j, 7, 5);
  s.momentum = 30;
  assert.ok(listActions(b, s).find((a) => a.id === 'bodyslam').ok, 'classe débloquée à 25');
  assert.ok(!listActions(b, s).find((a) => a.id === 'kneestrike').ok, 'spécialité verrouillée à 30');
  assert.ok(listActions(b, s).find((a) => a.id === 'taunt').ok, 'provoquer toujours disponible');
  const r = executeAction(b, s, 'bodyslam', { unit: j });
  assert.ok(r.ok);
  if (r.hit) assert.ok(s.momentum >= 30 + MOVES.bodyslam.momentum, 'un mouvement de classe ne coûte rien et rapporte');
  else assert.equal(s.momentum, 30, 'un coup raté ne coûte rien non plus');
  // Signature et finisher, eux, consomment la jauge.
  s.acted = false; s.momentum = 100;
  const f = executeAction(b, s, 'attitude_adjustment', { unit: j });
  assert.ok(f.ok);
  assert.ok(s.momentum < 100, 'le finisher dépense le momentum');
});

test('un lutteur à 0 PV est au sol, peut être couvert, puis se relève', () => {
  const b = mk('singles', ['jean_sina'], ['jobber_1']);
  const s = findP(b, 'jean_sina'), j = findE(b, 'jobber_1');
  place(s, 6, 5); place(j, 7, 5);
  j.hp = 1;
  const r = executeAction(b, s, 'punch', { unit: j });
  assert.ok(r.ok && r.hit);
  assert.ok(j.down, 'au sol');
  assert.ok(pinChance(b, s, j) > 0.4, 'gros pourcentage de tombé sur une cible au sol');
  // le jobber reste au sol un tour puis se relève
  endPlayerPhase(b);
  assert.ok(j.down && j.acted, 'toujours au sol pendant son tour');
  b.turn++; // simule endEnemyPhase sans IA
  endPlayerPhase(b);
  assert.ok(!j.down && j.hp > 0, 'se relève au tour suivant');
  assert.equal(j.grit, 0, 'le cœur baisse en se relevant');
});

test('on ne peut pas couvrir un adversaire trop frais, ni hors du ring en match simple', () => {
  const b = mk('singles', ['jean_sina'], ['jobber_1']);
  const s = findP(b, 'jean_sina'), j = findE(b, 'jobber_1');
  place(s, 6, 5); place(j, 7, 5);
  assert.ok(!listActions(b, s).find((a) => a.id === 'pin').ok);
  j.hp = 10;
  assert.ok(listActions(b, s).find((a) => a.id === 'pin').ok);
  place(s, 2, 5); place(j, 3, 5);
  assert.ok(!listActions(b, s).find((a) => a.id === 'pin').ok, 'pas de tombé sur le plancher');
  const h = mk('hardcore', ['jean_sina'], ['jobber_1']);
  const hs = findP(h, 'jean_sina'), hj = findE(h, 'jobber_1');
  place(hs, 2, 5); place(hj, 3, 5); hj.hp = 10;
  assert.ok(listActions(h, hs).find((a) => a.id === 'pin').ok, 'falls count anywhere');
});

test('Irish Whip dans une table la casse et blesse', () => {
  const b = mk('hardcore', ['jean_sina'], ['jobber_1']);
  const j = findE(b, 'jobber_1');
  place(j, 17, 7);                        // juste à côté de la table des commentateurs
  const hp = j.hp;
  pushUnit(b, j, 1, 0, 2, findP(b, 'jean_sina'));
  assert.equal(b.stats.tables, 1);
  assert.ok(j.hp < hp);
  assert.equal(b.grid.tiles[7 * b.grid.w + 18], 'debris');
});

test('bataille royale : élimination par-dessus la corde uniquement', () => {
  const b = mk('battle_royal', ['jean_sina'], ['jobber_1']);
  const s = findP(b, 'jean_sina'), j = findE(b, 'jobber_1');
  place(s, 5, 5); place(j, 4, 5);
  const acts = listActions(b, s);
  assert.ok(!acts.find((a) => a.id === 'pin'), 'pas de tombé');
  assert.ok(acts.find((a) => a.id === 'toss').ok, 'toss possible quand la cible est sur les cordes');
  j.hp = 1; j.down = true;
  let tossed = false;
  for (let i = 0; i < 20 && !tossed; i++) { s.acted = false; const r = executeAction(b, s, 'toss', { unit: j }); tossed = r.success; }
  assert.ok(tossed);
  assert.equal(b.result.winner, 'player');
});

test('match d’échelle : deux tours d’escalade sans dégâts pour gagner', () => {
  const b = mk('ladder', ['jean_sina'], ['jobber_1']);
  const s = findP(b, 'jean_sina');
  place(s, 9, 6);                         // sur l'échelle, au centre du ring
  executeAction(b, s, 'climb');
  assert.equal(s.climb, 1);
  s.acted = false;
  b.api.applyDamage(s, 5, findE(b, 'jobber_1'), {});
  assert.equal(s.climb, 0, 'les dégâts font retomber');
  executeAction(b, s, 'climb'); s.acted = false; executeAction(b, s, 'climb');
  assert.ok(s.flags.belt);
  assert.equal(b.result.winner, 'player');
});

test('cage : évasion depuis un coin', () => {
  const b = mk('cage', ['jean_sina'], ['jobber_1']);
  const s = findP(b, 'jean_sina');
  place(s, 4, 3);
  executeAction(b, s, 'climb'); s.acted = false; executeAction(b, s, 'climb');
  assert.ok(s.flags.escaped);
  assert.equal(b.result.winner, 'player');
});

test('tag : seul le lutteur légal peut couvrir, le tag soigne et donne du momentum', () => {
  const b = mk('tag', ['jean_sina', 'derby_allin'], ['jobber_1', 'jobber_2']);
  const s = findP(b, 'jean_sina'), d = findP(b, 'derby_allin'), j = findE(b, 'jobber_1');
  assert.ok(s.legal && !d.legal);
  place(s, 5, 5); place(d, 4, 5); place(j, 6, 5); j.hp = 5;
  assert.ok(!listActions(b, d).find((a) => a.id === 'pin').ok, 'le non-légal ne peut pas couvrir');
  d.hp = 40;
  executeAction(b, s, 'tag', { unit: d });
  assert.ok(d.legal && !s.legal);
  assert.ok(d.hp > 40 && d.momentum >= 30);
  assert.equal(b.stats.tags, 1);
});

test('compte à l’extérieur : 6 tours dehors = éliminé', () => {
  const b = mk('singles', ['jean_sina'], ['jobber_1']);
  const j = findE(b, 'jobber_1');
  place(j, 2, 5);
  for (let i = 0; i < 6; i++) { endPlayerPhase(b); b.turn++; b.phase = 'player'; }
  assert.ok(j.eliminated && j.elimReason === 'countout');
  assert.equal(b.result.winner, 'player');
});

test('gimmicks : N’abandonne jamais empêche la première chute, aura de Ronan Rains', () => {
  const b = mk('showdown', ['jean_sina', 'ronan_rains'], ['jobber_1']);
  const s = findP(b, 'jean_sina'), r = findP(b, 'ronan_rains');
  place(s, 6, 5); place(r, 6, 6);
  const base = W.jean_sina.stats.str;
  assert.equal(getStats(b, s).str, base + 2, 'aura +2 FOR à 2 cases');
  b.api.applyDamage(s, 999, findE(b, 'jobber_1'), {});
  assert.ok(!s.down && s.hp > 0, 'never give up');
  b.api.applyDamage(s, 999, findE(b, 'jobber_1'), {});
  assert.ok(s.down, 'la deuxième fois, il tombe');
});

test('mode scénarios : Vendre et Faire le job sont disponibles et respectent le script', () => {
  const b = createBattle({ match: { id: 't', title: 'T', type: 'singles', enemies: ['kris_gericault'], mode: 'scenario', script: { summary: '', finish: { winner: 'enemy', method: 'pin', finisher: true }, beats: ['sells'] } }, playerTeam: [W.jean_sina], seed: 7 });
  const s = findP(b, 'jean_sina'), k = findE(b, 'kris_gericault');
  place(s, 6, 5); place(k, 7, 5);
  let acts = listActions(b, s);
  assert.ok(acts.find((a) => a.id === 'sell').ok);
  assert.ok(!acts.find((a) => a.id === 'job').ok, 'doit d’abord encaisser le finisher');
  executeAction(b, s, 'sell');
  assert.equal(b.stats.sells, 1);
  s.acted = false; s.statuses.finished = 2;
  acts = listActions(b, s);
  assert.ok(acts.find((a) => a.id === 'job').ok);
  executeAction(b, s, 'job', { unit: k });
  assert.equal(b.result.winner, 'enemy');
  assert.ok(b.stats.finisherFinish);
});

test('l’IA joue une phase complète sans erreur et finit par gagner ou perdre', () => {
  for (const show of SEASON.shows) for (const m of show.matches) {
    const team = ['jean_sina', 'derby_allin', 'brian_danielsson'].slice(0, m.teamSize).map((id) => W[id]);
    const b = createBattle({ match: m, playerTeam: team, seed: 3 });
    const r = autoPlay(b, 40);
    assert.ok(r && ['player', 'enemy'].includes(r.winner), `${m.id} se termine`);
  }
});

test('les renforts arrivent au tour prévu', () => {
  const m = SEASON.shows[6].matches[0];
  const b = createBattle({ match: m, playerTeam: ['jean_sina', 'derby_allin', 'brian_danielsson'].map((id) => W[id]), seed: 1 });
  assert.equal(b.units.filter((u) => u.team === 'enemy').length, 2);
  for (const u of b.units) if (u.team === 'player') place(u, 8, 3 + b.units.indexOf(u)); // loin de la rampe
  endPlayerPhase(b); runEnemyPhase(b); // tour 2
  endPlayerPhase(b); runEnemyPhase(b); // tour 3 → renfort
  assert.ok(b.units.filter((u) => u.team === 'enemy').length >= 3);
});

test('les trois actes changent les règles du match', async () => {
  const { matchPhase, PHASES } = await import('../src/engine/phases.js');
  const b = mk('singles', ['jean_sina'], ['jobber_1']);
  assert.equal(matchPhase(b).key, 'early', 'ouverture au premier tour');
  b.turn = 6; b.heat = 50;
  assert.equal(matchPhase(b).key, 'mid', 'corps du match ensuite');
  b.heat = 80;
  assert.equal(matchPhase(b).key, 'late', 'une foule chaude fait basculer en main event');
  b.heat = 20; b.turn = 12;
  assert.equal(matchPhase(b).key, 'late', 'un match long aussi');
  assert.ok(PHASES.late.dmg > PHASES.early.dmg, 'la fin frappe plus fort que le début');
  assert.ok(PHASES.early.momentum > PHASES.late.momentum, 'le début construit le momentum');
  assert.ok(PHASES.late.flashy > PHASES.early.flashy, 'les gros mouvements paient surtout à la fin');
});

test('les combos se déclenchent sur les bonnes conditions et cumulent', async () => {
  const { activeCombos, comboDamageMult } = await import('../src/engine/battle.js');
  const b = mk('singles', ['derby_allin'], ['jobber_1']);
  const d = findP(b, 'derby_allin'), j = findE(b, 'jobber_1');
  place(d, 6, 5); place(j, 7, 5);
  assert.equal(activeCombos(b, d, j, MOVES.punch).length, 0, 'aucun combo sans mise en place');
  j.statuses.dazed = 2;
  const c1 = activeCombos(b, d, j, MOVES.punch);
  assert.ok(c1.some((c) => c.id === 'stagger'), 'cible étourdie : suite logique');
  place(d, 4, 3); place(j, 5, 4);
  const c2 = activeCombos(b, d, j, MOVES.moonsault);
  assert.ok(c2.some((c) => c.id === 'highspot'), 'plongeon depuis le coin : high spot');
  assert.ok(comboDamageMult(c2) > 1, 'les combos augmentent les dégâts');
  assert.ok(comboDamageMult([{ dmg: 2 }, { dmg: 2 }, { dmg: 2 }]) <= 1.8, 'le cumul est plafonné');
  d.memory.lastHit = { uid: j.uid, type: 'strike' };
  assert.ok(activeCombos(b, d, j, MOVES.hurricanrana).some((c) => c.id === 'chain'), 'changer de famille de coup : enchaînement');
});

test('arrêt de l’arbitre : un adversaire sans cœur qui retombe ne se relève plus', () => {
  const b = mk('singles', ['jean_sina'], ['jobber_1']);
  const j = findE(b, 'jobber_1');
  j.grit = 0;
  b.api.applyDamage(j, 999, findP(b, 'jean_sina'), {});
  assert.ok(j.eliminated && j.elimReason === 'stoppage');
  assert.equal(b.result.winner, 'player');
});

test('chaque match expose plusieurs routes de victoire', async () => {
  const { winRoutes } = await import('../src/engine/rules.js');
  const singles = winRoutes(mk('singles', ['brian_danielsson'], ['jobber_1'])).map((r) => r.id);
  for (const id of ['pin', 'stoppage', 'submission', 'countout', 'dq']) assert.ok(singles.includes(id), `match simple : ${id}`);
  const royal = winRoutes(mk('battle_royal', ['jean_sina'], ['jobber_1'])).map((r) => r.id);
  assert.ok(royal.includes('toss'), 'bataille royale : par-dessus la corde');
  assert.ok(!royal.includes('pin'), 'bataille royale : pas de tombé');
  const cage = winRoutes(mk('cage', ['jean_sina'], ['jobber_1'])).map((r) => r.id);
  assert.ok(cage.includes('escape') && cage.includes('pin'), 'cage : évasion et tombé');
  const ladder = winRoutes(mk('ladder', ['jean_sina'], ['jobber_1'])).map((r) => r.id);
  assert.ok(ladder.includes('belt'), 'échelle : ceinture');
});

// ------------------------------------------------------------- stipulations
test('la table des commentateurs ne se brise que si la stipulation l’autorise', async () => {
  const { tileAt } = await import('../src/engine/grid.js');
  const tableTile = (b) => {
    for (let y = 0; y < b.grid.h; y++) for (let x = 0; x < b.grid.w; x++) if (tileAt(b.grid, x, y) === 'table') return { x, y };
    return null;
  };
  // match simple : on s'écrase dessus, elle tient
  const s = mk('singles', ['jean_sina'], ['jobber_1']);
  const t = tableTile(s);
  assert.ok(t, 'l’aréna standard a une table des commentateurs');
  const victime = findE(s, 'jobber_1'), pousseur = findP(s, 'jean_sina');
  place(victime, t.x - 1, t.y); place(pousseur, t.x - 2, t.y);
  const hpAvant = victime.hp;
  pushUnit(s, victime, 1, 0, 2, pousseur);
  assert.equal(tileAt(s.grid, t.x, t.y), 'table', 'la table doit tenir bon');
  assert.ok(victime.hp < hpAvant, 'mais faire mal quand même');

  // hardcore : elle est au menu
  const h = mk('hardcore', ['jean_sina'], ['jobber_1']);
  const th = tableTile(h);
  const v2 = findE(h, 'jobber_1'), p2 = findP(h, 'jean_sina');
  place(v2, th.x - 1, th.y); place(p2, th.x - 2, th.y);
  pushUnit(h, v2, 1, 0, 2, p2);
  assert.equal(tileAt(h.grid, th.x, th.y), 'debris', 'la table doit se briser');
});

test('les armes se cherchent sous le ring, depuis le bord du tablier', () => {
  const b = mk('singles', ['jean_sina'], ['jobber_1']);
  const u = findP(b, 'jean_sina');
  const stock = b.underRing;
  assert.ok(stock > 0);

  // au milieu du ring : l'action existe mais est refusée
  place(u, b.grid.ring.x0 + 1, b.grid.ring.y0 + 1);
  const dedans = listActions(b, u).find((a) => a.id === 'scavenge');
  assert.ok(dedans && !dedans.ok, 'impossible de fouiller depuis le centre du ring');

  // contre le tablier, à l'extérieur : c'est bon
  place(u, b.grid.ring.rx0 - 1, b.grid.ring.ry0 + 1);
  const dehors = listActions(b, u).find((a) => a.id === 'scavenge');
  assert.ok(dehors && dehors.ok, 'fouiller doit être possible au bord du ring');
  executeAction(b, u, 'scavenge', { self: true });
  assert.ok(u.weapon, 'le lutteur ressort avec une arme');
  assert.equal(b.underRing, stock - 1);
});

test('Last Man Standing : deux tours au sol et c’est le compte de dix', () => {
  const b = mk('last_man_standing', ['jean_sina'], ['jobber_1']);
  assert.ok(b.rules.tenCount && b.rules.noPin);
  const j = findE(b, 'jobber_1');
  j.down = true; j.downTurns = 0; j.hp = 0;
  endPlayerPhase(b);                    // premier passage : l'arbitre commence à compter
  assert.ok(!j.eliminated, 'il a encore un tour pour se relever');
  assert.equal(j.downTurns, 1);
  runEnemyPhase(b);
  endPlayerPhase(b);                    // deuxième passage : dix !
  assert.ok(j.eliminated && j.elimReason === 'stoppage');
});
