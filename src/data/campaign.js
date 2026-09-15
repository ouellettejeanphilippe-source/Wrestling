// Campagne : une carrière courte de 8 épisodes. Chaque épisode propose 2
// matchs ; le joueur en réserve un. Le huitième est le match de championnat
// du monde — c'est là que la carrière se joue.
// Chaque match : type, adversaires (id ou {id, boost}), taille d'équipe, directives du Network, récompenses.
export const SEASON = {
  name: 'Une carrière — De la salle de bingo à la ceinture',
  // LE CHAMPION DU MONDE. Sept matchs de route, puis lui. Le classement (voir
  // `src/game/rank.js`) ne décide pas si on a son match — on l'a toujours —
  // mais dans quelles conditions on l'obtient.
  champion: 'le_caillou',
  beltName: 'Championnat du Monde PPW',
  // LE PUBLIC N'EST PLUS LE BUT, IL EST LE MOYEN. Il payait la fin de la
  // saison : « 2 000 fans à l'arrivée, sinon fin “ok” ». Un nombre en guise
  // d'histoire. Les fans achètent maintenant les entraînements et les recrues
  // qui vous emmènent jusqu'à la ceinture, et ce seuil n'est plus qu'une
  // mention honorable sur l'écran de fin.
  finalFansGoal: 2000,
  shows: [
    {
      id: 'ep1', title: 'Épisode 1 — Le Bingo du Centre Communautaire',
      intro: 'Votre promotion débute dans une salle de bingo louée entre deux parties. Le Network envoie une caméra… et une liste de demandes.',
      matches: [
        { id: 'ep1a', script: { summary: 'Squash rapide : votre lutteur gagne par tombé pour se présenter.', finish: { winner: 'player', method: 'pin' }, beats: ['taunts', 'fast'] }, title: 'Match d’ouverture', type: 'singles', teamSize: 1, enemies: ['jobber_1'], directives: ['fast', 'taunts'], reward: { money: 250, fans: 60 },
          desc: 'Un jobber local pour vous échauffer. Montrez au Network que vous savez lutter.' },
        { id: 'ep1b', script: { summary: 'Le vétéran doit gagner par tombé après son finisher pour lancer la rivalité. Vendez, résistez à un tombé, chauffez la foule.', finish: { winner: 'enemy', method: 'pin', finisher: true }, beats: ['near_fall_self', 'sells', 'heat'] }, title: 'Le vétéran de passage', type: 'singles', teamSize: 1, enemies: ['kris_gericault'], directives: ['finisher_finish', 'kickout_drama'], reward: { money: 450, fans: 120 },
          desc: 'Une légende en tournée accepte un match. Plus dur, mais la foule s’en souviendra.' },
      ],
    },
    {
      id: 'ep2', title: 'Épisode 2 — Tables, chaises et sous-sol d’église',
      intro: 'Le Network veut du sang (métaphorique) et du bois brisé. Le sous-sol d’église a été réservé sous un faux nom.',
      matches: [
        { id: 'ep2a', script: { summary: 'Votre lutteur gagne, mais le Network veut du bois cassé et de l’acier.', finish: { winner: 'player', method: 'pin' }, beats: ['table', 'weapons', 'kickout_drama'] }, title: 'Hardcore du sous-sol', type: 'hardcore', teamSize: 1, enemies: ['jon_moxie'], directives: ['table', 'weapons'], reward: { money: 500, fans: 140 },
          desc: 'Un chien enragé, quatre armes, deux tables. Bonne chance.' },
        { id: 'ep2b', script: { summary: 'Jon Moxie doit garder son aura hardcore : votre équipe perd (n’importe comment), après une table et beaucoup de bumps.', finish: { winner: 'enemy', method: 'any' }, beats: ['table', 'sells', 'heat'] }, title: 'Tag hardcore', type: 'hardcore', teamSize: 2, enemies: ['jon_moxie', 'dannemaison'], directives: ['table', 'clean_sweep'], reward: { money: 550, fans: 160 },
          desc: 'Deux contre deux, tout est permis. Attention aux malédictions.' },
      ],
    },
    {
      id: 'ep3', title: 'Épisode 3 — La Guerre des Tags',
      intro: 'Un vrai match par équipes avec un vrai arbitre (le cousin du promoteur). Les tags comptent, la légalité aussi.',
      matches: [
        { id: 'ep3a', script: { summary: 'Victoire propre par tombé après un hot tag et un retour du héros.', finish: { winner: 'player', method: 'pin' }, beats: ['hot_tag', 'comeback', 'kickout_drama'] }, title: 'Les Fraudeurs', type: 'tag', teamSize: 2, enemies: ['mjg', 'seth_rollmops'], directives: ['hot_tag', 'no_weapons'], reward: { money: 600, fans: 180 },
          desc: 'Deux tricheurs professionnels. Faites des tags propres et gagnez proprement.' },
        { id: 'ep3b', script: { summary: 'Rhea Rippley et Randy Horton montent en puissance : votre équipe perd par tombé après avoir encaissé un finisher.', finish: { winner: 'enemy', method: 'pin' }, beats: ['hot_tag', 'sells', 'took_finisher'] }, title: 'Mami et la Vipère', type: 'tag', teamSize: 2, enemies: ['rhea_ripplay', 'randy_python'], directives: ['hot_tag', 'comeback'], reward: { money: 700, fans: 220 },
          desc: 'Une équipe brutale. Gardez vos distances de la Vipère quand elle a du momentum.' },
      ],
    },
    {
      id: 'ep4', title: 'Épisode 4 — La Bataille Royale du Buffet',
      intro: 'Le Network veut du chaos. Tout le monde dans le ring, personne ne sort autrement que par-dessus la troisième corde.',
      matches: [
        { id: 'ep4a', script: { summary: 'Vos lutteurs vident le ring et gagnent la bataille royale.', finish: { winner: 'player', method: 'any' }, beats: ['toss_three', 'heat'] }, title: 'Bataille royale à 7', type: 'battle_royal', teamSize: 3, enemies: ['jobber_1', 'jobber_2', 'logan_pole', 'dannemaison'], directives: ['toss_three', 'no_loss'], reward: { money: 700, fans: 240 },
          desc: 'Trois des vôtres contre quatre. Poussez-les dans les cordes, puis jetez-les.' },
        { id: 'ep4b', script: { summary: 'Le Général doit dominer : votre équipe se fait éliminer après avoir vendu ses chops.', finish: { winner: 'enemy', method: 'any' }, beats: ['sells', 'long'] }, title: 'Bataille royale des poids lourds', type: 'battle_royal', teamSize: 3, enemies: ['hulk_gogane', 'gunter', 'jobber_2'], directives: ['no_loss', 'heat'], reward: { money: 800, fans: 280 },
          desc: 'Des colosses difficiles à faire passer par-dessus les cordes. Usez-les ou étourdissez-les d’abord.' },
      ],
    },
    {
      id: 'ep5', title: 'Épisode 5 — L’Échelle vers la Gloire',
      intro: 'Une ceinture (achetée en ligne) est suspendue au-dessus du ring. Le premier qui grimpe deux tours de suite la décroche.',
      matches: [
        { id: 'ep5a', script: { summary: 'Vous décrochez la ceinture après un high spot et une projection dangereuse.', finish: { winner: 'player', method: 'belt' }, beats: ['high_spot', 'whip_hazard'] }, title: 'Ladder match aérien', type: 'ladder', teamSize: 2, enemies: ['bill_osprey', 'curve_stricklande'], directives: ['high_spot', 'whip_hazard'], reward: { money: 800, fans: 300 },
          desc: 'Deux voltigeurs qui grimpent vite. Frappez-les dès qu’ils touchent l’échelle.' },
        { id: 'ep5b', script: { summary: 'L’Influenceur vole la ceinture : laissez-le grimper, mais faites un match long et violent.', finish: { winner: 'enemy', method: 'belt' }, beats: ['weapons', 'heat', 'long'] }, title: 'Ladder match brutal', type: 'ladder', teamSize: 2, enemies: ['gunter', 'logan_pole'], directives: ['weapons', 'fast'], reward: { money: 850, fans: 320 },
          desc: 'Le Général bloque l’échelle, l’Influenceur vole autour. Utilisez les chaises.' },
      ],
    },
    {
      id: 'ep6', title: 'Épisode 6 — La Cage du Démon',
      intro: 'Une cage d’acier (louée à une ferme). Personne n’entre, personne ne sort… sauf par-dessus.',
      matches: [
        { id: 'ep6a', script: { summary: 'Évasion de la cage après un retour du héros.', finish: { winner: 'player', method: 'escape' }, beats: ['comeback', 'whip_hazard'] }, title: 'Cage contre le Démon', type: 'cage', teamSize: 1, enemies: [{ id: 'fray_wyatt', boost: { hp: 10 } }], directives: ['escape', 'comeback'], reward: { money: 900, fans: 350 },
          desc: 'Quand ses PV baissent, il devient le Démon. Évadez-vous avant, ou finissez-le vite.' },
        { id: 'ep6b', script: { summary: 'Le Géant tombe enfin : tombé après votre finisher, avec du drame.', finish: { winner: 'player', method: 'pin', finisher: true }, beats: ['kickout_drama', 'whip_hazard'] }, title: 'Cage contre le Géant', type: 'cage', teamSize: 1, enemies: ['le_geant'], directives: ['whip_hazard', 'kickout_drama'], reward: { money: 950, fans: 380 },
          desc: 'Impossible à projeter. Mais une cage a beaucoup de murs et il est lent.' },
      ],
    },
    {
      id: 'ep7', title: 'Épisode 7 — L’Invasion du nWc',
      intro: 'Une faction en noir et blanc envahit votre show. Ils sont nombreux, ils arrivent par vagues, et le Network adore ça.',
      matches: [
        { id: 'ep7a', script: { summary: 'Vous tenez le ring jusqu’au bout sans perdre personne.', finish: { winner: 'player', method: 'any' }, beats: ['no_loss', 'heat'] }, title: 'Tenir le ring', type: 'survival', teamSize: 3, turns: 8, enemies: ['invader', 'invader'], directives: ['no_loss', 'heat'], reward: { money: 1000, fans: 420 },
          reinforcements: [{ turn: 3, enemies: ['invader'], spawns: [[0, 7]] }, { turn: 5, enemies: ['gunter'], spawns: [[0, 7]] }, { turn: 7, enemies: ['invader'], spawns: [[0, 6]] }],
          desc: 'Survivez 8 tours. Des renforts arrivent par la rampe aux tours 3, 5 et 7.' },
        { id: 'ep7b', script: { summary: 'Cliffhanger : l’invasion prend le contrôle. Votre équipe perd après avoir encaissé un finisher et beaucoup vendu.', finish: { winner: 'enemy', method: 'any' }, beats: ['sells', 'took_finisher', 'heat'] }, title: 'Contre-attaque', type: 'showdown', teamSize: 3, enemies: ['invader', 'invader', 'randy_python'], directives: ['no_loss', 'finisher_finish'], reward: { money: 1100, fans: 450 },
          desc: 'Éliminez tous les envahisseurs et leur nouveau leader. Pas de compte, pas de DQ.' },
      ],
    },
    // LE HUITIÈME ÉPISODE N'OFFRE PAS DE CHOIX. Tous les autres en proposent
    // deux ; celui-là n'en propose qu'un, parce qu'il n'y a plus qu'une
    // question. Les adversaires écrits ici sont ceux du meilleur cas —
    // `titleMatch()` les remplace selon votre classement, et c'est la seule
    // chose que le classement décide.
    {
      id: 'ep8', title: 'Épisode 8 — Le PPV : le Championnat du Monde',
      intro: 'Le grand soir. Une ceinture, un champion, et vous. Le Network diffuse en direct et tout le monde sait ce qui se joue : sept matchs de route s’arrêtent ici, d’une manière ou d’une autre.',
      title_match: true,
      matches: [
        { id: 'ep8a', script: { summary: 'Le main event parfait : vous gagnez par tombé après votre finisher, après avoir survécu au sien.', finish: { winner: 'player', method: 'pin', finisher: true }, beats: ['near_fall_self', 'took_finisher', 'heat'] }, title: 'Championnat du Monde PPW', type: 'showdown', teamSize: 1, enemies: ['le_caillou'], directives: ['finisher_finish', 'kickout_drama', 'heat'], reward: { money: 2000, fans: 800 },
          desc: 'Tout le monde doit être éliminé. Le champion se relève toujours une fois de plus qu’on ne le croit.' },
      ],
    },
  ],
};

