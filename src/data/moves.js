// Catalogue des mouvements.
// tier : 'base' (tout le monde) | 'class' (classe) | 'specialty' (spécialité) | 'signature' | 'finisher'
// type : strike | grapple | aerial | submission | taunt | weapon
// stat : str | agi | tec (stat d'attaque) ; power / acc ; range [min,max] ; cost = momentum requis
// part : la partie du corps que le mouvement TRAVAILLE — 'head' | 'arms' | 'torso' | 'legs'.
//        Omis, elle se déduit du type (frappe → tête, prise/aérien → torse, soumission → bras).
//        C'est le champ qui rend l'usure ciblée jouable : dix tours sur la jambe,
//        et la clé de jambe finit le match.
// requires : { turnbuckle, attackerOnRope, targetDown, targetOnRope, targetDazed, targetNearTable, weapon,
//              ran: n (avoir couru n cases CE TOUR — le mouvement n'existe pas
//              à l'arrêt), crossedRope (avoir traversé les cordes en chemin) }
// effects : { daze, push, welt, listed, drainMomentum, heat, selfMomentum, ignoreDef, selfDamageOnMiss, breakTable, illegal, charge }
//           portée élargie — line: n (le coup continue tout droit derrière la
//           cible), splash: f (les voisins prennent la fraction f), push: n
//           (la cible recule). Ces trois-là font du PLACEMENT une question
//           défensive : rester aligné ou agglutiné coûte cher.
//           pull: n — l'inverse du recul : arrache la cible de sa position.
export const MOVES = {
  // ---- Base ---------------------------------------------------------------
  punch: { tier: 'base', name: 'Coup de poing', type: 'strike', stat: 'str', power: 7, acc: 95, range: [1, 1], momentum: 10, desc: 'Un bon vieux coup. Fiable.' },
  grapple: { tier: 'base', name: 'Prise de base', type: 'grapple', stat: 'str', power: 10, acc: 85, range: [1, 1], momentum: 12, desc: 'Une prise simple mais efficace.' },
  taunt: { tier: 'base', name: 'Provoquer', type: 'taunt', range: [0, 0], momentum: 30, desc: '+30 momentum, chauffe la foule. Effets bonus selon le gimmick.' },
  whip: { tier: 'base', name: 'Irish Whip', type: 'special', stat: 'str', acc: 90, range: [1, 1], momentum: 5, desc: "Projette l'adversaire 2 cases. Cordes = étourdi, coin/marches/table = gros dégâts." },

  // ---- La course ----------------------------------------------------------
  // Ces mouvements n'existent pas à l'arrêt : `ran` est un interrupteur, pas
  // un bonus. C'est la moitié du vocabulaire du catch qui ne s'ouvre qu'en
  // mouvement — et le meilleur remède contre deux lutteurs qui se tapent
  // dessus sans bouger.
  running_elbow: { tier: 'base', name: 'Coude en course', type: 'strike', stat: 'str', power: 9, acc: 90, range: [1, 1], momentum: 12, requires: { ran: 2 }, effects: { push: 1 }, desc: 'Après deux cases de course. Repousse.' },
  shoulder_block: { tier: 'class', name: 'Épaule en course', type: 'strike', stat: 'str', power: 12, acc: 88, range: [1, 1], momentum: 14, requires: { ran: 3 }, effects: { push: 2, line: 1 }, desc: 'Après trois cases. Traverse ce qui est aligné et projette de deux cases.' },
  running_knee: { tier: 'specialty', name: 'Genou sauté', type: 'strike', stat: 'agi', power: 14, acc: 85, range: [1, 1], momentum: 15, requires: { ran: 3 }, effects: { daze: 1 }, desc: 'Après trois cases. Étourdit.' },
  lariat_run: { tier: 'specialty', name: 'Lariat lancé', type: 'strike', stat: 'str', power: 16, acc: 80, range: [1, 1], momentum: 16, requires: { ran: 4 }, effects: { daze: 1, push: 1, line: 1 }, desc: 'Pleine course. Retourne tout ce qui est sur la trajectoire.' },
  dropdown: { tier: 'base', name: 'Se coucher au passage', type: 'special', stat: 'agi', acc: 95, range: [1, 1], momentum: 14, requires: { ran: 2 }, desc: 'On se laisse tomber pour que l’autre saute par-dessus : vole son momentum.', effects: { drainMomentum: 20 } },

  // ---- Les cordes : rebond et tremplin ------------------------------------
  rebound_clothesline: { tier: 'class', name: 'Clothesline de rebond', type: 'strike', stat: 'str', power: 14, acc: 85, range: [1, 1], momentum: 16, requires: { crossedRope: true }, effects: { daze: 1, push: 1 }, desc: 'Il faut avoir traversé les cordes en chemin. Le rebond du catch télévisé.' },
  springboard_dropkick: { tier: 'specialty', name: 'Dropkick springboard', type: 'aerial', stat: 'agi', power: 15, acc: 82, range: [1, 2], momentum: 16, requires: { crossedRope: true }, effects: { push: 2 }, desc: 'Appui dans les cordes, puis dropkick. Projette de deux cases.' },
  slingshot_senton: { tier: 'specialty', name: 'Senton slingshot', type: 'aerial', stat: 'agi', power: 16, acc: 80, range: [1, 2], momentum: 17, requires: { attackerOnRope: true }, effects: { splash: 0.5 }, desc: 'Depuis les cordes, par-dessus : retombe sur le tas.' },
  rope_walk: { tier: 'signature', name: 'Marche sur la corde', type: 'aerial', stat: 'agi', power: 19, acc: 78, range: [1, 3], unlock: 50, cost: 25, requires: { attackerOnRope: true }, effects: { daze: 1 }, desc: 'On marche sur la corde du haut avant de sauter. Portée 3.' },

  // ---- Du haut du coin ----------------------------------------------------
  diving_headbutt: { tier: 'specialty', name: 'Coup de tête plongeant', type: 'aerial', stat: 'str', power: 17, acc: 75, range: [1, 3], momentum: 18, requires: { turnbuckle: true }, effects: { selfDamage: 4, daze: 1 }, desc: 'Depuis le coin. Fait mal aux deux.' },
  double_stomp: { tier: 'specialty', name: 'Double stomp', type: 'aerial', stat: 'agi', power: 16, acc: 80, range: [1, 3], momentum: 16, requires: { turnbuckle: true, targetDownOrDazed: true }, desc: 'Depuis le coin, sur une cible au sol ou sonnée.' },
  super_plex: { tier: 'signature', name: 'Superplex', type: 'grapple', part: 'head', stat: 'str', power: 22, acc: 78, range: [1, 1], unlock: 55, cost: 30, requires: { targetOnRope: true }, effects: { daze: 1, pull: 1 }, desc: 'Cueille l’adversaire sur les cordes et l’arrache jusqu’au tapis.' },
  avalanche: { tier: 'signature', name: 'Avalanche du coin', type: 'grapple', stat: 'str', power: 21, acc: 75, range: [1, 1], unlock: 55, cost: 30, requires: { turnbuckle: true }, effects: { splash: 0.4, daze: 1 }, desc: 'Tout le poids depuis le coin. Les voisins dégustent.' },

  // ---- Par-dessus la troisième corde --------------------------------------
  tope_con_hilo: { tier: 'signature', name: 'Tope con hilo', type: 'aerial', stat: 'agi', power: 20, acc: 75, range: [1, 3], unlock: 55, cost: 30, requires: { attackerOnRope: true }, effects: { splash: 0.5, selfDamageOnMiss: 10 }, desc: 'Par-dessus la corde, en vrille. Tout le monde en dessous déguste.' },
  asai_moonsault: { tier: 'signature', name: 'Moonsault Asai', type: 'aerial', stat: 'agi', power: 19, acc: 75, range: [1, 3], unlock: 50, cost: 25, requires: { attackerOnRope: true }, effects: { selfDamageOnMiss: 8, daze: 1 }, desc: 'Dos aux cordes, salto arrière vers l’extérieur.' },

  // ---- Reprendre la position ----------------------------------------------
  arm_drag: { tier: 'class', name: 'Arm drag', type: 'grapple', stat: 'tec', power: 9, acc: 90, range: [1, 1], momentum: 13, effects: { pull: 1 }, desc: 'Arrache l’adversaire de sa position et le ramène vers vous.' },
  snapmare: { tier: 'base', name: 'Snapmare', type: 'grapple', stat: 'tec', power: 8, acc: 92, range: [1, 1], momentum: 11, effects: { pull: 1 }, desc: 'Roulé d’épaule : ramène la cible devant vous et l’assoit.' },
  headlock_takeover: { tier: 'class', name: 'Prise de tête au sol', type: 'grapple', stat: 'tec', power: 11, acc: 88, range: [1, 1], momentum: 13, effects: { pull: 1, daze: 1 }, desc: 'Emmène la cible au tapis avec vous.' },
  irish_reversal: { tier: 'specialty', name: 'Renversement d’Irish Whip', type: 'strike', stat: 'tec', power: 10, acc: 88, range: [1, 1], momentum: 14, requires: { ran: 2 }, effects: { push: 2, daze: 1 }, desc: 'Après une course : on inverse l’élan de l’autre et on l’envoie voler.' },

  // ---- Usure : le corps du match ------------------------------------------
  // Des coups modestes qui font durer plutôt que finir : un long match a
  // besoin de marquer, d’user, de reprendre son souffle.
  stomp_away: { tier: 'base', name: 'Piétiner', type: 'strike', part: 'torso', stat: 'str', power: 6, acc: 95, range: [1, 1], momentum: 9, requires: { targetDown: true }, effects: { welt: 1 }, desc: 'Sur une cible au sol. Peu de dégâts, beaucoup de marques.' },
  knee_drop: { tier: 'base', name: 'Genou sur le crâne', type: 'strike', part: 'head', stat: 'str', power: 8, acc: 90, range: [1, 1], momentum: 10, requires: { targetDown: true }, desc: 'Classique, efficace, sans gloire.' },
  chinlock: { tier: 'class', name: 'Chinlock', type: 'submission', part: 'head', stat: 'tec', power: 6, acc: 92, range: [1, 1], momentum: 12, effects: { drainMomentum: 12 }, desc: 'La prise de repos : use l’adversaire et lui vide la jauge.' },
  gut_wrench: { tier: 'specialty', name: 'Gutwrench', type: 'grapple', part: 'torso', stat: 'str', power: 12, acc: 85, range: [1, 1], momentum: 13, effects: { welt: 1 }, desc: 'Soulève par le ventre. Marque les côtes.' },
  back_rake: { tier: 'specialty', name: 'Griffure du dos', type: 'strike', part: 'torso', stat: 'str', power: 5, acc: 95, range: [1, 1], momentum: 10, effects: { welt: 2, heat: 4 }, desc: 'Sale, bruyant, et ça marque.' },

  // ---- Travailler un membre -----------------------------------------------
  // Peu de dégâts, beaucoup d'usure sur UNE partie du corps. Ce sont les coups
  // qui font tenir un match trente tours : ils ne finissent rien, ils
  // préparent tout. `chop_block` et `arm_wringer` sont dans le kit de base
  // pour que travailler un membre soit à la portée de n'importe qui, pas
  // seulement des spécialistes de la soumission.
  chop_block: { tier: 'base', name: 'Coup dans le genou', type: 'strike', stat: 'str', power: 6, acc: 95, range: [1, 1], momentum: 10, part: 'legs', effects: { wear: 9 }, desc: 'Peu de dégâts, beaucoup d’usure : la jambe commence à lâcher.' },
  arm_wringer: { tier: 'base', name: 'Clé de poignet', type: 'grapple', stat: 'tec', power: 6, acc: 94, range: [1, 1], momentum: 10, part: 'arms', effects: { wear: 9 }, desc: 'On tord le bras et on ne lâche plus. Use le bras.' },
  dragon_screw: { tier: 'class', name: 'Dragon Screw', type: 'grapple', stat: 'tec', power: 10, acc: 88, range: [1, 1], momentum: 13, part: 'legs', effects: { wear: 12, pull: 1 }, desc: 'La jambe part en vrille et l’adversaire avec.' },
  neckbreaker: { tier: 'class', name: 'Neckbreaker', type: 'grapple', stat: 'tec', power: 11, acc: 86, range: [1, 1], momentum: 13, part: 'head', effects: { wear: 10 }, desc: 'La nuque sur l’épaule. Use la tête.' },
  rib_breaker: { tier: 'class', name: 'Brise-côtes', type: 'grapple', stat: 'str', power: 11, acc: 86, range: [1, 1], momentum: 13, part: 'torso', effects: { wear: 12, welt: 1 }, desc: 'Le genou dans les côtes : coupe le souffle pour de bon.' },
  shin_breaker: { tier: 'specialty', name: 'Brise-tibia', type: 'grapple', stat: 'str', power: 12, acc: 85, range: [1, 1], momentum: 14, part: 'legs', effects: { wear: 16 }, desc: 'Le tibia sur le genou. Ça ne se remet pas dans un match.' },
  hammerlock: { tier: 'specialty', name: 'Hammerlock', type: 'submission', stat: 'tec', power: 7, acc: 92, range: [1, 1], momentum: 12, part: 'arms', effects: { wear: 14, drainMomentum: 8 }, desc: 'Le bras dans le dos. Use le bras et vide la jauge.' },
  spinning_toe_hold: { tier: 'specialty', name: 'Prise d’orteil tournante', type: 'submission', stat: 'tec', power: 8, acc: 90, range: [1, 1], momentum: 13, part: 'legs', effects: { wear: 16, tapBonus: 0.05 }, desc: 'La prise du territoire : on tourne, on tourne, et la jambe cède.' },

  // ---- Classe : Force (powerhouse) -----------------------------------------
  bodyslam: { tier: 'class', name: 'Body Slam', type: 'grapple', stat: 'str', power: 13, acc: 80, range: [1, 1], momentum: 15, desc: 'Soulève et écrase.' },
  clothesline: { tier: 'class', name: 'Clothesline', type: 'strike', stat: 'str', power: 10, acc: 85, range: [1, 1], momentum: 12, effects: { line: 1, push: 1, daze: 1 }, desc: 'Étourdit, repousse, et traverse : ce qui est aligné derrière encaisse aussi.' },
  powerbomb: { tier: 'class', name: 'Powerbomb', type: 'grapple', stat: 'str', power: 17, acc: 70, range: [1, 1], momentum: 18, desc: 'Puissant mais imprécis.' },

  // ---- Classe : Voltigeur (highflyer) -------------------------------------
  dropkick: { tier: 'class', name: 'Dropkick', type: 'strike', part: 'head', stat: 'agi', power: 9, acc: 85, range: [1, 2], momentum: 12, desc: 'Portée 2. Rapide.' },
  hurricanrana: { tier: 'class', name: 'Hurricanrana', type: 'grapple', stat: 'agi', power: 11, acc: 85, range: [1, 1], momentum: 14, effects: { push: 1 }, desc: 'Repousse la cible d’une case.' },
  moonsault: { tier: 'class', name: 'Moonsault', type: 'aerial', stat: 'agi', power: 18, acc: 70, range: [1, 3], momentum: 20, requires: { turnbuckle: true }, effects: { selfDamageOnMiss: 10 }, desc: 'Depuis un coin. Portée 3, +25 % de dégâts en plongeon. Douloureux si raté.' },

  // ---- Classe : Technicien (technician) -----------------------------------
  suplex: { tier: 'class', name: 'Suplex', type: 'grapple', stat: 'tec', power: 12, acc: 85, range: [1, 1], momentum: 14, desc: 'Propre et efficace.' },
  ddt: { tier: 'class', name: 'DDT', type: 'grapple', part: 'head', stat: 'tec', power: 13, acc: 80, range: [1, 1], momentum: 14, effects: { daze: 1 }, desc: 'Étourdit la cible.' },
  armbar: { tier: 'class', name: 'Clé de bras', type: 'submission', part: 'arms', stat: 'tec', power: 8, acc: 85, range: [1, 1], momentum: 14, desc: 'Soumission : peut faire abandonner une cible affaiblie. Rope break si près des cordes.' },

  // ---- Classe : Bagarreur (brawler) ---------------------------------------
  haymaker: { tier: 'class', name: 'Haymaker', type: 'strike', stat: 'str', power: 12, acc: 85, range: [1, 1], momentum: 12, desc: 'Un crochet dévastateur.' },
  chop: { tier: 'class', name: 'Chop', type: 'strike', part: 'torso', stat: 'str', power: 9, acc: 90, range: [1, 1], momentum: 14, effects: { welt: 2 }, desc: 'WOOO ! Laisse deux marques : -1 DEF chacune, cumulables (max 4).' },
  headbutt: { tier: 'class', name: 'Coup de tête', type: 'strike', part: 'head', stat: 'str', power: 14, acc: 90, range: [1, 1], momentum: 12, effects: { selfDamage: 2 }, desc: 'Fait mal aux deux.' },

  // ---- Classe : Vedette (showman) -----------------------------------------
  pose: { tier: 'class', name: 'Pose de champion', type: 'taunt', range: [0, 0], momentum: 40, effects: { heat: 10 }, desc: '+40 momentum et +10 chaleur.' },
  eyepoke: { tier: 'class', name: 'Doigt dans l’œil', type: 'strike', part: 'head', stat: 'tec', power: 7, acc: 100, range: [1, 1], momentum: 8, effects: { daze: 1 }, desc: 'Ne rate jamais et étourdit toujours. Prépare l’Elbow Drop.' },
  elbowdrop: { tier: 'class', name: 'Elbow Drop', type: 'strike', stat: 'str', power: 15, acc: 100, range: [1, 1], momentum: 15, requires: { targetDownOrDazed: true }, effects: { heat: 5 }, desc: 'Sur une cible au sol ou étourdie. Ne rate jamais.' },

  // ---- Spécialité : Aérien -------------------------------------------------
  crossbody: { tier: 'specialty', name: 'Crossbody', type: 'aerial', stat: 'agi', power: 12, acc: 80, range: [1, 3], momentum: 15, requires: { turnbuckle: true }, desc: 'Plongeon depuis un coin, portée 3.' },
  springboard: { tier: 'specialty', name: 'Springboard Kick', type: 'strike', stat: 'agi', power: 12, acc: 85, range: [1, 2], momentum: 14, requires: { attackerOnRope: true }, desc: 'Depuis les cordes, portée 2.' },

  // ---- Spécialité : Soumission --------------------------------------------
  sleeper: { tier: 'specialty', name: 'Sleeper Hold', type: 'submission', part: 'head', stat: 'tec', power: 7, acc: 90, range: [1, 1], momentum: 12, desc: 'Soumission fiable.' },
  anklelock: { tier: 'specialty', name: 'Ankle Lock', type: 'submission', part: 'legs', stat: 'tec', power: 10, acc: 80, range: [1, 1], momentum: 15, effects: { tapBonus: 0.15 }, desc: 'Soumission avec bonus d’abandon.' },

  // ---- Spécialité : Hardcore ----------------------------------------------
  tablespot: { tier: 'specialty', name: 'Passage à travers la table', type: 'grapple', stat: 'str', power: 20, acc: 80, range: [1, 1], momentum: 25, requires: { targetNearTable: true }, effects: { breakTable: true, heat: 20 }, desc: 'La cible doit être adjacente à une table. Gros dégâts, la table casse.' },
  senton: { tier: 'specialty', name: 'Running Senton', type: 'grapple', part: 'torso', stat: 'str', power: 13, acc: 85, range: [1, 1], momentum: 14, effects: { splash: 0.5, selfDamage: 2 }, desc: 'Tout le poids du corps.' },

  // ---- Spécialité : Frappeur ----------------------------------------------
  roundhouse: { tier: 'specialty', name: 'Coup de pied retourné', type: 'strike', stat: 'agi', power: 11, acc: 85, range: [1, 1], momentum: 12, effects: { daze: 1 }, desc: 'Étourdit.' },
  kneestrike: { tier: 'specialty', name: 'Coup de genou', type: 'strike', stat: 'str', power: 14, acc: 80, range: [1, 1], momentum: 14, desc: 'Direct au menton.' },

  // ---- Spécialité : Tricheur ----------------------------------------------
  lowblow: { tier: 'specialty', name: 'Coup bas', type: 'strike', part: 'torso', stat: 'tec', power: 12, acc: 95, range: [1, 1], momentum: 10, effects: { daze: 1, illegal: true }, desc: 'Illégal : risque de DQ si l’arbitre regarde. Étourdit.' },
  distract: { tier: 'specialty', name: 'Distraire l’arbitre', type: 'taunt', range: [0, 0], momentum: 10, effects: { distractRef: 2 }, desc: 'L’arbitre ne voit rien pendant 2 tours (armes et coups illégaux sans risque).' },

  // ---- Spécialité : Colosse -----------------------------------------------
  chokeslam: { tier: 'specialty', name: 'Chokeslam', type: 'grapple', stat: 'str', power: 16, acc: 75, range: [1, 1], momentum: 16, effects: { push: 1 }, desc: 'Par la gorge, jusqu’au tapis.' },
  bigboot: { tier: 'specialty', name: 'Big Boot', type: 'strike', part: 'head', stat: 'str', power: 11, acc: 80, range: [1, 1], momentum: 12, effects: { push: 1 }, desc: 'Repousse d’une case.' },

  // ---- Spécialité : Vitesse -----------------------------------------------
  baseballslide: { tier: 'specialty', name: 'Baseball Slide', type: 'strike', part: 'legs', stat: 'agi', power: 8, acc: 90, range: [2, 2], momentum: 10, effects: { push: 1 }, desc: 'Portée exacte 2, repousse.' },
  dive: { tier: 'specialty', name: 'Suicide Dive', type: 'aerial', stat: 'agi', power: 14, acc: 80, range: [1, 2], momentum: 16, requires: { attackerOnRope: true }, effects: { splash: 0.5, selfDamageOnMiss: 8 }, desc: 'Depuis les cordes vers l’extérieur ou l’intérieur.' },

  // ---- Spécialité : Micro -------------------------------------------------
  promo: { tier: 'specialty', name: 'Promo', type: 'taunt', range: [0, 0], momentum: 20, effects: { allyMomentum: 20, heat: 8 }, desc: '+20 momentum pour vous et vos alliés à 2 cases.' },
  insult: { tier: 'specialty', name: 'Insulte', type: 'special', range: [1, 3], momentum: 10, effects: { drainMomentum: 25 }, desc: 'La cible perd 25 momentum. Portée 3.' },

  // ---- Signatures & finishers (par lutteur) --------------------------------
  superman_punch: { tier: 'signature', name: 'Superman Punch', type: 'strike', stat: 'str', power: 14, acc: 85, range: [1, 2], momentum: 15, effects: { push: 1 } },
  spear: { tier: 'finisher', name: 'Spear', type: 'grapple', part: 'torso', stat: 'str', power: 24, acc: 85, range: [1, 1], effects: { line: 1, push: 1, charge: true }, desc: 'Traverse : ce qui est aligné derrière encaisse aussi. +8 dégâts après trois cases de course.' },
  five_knuckle: { tier: 'signature', name: 'Five Knuckle Shuffle', type: 'strike', stat: 'str', power: 10, acc: 100, range: [1, 1], requires: { targetDownOrDazed: true }, effects: { selfMomentum: 40, heat: 10 }, desc: 'Sur une cible au sol. Tu peux pas le voir. +40 momentum.' },
  attitude_adjustment: { tier: 'finisher', name: 'Attitude Adjustment', type: 'grapple', stat: 'str', power: 22, acc: 85, range: [1, 1] },
  old_school: { tier: 'signature', name: 'Old School', type: 'aerial', stat: 'str', power: 14, acc: 80, range: [1, 2], requires: { turnbuckle: true } },
  tombstone: { tier: 'finisher', name: 'Tombstone Piledriver', type: 'grapple', part: 'head', stat: 'str', power: 23, acc: 80, range: [1, 1], effects: { finishedBonus: 0.15 }, desc: 'Le tombé qui suit est presque garanti.' },
  draping_ddt: { tier: 'signature', name: 'DDT suspendu', type: 'grapple', part: 'head', stat: 'tec', power: 15, acc: 85, range: [1, 1], requires: { targetOnRope: true }, effects: { daze: 1 }, desc: 'La cible doit être sur les cordes.' },
  rko: { tier: 'finisher', name: 'RKO', type: 'grapple', stat: 'tec', power: 22, acc: 90, range: [1, 1] },
  thesz_press: { tier: 'signature', name: 'Lou Thesz Press', type: 'strike', stat: 'str', power: 13, acc: 90, range: [1, 1], effects: { daze: 1 } },
  stunner: { tier: 'finisher', name: 'Stunner', type: 'grapple', part: 'head', stat: 'str', power: 21, acc: 90, range: [1, 1], effects: { daze: 1 } },
  rock_bottom: { tier: 'signature', name: 'Rock Bottom', type: 'grapple', stat: 'str', power: 18, acc: 85, range: [1, 1], effects: { push: 1 } },
  peoples_elbow: { tier: 'finisher', name: 'Coude du Peuple', type: 'strike', stat: 'str', power: 20, acc: 100, range: [1, 1], requires: { targetDownOrDazed: true }, effects: { heat: 30 }, desc: 'Le mouvement le plus électrisant du divertissement sportif. Sur cible au sol ou étourdie.' },
  hulk_boot: { tier: 'signature', name: 'Big Boot du Hulkster', type: 'strike', part: 'head', stat: 'str', power: 15, acc: 85, range: [1, 1], effects: { daze: 1 } },
  legdrop: { tier: 'finisher', name: 'Leg Drop atomique', type: 'strike', part: 'head', stat: 'str', power: 20, acc: 100, range: [1, 1], requires: { targetDownOrDazed: true }, effects: { heat: 15 } },
  v_trigger: { tier: 'signature', name: 'V-Trigger', type: 'strike', stat: 'agi', power: 15, acc: 85, range: [1, 2], effects: { push: 1, daze: 1 } },
  one_winged_angel: { tier: 'finisher', name: 'Ange à Une Aile', type: 'grapple', stat: 'tec', power: 25, acc: 80, range: [1, 1] },
  salt_of_earth: { tier: 'signature', name: 'Sel de la Terre', type: 'submission', part: 'arms', stat: 'tec', power: 10, acc: 85, range: [1, 1], effects: { tapBonus: 0.1 } },
  heatseeker: { tier: 'finisher', name: 'Heatseeker', type: 'grapple', stat: 'tec', power: 21, acc: 85, range: [1, 1] },
  sloth_kick: { tier: 'signature', name: 'Petits coups de pied paresseux', type: 'strike', stat: 'agi', power: 1, acc: 100, range: [1, 1], unlock: 0, cost: 0, effects: { selfMomentum: 25, heat: 8 }, desc: '1 dégât. +25 momentum. La foule adore.' },
  orange_punch: { tier: 'finisher', name: 'Orange Punch', type: 'strike', stat: 'str', power: 20, acc: 90, range: [1, 1] },
  cody_cutter: { tier: 'signature', name: 'Cody Cutter', type: 'grapple', stat: 'agi', power: 15, acc: 85, range: [1, 1] },
  cross_roads: { tier: 'finisher', name: 'Cross Roads', type: 'grapple', stat: 'tec', power: 22, acc: 85, range: [1, 1] },
  teeth: { tier: 'signature', name: 'Dents dans la bouche', type: 'strike', stat: 'tec', power: 6, acc: 100, range: [1, 1], unlock: 40, cost: 20, effects: { daze: 2, heat: 8 }, desc: 'Étourdit 2 tours. Très gentil. Très méchant.' },
  very_evil_ddt: { tier: 'finisher', name: 'DDT très méchant', type: 'grapple', part: 'head', stat: 'tec', power: 18, acc: 85, range: [1, 1] },
  derby_crossbody: { tier: 'signature', name: 'Crossbody suicidaire', type: 'aerial', stat: 'agi', power: 16, acc: 80, range: [1, 3], requires: { turnbuckle: true } },
  coffin_drop: { tier: 'finisher', name: 'Coffin Drop', type: 'aerial', stat: 'agi', power: 24, acc: 75, range: [1, 3], requires: { turnbuckle: true }, effects: { selfDamage: 8, selfDamageOnMiss: 15 } },
  prism_trap: { tier: 'signature', name: 'Prism Trap', type: 'submission', part: 'arms', stat: 'tec', power: 11, acc: 85, range: [1, 1] },
  riptide: { tier: 'finisher', name: 'Riptide', type: 'grapple', stat: 'str', power: 23, acc: 85, range: [1, 1] },
  stinger_splash: { tier: 'signature', name: 'Stinger Splash', type: 'strike', part: 'torso', stat: 'agi', power: 14, acc: 85, range: [1, 2], requires: { targetDazedOrCorner: true }, effects: { splash: 0.4 }, desc: 'Cible étourdie ou dans un coin.' },
  scorpion_death_drop: { tier: 'finisher', name: 'Scorpion Death Drop', type: 'grapple', stat: 'str', power: 21, acc: 85, range: [1, 1] },
  walls: { tier: 'signature', name: 'Murs de Jerico', type: 'submission', part: 'legs', stat: 'tec', power: 13, acc: 85, range: [1, 1] },
  judas_effect: { tier: 'finisher', name: 'Effet Judas', type: 'strike', stat: 'str', power: 21, acc: 90, range: [1, 1], effects: { daze: 1 } },
  paradigm_shift: { tier: 'signature', name: 'Paradigm Shift', type: 'grapple', stat: 'tec', power: 16, acc: 85, range: [1, 1] },
  death_rider: { tier: 'finisher', name: 'Death Rider', type: 'grapple', stat: 'str', power: 22, acc: 85, range: [1, 1] },
  general_sleeper: { tier: 'signature', name: 'Sleeper du Général', type: 'submission', part: 'head', stat: 'tec', power: 10, acc: 85, range: [1, 1] },
  imperial_powerbomb: { tier: 'finisher', name: 'Powerbomb Impériale', type: 'grapple', stat: 'str', power: 25, acc: 80, range: [1, 1] },
  buckle_bomb: { tier: 'signature', name: 'Buckle Bomb', type: 'grapple', part: 'torso', stat: 'str', power: 15, acc: 80, range: [1, 1], effects: { push: 2, daze: 1 }, desc: 'Projette 2 cases (idéal vers un coin) et étourdit.' },
  stomp: { tier: 'finisher', name: 'Le Stomp', type: 'strike', stat: 'agi', power: 22, acc: 95, range: [1, 1], requires: { targetDownOrDazed: true } },
  oscutter: { tier: 'signature', name: 'Oscutter', type: 'grapple', stat: 'agi', power: 15, acc: 85, range: [1, 2] },
  hidden_blade: { tier: 'finisher', name: 'Lame Cachée', type: 'strike', stat: 'str', power: 20, acc: 90, range: [1, 1], effects: { ignoreDef: 0.5 }, desc: 'Ignore 50 % de la DEF.' },
  swerve_stomp: { tier: 'signature', name: 'Swerve Stomp', type: 'aerial', stat: 'agi', power: 16, acc: 80, range: [1, 3], requires: { turnbuckle: true } },
  house_call: { tier: 'finisher', name: 'House Call', type: 'strike', stat: 'agi', power: 22, acc: 95, range: [1, 1], requires: { targetDownOrDazed: true }, effects: { push: 1 } },
  hip_attack: { tier: 'signature', name: 'Hip Attack', type: 'strike', part: 'torso', stat: 'str', power: 13, acc: 90, range: [1, 1], unlock: 50, cost: 30, effects: { push: 1, heat: 5 } },
  storm_zero: { tier: 'finisher', name: 'Storm Zero', type: 'grapple', stat: 'tec', power: 22, acc: 85, range: [1, 1] },
  lucky_punch: { tier: 'signature', name: 'Coup chanceux', type: 'strike', stat: 'str', power: 12, acc: 80, range: [1, 1], unlock: 50, cost: 30, effects: { daze: 1 } },
  frog_splash: { tier: 'finisher', name: 'Frog Splash', type: 'aerial', stat: 'agi', power: 24, acc: 85, range: [1, 3], requires: { turnbuckle: true, targetDownOrDazed: true }, effects: { splash: 0.5 } },
  anaconda: { tier: 'signature', name: 'Anaconda Vise', type: 'submission', part: 'head', stat: 'tec', power: 12, acc: 85, range: [1, 1] },
  gts: { tier: 'finisher', name: 'Go To Sleep', type: 'grapple', part: 'head', stat: 'str', power: 22, acc: 85, range: [1, 1], effects: { daze: 1 } },
  colossal_chop: { tier: 'signature', name: 'Chop colossal', type: 'strike', part: 'torso', stat: 'str', power: 16, acc: 85, range: [1, 1], effects: { welt: 2 } },
  ko_punch: { tier: 'finisher', name: 'Poing K.-O.', type: 'strike', stat: 'str', power: 26, acc: 80, range: [1, 1], effects: { push: 2, daze: 1 } },
  busaiku_knee: { tier: 'signature', name: 'Genou Busaiku', type: 'strike', stat: 'agi', power: 16, acc: 85, range: [1, 2] },
  lebell_lock: { tier: 'finisher', name: 'LeBell Lock', type: 'submission', part: 'head', stat: 'tec', power: 18, acc: 85, range: [1, 1], effects: { tapBonus: 0.25 } },
  disarmher: { tier: 'signature', name: 'Dis-arm-her', type: 'submission', part: 'arms', stat: 'tec', power: 12, acc: 85, range: [1, 1], effects: { tapBonus: 0.1 } },
  manhandle_slam: { tier: 'finisher', name: 'Manhandle Slam', type: 'grapple', stat: 'str', power: 21, acc: 85, range: [1, 1] },
  mandible_claw: { tier: 'signature', name: 'Griffe mandibulaire', type: 'submission', part: 'head', stat: 'tec', power: 11, acc: 85, range: [1, 1] },
  sister_abigail: { tier: 'finisher', name: 'Sister Abigail', type: 'grapple', stat: 'str', power: 22, acc: 85, range: [1, 1] },
  buckshot: { tier: 'signature', name: 'Buckshot Lariat', type: 'strike', stat: 'str', power: 17, acc: 85, range: [1, 2], requires: { attackerOnRope: true }, effects: { line: 1 }, desc: 'Depuis les cordes (slingshot).' },
  deadeye: { tier: 'finisher', name: 'Deadeye', type: 'grapple', stat: 'tec', power: 22, acc: 85, range: [1, 1] },
  six_one_nine: { tier: 'signature', name: '619', type: 'strike', part: 'head', stat: 'agi', power: 16, acc: 90, range: [1, 2], requires: { targetOnRope: true }, effects: { daze: 1 }, desc: 'La cible doit être sur les cordes.' },
  west_coast_pop: { tier: 'finisher', name: 'West Coast Pop', type: 'aerial', stat: 'agi', power: 20, acc: 80, range: [1, 3], requires: { turnbuckle: true } },
  jobber_dropkick: { tier: 'signature', name: 'Dropkick d’espoir', type: 'strike', stat: 'agi', power: 10, acc: 85, range: [1, 1] },
  jobber_finisher: { tier: 'finisher', name: 'Roll-up désespéré', type: 'grapple', stat: 'tec', power: 14, acc: 85, range: [1, 1] },
  invader_strike: { tier: 'signature', name: 'Coup de batte', type: 'strike', stat: 'str', power: 15, acc: 85, range: [1, 1], effects: { daze: 1 } },
  invader_finisher: { tier: 'finisher', name: 'Bombe du Chaos', type: 'grapple', stat: 'str', power: 20, acc: 85, range: [1, 1] },
};

// Chaque mouvement porte sa clé. Le moteur en a besoin pour se souvenir de ce
// qu'il a déjà tenté sur qui — une prise de soumission qu'on répète marche de
// moins en moins bien, et sans identité il n'y a rien à compter.
for (const [id, m] of Object.entries(MOVES)) m.id = id;

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
