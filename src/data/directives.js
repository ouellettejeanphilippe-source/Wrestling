// Directives du « Network » (à la Chroma Squad) : objectifs bonus évalués à la fin d'un match gagné.
//
// ELLES DOIVENT DÉCRIRE LE JEU TEL QU'IL EST. Mesurées sur 25 saisons
// complètes, plusieurs ne le faisaient plus du tout : « gagner en 8 tours »
// était réalisée 0 fois sur 100 depuis qu'un match en dure une trentaine,
// « finir avec 70+ de chaleur » 100 fois sur 100 puisque la chaleur sature, et
// « aucun de vos lutteurs ne tombe au sol » 11 fois sur 100 alors que la chute
// est devenue le cœur de la boucle. Une directive impossible et une directive
// gratuite se valent : ni l'une ni l'autre n'est une décision.
//
// La cible : réalisable entre 25 % et 75 % du temps, selon comment on joue.
//
// ATTENTION À LA MESURE. Les premiers relevés étaient faussés : tant qu'une
// défaite obligeait à rejouer l'épisode, les matchs DIFFICILES étaient rejoués
// en boucle et pesaient cinq fois plus lourd que les autres dans la moyenne.
// Le bon échantillon, c'est huit matchs par saison, une fois chacun.
//
// Deux directives restent hors de portée de la mesure automatique : « Lutte
// propre » et « Sang et acier » dépendent de ce que le JOUEUR choisit de
// faire des armes, et l'IA n'en ramasse jamais.
import { WEAR_BROKEN } from '../engine/wear.js';
import { avgHeat } from '../engine/util.js';

