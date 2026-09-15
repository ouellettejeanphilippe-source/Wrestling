// LE DECK QUI SE CONSTRUIT — EN CARRIÈRE, ET NULLE PART AILLEURS
//
// La main (`src/engine/hand.js`) a réglé la question du tour : on joue ce
// qu'on a, pas le meilleur coup d'une liste de dix-huit. Mais d'un match à
// l'autre, le répertoire d'un lutteur ne bougeait pas d'un pouce : la même
// vingtaine de mouvements à l'épisode 1 et à l'épisode 8. Il n'y avait rien à
// construire entre deux matchs, donc rien à regretter dans un choix.
//
// UNE CARTE PAR ÉPISODE. Après chaque match de campagne, le lutteur qui l'a
// disputé apprend un mouvement, choisi parmi trois — deux s'il a perdu. Le
// deck grossit, et c'est le compromis du genre : un outil de plus dans la
// boîte, mais plus de tours à attendre avant de revoir chacun des autres.
// Les chiffres exacts sont plus bas, au-dessus de `DECK_MAX`.
//
// EN EXHIBITION, RIEN DE TOUT ÇA. Un match d'exhibition ne transmet aucun
// bonus au moteur (`playerBonuses` n'existe qu'en campagne), donc un lutteur
// d'exhibition part toujours avec son répertoire d'origine. C'est voulu : une
// exhibition doit rester lisible et comparable, pas dépendre d'une sauvegarde.
import { MOVES } from '../data/moves.js';
import { WRESTLERS_BY_ID } from '../data/wrestlers.js';
import { movesFor } from '../engine/units.js';
import { isCard } from '../engine/hand.js';
import { createRng } from '../engine/rng.js';

// COMBIEN DE CHOIX. Trois : deux, ce n'est pas un choix, c'est un tirage à
// pile ou face ; quatre, on lit la liste au lieu de décider.
export const OFFRE = 3;

// LE VIVIER. Tout ce qui se pioche — donc ni les fondamentaux, ni les
// provocations, ni les paliers mérités. Un finisher ne se gagne pas au tirage,
// et la signature d'un autre non plus : ce sont les marques d'un personnage.
export const CARD_POOL = Object.keys(MOVES).filter(isCard);

// Ce qu'un lutteur connaît RÉELLEMENT : son répertoire d'origine, plus ce
// qu'il a appris, moins ce qu'il a laissé tomber. Cette soustraction est le
// point important — sans elle, oublier ne libère aucune place et le plafond
// du deck ne veut rien dire. Elle doit dire exactement la même chose que
// `unitMoves` côté moteur, qui construit le répertoire du match.
export function knownMoves(entry) {
  const def = WRESTLERS_BY_ID[entry.id];
  if (!def) return new Set(entry.cards || []);
  const jamais = new Set([def.signature, def.finisher]);
  const sans = new Set((entry.forgotten || []).filter((id) => !jamais.has(id)));
  return new Set([...movesFor(def), ...(entry.cards || [])].filter((id) => !sans.has(id)));
}

// Les trois cartes proposées après un match. Déterministe : la même
// sauvegarde au même épisode propose toujours la même offre, sinon on
// rechargerait la page jusqu'à tomber sur la bonne.
export function cardOffer(state, wrestlerId, tirage = 0) {
  const entry = state.roster.find((r) => r.id === wrestlerId);
  if (!entry) return [];
  const connus = knownMoves(entry);
  const dispo = CARD_POOL.filter((id) => !connus.has(id));
  if (!dispo.length) return [];
  const rng = createRng(state.seed + state.showIndex * 131 + tirage * 17 + wrestlerId.length);
  return rng.shuffle(dispo).slice(0, OFFRE);
}

