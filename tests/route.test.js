import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRoute, openNodes, nodeAt, isFight, rankStep, rankLoss, eliteMatch, ELITE_BOOST, SEMAINES, SEMAINE_TITRE, NODE_TYPES } from '../src/game/route.js';
import { newGame, weekNodes, takeNode, ensureRoute, applyResult, buildMatch, playerBonuses, TITLE_MATCH_ID } from '../src/game/state.js';
import { rankOf, RANK_START } from '../src/game/rank.js';
import { restOptions, restGate, restTrain, restTrim, trimmable, eventFor, applyEvent, shopStock, buyCard, buyAds, buyAgent, EVENTS, SHOP_PRICES, SHOP_FANS, GATE_MONEY } from '../src/game/week.js';
import { deckSize, knownMoves } from '../src/game/deck.js';
import { createBattle } from '../src/engine/battle.js';
import { SEASON } from '../src/data/campaign.js';
import { WRESTLERS_BY_ID as W, STARTER_CHOICES } from '../src/data/wrestlers.js';

const partie = (mode = 'kayfabe') => newGame({ promoName: 'T', mode, starters: STARTER_CHOICES.slice(0, 3) });

test('la carte a huit semaines, finit sur le titre, et commence par un match', () => {
  for (const seed of [1, 2, 3, 99, 12345]) {
    const r = buildRoute(seed);
    assert.equal(r.rows.length, SEMAINES);
    assert.equal(r.rows[0].length, 1, 'on commence par lutter, pas par faire ses courses');
    assert.equal(r.rows[0][0].type, 'match');
    const dernier = r.rows[SEMAINE_TITRE];
    assert.equal(dernier.length, 1, 'le dernier soir n’offre pas de choix');
    assert.equal(dernier[0].type, 'boss');
    assert.equal(dernier[0].match.id, TITLE_MATCH_ID);
  }
});

test('chaque semaine propose toujours au moins un match', () => {
  // Sans ça, une carte peut offrir une semaine où l'on ne peut pas se battre —
  // et le classement, qui est tout l'enjeu, devient hors de portée.
  for (let seed = 1; seed <= 120; seed++) {
    for (const row of buildRoute(seed).rows) {
      assert.ok(row.some((n) => isFight(n.type)), `graine ${seed}, semaine ${row[0].row} : aucun match`);
      assert.ok(row.length >= 1 && row.length <= 3, 'deux ou trois nœuds par semaine');
    }
  }
});

test('aucun nœud n’est orphelin : tout chemin mène à la ceinture', () => {
  for (let seed = 1; seed <= 120; seed++) {
    const r = buildRoute(seed);
    // Accessibilité descendante depuis la première ligne.
    let atteints = new Set([0]);
    for (let s = 0; s < r.rows.length - 1; s++) {
      const suivant = new Set();
      for (const col of atteints) for (const c of nodeAt(r, s, col).next) suivant.add(c);
      assert.ok(suivant.size, `graine ${seed} : cul-de-sac à la semaine ${s}`);
      // Et personne d'inaccessible sur la ligne suivante.
      for (let c = 0; c < r.rows[s + 1].length; c++) {
        assert.ok(r.rows[s].some((n) => n.next.includes(c)), `graine ${seed} : nœud ${s + 1}:${c} inaccessible`);
      }
      atteints = suivant;
    }
    assert.ok(atteints.has(0), 'le dernier nœud est le titre, et il est atteignable');
  }
});

test('chaque nœud de combat porte un vrai match, et la difficulté suit la semaine', () => {
  const normal = [], elite = [];
  for (const show of SEASON.shows) { if (show.title_match) continue; show.matches.forEach((m, i) => (i === 0 ? normal : elite).push(m.id)); }
  let pire = 0;
  for (let seed = 1; seed <= 120; seed++) {
    for (const row of buildRoute(seed).rows) for (const n of row) {
      if (!isFight(n.type)) { assert.equal(n.match, undefined); continue; }
      assert.ok(n.match && n.match.id && n.match.type, `nœud ${n.id} sans match`);
      if (n.type === 'boss') continue;
      const vivier = n.type === 'match' ? normal : elite;
      assert.ok(vivier.includes(n.match.id), `${n.type} doit piocher dans son vivier`);
      pire = Math.max(pire, Math.abs(vivier.indexOf(n.match.id) - n.row));
    }
  }
  // La fenêtre vaut 1 les trois premières semaines, 2 ensuite : jamais plus.
  assert.ok(pire <= 2, `la difficulté doit suivre la semaine (écart max vu : ${pire})`);
});

