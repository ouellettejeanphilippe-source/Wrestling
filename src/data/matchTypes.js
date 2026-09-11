// Types de matchs et leurs règles / conditions de victoire.
// victory : fall | lastStanding | belt | fall_or_escape | survive | boss
//
// Quelques règles transversales, calquées sur les stipulations les plus connues :
//   dq          l'arbitre disqualifie pour arme ou coup bas (s'il regarde)
//   countOut    nombre de tours à l'extérieur avant le compte (0 = pas de compte)
//   tables      la table des commentateurs peut être brisée. Ailleurs elle tient :
//               on s'écrase dessus, mais on ne passe pas au travers (c'est réservé
//               aux matchs où c'est au menu, TLC en tête)
//   weapons     armes déjà posées au sol au coup d'envoi
//   underRing   armes disponibles SOUS LE RING : il faut sortir, aller les chercher
//               au bord du tablier, et assumer le risque de DQ en s'en servant
//   tenCount    un lutteur au sol qui ne se relève pas est compté (Last Man Standing)
export const MATCH_TYPES = {
  singles: { name: 'Match simple', icon: '🥇', arena: 'standard', victory: 'fall', firstFall: true, countOut: 6, dq: true, weapons: 0, underRing: 2,
    desc: 'Tombé ou soumission. Compte de 6 tours à l’extérieur. Rien ne traîne au sol : il faut sortir chercher une arme sous le ring — et s’en servir devant l’arbitre, c’est la disqualification.' },
  tag: { name: 'Match par équipes', icon: '🤝', arena: 'standard', victory: 'fall', firstFall: true, countOut: 6, dq: true, tag: true, weapons: 0, underRing: 2,
    desc: 'Un seul lutteur légal par équipe. Tag avec un partenaire adjacent pour changer (soigne et donne du momentum). Attaquer sans être légal = risque de DQ. Le premier tombé décide du match.' },
  hardcore: { name: 'Hardcore', icon: '🪑', arena: 'hardcore', victory: 'fall', firstFall: true, countOut: 0, dq: false, weapons: 4, underRing: 4, tables: true,
    desc: 'Pas de DQ, pas de compte à l’extérieur, armes et tables partout — et la table des commentateurs est au menu. Le tombé compte n’importe où.' },
  battle_royal: { name: 'Bataille royale', icon: '👑', arena: 'standard', victory: 'lastStanding', firstFall: false, countOut: 0, dq: false, toss: true, noPin: true,
    desc: 'Aucun tombé : on élimine en jetant un adversaire par-dessus la troisième corde (il doit être sur les cordes ou dans un coin). Usez-le ou étourdissez-le d’abord. Dernier debout gagne.' },
  ladder: { name: 'Match d’échelle', icon: '🪜', arena: 'ladder', victory: 'belt', firstFall: false, countOut: 0, dq: false, weapons: 2, underRing: 2, noPin: true,
    desc: 'Grimpez l’échelle (au centre du ring) deux tours de suite sans subir de dégâts pour décrocher la ceinture. Pas de tombé, pas de DQ.' },
  cage: { name: 'Cage d’acier', icon: '🔒', arena: 'cage', victory: 'fall_or_escape', firstFall: true, countOut: 0, dq: false, cage: true,
    desc: 'Tombé, soumission, ou évasion : grimpez depuis un coin pendant deux tours sans subir de dégâts. Projeter quelqu’un dans la cage fait mal.' },
  tlc: { name: 'TLC (Tables, Échelles, Chaises)', icon: '🪜', arena: 'ladder', victory: 'belt', firstFall: false, countOut: 0, dq: false, weapons: 4, underRing: 4, tables: true, noPin: true,
    desc: 'Tables, échelles et chaises : tout est légal et tout est fourni. La table des commentateurs se brise. Grimpez l’échelle deux tours de suite sans être touché pour décrocher la ceinture.' },
  hell_in_cell: { name: 'Hell in a Cell', icon: '😈', arena: 'cage', victory: 'fall', firstFall: true, countOut: 0, dq: false, cage: true, weapons: 2, underRing: 3, tables: true,
    desc: 'Enfermés. Pas d’évasion, pas de DQ, pas de compte : ça se termine par tombé ou soumission. Les murs font mal et il y a des chaises sous le ring.' },
  last_man_standing: { name: 'Last Man Standing', icon: '🔟', arena: 'standard', victory: 'fall', firstFall: true, countOut: 0, dq: false, noPin: true, tenCount: true, underRing: 3, tables: true,
    desc: 'Aucun tombé : il faut mettre l’adversaire au sol et qu’il ne réponde pas au compte de dix. Un lutteur au sol qui ne se relève pas au tour suivant a perdu. Tout est légal.' },
  street_fight: { name: 'Street Fight (sans DQ)', icon: '🥊', arena: 'hardcore', victory: 'fall', firstFall: true, countOut: 0, dq: false, weapons: 3, underRing: 3, tables: true,
    desc: 'Pas de disqualification, pas de compte, et les tombés comptent n’importe où — y compris à l’extérieur. Armes au sol et sous le ring.' },
  submission_only: { name: 'Soumission uniquement', icon: '🔗', arena: 'standard', victory: 'fall', firstFall: true, countOut: 6, dq: true, noPin: true, underRing: 0,
    desc: 'Pas de tombé : la seule façon de gagner est de faire abandonner l’adversaire. Les armes restent illégales, et personne n’est venu en cacher sous le ring.' },
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
