import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle } from '../src/engine/battle.js';
import { newGame, playerBonuses, buildMatch, applyResult, exhibitionMatch } from '../src/game/state.js';
import { cardOffer, learnCard, knownMoves, deckSize, oubliable, CARD_POOL, DECK_MAX, DECK_MIN, OFFRE } from '../src/game/deck.js';
import { WRESTLERS_BY_ID } from '../src/data/wrestlers.js';
import { movesFor, unitMoves } from '../src/engine/units.js';
import { isCard, buildDeck } from '../src/engine/hand.js';
import { MOVES } from '../src/data/moves.js';
import { SEASON } from '../src/data/campaign.js';

const partie = () => newGame({ promoName: 'T', mode: 'kayfabe', starters: ['jean_sina', 'derby_allin', 'brian_danielsson'] });

test('le vivier de cartes ne contient que du piochable', () => {
  assert.ok(CARD_POOL.length > 30, 'il faut de quoi construire un deck');
  for (const id of CARD_POOL) {
    assert.ok(MOVES[id], `${id} doit exister`);
    assert.ok(isCard(id), `${id} ne se pioche pas : il n’a rien à faire dans le vivier`);
    // Ni fondamental, ni palier mérité : on ne gagne pas le finisher d'un autre.
    assert.ok(!['signature', 'finisher'].includes(MOVES[id].tier), `${id} est un palier mérité`);
  }
});

test('l’offre propose des mouvements que le lutteur ne connaît pas', () => {
  const st = partie();
  const offre = cardOffer(st, 'jean_sina');
  assert.equal(offre.length, OFFRE);
  assert.equal(new Set(offre).size, OFFRE, 'pas deux fois la même carte');
  const connus = new Set(movesFor(WRESTLERS_BY_ID.jean_sina));
  for (const id of offre) assert.ok(!connus.has(id), `${id} est déjà au répertoire`);
  // Déterministe : recharger la page ne redistribue pas l'offre.
  assert.deepEqual(cardOffer(st, 'jean_sina'), offre);
  // Et elle diffère d'un lutteur à l'autre.
  assert.notDeepEqual(cardOffer(st, 'derby_allin'), offre);
});

test('apprendre une carte l’ajoute au répertoire de match, et à lui seul', () => {
  const st = partie();
  const id = cardOffer(st, 'jean_sina')[0];
  assert.ok(learnCard(st, 'jean_sina', id).ok);
  assert.ok(knownMoves(st.roster[0]).has(id));
  // Une carrière n'a qu'un lutteur : la carte va dans SON deck, et le deck
  // n'existe nulle part ailleurs.
  assert.equal(st.roster.length, 1);
  assert.deepEqual(st.roster[0].cards, [id]);
  // On ne l'apprend pas deux fois, et on n'apprend pas n'importe quoi.
  assert.ok(!learnCard(st, 'jean_sina', id).ok, 'déjà au répertoire');
  assert.ok(!learnCard(st, 'jean_sina', 'punch').ok, 'un fondamental ne s’apprend pas');
  assert.ok(!learnCard(st, 'jean_sina', WRESTLERS_BY_ID.derby_allin.finisher).ok, 'un finisher ne s’apprend pas');
  assert.ok(!learnCard(st, 'inconnu', id).ok, 'lutteur absent du roster');
});

test('le deck a un plafond : au-delà, apprendre oblige à oublier', () => {
  const st = partie();
  const e = st.roster[0];
  let garde = 0;
  while (deckSize(e) < DECK_MAX && garde++ < 40) {
    const [c] = cardOffer(st, 'jean_sina', garde);
    if (!c) break;
    assert.ok(learnCard(st, 'jean_sina', c).ok);
  }
  assert.equal(deckSize(e), DECK_MAX, 'on doit pouvoir atteindre le plafond');
  const suivante = cardOffer(st, 'jean_sina', 99)[0];
  const refus = learnCard(st, 'jean_sina', suivante);
  assert.equal(refus.ok, false);
  assert.equal(refus.mustForget, true, 'le refus doit dire pourquoi');
  // Avec un sacrifice, ça passe — et la taille ne bouge pas. Le sacrifié doit
  // être une carte à exemplaire unique : on n'oublie pas un fondamental, qui
  // vaut trois cartes dans le talon.
  const sacrifie = [...knownMoves(e)].filter(oubliable)[0];
  assert.ok(learnCard(st, 'jean_sina', suivante, sacrifie).ok);
  assert.equal(deckSize(e), DECK_MAX, 'une carte apprise, une carte perdue');
  assert.ok(!knownMoves(e).has(sacrifie), 'le mouvement sacrifié a bien disparu');
});

test('on n’oublie jamais sa signature ni son finisher', () => {
  const def = WRESTLERS_BY_ID.jean_sina;
  const moves = unitMoves(def, { without: [def.signature, def.finisher, 'chinlock'] });
  assert.ok(moves.includes(def.signature), 'la signature est la marque du personnage');
  assert.ok(moves.includes(def.finisher), 'le finisher aussi');
  assert.ok(!moves.includes('chinlock') || !movesFor(def).includes('chinlock'), 'le reste s’oublie');
});

