// L'USURE CIBLÉE, LES MANAGERS, LES RIVALITÉS ET L'HISTOIRE DU MATCH
//
// Ces quatre pièces répondent à la même question : qu'est-ce qui distingue le
// trentième tour du troisième ? Un match qui n'accumule rien n'a pas d'arc, et
// un match sans arc n'a pas d'histoire — quelle que soit sa durée.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, autoPlay, listActions, executeAction, resolveAttack, applyDamage,
  tapChance, novelty, computeDamage, getStats, moveRange, subAttempts,
  MANAGER_FIRST_TURN, RIVALRY_REVENGE, startPhase } from '../src/engine/battle.js';
import { movePart, wearFrom, wearOf, wearLevel, wornParts, isAimed,
  WEAR_RATE, WEAR_DRIFT, WEAR_HURT, WEAR_BROKEN } from '../src/engine/wear.js';
import { WRESTLERS_BY_ID as W } from '../src/data/wrestlers.js';
import { MOVES } from '../src/data/moves.js';
import { tileAt, isOutside } from '../src/engine/grid.js';
import { MANAGERS } from '../src/data/managers.js';
import { rivalryFor, recordMatch, pairKey, getRivalry } from '../src/game/rivalry.js';
import { matchStory, rateMatch } from '../src/game/story.js';

const mk = (players, enemies, seed = 42, extra = {}) => createBattle({
  match: { id: 't', title: 'T', type: 'singles', enemies, ...extra },
  playerTeam: players.map((id) => W[id]), seed,
});
const colle = (b) => { const [u, e] = b.units; u.x = e.x - 1; u.y = e.y; return [u, e]; };

// ------------------------------------------------------------------ l'usure
test('viser un membre l’use quatre fois plus que l’atteindre au passage', () => {
  const vise = wearFrom(MOVES.chop_block, 10);      // part: 'legs'
  const passage = wearFrom(MOVES.punch, 10);        // pas de `part` : dérive
  assert.equal(vise.part, 'legs');
  assert.equal(vise.aimed, true);
  assert.equal(passage.aimed, false);
  // Sans cet écart, l'offensive ordinaire suffit à démolir un membre et
  // « hors service » cesse de vouloir dire quelque chose.
  assert.ok(vise.n > passage.n * 3, `viser use bien plus (${vise.n.toFixed(1)} contre ${passage.n.toFixed(1)})`);
  assert.ok(WEAR_RATE > WEAR_DRIFT * 2, 'le rapport tient dans les constantes');
});

test('aucune frappe ordinaire ne travaille la tête par défaut', () => {
  // Le piège corrigé : quand les frappes usaient la tête, l'usure « tête »
  // montait toute seule et les prises de tête devenaient décisives sans que
  // personne ait rien décidé.
  for (const id of ['punch', 'haymaker', 'kneestrike', 'roundhouse']) {
    const m = MOVES[id];
    if (isAimed(m)) continue;
    assert.notEqual(movePart(m), 'head', `${id} ne doit pas user la tête par défaut`);
  }
});

test('l’usure retire des caractéristiques et ferme des portes', () => {
  const b = mk(['bill_osprey'], ['jean_sina']);      // un voltigeur
  const [u] = colle(b);
  u.momentum = 100;
  const avant = getStats(b, u), movAvant = moveRange(b, u);
  const aerienAvant = listActions(b, u).filter((a) => a.move && a.move.type === 'aerial');
  assert.ok(aerienAvant.length, 'un voltigeur a bien des mouvements aériens');

  u.wear.legs = WEAR_BROKEN;
  assert.equal(wearLevel(u, 'legs'), 2);
  const apres = getStats(b, u);
  assert.ok(apres.agi < avant.agi, 'la jambe coûte de l’agilité');
  assert.ok(moveRange(b, u) < movAvant, 'et de la portée de déplacement');
  const aerienApres = listActions(b, u).filter((a) => a.move && a.move.type === 'aerial');
  assert.ok(aerienApres.every((a) => !a.ok), 'plus un seul mouvement aérien jouable');
  assert.ok(aerienApres.some((a) => /jambe/i.test(a.reason)), 'et la raison le dit');
});