// LE DECK N'EST PAS SANS FOND. Au-delà de cette taille, apprendre un
// mouvement OBLIGE à en oublier un autre : c'est là que le choix commence à
// coûter quelque chose. En dessous, on ajoute et c'est tout.
//
// Vingt-deux, mesuré : un lutteur commence la saison avec 13 à 19 cartes
// piochables (médiane 17) et la saison compte huit épisodes. Le plafond tombe
// donc vers le cinquième — les trois premières cartes sont un cadeau, les
// dernières sont un arbitrage. C'est le bon endroit pour le mettre : assez
// tard pour qu'on ait eu le temps de s'attacher à un deck, assez tôt pour
// qu'il faille le trancher avant le PPV.
//
// CE QUE COÛTE UNE CARTE DE PLUS, mesuré sur 400 matchs simulés — le nombre
// de tours avant de repiocher une carte précise, avec une main de quatre :
//
//   deck 12 → 7,7 tours    deck 18 → 13,0 tours    deck 26 → 17,6 tours
//   deck 14 → 9,4 tours    deck 22 → 15,7 tours
//
// C'est ça, l'arbitrage : un outil de plus contre quelques tours d'attente sur
// tous les autres. Ce n'est PAS « un gros deck joue moins varié » — mesuré sur
// soixante matchs, un deck de 22 sort même plus de coups différents qu'un deck
// de 18 (10,0 contre 8,8). Ce qu'on perd, c'est de pouvoir compter sur une
// carte au moment où on en a besoin.
export const DECK_MAX = 22;

// ET UN PLANCHER. On peut tailler son deck dans le hub, et c'est une vraie
// stratégie — moins de cartes, chacune revient plus vite. Mais un deck vide
// rendrait la main inutile : il ne resterait que les fondamentaux, c'est-à-dire
// le menu d'avant. Huit cartes, c'est deux mains pleines.
export const DECK_MIN = 8;

// Combien de cartes se piochent réellement pour ce lutteur (son deck de
// match), pour que l'écran puisse dire « 18 / 22 ».
export function deckSize(entry) {
  return [...knownMoves(entry)].filter(isCard).length;
}

// Apprendre une carte. `oublie` est l'identifiant du mouvement qu'on laisse
// tomber quand le deck est plein — il doit appartenir au vivier piochable
// (on n'oublie pas un coup de poing, ni son propre finisher).
export function learnCard(state, wrestlerId, moveId, oublie = null) {
  const entry = state.roster.find((r) => r.id === wrestlerId);
  if (!entry) return { ok: false, reason: 'Lutteur absent du roster' };
  if (!MOVES[moveId] || !isCard(moveId)) return { ok: false, reason: 'Ce mouvement ne s’apprend pas' };
  entry.cards = entry.cards || [];
  entry.forgotten = entry.forgotten || [];
  if (knownMoves(entry).has(moveId)) return { ok: false, reason: 'Déjà au répertoire' };
  if (deckSize(entry) >= DECK_MAX) {
    if (!oublie) return { ok: false, reason: 'Deck plein : il faut oublier un mouvement', mustForget: true };
    if (!isCard(oublie) || !knownMoves(entry).has(oublie)) return { ok: false, reason: 'Ce mouvement ne s’oublie pas' };
    forgetCard(entry, oublie);
  }
  entry.cards.push(moveId);
  return { ok: true, move: MOVES[moveId] };
}

// Oublier : soit on retire une carte apprise, soit on met un mouvement
// d'origine sur la liste noire. Les deux reviennent au même à l'usage, mais
// il faut les distinguer — on ne peut pas retirer de `cards` ce qui n'y a
// jamais été.
export function forgetCard(entry, moveId, plancher = false) {
  entry.cards = entry.cards || [];
  entry.forgotten = entry.forgotten || [];
  if (plancher && deckSize(entry) <= DECK_MIN) return { ok: false, reason: `Un deck ne descend pas sous ${DECK_MIN} cartes` };
  if (!knownMoves(entry).has(moveId) || !isCard(moveId)) return { ok: false, reason: 'Ce mouvement ne s’oublie pas' };
  const i = entry.cards.indexOf(moveId);
  if (i >= 0) entry.cards.splice(i, 1);
  else if (!entry.forgotten.includes(moveId)) entry.forgotten.push(moveId);
  return { ok: true };
}

// Ce que le moteur reçoit : les mouvements en plus, et ceux à retirer. Une
// sauvegarde d'avant les decks n'a ni l'un ni l'autre, et marche telle quelle.
export const deckBonus = (entry) => ({ moves: entry.cards || [], without: entry.forgotten || [] });