test('le deck arrive jusque dans la main, en carrière — et jamais en exhibition', () => {
  const st = partie();
  const carte = cardOffer(st, 'jean_sina')[0];
  learnCard(st, 'jean_sina', carte);
  const m = SEASON.shows[0].matches[0];
  const carriere = createBattle({ match: buildMatch(st, m), playerTeam: [WRESTLERS_BY_ID.jean_sina], playerBonuses: playerBonuses(st), seed: 5 });
  const u = carriere.units.find((x) => x.team === 'player');
  assert.ok(u.moves.includes(carte), 'la carte apprise doit être au répertoire du match');
  assert.ok(buildDeck(u).includes(carte), 'et donc dans le talon');

  // L'EXHIBITION NE LIT PAS LA SAUVEGARDE. C'est la garantie demandée : un
  // match d'exhibition se joue avec le répertoire de fiche, point.
  const exhib = createBattle({ match: exhibitionMatch('singles', ['jean_sina'], ['gunter']), playerTeam: [WRESTLERS_BY_ID.jean_sina], seed: 5 });
  const e = exhib.units.find((x) => x.team === 'player');
  assert.ok(!e.moves.includes(carte), 'l’exhibition ignore le deck de carrière');
  assert.deepEqual(e.moves, movesFor(WRESTLERS_BY_ID.jean_sina), 'exactement le répertoire d’origine');
});

test('un match de campagne propose des cartes, une exhibition non', () => {
  const st = partie();
  const m = SEASON.shows[0].matches[0];
  const b = createBattle({ match: buildMatch(st, m), playerTeam: [WRESTLERS_BY_ID.jean_sina], playerBonuses: playerBonuses(st), seed: 11 });
  b.result = { winner: 'player', reason: 'Tombé.', turns: 20 };
  const s = applyResult(st, b, m, ['jean_sina']);
  assert.equal(s.cards.length, 1, 'un lutteur en lice, une offre');
  assert.equal(s.cards[0].id, 'jean_sina');
  assert.equal(s.cards[0].offer.length, OFFRE, 'trois cartes quand on gagne');
  assert.equal(s.cards[0].max, DECK_MAX);

  // Perdre apprend aussi, mais moins bien.
  const st2 = partie();
  const m2 = SEASON.shows[0].matches[0];
  const b2 = createBattle({ match: buildMatch(st2, m2), playerTeam: [WRESTLERS_BY_ID.jean_sina], playerBonuses: playerBonuses(st2), seed: 12 });
  b2.result = { winner: 'enemy', reason: 'Tombé.', turns: 20 };
  assert.equal(applyResult(st2, b2, m2, ['jean_sina']).cards[0].offer.length, OFFRE - 1);
});

test('une sauvegarde d’avant les decks continue de marcher', () => {
  const st = partie();
  // Une vieille entrée n'a ni `cards` ni `forgotten`.
  for (const r of st.roster) { delete r.cards; delete r.forgotten; }
  assert.doesNotThrow(() => playerBonuses(st));
  assert.doesNotThrow(() => deckSize(st.roster[0]));
  assert.ok(cardOffer(st, 'jean_sina').length, 'l’offre marche quand même');
  assert.ok(learnCard(st, 'jean_sina', cardOffer(st, 'jean_sina')[0]).ok, 'et on peut apprendre');
});

test('un deck ne se vide pas : il y a un plancher', async () => {
  const { forgetCard } = await import('../src/game/deck.js');
  const st = partie();
  const e = st.roster[0];
  let garde = 0;
  while (deckSize(e) > DECK_MIN && garde++ < 40) {
    const [carte] = [...knownMoves(e)].filter(oubliable);
    if (!carte) break;
    assert.ok(forgetCard(e, carte, true).ok, 'tailler son deck est une stratégie valable');
  }
  assert.ok(deckSize(e) <= DECK_MIN + 1, `on descend jusqu’au plancher (obtenu ${deckSize(e)})`);
  const derniere = [...knownMoves(e)].filter(oubliable)[0];
  const refus = forgetCard(e, derniere, true);
  assert.equal(refus.ok, false, 'sous le plancher, la main n’aurait plus rien à piocher');
  assert.match(refus.reason, new RegExp(String(DECK_MIN)));
  // UN FONDAMENTAL NE S'OUBLIE PAS. Il vaut plusieurs cartes dans le talon, et
  // c'est la seule chose qui entre au corps à corps toute seule.
  assert.equal(forgetCard(e, 'punch').ok, false, 'on ne désapprend pas le coup de poing');
  assert.equal(oubliable('punch'), false);
  assert.equal(oubliable('moonsault'), true);
  // Le plancher ne s'applique qu'au hub : l'échange « une carte apprise contre
  // une oubliée » passe toujours, il ne change pas la taille.
  assert.ok(forgetCard(e, derniere).ok, 'sans le garde-fou, l’échange reste possible');
});
