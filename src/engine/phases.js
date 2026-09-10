// Phases de match : un match de lutte raconte une histoire en trois actes.
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

export const FLASHY_TIERS = ['signature', 'finisher'];
export const isFlashy = (move) => move.type === 'aerial' || FLASHY_TIERS.includes(move.tier);

export function matchPhase(battle) {
  const worn = battle.units.filter((u) => !u.eliminated).some((u) => u.hp / u.maxHp < 0.45);
  if (battle.turn <= 3 && battle.heat < 45 && !worn) return PHASES.early;
  if (battle.turn >= 9 || battle.heat >= 65 || battle.stats.finishers > 0) return PHASES.late;
  return PHASES.mid;
}