test('deux carrières ne suivent pas la même route', () => {
  const vues = new Set();
  for (let seed = 1; seed <= 100; seed++) {
    vues.add(buildRoute(seed).rows.map((r) => r.map((n) => n.type[0] + (n.match ? n.match.id : '')).join(',')).join('|'));
  }
  assert.ok(vues.size >= 95, `100 graines doivent donner ~100 cartes (obtenu : ${vues.size})`);
  // Et la même graine donne toujours la même carte : sinon recharger la page
  // rebattrait la route.
  assert.deepEqual(buildRoute(7), buildRoute(7));
});

test('on ne peut aller que là où mène le nœud d’où l’on vient', () => {
  const st = partie();
  st.route = buildRoute(7); st.path = [];
  assert.deepEqual(openNodes(st.route, st.path), [0], 'la première semaine n’a qu’une porte');
  const premier = weekNodes(st)[0];
  takeNode(st, premier);
  assert.equal(st.path.length, 1);
  assert.equal(st.showIndex, 1, 'la semaine suit la longueur du chemin');
  const ouverts = weekNodes(st).map((n) => n.col);
  assert.deepEqual(ouverts, premier.next, 'exactement les nœuds vers lesquels il pointait');
  assert.ok(ouverts.length >= 1);
});

test('un main event vaut deux places au classement, un match une seule', () => {
  for (const [type, pas] of [['match', 1], ['elite', 2]]) {
    assert.equal(rankStep(type), pas);
    const st = partie();
    const m = SEASON.shows[0].matches[0];
    const b = createBattle({ match: buildMatch(st, m), playerTeam: [W[st.roster[0].id]], playerBonuses: playerBonuses(st), seed: 3 });
    b.result = { winner: 'player', reason: 'Tombé.', turns: 20 };
    const sum = applyResult(st, b, m, [st.roster[0].id], { row: 0, col: 0, type });
    assert.equal(sum.rankStep, pas);
    assert.equal(rankOf(st), RANK_START - pas, `${type} : ${pas} place(s)`);
  }
});

test('une semaine sans match ne touche pas au classement mais avance la carrière', () => {
  const st = partie();
  const avant = rankOf(st);
  const argent = st.money;
  takeNode(st, { row: 0, col: 0, type: 'rest' });
  assert.equal(rankOf(st), avant, 'pas de match, pas de classement');
  assert.equal(st.path.length, 1, 'mais la semaine est passée');
  const res = restGate(st);
  assert.ok(res.ok);
  assert.equal(st.money, argent + GATE_MONEY, 'le house show paie');
});

test('la semaine off : une séance offerte, ou un deck resserré', () => {
  const st = partie();
  const r = st.roster[0];
  const options = restOptions(st);
  assert.deepEqual(options.map((o) => o.key), ['train', 'trim', 'gate']);
  assert.ok(options.every((o) => o.name && o.desc));

  const avant = r.bonus.str, sous = r.trainings, sousArgent = st.money;
  assert.ok(restTrain(st, r.id, 'str').ok);
  assert.equal(r.bonus.str, avant + 1);
  assert.equal(r.trainings, sous + 1);
  assert.equal(st.money, sousArgent, 'offerte veut dire gratuite');

  const taille = deckSize(r);
  const carte = trimmable(r)[0];
  assert.ok(restTrim(st, r.id, carte).ok);
  assert.equal(deckSize(r), taille - 1);
  assert.ok(!knownMoves(r).has(carte));
});

test('chaque angle de coulisses a deux portes, et aucune n’est gratuite', () => {
  assert.ok(EVENTS.length >= 4, 'il en faut assez pour ne pas tourner en rond');
  for (const ev of EVENTS) {
    assert.ok(ev.icon && ev.title && ev.text, `${ev.id} doit se raconter`);
    assert.equal(ev.choices.length, 2, `${ev.id} : deux portes`);
    for (const c of ev.choices) assert.ok(c.label && c.hint && typeof c.apply === 'function');
  }
  const st = partie();
  const node = { row: 2, col: 1 };
  // Déterministe : le même nœud propose toujours le même angle.
  assert.equal(eventFor(st, node).id, eventFor(st, node).id);
  for (let i = 0; i < 2; i++) {
    const frais = partie();
    const res = applyEvent(frais, node, i);
    assert.ok(res.ok && res.message, 'un angle doit répondre quelque chose');
    assert.ok(frais.fans >= 0 && frais.money >= 0, 'et ne jamais laisser de valeurs négatives');
  }
});

