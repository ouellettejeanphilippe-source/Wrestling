// Catalogue des mouvements.
// tier : 'base' (tout le monde) | 'class' (classe) | 'specialty' (spécialité) | 'signature' | 'finisher'
// type : strike | grapple | aerial | submission | taunt | weapon
// stat : str | agi | tec (stat d'attaque) ; power / acc ; range [min,max] ; cost = momentum requis
// requires : { turnbuckle, attackerOnRope, targetDown, targetOnRope, targetDazed, targetNearTable, weapon }
// effects : { daze, push, welt, listed, drainMomentum, heat, selfMomentum, ignoreDef, selfDamageOnMiss, breakTable, illegal, charge }
export const MOVES = {
  // ---- Base ---------------------------------------------------------------
  punch: { tier: 'base', name: 'Coup de poing', type: 'strike', stat: 'str', power: 7, acc: 95, range: [1, 1], momentum: 10, desc: 'Un bon vieux coup. Fiable.' },
  grapple: { tier: 'base', name: 'Prise de base', type: 'grapple', stat: 'str', power: 10, acc: 85, range: [1, 1], momentum: 12, desc: 'Une prise simple mais efficace.' },
  taunt: { tier: 'base', name: 'Provoquer', type: 'taunt', range: [0, 0], momentum: 30, desc: '+30 momentum, chauffe la foule. Effets bonus selon le gimmick.' },
  whip: { tier: 'base', name: 'Irish Whip', type: 'special', stat: 'str', acc: 90, range: [1, 1], momentum: 5, desc: "Projette l'adversaire 2 cases. Cordes = étourdi, coin/marches/table = gros dégâts." },

  // ---- Classe : Force (powerhouse) -----------------------------------------
  bodyslam: { tier: 'class', name: 'Body Slam', type: 'grapple', stat: 'str', power: 13, acc: 80, range: [1, 1], momentum: 15, desc: 'Soulève et écrase.' },
  clothesline: { tier: 'class', name: 'Clothesline', type: 'strike', stat: 'str', power: 10, acc: 85, range: [1, 1], momentum: 12, effects: { daze: 1 }, desc: 'Étourdit la cible 1 tour.' },
  powerbomb: { tier: 'class', name: 'Powerbomb', type: 'grapple', stat: 'str', power: 17, acc: 70, range: [1, 1], momentum: 18, desc: 'Puissant mais imprécis.' },

  // ---- Classe : Voltigeur (highflyer) -------------------------------------
  dropkick: { tier: 'class', name: 'Dropkick', type: 'strike', stat: 'agi', power: 9, acc: 85, range: [1, 2], momentum: 12, desc: 'Portée 2. Rapide.' },
  hurricanrana: { tier: 'class', name: 'Hurricanrana', type: 'grapple', stat: 'agi', power: 11, acc: 85, range: [1, 1], momentum: 14, effects: { push: 1 }, desc: 'Repousse la cible d’une case.' },
  moonsault: { tier: 'class', name: 'Moonsault', type: 'aerial', stat: 'agi', power: 18, acc: 70, range: [1, 3], momentum: 20, requires: { turnbuckle: true }, effects: { selfDamageOnMiss: 10 }, desc: 'Depuis un coin. Portée 3, +25 % de dégâts en plongeon. Douloureux si raté.' },

  // ---- Classe : Technicien (technician) -----------------------------------
  suplex: { tier: 'class', name: 'Suplex', type: 'grapple', stat: 'tec', power: 12, acc: 85, range: [1, 1], momentum: 14, desc: 'Propre et efficace.' },
  ddt: { tier: 'class', name: 'DDT', type: 'grapple', stat: 'tec', power: 13, acc: 80, range: [1, 1], momentum: 14, effects: { daze: 1 }, desc: 'Étourdit la cible.' },
  armbar: { tier: 'class', name: 'Clé de bras', type: 'submission', stat: 'tec', power: 8, acc: 85, range: [1, 1], momentum: 14, desc: 'Soumission : peut faire abandonner une cible affaiblie. Rope break si près des cordes.' },

  // ---- Classe : Bagarreur (brawler) ---------------------------------------
  haymaker: { tier: 'class', name: 'Haymaker', type: 'strike', stat: 'str', power: 12, acc: 85, range: [1, 1], momentum: 12, desc: 'Un crochet dévastateur.' },
  chop: { tier: 'class', name: 'Chop', type: 'strike', stat: 'str', power: 9, acc: 90, range: [1, 1], momentum: 14, effects: { welt: 2 }, desc: 'WOOO ! Laisse deux marques : -1 DEF chacune, cumulables (max 4).' },
  headbutt: { tier: 'class', name: 'Coup de tête', type: 'strike', stat: 'str', power: 14, acc: 90, range: [1, 1], momentum: 12, effects: { selfDamage: 2 }, desc: 'Fait mal aux deux.' },

  // ---- Classe : Vedette (showman) -----------------------------------------
  pose: { tier: 'class', name: 'Pose de champion', type: 'taunt', range: [0, 0], momentum: 40, effects: { heat: 10 }, desc: '+40 momentum et +10 chaleur.' },
  eyepoke: { tier: 'class', name: 'Doigt dans l’œil', type: 'strike', stat: 'tec', power: 7, acc: 100, range: [1, 1], momentum: 8, effects: { daze: 1 }, desc: 'Ne rate jamais et étourdit toujours. Prépare l’Elbow Drop.' },
  elbowdrop: { tier: 'class', name: 'Elbow Drop', type: 'strike', stat: 'str', power: 15, acc: 100, range: [1, 1], momentum: 15, requires: { targetDownOrDazed: true }, effects: { heat: 5 }, desc: 'Sur une cible au sol ou étourdie. Ne rate jamais.' },

  // ---- Spécialité : Aérien -------------------------------------------------
  crossbody: { tier: 'specialty', name: 'Crossbody', type: 'aerial', stat: 'agi', power: 12, acc: 80, range: [1, 3], momentum: 15, requires: { turnbuckle: true }, desc: 'Plongeon depuis un coin, portée 3.' },
  springboard: { tier: 'specialty', name: 'Springboard Kick', type: 'strike', stat: 'agi', power: 12, acc: 85, range: [1, 2], momentum: 14, requires: { attackerOnRope: true }, desc: 'Depuis les cordes, portée 2.' },

  // ---- Spécialité : Soumission --------------------------------------------
  sleeper: { tier: 'specialty', name: 'Sleeper Hold', type: 'submission', stat: 'tec', power: 7, acc: 90, range: [1, 1], momentum: 12, desc: 'Soumission fiable.' },
  anklelock: { tier: 'specialty', name: 'Ankle Lock', type: 'submission', stat: 'tec', power: 10, acc: 80, range: [1, 1], momentum: 15, effects: { tapBonus: 0.15 }, desc: 'Soumission avec bonus d’abandon.' },

  // ---- Spécialité : Hardcore ----------------------------------------------
  tablespot: { tier: 'specialty', name: 'Passage à travers la table', type: 'grapple', stat: 'str', power: 20, acc: 80, range: [1, 1], momentum: 25, requires: { targetNearTable: true }, effects: { breakTable: true, heat: 20 }, desc: 'La cible doit être adjacente à une table. Gros dégâts, la table casse.' },
  senton: { tier: 'specialty', name: 'Running Senton', type: 'grapple', stat: 'str', power: 13, acc: 85, range: [1, 1], momentum: 14, effects: { selfDamage: 2 }, desc: 'Tout le poids du corps.' },

  // ---- Spécialité : Frappeur ----------------------------------------------
  roundhouse: { tier: 'specialty', name: 'Coup de pied retourné', type: 'strike', stat: 'agi', power: 11, acc: 85, range: [1, 1], momentum: 12, effects: { daze: 1 }, desc: 'Étourdit.' },
  kneestrike: { tier: 'specialty', name: 'Coup de genou', type: 'strike', stat: 'str', power: 14, acc: 80, range: [1, 1], momentum: 14, desc: 'Direct au menton.' },

  // ---- Spécialité : Tricheur ----------------------------------------------
  lowblow: { tier: 'specialty', name: 'Coup bas', type: 'strike', stat: 'tec', power: 12, acc: 95, range: [1, 1], momentum: 10, effects: { daze: 1, illegal: true }, desc: 'Illégal : risque de DQ si l’arbitre regarde. Étourdit.' },
  distract: { tier: 'specialty', name: 'Distraire l’arbitre', type: 'taunt', range: [0, 0], momentum: 10, effects: { distractRef: 2 }, desc: 'L’arbitre ne voit rien pendant 2 tours (armes et coups illégaux sans risque).' },

  // ---- Spécialité : Colosse -----------------------------------------------
  chokeslam: { tier: 'specialty', name: 'Chokeslam', type: 'grapple', stat: 'str', power: 16, acc: 75, range: [1, 1], momentum: 16, desc: 'Par la gorge, jusqu’au tapis.' },
  bigboot: { tier: 'specialty', name: 'Big Boot', type: 'strike', stat: 'str', power: 11, acc: 80, range: [1, 1], momentum: 12, effects: { push: 1 }, desc: 'Repousse d’une case.' },

  // ---- Spécialité : Vitesse -----------------------------------------------
  baseballslide: { tier: 'specialty', name: 'Baseball Slide', type: 'strike', stat: 'agi', power: 8, acc: 90, range: [2, 2], momentum: 10, effects: { push: 1 }, desc: 'Portée exacte 2, repousse.' },
  dive: { tier: 'specialty', name: 'Suicide Dive', type: 'aerial', stat: 'agi', power: 14, acc: 80, range: [1, 2], momentum: 16, requires: { attackerOnRope: true }, effects: { selfDamageOnMiss: 8 }, desc: 'Depuis les cordes vers l’extérieur ou l’intérieur.' },

  // ---- Spécialité : Micro -------------------------------------------------
  promo: { tier: 'specialty', name: 'Promo', type: 'taunt', range: [0, 0], momentum: 20, effects: { allyMomentum: 20, heat: 8 }, desc: '+20 momentum pour vous et vos alliés à 2 cases.' },
  insult: { tier: 'specialty', name: 'Insulte', type: 'special', range: [1, 3], momentum: 10, effects: { drainMomentum: 25 }, desc: 'La cible perd 25 momentum. Portée 3.' },

  // ---- Signatures & finishers (par lutteur) --------------------------------
  superman_punch: { tier: 'signature', name: 'Superman Punch', type: 'strike', stat: 'str', power: 14, acc: 85, range: [1, 2], momentum: 15 },
  spear: { tier: 'finisher', name: 'Spear', type: 'grapple', stat: 'str', power: 24, acc: 85, range: [1, 1], effects: { charge: true }, desc: '+8 dégâts si vous avez bougé d’au moins 3 cases ce tour.' },
  five_knuckle: { tier: 'signature', name: 'Five Knuckle Shuffle', type: 'strike', stat: 'str', power: 10, acc: 100, range: [1, 1], requires: { targetDownOrDazed: true }, effects: { selfMomentum: 40, heat: 10 }, desc: 'Sur une cible au sol. Tu peux pas le voir. +40 momentum.' },
  attitude_adjustment: { tier: 'finisher', name: 'Attitude Adjustment', type: 'grapple', stat: 'str', power: 22, acc: 85, range: [1, 1] },
  old_school: { tier: 'signature', name: 'Old School', type: 'aerial', stat: 'str', power: 14, acc: 80, range: [1, 2], requires: { turnbuckle: true } },
  tombstone: { tier: 'finisher', name: 'Tombstone Piledriver', type: 'grapple', stat: 'str', power: 23, acc: 80, range: [1, 1], effects: { finishedBonus: 0.15 }, desc: 'Le tombé qui suit est presque garanti.' },
  draping_ddt: { tier: 'signature', name: 'DDT suspendu', type: 'grapple', stat: 'tec', power: 15, acc: 85, range: [1, 1], requires: { targetOnRope: true }, effects: { daze: 1 }, desc: 'La cible doit être sur les cordes.' },
  rko: { tier: 'finisher', name: 'RKO', type: 'grapple', stat: 'tec', power: 22, acc: 90, range: [1, 1] },
  thesz_press: { tier: 'signature', name: 'Lou Thesz Press', type: 'strike', stat: 'str', power: 13, acc: 90, range: [1, 1], effects: { daze: 1 } },
  stunner: { tier: 'finisher', name: 'Stunner', type: 'grapple', stat: 'str', power: 21, acc: 90, range: [1, 1], effects: { daze: 1 } },
  rock_bottom: { tier: 'signature', name: 'Rock Bottom', type: 'grapple', stat: 'str', power: 18, acc: 85, range: [1, 1] },
  peoples_elbow: { tier: 'finisher', name: 'Coude du Peuple', type: 'strike', stat: 'str', power: 20, acc: 100, range: [1, 1], requires: { targetDownOrDazed: true }, effects: { heat: 30 }, desc: 'Le mouvement le plus électrisant du divertissement sportif. Sur cible au sol ou étourdie.' },
  hulk_boot: { tier: 'signature', name: 'Big Boot du Hulkster', type: 'strike', stat: 'str', power: 15, acc: 85, range: [1, 1], effects: { daze: 1 } },
  legdrop: { tier: 'finisher', name: 'Leg Drop atomique', type: 'strike', stat: 'str', power: 20, acc: 100, range: [1, 1], requires: { targetDownOrDazed: true }, effects: { heat: 15 } },
  v_trigger: { tier: 'signature', name: 'V-Trigger', type: 'strike', stat: 'agi', power: 15, acc: 85, range: [1, 2], effects: { daze: 1 } },
  one_winged_angel: { tier: 'finisher', name: 'Ange à Une Aile', type: 'grapple', stat: 'tec', power: 25, acc: 80, range: [1, 1] },
  salt_of_earth: { tier: 'signature', name: 'Sel de la Terre', type: 'submission', stat: 'tec', power: 10, acc: 85, range: [1, 1], effects: { tapBonus: 0.1 } },
  heatseeker: { tier: 'finisher', name: 'Heatseeker', type: 'grapple', stat: 'tec', power: 21, acc: 85, range: [1, 1] },
  sloth_kick: { tier: 'signature', name: 'Petits coups de pied paresseux', type: 'strike', stat: 'agi', power: 1, acc: 100, range: [1, 1], unlock: 0, cost: 0, effects: { selfMomentum: 25, heat: 8 }, desc: '1 dégât. +25 momentum. La foule adore.' },
  orange_punch: { tier: 'finisher', name: 'Orange Punch', type: 'strike', stat: 'str', power: 20, acc: 90, range: [1, 1] },
  cody_cutter: { tier: 'signature', name: 'Cody Cutter', type: 'grapple', stat: 'agi', power: 15, acc: 85, range: [1, 1] },
  cross_roads: { tier: 'finisher', name: 'Cross Roads', type: 'grapple', stat: 'tec', power: 22, acc: 85, range: [1, 1] },
  teeth: { tier: 'signature', name: 'Dents dans la bouche', type: 'strike', stat: 'tec', power: 6, acc: 100, range: [1, 1], unlock: 40, cost: 20, effects: { daze: 2, heat: 8 }, desc: 'Étourdit 2 tours. Très gentil. Très méchant.' },
  very_evil_ddt: { tier: 'finisher', name: 'DDT très méchant', type: 'grapple', stat: 'tec', power: 18, acc: 85, range: [1, 1] },
  derby_crossbody: { tier: 'signature', name: 'Crossbody suicidaire', type: 'aerial', stat: 'agi', power: 16, acc: 80, range: [1, 3], requires: { turnbuckle: true } },
  coffin_drop: { tier: 'finisher', name: 'Coffin Drop', type: 'aerial', stat: 'agi', power: 24, acc: 75, range: [1, 3], requires: { turnbuckle: true }, effects: { selfDamage: 8, selfDamageOnMiss: 15 } },
  prism_trap: { tier: 'signature', name: 'Prism Trap', type: 'submission', stat: 'tec', power: 11, acc: 85, range: [1, 1] },
  riptide: { tier: 'finisher', name: 'Riptide', type: 'grapple', stat: 'str', power: 23, acc: 85, range: [1, 1] },
  stinger_splash: { tier: 'signature', name: 'Stinger Splash', type: 'strike', stat: 'agi', power: 14, acc: 85, range: [1, 2], requires: { targetDazedOrCorner: true }, desc: 'Cible étourdie ou dans un coin.' },
  scorpion_death_drop: { tier: 'finisher', name: 'Scorpion Death Drop', type: 'grapple', stat: 'str', power: 21, acc: 85, range: [1, 1] },
  walls: { tier: 'signature', name: 'Murs de Jerico', type: 'submission', stat: 'tec', power: 13, acc: 85, range: [1, 1] },
  judas_effect: { tier: 'finisher', name: 'Effet Judas', type: 'strike', stat: 'str', power: 21, acc: 90, range: [1, 1], effects: { daze: 1 } },
  paradigm_shift: { tier: 'signature', name: 'Paradigm Shift', type: 'grapple', stat: 'tec', power: 16, acc: 85, range: [1, 1] },
  death_rider: { tier: 'finisher', name: 'Death Rider', type: 'grapple', stat: 'str', power: 22, acc: 85, range: [1, 1] },
  general_sleeper: { tier: 'signature', name: 'Sleeper du Général', type: 'submission', stat: 'tec', power: 10, acc: 85, range: [1, 1] },
  imperial_powerbomb: { tier: 'finisher', name: 'Powerbomb Impériale', type: 'grapple', stat: 'str', power: 25, acc: 80, range: [1, 1] },
  buckle_bomb: { tier: 'signature', name: 'Buckle Bomb', type: 'grapple', stat: 'str', power: 15, acc: 80, range: [1, 1], effects: { push: 2, daze: 1 }, desc: 'Projette 2 cases (idéal vers un coin) et étourdit.' },
  stomp: { tier: 'finisher', name: 'Le Stomp', type: 'strike', stat: 'agi', power: 22, acc: 95, range: [1, 1], requires: { targetDownOrDazed: true } },
  oscutter: { tier: 'signature', name: 'Oscutter', type: 'grapple', stat: 'agi', power: 15, acc: 85, range: [1, 2] },
  hidden_blade: { tier: 'finisher', name: 'Lame Cachée', type: 'strike', stat: 'str', power: 20, acc: 90, range: [1, 1], effects: { ignoreDef: 0.5 }, desc: 'Ignore 50 % de la DEF.' },
  swerve_stomp: { tier: 'signature', name: 'Swerve Stomp', type: 'aerial', stat: 'agi', power: 16, acc: 80, range: [1, 3], requires: { turnbuckle: true } },
  house_call: { tier: 'finisher', name: 'House Call', type: 'strike', stat: 'agi', power: 22, acc: 95, range: [1, 1], requires: { targetDownOrDazed: true } },
  hip_attack: { tier: 'signature', name: 'Hip Attack', type: 'strike', stat: 'str', power: 13, acc: 90, range: [1, 1], unlock: 50, cost: 30, effects: { push: 1, heat: 5 } },
  storm_zero: { tier: 'finisher', name: 'Storm Zero', type: 'grapple', stat: 'tec', power: 22, acc: 85, range: [1, 1] },
  lucky_punch: { tier: 'signature', name: 'Coup chanceux', type: 'strike', stat: 'str', power: 12, acc: 80, range: [1, 1], unlock: 50, cost: 30, effects: { daze: 1 } },
  frog_splash: { tier: 'finisher', name: 'Frog Splash', type: 'aerial', stat: 'agi', power: 24, acc: 85, range: [1, 3], requires: { turnbuckle: true, targetDownOrDazed: true } },
  anaconda: { tier: 'signature', name: 'Anaconda Vise', type: 'submission', stat: 'tec', power: 12, acc: 85, range: [1, 1] },
  gts: { tier: 'finisher', name: 'Go To Sleep', type: 'grapple', stat: 'str', power: 22, acc: 85, range: [1, 1], effects: { daze: 1 } },
  colossal_chop: { tier: 'signature', name: 'Chop colossal', type: 'strike', stat: 'str', power: 16, acc: 85, range: [1, 1], effects: { welt: 2 } },
  ko_punch: { tier: 'finisher', name: 'Poing K.-O.', type: 'strike', stat: 'str', power: 26, acc: 80, range: [1, 1], effects: { daze: 1 } },
  busaiku_knee: { tier: 'signature', name: 'Genou Busaiku', type: 'strike', stat: 'agi', power: 16, acc: 85, range: [1, 2] },
  lebell_lock: { tier: 'finisher', name: 'LeBell Lock', type: 'submission', stat: 'tec', power: 18, acc: 85, range: [1, 1], effects: { tapBonus: 0.25 } },
  disarmher: { tier: 'signature', name: 'Dis-arm-her', type: 'submission', stat: 'tec', power: 12, acc: 85, range: [1, 1], effects: { tapBonus: 0.1 } },
  manhandle_slam: { tier: 'finisher', name: 'Manhandle Slam', type: 'grapple', stat: 'str', power: 21, acc: 85, range: [1, 1] },
  mandible_claw: { tier: 'signature', name: 'Griffe mandibulaire', type: 'submission', stat: 'tec', power: 11, acc: 85, range: [1, 1] },
  sister_abigail: { tier: 'finisher', name: 'Sister Abigail', type: 'grapple', stat: 'str', power: 22, acc: 85, range: [1, 1] },
  buckshot: { tier: 'signature', name: 'Buckshot Lariat', type: 'strike', stat: 'str', power: 17, acc: 85, range: [1, 2], requires: { attackerOnRope: true }, desc: 'Depuis les cordes (slingshot).' },
  deadeye: { tier: 'finisher', name: 'Deadeye', type: 'grapple', stat: 'tec', power: 22, acc: 85, range: [1, 1] },
  six_one_nine: { tier: 'signature', name: '619', type: 'strike', stat: 'agi', power: 16, acc: 90, range: [1, 2], requires: { targetOnRope: true }, effects: { daze: 1 }, desc: 'La cible doit être sur les cordes.' },
  west_coast_pop: { tier: 'finisher', name: 'West Coast Pop', type: 'aerial', stat: 'agi', power: 20, acc: 80, range: [1, 3], requires: { turnbuckle: true } },
  jobber_dropkick: { tier: 'signature', name: 'Dropkick d’espoir', type: 'strike', stat: 'agi', power: 10, acc: 85, range: [1, 1] },
  jobber_finisher: { tier: 'finisher', name: 'Roll-up désespéré', type: 'grapple', stat: 'tec', power: 14, acc: 85, range: [1, 1] },
  invader_strike: { tier: 'signature', name: 'Coup de batte', type: 'strike', stat: 'str', power: 15, acc: 85, range: [1, 1], effects: { daze: 1 } },
  invader_finisher: { tier: 'finisher', name: 'Bombe du Chaos', type: 'grapple', stat: 'str', power: 20, acc: 85, range: [1, 1] },
};

export const MOVE_TIER_LABEL = { base: 'Base', class: 'Classe', specialty: 'Spécialité', signature: 'Signature', finisher: 'Finisher' };

// Échelle de momentum : chaque palier se débloque à un seuil et coûte du momentum à l'usage.
// Les provocations (type taunt) sont toujours gratuites. Un mouvement peut surcharger unlock / cost.
export const MOVE_TIERS = {
  base: { unlock: 0, cost: 0 },
  class: { unlock: 25, cost: 0 },
  specialty: { unlock: 45, cost: 0 },
  signature: { unlock: 60, cost: 40 },
  finisher: { unlock: 100, cost: 100 },
};
export function moveUnlock(m) { return m.type === 'taunt' ? 0 : (m.unlock ?? (MOVE_TIERS[m.tier] || MOVE_TIERS.base).unlock); }
export function moveCost(m) { return m.type === 'taunt' ? 0 : (m.cost ?? (MOVE_TIERS[m.tier] || MOVE_TIERS.base).cost); }
