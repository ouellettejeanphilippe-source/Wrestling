// LA MAIN ET L'ÉNERGIE — le tour d'un jeu de deck
//
// Première version : une main de cinq qu'on GARDAIT d'un tour à l'autre, une
// seule carte jouée par tour. L'idée était de pouvoir tenir un plan (garder
// son Lariat lancé en cherchant ses quatre cases de course). Mesuré sur
// soixante matchs : quarante tours en médiane, trois cartes sur cinq
// jouables, souvent une seule au premier tour — les autres grises, bloquées
// par le momentum ou une condition. Un tour, c'était six clics pour une
// ligne de journal. Le plan ne se jouait pas, il s'attendait.
//
// Le tour d'un deck-builder règle ça, et c'est la réponse classique du genre
// (Slay the Spire, Chroma Squad pour la grille) :
//
//   · chaque tour, on DÉFAUSSE sa main et on en pioche une neuve de cinq ;
//   · chaque lutteur dispose de 3 points d'ÉNERGIE par tour ;
//   · chaque carte coûte de l'énergie — un coup de poing 1, un finisher 3 —
//     et on en joue autant que l'énergie le permet, dans l'ordre qu'on veut.
//
// LE TOUR EST LE PLAN. Se déplacer, poser un coup qui étourdit, enchaîner
// avec la prise qui demande une cible étourdie : ça tient dans un seul tour,
// donc ça se joue. On n'a plus besoin de garder une carte trois tours — on
// revoit tout son deck tous les cinq tours.
//
// Ce qui ne bouge pas : la signature et le finisher ne se piochent pas (le
// momentum les ouvre), et la défausse reconstitue le talon.
import { MOVES } from '../data/moves.js';

export const HAND_SIZE = 5;
export const ENERGY_PER_TURN = 3;

// Ce que coûte une carte, par palier. Un fondamental vaut un point, un
// finisher vaut le tour entier : on ne lance pas un finisher ET deux coups.
export const ENERGY_BY_TIER = { base: 1, class: 1, specialty: 2, signature: 2, finisher: 3 };
// Les actions qui ne sont pas des cartes.
// Grimper vaut deux points : un échelon par tour au plus, mais il reste de
// quoi porter un coup avant de monter — c'est ce qui rend l'échelle jouable
// face à un adversaire qui, lui, a trois cartes pour vous en faire tomber.
export const ENERGY_BY_TYPE = { pin: 1, toss: 1, weapon: 1, tag: 1, scavenge: 1, pickup: 0, sell: 1, climb: 2 };
// Celles qui FERMENT le tour, quoi qu'il reste d'énergie : souffler, jeter sa
// main, grimper, rentrer, appeler son manager, faire le job, et se mettre en
// double équipe. Ce sont des postures, pas des coups.
export const ENDS_TURN = new Set(['wait', 'redraw', 'rollin', 'manager', 'job', 'teamwork']);

export function energyCost(a) {
  if (!a) return 0;
  if (ENDS_TURN.has(a.type)) return 'all';
  if (a.move && a.move.tier) return a.move.type === 'taunt' ? 1 : (a.move.energy ?? ENERGY_BY_TIER[a.move.tier] ?? 1);
  return ENERGY_BY_TYPE[a.type] ?? 1;
}
export const energyLabel = (c) => (c === 'all' ? '⚡ ferme le tour' : c === 0 ? '⚡ gratuit' : `⚡${c}`);

// TOUT EST UNE CARTE — Y COMPRIS LES FONDAMENTAUX
//
// Ils étaient hors du talon, toujours disponibles. C'était un filet : une
// mauvaise main voulait dire « je n'ai que les bases », jamais « je ne peux
// rien faire ». Mais ça voulait dire aussi que la moitié des tours se jouait
// en dehors du système de cartes. Une main qu'on peut ignorer n'est pas une
// main.
//
// LA CONTREPARTIE EST OBLIGATOIRE : les fondamentaux entrent dans le talon EN
// PLUSIEURS EXEMPLAIRES, comme les cinq Frappes du paquet de départ de Slay
// the Spire. On ne tire pas « le » coup de poing, on en a plusieurs qui
// reviennent souvent — et avec trois points d'énergie, une main de deux coups
// de poing et d'une prise est un tour complet, pas un tour mort.
export const COPIES = { punch: 2, grapple: 2, whip: 2, taunt: 1 };

