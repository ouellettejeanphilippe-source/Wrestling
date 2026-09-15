// Phases de match : un match de lutte raconte une histoire en trois actes.
import { living } from './util.js';

// La phase se déduit de l'état du match (tour, chaleur de la foule, usure), pas d'un compteur fixe.
//   dmg      multiplicateur de dégâts
//   momentum multiplicateur du momentum gagné en frappant
//   pin      modificateur de chance de tombé
//   heat     multiplicateur de chaleur gagnée
//   flashy   multiplicateur appliqué aux mouvements spectaculaires (aérien, signature, finisher)
//   wear     bonus d'abandon sur les soumissions (usure)
export const PHASES = {
  early: {
    key: 'early', name: 'Ouverture', icon: '🔔', tag: 'Build-up',
    short: 'Installez le match : position, provocations, premières marques.',
    desc: 'La foule est froide et les corps sont frais. Les dégâts passent mal et un gros mouvement fait moins d’effet : personne n’y croit encore. En revanche le momentum monte vite. C’est le moment de prendre position, de provoquer et d’user l’adversaire.',
    dmg: 0.85, momentum: 1.35, pin: -0.08, heat: 0.7, flashy: 0.85, wear: 0,
  },
  mid: {
    key: 'mid', name: 'Corps du match', icon: '🔥', tag: 'Prendre l’avantage',
    short: 'Prenez l’avantage : usure, contrôle du terrain, ouvertures.',
    desc: 'Le match a trouvé son rythme et les paliers s’ouvrent. Ce n’est pas encore le moment de finir : c’est le moment de prendre l’ascendant. Les soumissions usent mieux, les marques s’accumulent, le terrain se contrôle.',
    dmg: 1, momentum: 1, pin: -0.02, heat: 1, flashy: 1, wear: 0.08,
  },
  late: {
    key: 'late', name: 'Main event', icon: '🏆', tag: 'Tout donner',
    short: 'Tout donner : gros mouvements, plongeons, finishers, tombés.',
    desc: 'La foule est debout et les corps sont usés. Les dégâts sont majorés, les mouvements spectaculaires font enfin l’effet qu’ils méritent et les tombés passent. Vos adversaires le savent aussi : un finisher peut tout terminer dans les deux sens.',
    dmg: 1.15, momentum: 0.9, pin: 0.12, heat: 1.4, flashy: 1.15, wear: 0,
  },
};

// Les deux bornes, calibrées pour qu'un match de trente-cinq tours se partage
// en trois actes à peu près égaux : ouverture jusqu'au onzième, corps du match
// jusqu'au vingt-quatrième, main event ensuite.
export const ACTE_II = 0.28, ACTE_III = 0.42;
const USURE_MAX = 0.30;                 // l'usure seule n'ouvre jamais l'acte III
const HEAT_ENCORE_FROIDE = 75;          // au-delà, la salle est déjà dans le match

export const FLASHY_TIERS = ['signature', 'finisher'];
export const isFlashy = (move) => move.type === 'aerial' || FLASHY_TIERS.includes(move.tier);

// LES TROIS ACTES SE LISENT SUR LES CORPS, PAS SUR UN COMPTEUR
//
// L'ancienne règle était : « tour ≥ 9, ou chaleur ≥ 65, ou un finisher » = main
// event. Elle avait été écrite quand un match durait treize tours. Depuis qu'il
// en dure trente-cinq et que la chaleur saturait dès le douzième, 91 % DU TEMPS
// DE JEU se passait en main event : les trois actes existaient dans le code et
// nulle part ailleurs.
//
// L'avancement se mesure maintenant sur ce qui avance vraiment — les points de
// vie, les cœurs dépensés, et le chrono en dernier recours. Un match où les
// deux hommes sont frais est une ouverture, même au vingtième tour ; un match
// où les cœurs sont partis est un main event, même au dixième.
export function matchPhase(battle) {
  const vivants = living(battle);
  if (!vivants.length) return PHASES.late;
  const moy = (f) => vivants.reduce((a, u) => a + f(u), 0) / vivants.length;
  const usure = 1 - moy((u) => (u.maxHp ? u.hp / u.maxHp : 0));
  const coeurs = 1 - moy((u) => (u.maxGrit ? u.grit / u.maxGrit : 1));
  const limite = (battle.match && battle.match.maxTurns) || (battle.rules && battle.rules.maxTurns) || 60;
  // Mesuré sur quarante matchs, tour par tour :
  //   · l'USURE monte vite puis plafonne vers 0,65 dès le vingtième tour — on
  //     se relève à 55 % de ses PV, donc la moyenne ne descend plus. Elle dit
  //     « le match a commencé », jamais « le match se termine » : on la
  //     plafonne sous le seuil du troisième acte ;
  //   · le CŒUR monte lentement et ne redescend JAMAIS (0,00 au douzième tour,
  //     0,24 au trente-cinquième). C'est le vrai arc de l'histoire ;
  //   · le CHRONO sert de garde-fou quand les deux autres traînent.
  const avancement = Math.max(
    Math.min(USURE_MAX, usure * 0.65),
    coeurs * 2.2,
    battle.turn / limite,
  // UN FINISHER POUSSE L'HISTOIRE, IL NE LA VERROUILLE PAS. La règle était
  // « un finisher est tombé → main event », pour toujours : le premier gros
  // coup du quinzième tour figeait l'acte III sur les vingt tours suivants, et
  // 71 % du temps de jeu s'y passait. Chaque finisher avance le récit d'un
  // cran, et c'est tout.
  ) + Math.min(0.08, battle.stats.finishers * 0.04);
  if (avancement >= ACTE_III) return PHASES.late;
  if (avancement < ACTE_II && battle.heat < HEAT_ENCORE_FROIDE) return PHASES.early;
  return PHASES.mid;
}