test('le bureau du booker vend, et refuse quand on n’a pas l’argent', () => {
  const st = partie();
  const node = { row: 3, col: 0 };
  const stock = shopStock(st, node);
  assert.ok(stock.lutteur && st.roster.some((r) => r.id === stock.lutteur));
  assert.ok(stock.cartes.length >= 1, 'il doit y avoir quelque chose à vendre');
  assert.equal(shopStock(st, node).lutteur, stock.lutteur, 'le stock est déterministe');

  st.money = 0;
  assert.equal(buyCard(st, stock.lutteur, stock.cartes[0]).ok, false);
  assert.equal(buyAds(st).ok, false);

  st.money = 5000;
  const fans = st.fans;
  assert.ok(buyAds(st).ok);
  assert.equal(st.fans, fans + SHOP_FANS);
  assert.equal(st.money, 5000 - SHOP_PRICES.fans);

  const avant = deckSize(st.roster.find((r) => r.id === stock.lutteur));
  assert.ok(buyCard(st, stock.lutteur, stock.cartes[0]).ok);
  assert.equal(deckSize(st.roster.find((r) => r.id === stock.lutteur)), avant + 1);

  if (stock.agent) {
    const n = st.roster.length;
    assert.ok(buyAgent(st, stock.agent, stock.agentPrix).ok);
    assert.equal(st.roster.length, n + 1);
    assert.equal(buyAgent(st, stock.agent, stock.agentPrix).ok, false, 'pas deux fois le même');
  }
});

test('une sauvegarde d’avant la carte s’en voit fabriquer une', () => {
  const st = partie();
  delete st.route; delete st.path;
  assert.doesNotThrow(() => ensureRoute(st));
  assert.ok(st.route && st.route.rows.length === SEMAINES);
  assert.deepEqual(st.path, []);
  assert.ok(weekNodes(st).length >= 1);
});

test('tous les types de nœud se décrivent', () => {
  for (const [key, t] of Object.entries(NODE_TYPES)) {
    assert.equal(t.key, key);
    assert.ok(t.icon && t.name && t.desc, `${key} doit se décrire à l’écran`);
  }
});

test('un main event est vraiment plus dur, et vaut vraiment plus', () => {
  // Mesuré avant ce bonus : 65 % de victoires sur les nœuds élite contre 67 %
  // sur les nœuds match. Deux places offertes sans risque, ce n'est pas une
  // décision.
  for (let seed = 1; seed <= 60; seed++) {
    for (const row of buildRoute(seed).rows) for (const n of row) {
      if (n.type !== 'elite') continue;
      for (const e of n.match.enemies) {
        assert.ok(typeof e === 'object' && e.boost, 'un adversaire de main event arrive gonflé');
        assert.ok(e.boost.hp >= ELITE_BOOST.hp && e.boost.stats >= ELITE_BOOST.stats, 'et du bon montant');
      }
    }
  }
  // Le bonus s'ajoute à celui déjà écrit, il ne l'écrase pas.
  const cumul = eliteMatch({ enemies: [{ id: 'gunter', boost: { hp: 20, stats: 1 } }] });
  assert.equal(cumul.enemies[0].boost.hp, 20 + ELITE_BOOST.hp);
  assert.equal(cumul.enemies[0].boost.stats, 1 + ELITE_BOOST.stats);

  // L'ASYMÉTRIE. À coût symétrique et 44 % de victoires, l'espérance du main
  // event était PIRE que celle d'un match de carte : le nœud risqué était
  // toujours le mauvais choix.
  assert.equal(rankStep('elite'), 2);
  assert.equal(rankStep('match'), 1);
  assert.equal(rankLoss('elite'), 1, 'perdre un main event serré n’enterre pas une carrière');
  assert.equal(rankLoss('match'), 1);
});

test('la carte offre un vrai choix la plupart des semaines', () => {
  // Mesuré avant : une semaine sur trois seulement. Une carte où l'on ne
  // choisit qu'une fois sur trois est un couloir avec des embranchements
  // décoratifs.
  let choix = 0, total = 0, sansCombat = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const r = buildRoute(seed);
    let ouverts = [0];
    for (let s = 0; s < SEMAINE_TITRE; s++) {
      total++;
      if (ouverts.length > 1) choix++;
      if (ouverts.map((c) => r.rows[s][c]).some((n) => !isFight(n.type))) sansCombat++;
      ouverts = r.rows[s][ouverts[0]].next;
    }
  }
  assert.ok(choix / total > 0.6, `il faut un vrai choix la plupart des semaines (obtenu : ${Math.round((choix / total) * 100)} %)`);
  assert.ok(sansCombat / total > 0.35, `et souvent une option sans match (obtenu : ${Math.round((sansCombat / total) * 100)} %)`);
});
