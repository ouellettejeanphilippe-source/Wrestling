// Classes (style de lutte) : stats de base et mouvements de classe.
export const CLASSES = {
  powerhouse: { name: 'Force', icon: '💪', desc: 'Gros dégâts, encaisse bien, lent.', moves: ['bodyslam', 'clothesline', 'powerbomb', 'shoulder_block', 'gut_wrench'], base: { hp: 120, str: 11, agi: 4, tec: 5, cha: 7, def: 8, mov: 3 } },
  highflyer: { name: 'Voltigeur', icon: '🪽', desc: 'Rapide, esquive, plonge depuis les coins. Fragile.', moves: ['dropkick', 'hurricanrana', 'moonsault', 'rebound_clothesline', 'arm_drag'], base: { hp: 85, str: 5, agi: 12, tec: 7, cha: 8, def: 4, mov: 5 } },
  technician: { name: 'Technicien', icon: '🧠', desc: 'Précis, critiques, soumissions.', moves: ['suplex', 'ddt', 'armbar', 'headlock_takeover', 'chinlock'], base: { hp: 100, str: 7, agi: 7, tec: 12, cha: 5, def: 7, mov: 4 } },
  brawler: { name: 'Bagarreur', icon: '🥊', desc: 'Frappe fort, aime les armes, endurant.', moves: ['haymaker', 'chop', 'headbutt', 'lariat_run', 'back_rake'], base: { hp: 110, str: 9, agi: 5, tec: 4, cha: 7, def: 6, mov: 4 } },
  showman: { name: 'Vedette', icon: '🎤', desc: 'Génère momentum et chaleur, coups fourbes.', moves: ['pose', 'eyepoke', 'elbowdrop', 'irish_reversal', 'snapmare'], base: { hp: 95, str: 7, agi: 7, tec: 6, cha: 12, def: 5, mov: 4 } },
};

// Spécialités : deuxième jeu de mouvements. Chaque liste s'est allongée —
// un long match épuise un kit de trois coups, et la variété est ce qui empêche
// de matraquer le même bouton quinze tours de suite.
export const SPECIALTIES = {
  aerial: { name: 'Aérien', icon: '🦅', desc: 'Plongeons depuis les coins et les cordes.', moves: ['crossbody', 'springboard', 'springboard_dropkick', 'diving_headbutt'] },
  submission: { name: 'Soumission', icon: '🔗', desc: 'Fait abandonner les adversaires affaiblis.', moves: ['sleeper', 'anklelock', 'chinlock', 'headlock_takeover'] },
  hardcore: { name: 'Hardcore', icon: '🪑', desc: 'Tables et douleur.', moves: ['tablespot', 'senton', 'double_stomp', 'back_rake'] },
  striker: { name: 'Frappeur', icon: '🦵', desc: 'Coups précis qui étourdissent.', moves: ['roundhouse', 'kneestrike', 'running_knee', 'irish_reversal'] },
  cheater: { name: 'Tricheur', icon: '😈', desc: 'Coups bas et arbitre distrait.', moves: ['lowblow', 'distract', 'back_rake', 'snapmare'] },
  giant: { name: 'Colosse', icon: '🗿', desc: 'Chokeslam et bottes.', moves: ['chokeslam', 'bigboot', 'shoulder_block', 'avalanche'] },
  speed: { name: 'Vitesse', icon: '⚡', desc: 'Attaques à distance et plongeons vers l’extérieur.', moves: ['baseballslide', 'dive', 'slingshot_senton', 'running_knee'] },
  mic: { name: 'Micro', icon: '📣', desc: 'Promos qui gonflent l’équipe et rabaissent l’adversaire.', moves: ['promo', 'insult', 'snapmare', 'running_elbow'] },
};
