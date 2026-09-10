// Types de matchs et leurs règles / conditions de victoire.
// victory : fall | lastStanding | belt | fall_or_escape | survive | boss
export const MATCH_TYPES = {
  singles: { name: 'Match simple', icon: '🥇', arena: 'standard', victory: 'fall', firstFall: true, countOut: 6, dq: true, weapons: 1,
    desc: 'Tombé ou soumission. Compte de 6 tours à l’extérieur. Les armes et coups bas = risque de disqualification.' },
  tag: { name: 'Match par équipes', icon: '🤝', arena: 'standard', victory: 'fall', firstFall: true, countOut: 6, dq: true, tag: true, weapons: 1,
    desc: 'Un seul lutteur légal par équipe. Tag avec un partenaire adjacent pour changer (soigne et donne du momentum). Attaquer sans être légal = risque de DQ. Le premier tombé décide du match.' },
  hardcore: { name: 'Hardcore', icon: '🪑', arena: 'hardcore', victory: 'fall', firstFall: true, countOut: 0, dq: false, weapons: 4,
    desc: 'Pas de DQ, pas de compte à l’extérieur, armes et tables partout. Le tombé compte n’importe où.' },
  battle_royal: { name: 'Bataille royale', icon: '👑', arena: 'standard', victory: 'lastStanding', firstFall: false, countOut: 0, dq: false, toss: true, noPin: true,
    desc: 'Aucun tombé : on élimine en jetant un adversaire par-dessus la troisième corde (il doit être sur les cordes ou dans un coin). Usez-le ou étourdissez-le d’abord. Dernier debout gagne.' },
  ladder: { name: 'Match d’échelle', icon: '🪜', arena: 'ladder', victory: 'belt', firstFall: false, countOut: 0, dq: false, weapons: 2, noPin: true,
    desc: 'Grimpez l’échelle (au centre du ring) deux tours de suite sans subir de dégâts pour décrocher la ceinture. Pas de tombé, pas de DQ.' },
  cage: { name: 'Cage d’acier', icon: '🔒', arena: 'cage', victory: 'fall_or_escape', firstFall: true, countOut: 0, dq: false, cage: true,
    desc: 'Tombé, soumission, ou évasion : grimpez depuis un coin pendant deux tours sans subir de dégâts. Projeter quelqu’un dans la cage fait mal.' },
  survival: { name: 'Survie', icon: '⏱️', arena: 'standard', victory: 'survive', firstFall: false, countOut: 0, dq: false, weapons: 3,
    desc: 'Des renforts arrivent chaque tour ou presque. Tenez jusqu’à la fin du chrono avec au moins un lutteur debout.' },
  showdown: { name: 'Confrontation', icon: '⚔️', arena: 'standard', victory: 'fall', firstFall: false, countOut: 0, dq: false, weapons: 2,
    desc: 'Éliminez tous les adversaires (tombé ou soumission). Les vôtres peuvent aussi être éliminés un à un.' },
};

export const WEAPONS = {
  chair: { id: 'chair', name: 'Chaise pliante', icon: '🪑', power: 12, uses: 3 },
  kendo: { id: 'kendo', name: 'Bâton de kendo', icon: '🥢', power: 8, uses: 5 },
  trash: { id: 'trash', name: 'Poubelle', icon: '🗑️', power: 10, uses: 2 },
  bat: { id: 'bat', name: 'Batte de baseball', icon: '🏏', power: 14, uses: 2 },
};