test('une jambe hors service ampute le second souffle', () => {
  // On fait tomber deux fois le MÊME lutteur, une fois valide, une fois la
  // jambe morte, et on compare ce qu'il récupère en se relevant.
  const relever = (jambe) => {
    const b = mk(['jean_sina'], ['gunter']);
    const [u] = b.units;
    u.wear.legs = jambe;
    u.hadTurn = true;
    // Certains gimmicks sauvent la première chute (« Ne renonce jamais ») :
    // on frappe jusqu'à ce qu'il soit vraiment au sol.
    for (let i = 0; i < 6 && !u.down; i++) applyDamage(b, u, u.maxHp + 50, null, { self: true });
    assert.equal(u.down, true, 'il est bien au sol');
    u.downTurns = 1;                      // le tour de compte est déjà passé
    startPhase(b, 'player');              // celui-ci le relève
    assert.equal(u.down, false, 'et il se relève');
    return u.hp;
  };
  const sain = relever(0), casse = relever(100);
  assert.ok(casse < sain, `une jambe morte rend moins de PV au relevé (${casse} contre ${sain})`);
});

// ------------------------------------------------------- le paiement : l'abandon
test('une soumission ne paie que sur un membre déjà travaillé', () => {
  const b = mk(['brian_danielsson'], ['jean_sina']);
  const [u, e] = colle(b);
  e.grit = 1;                                        // le cœur plafonne tout, on l'écarte
  const frais = tapChance(b, u, e, MOVES.anklelock);
  e.wear.legs = 100;
  const use = tapChance(b, u, e, MOVES.anklelock);
  assert.ok(use > frais + 0.3, `la jambe travaillée change tout (${(frais * 100) | 0} % → ${(use * 100) | 0} %)`);

  // Et le membre compte : la même jambe ne sert à rien pour une prise de tête.
  const tete = tapChance(b, u, e, MOVES.sleeper);
  assert.ok(use > tete, 'c’est le membre VISÉ par la prise qui compte, pas l’usure en général');
});

test('le cœur plafonne l’abandon comme il plafonne le tombé', () => {
  const b = mk(['brian_danielsson'], ['jean_sina']);
  const [u, e] = colle(b);
  e.wear.legs = 100;
  e.grit = 7;
  const plein = tapChance(b, u, e, MOVES.anklelock);
  e.grit = 1;
  const vide = tapChance(b, u, e, MOVES.anklelock);
  assert.ok(vide > plein, 'un adversaire sans cœur abandonne beaucoup plus vite');
});

test('il connaît la prise : répéter la même soumission marche de moins en moins', () => {
  const b = mk(['brian_danielsson'], ['jean_sina']);
  const [u, e] = colle(b);
  e.wear.legs = 100; e.grit = 1;
  const suite = [];
  for (let i = 0; i < 5; i++) {
    suite.push(tapChance(b, u, e, MOVES.anklelock));
    e.memory.subs = e.memory.subs || {};
    e.memory.subs.anklelock = subAttempts(e, MOVES.anklelock) + 1;
  }
  for (let i = 1; i < suite.length; i++) assert.ok(suite[i] < suite[i - 1], 'chaque reprise vaut moins');
  assert.ok(suite[4] < suite[0] * 0.6, 'et l’écart est net au bout de cinq');
  // Varier remet le compteur : c'est ce qui pousse à alterner les prises.
  assert.ok(tapChance(b, u, e, MOVES.spinning_toe_hold) > suite[4], 'une autre prise sur la même jambe vaut encore');
});

