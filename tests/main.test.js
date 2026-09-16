// LA MAIN
//
// On ne choisit plus le meilleur coup parmi dix-huit, on joue ce qu'on a
// pioché. Ces tests verrouillent les trois choses sans lesquelles le système
// se retourne contre le jeu : les fondamentaux toujours disponibles (une
// mauvaise main ne doit jamais être une impasse), ce qu'on garde d'un tour à
// l'autre (sinon on ne peut poursuivre aucun plan), et la soupape.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, autoPlay, listActions, executeAction, startPhase } from '../src/engine/battle.js';
import { planUnit } from '../src/engine/ai.js';
import { isCard, availableMoves, buildDeck, deckState, COPIES, copiesOf, HAND_SIZE } from '../src/engine/hand.js';
import { WRESTLERS_BY_ID as W } from '../src/data/wrestlers.js';
import { MOVES } from '../src/data/moves.js';

const mk = (players, enemies, seed = 42) => createBattle({
  match: { id: 't', title: 'T', type: 'singles', enemies }, playerTeam: players.map((id) => W[id]), seed,
});
const colle = (b) => { const [u, e] = b.units; u.x = e.x - 1; u.y = e.y; return [u, e]; };

test('TOUT est une carte — les fondamentaux aussi, en plusieurs exemplaires', () => {
  // Ils étaient hors du talon, toujours disponibles : la moitié des tours se
  // jouait donc en dehors du système de cartes. La contrepartie obligatoire,
  // c'est les copies multiples — on ne tire pas « le » coup de poing.
  for (const id of ['punch', 'grapple', 'whip', 'taunt']) {
    assert.equal(isCard(id), true, `${id} est une carte comme les autres`);
  }
  // LES COUPS de base existent en double : ce sont eux qui entrent au corps à
  // corps tout seuls, et sans eux « tout est carte » devient bloquant.
  for (const id of ['punch', 'grapple', 'whip']) {
    assert.ok(copiesOf(id) >= 2, `${id} doit exister en plusieurs exemplaires`);
  }
  // LA PROVOCATION, non : elle ne fait aucun dégât. À deux exemplaires, les
  // matchs perdaient une chute chacun (3,00 → 2,68 sur soixante matchs) parce
  // qu'un tour sur treize ne servait à rien.
  assert.equal(copiesOf('taunt'), 1, 'une seule provocation : elle ne blesse personne');
  assert.equal(copiesOf('moonsault'), 1, 'une carte de spécialité reste unique');
  // La signature et le finisher non plus : ils se méritent à la jauge.
  assert.equal(isCard('coffin_drop'), false, 'un finisher ne se tire pas au sort');
  assert.equal(isCard('derby_crossbody'), false, 'une signature non plus');
  // Tout le reste est une carte.
  assert.equal(isCard('moonsault'), true);
  assert.equal(isCard('chop_block'), true);
});

test('on démarre avec une main pleine, et le talon contient le reste du répertoire', () => {
  const b = mk(['derby_allin'], ['gunter']);
  const [u] = b.units;
  assert.equal(u.hand.length, HAND_SIZE, 'main pleine au coup d’envoi');
  const d = deckState(u);
  assert.equal(d.main + d.talon + d.defausse, buildDeck(u).length, 'aucune carte perdue en route');
  for (const id of u.hand) assert.ok(isCard(id), `${id} est bien une carte`);
});

test('une main vide n’est jamais une impasse — mais elle ne frappe plus gratuitement', () => {
  // Il n'y a plus de coup de poing hors du talon : le filet, c'est la défausse
  // complète, qui coûte le tour. Une mauvaise main est donc une VRAIE mauvaise
  // main, pas un demi-tour gratuit.
  const b = mk(['derby_allin'], ['gunter']);
  const [u, e] = colle(b);
  // Le pire cas réaliste : quatre cartes dont aucune ne peut partir ici. (Une
  // main VIDE n'existe pas : on repioche au début de chaque tour, et ce qu'on
  // joue va à la défausse, qui remplit le talon quand il s'épuise.)
  u.hand = ['moonsault', 'moonsault', 'moonsault', 'moonsault'];  // exige un coin
  u.momentum = 0;
  const acts = listActions(b, u).filter((a) => a.ok);
  assert.ok(!acts.some((a) => a.id === 'punch'), 'plus de coup de poing gratuit hors du talon');
  assert.ok(acts.some((a) => a.id === 'redraw'), 'la soupape reste : jeter et repiocher');
  assert.ok(acts.some((a) => a.id === 'wait'), 'et passer son tour');
  // Et l'IA ne se bloque pas non plus.
  const plan = planUnit(b, u);
  assert.ok(plan && plan.action && plan.action.id, 'elle trouve toujours quelque chose à faire');
});

