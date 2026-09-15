// LE CLASSEMENT — UNE COURSE COURTE, UNE CEINTURE AU BOUT
//
// La carrière se terminait sur un total de fans : « 2 000 à l'arrivée, sinon
// la fin “ok” ». Un nombre. On pouvait jouer huit épisodes sans jamais savoir
// vers quoi on allait, et l'écran de fin annonçait un chiffre au lieu d'une
// histoire.
//
// Une carrière de lutteur ne se raconte pas comme ça. Elle se raconte en une
// phrase : « il est arrivé de nulle part et il est reparti avec la ceinture ».
// C'est aussi ce que demande une structure de run : un début clair, une montée
// lisible, et UNE question à la fin à laquelle on répond oui ou non.
//
// Alors : huit épisodes, sept matchs de route, et le huitième est le match de
// championnat du monde. Chaque victoire vous fait monter d'une place, chaque
// défaite vous en fait perdre une — et c'est votre place au classement le soir
// du PPV qui décide des CONDITIONS du match de titre, pas le droit d'y aller.
// On a toujours son match ; on ne l'a jamais dans les mêmes termes.
import { WRESTLERS_BY_ID } from '../data/wrestlers.js';

// On part sixième prétendant. Sept matchs de route à ±1, donc le classement
// du soir vaut `13 − 2 × victoires` : six victoires ou plus amènent premier,
// quatre ou cinq amènent cinquième, trois ou moins jettent au fond.
//
// Calibré sur ce qui se passe vraiment : une carrière jouée par l'IA gagne
// quatre à cinq de ses sept matchs de route. Partir huitième — l'essai
// précédent — envoyait 37 carrières sur 40 dans le pire des trois termes.
// Un palier que presque tout le monde touche n'est pas un palier.
export const RANK_START = 6;
export const RANK_TOP = 1;
export const RANK_BOTTOM = 10;

export const clampRank = (n) => Math.max(RANK_TOP, Math.min(RANK_BOTTOM, n));

// Gagner monte d'une place, perdre en fait perdre une. Symétrique et lisible :
// on doit pouvoir compter dans sa tête, au milieu de la carrière, combien de
// victoires il reste à aller chercher.
//
// ON NE BORNE PAS EN CHEMIN, seulement à la lecture. Sinon l'ordre des
// résultats change le classement final : six victoires puis une défaite
// donnait deuxième (la sixième victoire butait sur le plafond et la défaite
// repartait de là), une défaite puis six victoires donnait premier. Deux
// carrières à 6-1 doivent finir au même rang.
export function moveRank(state, won) {
  state.rank = (state.rank ?? RANK_START) + (won ? -1 : 1);
  return rankOf(state);
}

// Le classement tel qu'on l'annonce : le compteur interne, ramené entre le
// premier et le dernier prétendant.
export const rankOf = (state) => clampRank(state.rank ?? RANK_START);

// LES TROIS TERMES DU MATCH DE TITRE. Le champion est toujours le champion ;
// ce qui change, c'est ce qu'il se permet parce que vous venez de loin.
//
// Un prétendant mal classé n'a rien à faire là et le champion le sait : il
// arrive plus frais, et il amène quelqu'un. C'est la pression de tout le run,
// ramassée dans un seul match.
// Mesuré sur soixante finales par terme, avec un roster de fin de carrière :
//   ·  un contre un net ................................ ceinture 55 %
//   ·  un contre un, champion +25 PV +1 stat ........... ceinture 37 %
//   ·  deux contre deux, champion +25 +1, et son homme . ceinture 15 %
//
// Un premier essai mettait le palier du milieu à +15 PV : en carrière, il ne
// se distinguait plus du match propre (37 % contre 35 % sur cent carrières).
// Un palier qu'on ne sent pas n'est pas un palier — arriver premier prétendant
// doit se voir dans le ring, pas seulement sur l'affiche.
//
// À NE PAS RETENTER : monter le bonus plus haut ne fait plus rien. +35 PV et
// +2 en stats donnent 38 % — le même score qu'à +25/+1. Au-delà, le champion
// ne devient pas plus dur, il devient juste plus lent à tomber.
//
// Le UN CONTRE DEUX a été essayé et jeté : 0 % sur quarante matchs, dans
// toutes ses variantes, même avec un champion sans bonus. Être en infériorité
// numérique dans ce moteur n'est pas « très dur », c'est un mur — et un mur
// n'est pas une punition, c'est une fin de non-recevoir. Le champion amène
// donc son homme, et vous avez le droit d'amener le vôtre : le handicap, c'est
// qu'il arrive au sommet de sa forme et pas vous.
export const TITLE_TERMS = [
  {
    max: 1, key: 'net', icon: '⚖️',
    name: 'Match de titre, un contre un',
    desc: 'Vous êtes premier prétendant. Personne ne peut rien y redire : le champion vous doit un match propre.',
    boost: {}, extra: [], teamSize: 1, odds: 'un peu plus d’1 chance sur 2',
  },
  {
    max: 5, key: 'avantage', icon: '🪙',
    name: 'Match de titre, avantage au champion',
    desc: 'Vous méritez votre chance, mais le champion a choisi la date, la salle et l’arbitre. Il arrive plus frais que vous.',
    boost: { hp: 25, stats: 1 }, extra: [], teamSize: 1, odds: 'environ 1 chance sur 3',
  },
  {
    max: RANK_BOTTOM, key: 'handicap', icon: '🐺',
    name: 'Match de titre, et il n’est pas venu seul',
    desc: 'Personne ne vous attendait ici. Le champion prend le match pour l’insulte, arrive au sommet de sa forme, et amène son homme de main — amenez le vôtre.',
    boost: { hp: 25, stats: 1 }, extra: ['ronan_rains'], teamSize: 2, odds: 'environ 1 chance sur 7',
  },
];

export const titleTerms = (rank) => TITLE_TERMS.find((t) => clampRank(rank) <= t.max) || TITLE_TERMS[TITLE_TERMS.length - 1];

// Le match de championnat, construit à partir du classement. On part de la
// fiche écrite dans la saison et on ne touche qu'aux adversaires : le type, le
// script et les directives restent ceux de l'auteur.
export function titleMatch(matchDef, state, champion) {
  if (matchDef.terms) return matchDef;   // déjà résolu : la transformation est idempotente
  const t = titleTerms(state.rank ?? RANK_START);
  return {
    ...matchDef,
    // Le titre reste le nom de la ceinture — c'est lui qu'on veut lire en gros.
    // Les conditions sont une ligne à part (`termsLabel`), pas une rallonge.
    termsLabel: `${t.icon} ${t.name} — ${t.odds}`,
    desc: `${t.desc} ${matchDef.desc || ''}`.trim(),
    enemies: [{ id: champion, boost: t.boost }, ...t.extra],
    teamSize: t.teamSize,
    terms: t.key,
  };
}

export const rankLabel = (rank) => {
  const r = clampRank(rank ?? RANK_START);
  return r === RANK_TOP ? 'Premier prétendant' : `${r}ᵉ prétendant`;
};

export const championName = (id) => (WRESTLERS_BY_ID[id] || {}).name || id;
