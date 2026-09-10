// Campagne : une saison de 8 épisodes. Chaque épisode propose 2 matchs ; le joueur en réserve un.
// Chaque match : type, adversaires (id ou {id, boost}), taille d'équipe, directives du Network, récompenses.
export const SEASON = {
  name: 'Saison 1 — De la salle de bingo au PPV',
  finalFansGoal: 1500,
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
          reinforcements: [{ turn: 3, enemies: ['invader'], spawns: [[0, 4]] }, { turn: 5, enemies: ['gunter'], spawns: [[0, 5]] }, { turn: 7, enemies: ['invader'], spawns: [[0, 3]] }],
          desc: 'Survivez 8 tours. Des renforts arrivent par la rampe aux tours 3, 5 et 7.' },
        { id: 'ep7b', script: { summary: 'Cliffhanger : l’invasion prend le contrôle. Votre équipe perd après avoir encaissé un finisher et beaucoup vendu.', finish: { winner: 'enemy', method: 'any' }, beats: ['sells', 'took_finisher', 'heat'] }, title: 'Contre-attaque', type: 'showdown', teamSize: 3, enemies: ['invader', 'invader', 'randy_python'], directives: ['no_loss', 'finisher_finish'], reward: { money: 1100, fans: 450 },
          desc: 'Éliminez tous les envahisseurs et leur nouveau leader. Pas de compte, pas de DQ.' },
      ],
    },
    {
      id: 'ep8', title: 'Épisode 8 — Le PPV : Bataille du Siècle',
      intro: 'Le grand soir. Le Boss Final et le Chef Tribal veulent racheter votre promotion. Le Network diffuse en direct.',
      matches: [
        { id: 'ep8a', script: { summary: 'Le main event parfait : vous gagnez par tombé après votre finisher, après avoir survécu au sien.', finish: { winner: 'player', method: 'pin', finisher: true }, beats: ['near_fall_self', 'took_finisher', 'heat'] }, title: 'Main event : le Boss Final', type: 'showdown', teamSize: 2, enemies: [{ id: 'le_caillou', boost: { hp: 20, stats: 1 } }, 'ronan_rains'], directives: ['finisher_finish', 'kickout_drama', 'heat'], reward: { money: 2000, fans: 800 },
          desc: 'Deux contre deux, tout le monde doit être éliminé. Le Boss se relève toujours une fois.' },
        { id: 'ep8b', script: { summary: 'Évasion héroïque de la cage devant le Chef Tribal.', finish: { winner: 'player', method: 'escape' }, beats: ['whip_hazard', 'comeback', 'heat'] }, title: 'Main event : la Lignée en cage', type: 'cage', teamSize: 1, enemies: [{ id: 'ronan_rains', boost: { hp: 20, stats: 1 } }], directives: ['escape', 'heat'], reward: { money: 1800, fans: 700 },
          desc: 'Un contre un dans la cage contre le Chef Tribal. Reconnaissez-le… ou évadez-vous.' },
      ],
    },
  ],
};

export const EXHIBITION_TYPES = ['singles', 'tag', 'hardcore', 'battle_royal', 'ladder', 'cage', 'showdown'];