// --------------------------------------------------------------- la nouveauté
test('la foule paie de moins en moins le même mouvement', () => {
  const b = mk(['jean_sina'], ['gunter']);
  const [u, e] = colle(b);
  const n0 = novelty(u, MOVES.punch);
  for (let i = 0; i < 4; i++) resolveAttack(b, u, e, MOVES.punch);
  const n1 = novelty(u, MOVES.punch);
  assert.equal(n0, 1, 'un mouvement neuf vaut plein pot');
  assert.ok(n1 < 0.7, `le cinquième rapporte beaucoup moins (${n1.toFixed(2)})`);
  assert.equal(novelty(u, MOVES.grapple), 1, 'et ça ne déteint pas sur les autres mouvements');
});

// ----------------------------------------------------------- rentrer dans le ring
test('un lutteur au plancher peut toujours rentrer dans le ring', () => {
  const b = mk(['gunter'], ['ronan_rains']);
  const [u] = b.units;
  u.x = 4; u.y = 7;                                   // plancher, contre le tablier
  u.outsideCount = 4;
  u.wear.legs = 100;                                  // et une jambe morte, le pire cas
  const a = listActions(b, u).find((x) => x.id === 'rollin');
  assert.ok(a && a.ok, 'l’action existe même avec la portée de déplacement au minimum');
  executeAction(b, u, 'rollin');
  assert.equal(u.outsideCount, 0, 'le décompte repart de zéro');
  assert.ok(u.x >= 6, 'et il est physiquement revenu dans le ring');
});

// ------------------------------------------------------------------ managers
test('le manager n’intervient pas au coup d’envoi', () => {
  const b = mk(['jean_sina'], ['gunter'], 42, { managers: { player: 'bobby_cerveau' } });
  const [u] = colle(b);
  assert.equal(b.turn, 1);
  assert.ok(!listActions(b, u).some((a) => a.id === 'manager'), 'rien avant le tour ' + MANAGER_FIRST_TURN);
  b.turn = MANAGER_FIRST_TURN;
  assert.ok(listActions(b, u).some((a) => a.id === 'manager'), 'disponible à partir du tour ' + MANAGER_FIRST_TURN);
});

test('deux interventions par match, et elles font ce qu’elles annoncent', () => {
  const b = mk(['jean_sina'], ['gunter'], 42, { managers: { player: 'bobby_cerveau' } });
  const [u] = colle(b);
  b.turn = MANAGER_FIRST_TURN;
  assert.equal(b.managers.player.left, MANAGERS.bobby_cerveau.uses);
  executeAction(b, u, 'manager');
  assert.equal(b.managers.player.left, MANAGERS.bobby_cerveau.uses - 1, 'une cartouche de moins');
  assert.ok(b.refDistracted > 0, 'l’arbitre ne regarde plus');
  u.acted = false;
  executeAction(b, u, 'manager');
  u.acted = false;
  assert.equal(b.managers.player.left, 0);
  assert.ok(!listActions(b, u).some((a) => a.id === 'manager'), 'épuisé, l’action disparaît');
});

test('le mégaphone frappe, étourdit et use la tête', () => {
  const b = mk(['jean_sina'], ['gunter'], 42, { managers: { player: 'jimmy_lacravate' } });
  const [u, e] = colle(b);
  b.turn = MANAGER_FIRST_TURN;
  b.refDistracted = 5;                                // on isole l'effet du risque de DQ
  e.x = u.x; e.y = u.y; e.x = u.x + 1;
  // la cible doit être au bord du ring : on la pose sur les cordes
  for (let y = 0; y < b.grid.h; y++) for (let x = 0; x < b.grid.w; x++) {
    if (tileAt(b.grid, x, y) === 'rope') { e.x = x; e.y = y; }
  }
  const hp0 = e.hp, tete0 = wearOf(e, 'head');
  const a = listActions(b, u).find((x) => x.id === 'manager');
  assert.ok(a && a.ok, 'une cible au bord du ring suffit');
  executeAction(b, u, 'manager', { unit: e });
  assert.ok(e.hp < hp0, 'ça fait mal');
  assert.ok(wearOf(e, 'head') > tete0, 'et ça marque la tête');
  assert.ok(e.statuses.dazed > 0, 'et ça étourdit');
});