export const DIRECTIVES = {
  fast: { final: true, name: 'Vite fait, bien fait', desc: 'Gagner en 22 tours ou moins.', check: (b) => b.turn <= 22, reward: { fans: 40, money: 150 } },
  long: { final: true, name: 'Faites durer le plaisir', desc: 'Le match doit durer au moins 40 tours.', check: (b) => b.turn >= 40, reward: { fans: 40, money: 150 } },
  finisher_finish: { name: 'Finir avec le finisher', desc: 'La victoire doit suivre directement un finisher.', check: (b) => b.stats.finisherFinish, reward: { fans: 60, money: 200 } },
  table: { name: 'Cassez une table !', desc: 'Quelqu’un doit passer à travers une table.', check: (b) => b.stats.tables > 0, reward: { fans: 60, money: 200 } },
  // « Faire un tag » était réalisée 100 fois sur 100 : dans un match par
  // équipes, on en fait vingt. Un HOT TAG, c'est autre chose — c'est le relais
  // passé par un lutteur à bout de forces, celui que la salle attend depuis
  // dix tours. Le moteur l'enregistre déjà comme temps fort.
  hot_tag: { name: 'Hot tag', desc: 'Deux hot tags : deux fois le relais passé par un lutteur à bout (sous 40 % de PV).', check: (b) => (b.beats || []).filter((x) => x.kind === 'hottag').length >= 2, reward: { fans: 50, money: 150 } },
  high_spot: { name: 'High spot', desc: 'Réussir un mouvement aérien depuis un coin.', check: (b) => b.stats.highSpots >= 1, reward: { fans: 50, money: 150 } },
  kickout_drama: { name: 'Kick-out à 2,9', desc: 'Au moins 2 kick-outs dans le match.', check: (b) => b.stats.kickouts >= 2, reward: { fans: 70, money: 150 } },
  comeback: { name: 'Le retour du héros', desc: 'Un de vos lutteurs doit se relever après avoir été au sol.', check: (b) => b.stats.playerStandUps > 0, reward: { fans: 70, money: 200 } },
  // Depuis que la chute est le cœur de la boucle, « aucun lutteur au sol » ne
  // se réalisait plus qu'une fois sur neuf. Ce qu'on demande, c'est de ne pas
  // se faire user — donc de ne pas laisser partir les cœurs.
  clean_sweep: { final: true, name: 'Sans une égratignure', desc: 'Aucun de vos lutteurs ne perd le moindre cœur ❤️.', check: (b) => b.units.every((u) => u.team !== 'player' || u.grit >= u.maxGrit), reward: { fans: 60, money: 250 } },
  no_weapons: { final: true, name: 'Lutte propre', desc: 'N’utilisez aucune arme.', check: (b) => b.stats.playerWeaponHits === 0, reward: { fans: 40, money: 150 } },
  weapons: { name: 'Sang et acier', desc: 'Frapper avec une arme au moins 2 fois.', check: (b) => b.stats.playerWeaponHits >= 2, reward: { fans: 60, money: 150 } },
  // La chaleur redevient une vraie mesure depuis que la salle RETOMBE quand on
  // ne lui donne rien : la moyenne d'un match va de 34 à 77. On demande le
  // quart supérieur — tenir une salle chaude trente tours, pas la faire hurler
  // une fois.
  heat: { final: true, name: 'Foule en délire', desc: 'Garder la foule à 70 de chaleur en moyenne sur tout le match.', check: (b) => avgHeat(b) >= 70, reward: { fans: 100, money: 200 } },
  escape: { name: 'Évasion spectaculaire', desc: 'Gagner par évasion de la cage.', check: (b) => b.units.some((u) => u.team === 'player' && u.flags.escaped), reward: { fans: 80, money: 250 } },
  taunts: { name: 'Show-off', desc: 'Provoquer au moins 3 fois.', check: (b) => b.stats.playerTaunts >= 3, reward: { fans: 50, money: 100 } },
  submission_win: { name: 'Fais-le abandonner', desc: 'Gagner par soumission.', check: (b) => b.stats.lastElimReason === 'submission', reward: { fans: 70, money: 200 } },
  toss_three: { name: 'Videur de service', desc: 'Éliminer au moins 2 adversaires par-dessus les cordes.', check: (b) => b.stats.playerTosses >= 2, reward: { fans: 80, money: 200 } },
  no_loss: { final: true, name: 'Tout le monde survit', desc: 'Aucun de vos lutteurs éliminé.', check: (b) => b.units.every((u) => u.team !== 'player' || !u.eliminated), reward: { fans: 80, money: 250 } },
  sells: { name: 'Vendre comme un pro', desc: 'Vendre (prendre un bump) au moins 3 fois.', check: (b) => b.stats.sells >= 3, reward: { fans: 50, money: 100 } },
  near_fall_self: { name: 'Faux finish', desc: 'Un de vos lutteurs doit se dégager d’un tombé (kick-out).', check: (b) => b.stats.playerKickouts >= 1, reward: { fans: 70, money: 150 } },
  took_finisher: { name: 'Encaisser le finisher', desc: 'Un de vos lutteurs doit encaisser le finisher adverse.', check: (b) => b.stats.playerTookFinisher >= 1, reward: { fans: 60, money: 150 } },
  // Deux directives qui parlent des systèmes récents : l'usure ciblée et la
  // main. Le Network doit demander ce que le jeu sait faire aujourd'hui.
  cripple: { name: 'Le membre qui lâche', desc: 'Mettre un membre d’un adversaire hors service.', check: (b) => b.units.some((u) => u.team === 'enemy' && Object.values(u.wear || {}).some((n) => n >= WEAR_BROKEN)), reward: { fans: 70, money: 200 } },
  no_redraw: { final: true, name: 'On joue ce qu’on a', desc: 'Ne jamais jeter sa main de tout le match.', check: (b) => b.stats.playerRedraws === 0, reward: { fans: 50, money: 150 } },
  whip_hazard: { name: 'Dans les marches !', desc: 'Projeter un adversaire dans un coin, les marches, une table ou la cage.', check: (b) => b.stats.hazardWhips > 0, reward: { fans: 50, money: 150 } },
};
