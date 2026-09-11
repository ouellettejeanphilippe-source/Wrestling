// Combos : des enchaînements nommés qui récompensent la mise en place plutôt que le matraquage.
// Chaque combo est vérifié au moment où un coup touche. Plusieurs peuvent se déclencher ensemble.
// when(battle, attacker, target, move, ctx) -> bool ; ctx = { fromCorner, fromRope, phase }
export const COMBOS = [
  {
    id: 'stagger', name: 'Suite logique', icon: '💫',
    hint: 'Frappez une cible étourdie',
    desc: 'Une cible étourdie encaisse tout. Étourdissez, puis frappez fort.',
    when: (b, a, t, m) => (t.statuses.dazed || 0) > 0 && ['strike', 'grapple', 'aerial'].includes(m.type),
    dmg: 1.2, momentum: 8, heat: 5,
  },
  {
    id: 'welt', name: 'Poitrine en feu', icon: '🔴',
    hint: 'Frappez une cible marquée 3 fois ou plus',
    desc: 'Les marques (chops) réduisent la défense et finissent par ouvrir la garde.',
    when: (b, a, t) => (t.statuses.welt || 0) >= 3,
    dmg: 1.2, momentum: 6, heat: 4,
  },
  {
    id: 'highspot', name: 'High spot', icon: '🦅',
    hint: 'Plongez depuis un coin',
    desc: 'Un plongeon du coin fait exploser la foule et remplit la jauge.',
    when: (b, a, t, m, ctx) => m.type === 'aerial' && ctx.fromCorner,
    dmg: 1, momentum: 14, heat: 14,
  },
  {
    id: 'springboard', name: 'Rebond des cordes', icon: '🪢',
    hint: 'Attaquez depuis les cordes',
    desc: 'Se servir des cordes comme d’un tremplin ajoute de l’élan.',
    when: (b, a, t, m, ctx) => ctx.fromRope && m.type !== 'taunt',
    dmg: 1.1, momentum: 8, heat: 6,
  },
  // Les deux combos ci-dessous ne regardent pas un état de la cible mais le
  // TRAJET du tour : c'est ce qui relie le déplacement au coup au lieu d'en
  // faire deux phases indépendantes.
  {
    id: 'roperun', name: 'Course dans les cordes', icon: '💨',
    hint: 'Traversez les cordes en chemin, puis frappez',
    desc: 'Prendre appui dans les cordes en courant, puis revenir : le rebond du catch télévisé. Il faut PASSER par les cordes, pas s’y arrêter.',
    when: (b, a, t, m, ctx) => ctx.crossedRope && m.type !== 'taunt',
    dmg: 1.15, momentum: 10, heat: 8,
  },
  {
    id: 'blindside', name: 'Pris à revers', icon: '🌀',
    hint: 'Contournez : bougez, puis frappez dans le dos',
    desc: 'Arriver exactement derrière la cible, et y ARRIVER — être déjà là ne compte pas. C’est le contournement qu’on récompense, pas la position.',
    when: (b, a, t, m, ctx) => ctx.blindside && ctx.travel >= 1
      && ['strike', 'grapple', 'aerial'].includes(m.type),
    // Un combo qui se gagne souvent doit se payer peu : sur des matchs
    // simulés il se déclenche sur la moitié des coups d'une IA qui cherche
    // l'angle. Récompense réelle, pas prime déguisée.
    dmg: 1.12, momentum: 8, heat: 6,
  },
  {
    id: 'ground', name: 'Au sol et martelé', icon: '🔨',
    hint: 'Frappez une cible au sol',
    desc: 'Empiler les dégâts sur un adversaire au sol use son cœur avant le tombé.',
    when: (b, a, t) => t.down,
    dmg: 1.1, momentum: 6, heat: 3,
  },
  {
    id: 'sequence', name: 'Séquence de finition', icon: '☠️',
    hint: 'Enchaînez signature puis finisher',
    desc: 'Un finisher sur une cible encore sonnée par un gros coup est presque imparable.',
    when: (b, a, t, m) => m.tier === 'finisher' && (t.statuses.finished || 0) > 0,
    dmg: 1.25, momentum: 0, heat: 15,
  },
  {
    id: 'chain', name: 'Enchaînement', icon: '🔗',
    hint: 'Variez : deux coups de familles différentes sur la même cible',
    desc: 'Alterner frappe, prise et aérien sur la même cible paie plus que répéter le même mouvement.',
    when: (b, a, t, m) => {
      const last = a.memory.lastHit;
      return !!last && last.uid === t.uid && last.type !== m.type;
    },
    dmg: 1.15, momentum: 8, heat: 5,
  },
  {
    id: 'power', name: 'Différence de force', icon: '💪',
    hint: 'Prenez au corps un adversaire plus faible que vous',
    desc: 'Une prise réussie par le plus fort des deux ne se négocie pas.',
    when: (b, a, t, m) => ['grapple', 'submission'].includes(m.type) && a.stats.str >= t.stats.str + 3,
    dmg: 1.15, momentum: 6, heat: 4,
  },
  {
    id: 'crowd', name: 'La foule est debout', icon: '📣',
    hint: 'Attaquez avec 80+ de chaleur',
    desc: 'Au-delà de 80 de chaleur, la foule porte celui qui attaque.',
    when: (b) => b.heat >= 80,
    dmg: 1.1, momentum: 10, heat: 0,
  },
  {
    id: 'hazard', name: 'Décor complice', icon: '🪑',
    hint: 'Frappez une cible adossée à un obstacle',
    desc: 'Coincer un adversaire contre les marches, une table ou la cage transforme chaque coup.',
    when: (b, a, t, m, ctx) => ctx.targetPinnedToHazard,
    dmg: 1.15, momentum: 6, heat: 6,
  },
];

export const COMBOS_BY_ID = Object.fromEntries(COMBOS.map((c) => [c.id, c]));