test('ce qu’on ne joue pas, on le garde : c’est ce qui permet un plan', () => {
  const b = mk(['jean_sina'], ['gunter']);
  const [u, e] = colle(b);
  // Une carte conditionnelle qu'on ne peut pas jouer tout de suite.
  u.hand = ['bodyslam', 'chop_block', 'snapmare', 'stomp_away'];
  u.momentum = 40;
  executeAction(b, u, 'bodyslam', { unit: e });  // on joue une carte
  assert.ok(!u.hand.includes('bodyslam'), 'la carte jouée part à la défausse');
  assert.ok(u.discard.includes('bodyslam'));
  assert.ok(u.hand.includes('chop_block'), 'le reste de la main est intact — le plan tient');
});

test('on repioche au début de son tour, jusqu’à la taille de main', () => {
  const b = mk(['jean_sina'], ['gunter']);
  const [u] = b.units;
  u.hand = u.hand.slice(0, 1);
  u.hadTurn = true;
  startPhase(b, 'player');
  assert.equal(u.hand.length, HAND_SIZE, 'la main est refaite');
});

test('jeter sa main coûte le tour et fait souffler', () => {
  const b = mk(['jean_sina'], ['gunter']);
  const [u] = colle(b);
  const avant = [...u.hand];
  const a = listActions(b, u).find((x) => x.id === 'redraw');
  assert.ok(a && a.ok, 'la soupape existe toujours');
  u.stamina = 40;
  executeAction(b, u, 'redraw');
  assert.equal(u.hand.length, HAND_SIZE, 'on repioche autant');
  assert.equal(u.rested, true, 'et on reprend son souffle, comme en provoquant');
  assert.equal(u.acted, true, 'mais ça coûte le tour');
  for (const id of avant) assert.ok(u.discard.includes(id) || u.hand.includes(id), 'aucune carte perdue');
});

test('le talon se reconstitue avec la défausse : on ne tombe jamais à court', () => {
  const b = mk(['jean_sina'], ['gunter']);
  const [u] = b.units;
  const total = buildDeck(u).length;
  for (let i = 0; i < 40; i++) {
    u.hand = [];
    startPhase(b, 'player');
    assert.ok(u.hand.length > 0, `tour ${i} : il reste toujours des cartes`);
    u.discard.push(...u.hand);
    u.hand = [];
  }
  assert.ok(total > 0);
});

test('la main change ce que l’IA a sous la main, sans la bloquer', () => {
  // Garde-fou global : avec une main, un match complet doit toujours se
  // conclure, et l'IA doit passer l'essentiel de ses tours à lutter — pas à
  // jeter ses cartes. C'est le piège exact qui s'est produit une fois : la
  // défausse notée dans la boucle principale battait les vraies attaques, et
  // 56 % des tours étaient des défausses pour des matchs de quarante tours et
  // vingt coups.
  let coups = 0, tours = 0, finis = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const b = mk(['brian_danielsson'], ['gunter'], seed);
    autoPlay(b, 200);
    if (b.result) finis++;
    tours += b.turn;
    for (const l of b.log) if (/ dégâts/.test(l.text)) coups++;
  }
  assert.equal(finis, 8, 'tous les matchs se concluent');
  assert.ok(coups / tours > 0.5, `il se passe quelque chose la plupart des tours (${(coups / tours).toFixed(2)} coup/tour)`);
});

test('la variété : la main empêche de matraquer le même mouvement', () => {
  // SUR PLUSIEURS MATCHS, PAS UN SEUL. Avec une graine unique, ce test mesurait
  // surtout le hasard : la médiane du monopole est de 24 %, mais une graine sur
  // dix monte à 55 % — et le test cassait au premier changement qui décalait le
  // tirage, sans que rien n'ait empiré.
  const monopoles = [], vocabulaires = [];
  for (let seed = 1; seed <= 21; seed++) {
    const b = mk(['brian_danielsson'], ['gunter'], seed);
    autoPlay(b, 200);
    const par = new Map();
    let total = 0;
    for (const l of b.log) {
      const m = /→ (.+?) sur /.exec(l.text);
      if (m) { par.set(m[1], (par.get(m[1]) || 0) + 1); total++; }
    }
    if (total < 10) continue;
    monopoles.push(Math.max(...par.values()) / total);
    vocabulaires.push(par.size);
  }
  assert.ok(monopoles.length >= 15, 'la plupart des matchs ont de la matière');
  const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  const pire = median(monopoles);
  assert.ok(pire <= 0.4, `aucun mouvement ne monopolise le match (médiane ${(pire * 100) | 0} %)`);
  assert.ok(median(vocabulaires) >= 10, `et le vocabulaire est large (médiane ${median(vocabulaires)} mouvements)`);
});
