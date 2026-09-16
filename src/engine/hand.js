// LA MAIN — on ne choisit plus le meilleur coup, on joue ce qu'on a
//
// Le problème du menu : avec dix-huit mouvements par lutteur, la liste
// s'allonge mais la décision, elle, ne devient jamais plus intéressante. Le
// meilleur coup du tour est presque toujours le même que celui du tour
// précédent, et on finit par dérouler une routine au lieu de lutter.
//
// Une MAIN règle exactement ça : quatre ou cinq mouvements disponibles sur la
// vingtaine que connaît le lutteur, et il faut faire avec. Le reste du moteur
// était déjà taillé pour — les conditions existent (`ran`, `crossedRope`,
// `turnbuckle`, cible au sol), le momentum verrouille déjà les paliers, l'usure
// donne une raison de garder une carte, et la foule se lasse déjà des
// répétitions.
//
// LA RÈGLE IMPORTANTE : on ne défausse PAS sa main à chaque tour. On joue une
// carte, on en repioche une. Ce qu'on garde, on le garde aussi longtemps qu'on
// veut. C'est ce qui permet de POURSUIVRE UN PLAN : tenir son Lariat lancé
// pendant trois tours en cherchant ses quatre cases de course, c'est du catch.
// Une main rebattue chaque tour, ce serait du hasard.
import { MOVES } from '../data/moves.js';

export const HAND_SIZE = 5;

// TOUT EST UNE CARTE — Y COMPRIS LES FONDAMENTAUX
//
// Ils étaient hors du talon, toujours disponibles. C'était un filet : une
// mauvaise main voulait dire « je n'ai que les bases », jamais « je ne peux
// rien faire ». Mais ça voulait dire aussi que la moitié des tours se jouait
// en dehors du système de cartes, et qu'un coup de poing ne coûtait jamais
// rien. Une main de quatre qu'on peut ignorer n'est pas une main.
//
// LA CONTREPARTIE EST OBLIGATOIRE, et c'est la réponse classique du genre :
// les fondamentaux entrent dans le talon EN PLUSIEURS EXEMPLAIRES, comme les
// cinq Frappes du paquet de départ de Slay the Spire. On ne tire pas « le »
// coup de poing, on en a plusieurs qui reviennent souvent — c'est ce qui rend
// « tout est carte » jouable au lieu de bloquant.
//
// Le premier essai (fondamentaux au talon, un seul exemplaire chacun) donnait
// 41 % de tours entièrement morts. Les copies et les cartes qui déplacent
// (`step`) existent pour ça, et un test mesure le résultat.
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

// LA SOUPAPE. Cinq cartes injouables, ça arrive — c'est même la tension qu'on
// cherche. Mais ça ne doit jamais être une impasse : on jette tout, on
// repioche, et ça coûte le tour. C'est la prise de repos du système de cartes,
// et elle rend du souffle comme une provocation.
export function redraw(battle, unit) {
  unit.discard.push(...unit.hand);
  unit.hand = [];
  refill(battle, unit);
  return unit.hand;
}

// Ce que l'interface doit montrer : ce qu'il reste, et ce qui est déjà passé.
export const deckState = (unit) => ({
  main: unit.hand ? unit.hand.length : 0,
  talon: unit.deck ? unit.deck.length : 0,
  defausse: unit.discard ? unit.discard.length : 0,
});

// Les mouvements jouables ce tour : la main, plus tout ce qui ne se pioche pas
// (provocation toujours, signature et finisher quand la jauge le permet).
// Les mouvements jouables ce tour : la main, plus tout ce qui ne se pioche pas.
//
// Les paliers mérités restent AFFICHÉS même quand la jauge est trop basse —
// ils apparaissent verrouillés, avec ce qu'il manque. Les retirer de la liste
// ferait disparaître l'objectif : on ne monte pas une jauge vers un finisher
// qu'on ne voit pas.
// Les mouvements jouables ce tour : LA MAIN, plus les paliers mérités qui ne
// se piochent pas. Il n'y a plus rien d'autre — plus de coup de poing gratuit
// à côté du système.
export function availableMoves(unit) {
  return [...new Set([...(unit.hand || []), ...unit.moves.filter((id) => !isCard(id) && MOVES[id])])];
}