// ----------------------------------------------------------------- rivalités
test('une rivalité se construit d’un match à l’autre', () => {
  const db = {};
  const a = 'jean_sina', c = 'gunter';
  const noms = { [a]: 'John Sena', [c]: 'Günter' };

  const r0 = rivalryFor(db, a, c, noms);
  assert.equal(r0.meetings, 0);
  assert.equal(r0.heat, 0, 'une première rencontre commence froide');
  assert.equal(r0.revenge, null);

  recordMatch(db, { a, b: c, winnerId: a, turns: 30, stars: 4, headline: 'Sena l’emporte' });
  const r1 = rivalryFor(db, a, c, noms);
  assert.equal(r1.meetings, 1);
  assert.ok(r1.heat > 0, 'la salle connaît l’histoire');
  assert.equal(r1.revenge, c, 'celui qui a perdu vient chercher sa revanche');
  assert.match(r1.note, /Sena l’emporte/, 'la manchette du dernier match fait partie de l’histoire');

  recordMatch(db, { a, b: c, winnerId: a, turns: 22, stars: 3, headline: 'Encore Sena' });
  const r2 = rivalryFor(db, a, c, noms);
  assert.equal(r2.meetings, 2);
  assert.match(r2.note, /2 à 0|les 2 dernières/, 'la série se lit dans la phrase');
  assert.ok(r2.heat > r1.heat, 'et la chaleur monte avec les rencontres');
  assert.equal(getRivalry(db, c, a).meetings, 2, 'la fiche est symétrique');
  assert.equal(pairKey(a, c), pairKey(c, a));
});

test('la rivalité chauffe la salle et arme celui qui a perdu', () => {
  const riv = { meetings: 3, heat: 21, revenge: 'gunter', note: 'Troisième affrontement.' };
  const froid = mk(['jean_sina'], ['gunter']);
  const chaud = mk(['jean_sina'], ['gunter'], 42, { rivalry: riv });
  assert.ok(chaud.heat > froid.heat, 'la salle part plus haut');
  const vengeur = chaud.units.find((u) => u.id === 'gunter');
  const neutre = froid.units.find((u) => u.id === 'gunter');
  assert.equal(vengeur.flags.grudge, true);
  assert.equal(vengeur.momentum - neutre.momentum, RIVALRY_REVENGE, 'il entre avec du momentum en plus');
});

// ------------------------------------------------------------ l'histoire du match
test('chaque match produit une histoire tirée de ce qui s’est vraiment passé', () => {
  const b = mk(['brian_danielsson'], ['gunter'], 7);
  autoPlay(b, 200);
  assert.ok(b.result, 'le match se conclut');
  assert.ok(b.beats.length > 5, 'des temps forts ont été enregistrés');

  const st = matchStory(b, {});
  assert.equal(st.acts.length, 4, 'quatre actes : contexte, travail, tournant, fin');
  for (const a of st.acts) assert.ok(a.text && a.text.length > 10, `l’acte « ${a.title} » dit quelque chose`);
  assert.ok(st.headline.length > 10, 'et il y a une manchette');
  assert.ok(st.stars >= 1 && st.stars <= 5, 'la note tient dans l’échelle');
  // La fin racontée est bien la fin réelle du match.
  assert.ok(st.acts[3].text.includes(b.result.reason), 'le dernier acte cite la vraie raison');

  // Une chute survenue dans le match doit se retrouver dans les temps forts.
  const chutes = b.beats.filter((x) => x.kind === 'down').length;
  const dites = b.log.filter((l) => /est au sol/.test(l.text)).length;
  assert.equal(chutes, dites, 'aucun temps fort perdu en route');
});

test('la note distingue un vrai match d’une fin en queue de poisson', () => {
  const b = mk(['brian_danielsson'], ['gunter'], 7);
  autoPlay(b, 200);
  const vraie = rateMatch(b);
  b.result = { ...b.result, reason: 'Limite de temps : décision aux points pour votre équipe (40 % de PV restants).' };
  assert.ok(rateMatch(b) < vraie, 'aller au bout du chrono coûte des étoiles');
});