// LES SOIRS EN SOLO — LA ROUTE D'UN SEUL LUTTEUR
//
// Une carrière est celle d'UN lutteur. Les quatorze matchs écrits plus haut
// ont été pensés pour une écurie : neuf d'entre eux demandent deux ou trois
// des vôtres, et il n'en restait que cinq jouables seul. Cinq matchs pour sept
// semaines, c'était la même soirée trois fois.
//
// ON NE LES TRANSFORME PAS EN 1 CONTRE 2 : mesuré, l'infériorité numérique
// dans ce moteur donne 0 victoire sur 40. Un lutteur seul affronte UN homme.
//
// Ces six soirs-là comblent le trou — et ils font enfin servir les cinq
// stipulations que la campagne n'utilisait jamais alors qu'elles étaient
// écrites, mesurées et jouables : street fight, soumission uniquement, Last
// Man Standing, TLC et Hell in a Cell.
//
// `tier` remplace ici la convention des shows (« le second match est le plus
// dur ») : il dit si le match alimente les nœuds « match » ou « main event ».
export const SOLO_MATCHES = [
  { id: 'so1', tier: 'normal', title: 'Bagarre de parking', type: 'street_fight', teamSize: 1, enemies: ['dannemaison'], directives: ['weapons', 'taunts'], reward: { money: 380, fans: 130 },
    desc: 'Pas d’arbitre à convaincre, pas de disqualification : le tombé compte n’importe où. Il trichera, évidemment.',
    script: { summary: 'Un début de rivalité : vous gagnez, mais il faut que ça ait l’air sale.', finish: { winner: 'player', method: 'pin' }, beats: ['weapons', 'taunts'] } },

  { id: 'so2', tier: 'normal', title: 'Le défi du technicien', type: 'submission_only', teamSize: 1, enemies: ['kris_gericault'], directives: ['submission_win', 'cripple'], reward: { money: 520, fans: 190 },
    desc: 'Aucun tombé ne compte : il faut le faire abandonner. Travaillez un membre, et ne lâchez plus.',
    script: { summary: 'Le vétéran veut voir si vous savez lutter. Faites-le abandonner.', finish: { winner: 'player', method: 'submission' }, beats: ['submission_win', 'long'] } },

  { id: 'so3', tier: 'elite', title: 'Guerre des nerfs', type: 'last_man_standing', teamSize: 1, enemies: ['randy_python'], directives: ['kickout_drama', 'comeback'], reward: { money: 700, fans: 280 },
    desc: 'Ni tombé ni abandon : il faut le mettre au sol et qu’il y reste pendant le compte de dix. La Vipère se relève toujours une fois de trop.',
    script: { summary: 'Un main event long et cruel : vous finissez debout, lui non.', finish: { winner: 'player', method: 'any' }, beats: ['comeback', 'sells', 'long'] } },

  { id: 'so4', tier: 'normal', title: 'Le contrat au-dessus du ring', type: 'tlc', teamSize: 1, enemies: ['seth_rollmops'], directives: ['table', 'high_spot'], reward: { money: 740, fans: 300 },
    desc: 'Tables, échelles et chaises. Le premier qui décroche le contrat repart avec — s’il tient encore debout.',
    script: { summary: 'Le spot du show : du bois cassé, un plongeon, et le contrat pour vous.', finish: { winner: 'player', method: 'belt' }, beats: ['table', 'high_spot'] } },

  { id: 'so5', tier: 'normal', title: 'Duel à l’ancienne', type: 'singles', teamSize: 1, enemies: ['cody_roads'], directives: ['finisher_finish', 'no_weapons'], reward: { money: 820, fans: 340 },
    desc: 'Pas d’arme, pas de gadget, pas d’excuse. Un match propre devant une salle qui connaît la différence.',
    script: { summary: 'Le match d’école : propre, long, et gagné après votre finisher.', finish: { winner: 'player', method: 'pin', finisher: true }, beats: ['near_fall_self', 'finisher_finish'] } },

  { id: 'so7', tier: 'elite', title: 'Règlement de comptes', type: 'street_fight', teamSize: 1, enemies: ['jon_moxie'], directives: ['weapons', 'kickout_drama'], reward: { money: 560, fans: 200 },
    desc: 'Il vous attendait dans le parking et l’arbitre a décidé de ne rien voir. Aucune règle, et il aime ça plus que vous.',
    script: { summary: 'Une guerre de rue que vous finissez debout, après en avoir pris beaucoup.', finish: { winner: 'player', method: 'pin' }, beats: ['weapons', 'sells'] } },

  { id: 'so8', tier: 'elite', title: 'Le mur', type: 'singles', teamSize: 1, enemies: [{ id: 'gunter', boost: { hp: 10 } }], directives: ['comeback', 'cripple'], reward: { money: 880, fans: 330 },
    desc: 'Pas de gadget, pas de stipulation : juste un homme qu’on ne bouge pas et qui frappe comme un camion. Trouvez un membre et acharnez-vous.',
    script: { summary: 'On vous laisse survivre au rouleau compresseur — et le battre au bout.', finish: { winner: 'player', method: 'submission' }, beats: ['sells', 'comeback', 'long'] } },

  { id: 'so6', tier: 'elite', title: 'Hell in a Cell', type: 'hell_in_cell', teamSize: 1, enemies: [{ id: 'entrepreneur', boost: { hp: 10 } }], directives: ['whip_hazard', 'kickout_drama'], reward: { money: 1050, fans: 430 },
    desc: 'Enfermés, et vraiment : la cellule ne s’escalade pas. Il n’y a qu’une porte, et c’est lui qui a la clef.',
    script: { summary: 'Le main event que personne n’oubliera : vous sortez vainqueur de la cellule.', finish: { winner: 'player', method: 'pin' }, beats: ['whip_hazard', 'sells', 'heat'] } },
];

export const EXHIBITION_TYPES = ['singles', 'tag', 'hardcore', 'street_fight', 'last_man_standing', 'submission_only', 'battle_royal', 'ladder', 'tlc', 'cage', 'hell_in_cell', 'showdown'];