// Ce qui ne se pioche toujours pas : la signature et le finisher. Le momentum
// les ouvre, comme avant. Un finisher qu'on tire au sort n'aurait plus rien
// d'un finisher.
export const OFF_DECK_TIERS = new Set(['signature', 'finisher']);
export function isCard(id) {
  const m = MOVES[id];
  return !!m && !OFF_DECK_TIERS.has(m.tier);
}

// Combien d'exemplaires de cette carte dans un talon neuf.
export const copiesOf = (id) => COPIES[id] || 1;

// Le talon d'un lutteur : tout ce qui se pioche dans son répertoire de match,
// les fondamentaux en plusieurs exemplaires. En carrière ce répertoire n'est
// plus figé — `src/game/deck.js` y ajoute ce qu'il a appris et en retire ce
// qu'il a oublié. En exhibition, c'est exactement le répertoire de sa fiche.
export const buildDeck = (unit) => unit.moves.filter(isCard)
  .flatMap((id) => Array.from({ length: copiesOf(id) }, () => id));

// Mélange déterministe : le générateur du match, pour que deux parties avec la
// même graine se déroulent à l'identique (c'est ce dont vivent les tests).
function melange(rng, xs) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function initHand(battle, unit) {
  unit.deck = melange(battle.rng, buildDeck(unit));
  unit.discard = [];
  unit.hand = [];
  refill(battle, unit);
}

// Repioche jusqu'à la taille de main. Le talon vide se reconstitue avec la
// défausse — un lutteur ne tombe jamais à court de son propre répertoire.
export function refill(battle, unit, size = HAND_SIZE) {
  let garde = 0;
  while (unit.hand.length < size && garde++ < 60) {
    if (!unit.deck.length) {
      if (!unit.discard.length) break;
      unit.deck = melange(battle.rng, unit.discard);
      unit.discard = [];
    }
    unit.hand.push(unit.deck.pop());
  }
}

export function playCard(battle, unit, id) {
  const i = unit.hand.indexOf(id);
  if (i < 0) return false;
  unit.hand.splice(i, 1);
  unit.discard.push(id);
  return true;
}

// LA MAIN NEUVE DU TOUR. Ce qui n'a pas été joué part à la défausse, et on
// repioche cinq cartes. C'est le cœur du deck-builder : on revoit tout son
// deck tous les cinq tours, et chaque carte apprise en carrière revient
// vite — au lieu des dix-sept tours d'attente mesurés quand on gardait sa
// main.
export function newHand(battle, unit) {
  unit.discard = unit.discard || [];
  unit.discard.push(...(unit.hand || []));
  unit.hand = [];
  refill(battle, unit);
  return unit.hand;
}

// LA SOUPAPE, gardée par prudence : jeter sa main en cours de tour, ce qui
// coûte ce qu'il reste du tour et fait souffler. Depuis que la main est
// rebattue à chaque tour, on y va rarement.
export function redraw(battle, unit) {
  return newHand(battle, unit);
}

// Ce que l'interface doit montrer : ce qu'il reste, et ce qui est déjà passé.
export const deckState = (unit) => ({
  main: unit.hand ? unit.hand.length : 0,
  talon: unit.deck ? unit.deck.length : 0,
  defausse: unit.discard ? unit.discard.length : 0,
});

// Les mouvements jouables ce tour : LA MAIN, plus les paliers mérités qui ne
// se piochent pas. Ils restent AFFICHÉS même quand la jauge est trop basse —
// verrouillés, avec ce qu'il manque. Les retirer de la liste ferait
// disparaître l'objectif : on ne monte pas une jauge vers un finisher qu'on
// ne voit pas.
export function availableMoves(unit) {
  return [...new Set([...(unit.hand || []), ...unit.moves.filter((id) => !isCard(id) && MOVES[id])])];
}
