// Gimmicks = passifs (comme les passifs dans LoL). Chaque gimmick est un ensemble de hooks appelés par le moteur.
// Hooks disponibles (tous optionnels), signature : (battle, unit, ...args)
//  onMatchStart, onTurnStart, onTaunt, onHit(target, move, dmg), onMiss(target, move), onDamaged(attacker, move, dmg),
//  beforeDown() -> true pour empêcher la chute, onStandUp, onAttacked(attacker, move) -> true pour annuler l'attaque,
//  modMov(mov) -> mov, selfStats() -> stats partielles, auraStats(other) -> stats partielles appliquées à other,
//  modOutDamage(target, move, dmg) -> dmg, modInDamage(attacker, move, dmg) -> dmg,
//  modHitChance(attacker, target, move, chance, role) -> chance, modPinChance(pinner, target, chance, role) -> chance,
//  modTapChance(attacker, target, chance, role) -> chance, modDqChance(chance) -> chance,
//  canBeWhipped() -> bool, modTossChance(chance, role) -> chance
import { manhattan } from '../engine/grid.js';
import { log, addMomentum, addHeat, heal, alliesOf, enemiesOf, unitsWithin, setStatus, addStatus, hpRatio, clamp } from '../engine/util.js';

export const GIMMICKS = {
  acknowledge: {
    name: 'Reconnaissez-moi',
    desc: 'Aura : alliés à 2 cases +2 FOR / +1 DEF. Lui-même gagne +1 DEF par allié adjacent.',
    auraStats: (b, u, other) => (other.team === u.team && manhattan(u, other) <= 2 ? { str: 2, def: 1 } : null),
    selfStats: (b, u) => ({ def: unitsWithin(b, u, 1, u.team).length }),
  },
  never_give_up: {
    name: 'N’abandonne jamais',
    desc: 'La première fois qu’il devrait tomber, il reste debout à 40 % PV avec +30 momentum.',
    beforeDown: (b, u) => {
      if (u.memory.ngu) return false;
      u.memory.ngu = true;
      u.hp = Math.round(u.maxHp * 0.4);
      addMomentum(b, u, 30);
      log(b, `💪 ${u.name} refuse de tomber ! NEVER GIVE UP !`, 'gimmick');
      return true;
    },
  },
  sit_up: {
    name: 'Repose en paix',
    desc: 'Une fois par match, quand il devrait tomber : il se redresse à 50 % PV avec 100 momentum.',
    beforeDown: (b, u) => {
      if (u.memory.satUp) return false;
      u.memory.satUp = true;
      u.hp = Math.round(u.maxHp * 0.5);
      u.momentum = 100;
      log(b, `⚰️ ${u.name} SE REDRESSE ! Les lumières clignotent…`, 'gimmick');
      addHeat(b, 15);
      return true;
    },
  },
  outta_nowhere: {
    name: 'Sorti de nulle part',
    desc: 'Quand il est attaqué avec 50+ momentum : 35 % de chance de contrer avec un RKO (dépense 50 momentum).',
    onAttacked: (b, u, attacker, move) => {
      if (u.down || u.momentum < 50 || u.statuses.dazed) return false;
      if (!b.rng.chance(0.35)) return false;
      u.momentum -= 50;
      const dmg = Math.max(8, Math.round(18 + u.stats.tec * 1.2 - attacker.stats.def * 0.8));
      log(b, `🐍 RKO SORTI DE NULLE PART ! ${u.name} contre ${attacker.name} (${dmg}).`, 'gimmick');
      b.api.applyDamage(attacker, dmg, u, { move: { id: 'rko', name: 'RKO', type: 'grapple' } });
      addHeat(b, 12);
      return true;
    },
  },
  beer_bash: {
    name: 'Bière 3:16',
    desc: 'Provoquer soigne 15 PV pour lui et les alliés adjacents, +10 chaleur.',
    onTaunt: (b, u) => {
      heal(b, u, 15);
      for (const a of unitsWithin(b, u, 1, u.team)) heal(b, a, 15);
      addHeat(b, 10);
      log(b, `🍺 ${u.name} ouvre des bières. Ça fait du bien.`, 'gimmick');
    },
  },
  electrifying: {
    name: 'Électrisant',
    desc: 'Provoquer donne +30 momentum supplémentaire et +15 chaleur.',
    onTaunt: (b, u) => { addMomentum(b, u, 30); addHeat(b, 15); log(b, `⚡ Vous sentez ça ? ${u.name} électrise l’aréna.`, 'gimmick'); },
  },
  hulk_up: {
    name: 'Se gonfler',
    desc: 'Une fois par match, sous 35 % PV au début de son tour : +3 FOR, soigne 15, +25 momentum.',
    onTurnStart: (b, u) => {
      if (u.memory.hulked || hpRatio(u) >= 0.35) return;
      u.memory.hulked = true;
      u.stats.str += 3; heal(b, u, 15); addMomentum(b, u, 25); addHeat(b, 10);
      log(b, `💛 ${u.name} SE GONFLE ! Les coups ne lui font plus rien !`, 'gimmick');
    },
  },
  best_bout: {
    name: 'Meilleure machine à matchs',
    desc: 'Chaque coup réussi consécutif : +8 % dégâts (max 5). Un raté remet à zéro.',
    onHit: (b, u) => { u.memory.combo = Math.min(5, (u.memory.combo || 0) + 1); },
    onMiss: (b, u) => { u.memory.combo = 0; },
    modOutDamage: (b, u, t, m, dmg) => dmg * (1 + (u.memory.combo || 0) * 0.08),
  },
  better_than_you: {
    name: 'Meilleur que toi',
    desc: 'Chaque coup vole 10 momentum à la cible. Risque de DQ divisé par 2 (bague en diamant).',
    onHit: (b, u, t) => { const s = Math.min(10, t.momentum); addMomentum(b, t, -s); addMomentum(b, u, s); },
    modDqChance: (b, u, c) => c * 0.5,
  },
  hands_in_pockets: {
    name: 'Mains dans les poches',
    desc: '-25 % de chance d’être touché. À 75+ momentum, ses coups font +30 % (il y met de l’effort).',
    modHitChance: (b, u, atk, tgt, m, c, role) => (role === 'target' ? c - 25 : c),
    modOutDamage: (b, u, t, m, dmg) => (u.momentum >= 75 || m.tier === 'finisher' ? dmg * 1.3 : dmg),
  },
  finish_story: {
    name: 'Finir l’histoire',
    desc: 'Après s’être relevé une fois : +30 % dégâts et +10 % de chance de tombé pour le reste du match.',
    onStandUp: (b, u) => { if (!u.memory.story) { u.memory.story = true; log(b, `📖 ${u.name} va finir l’histoire.`, 'gimmick'); } },
    modOutDamage: (b, u, t, m, dmg) => (u.memory.story ? dmg * 1.3 : dmg),
    modPinChance: (b, u, p, t, c, role) => (role === 'pinner' && u.memory.story ? c + 0.1 : c),
  },
  curse: {
    name: 'Très gentil, très méchant',
    desc: 'Au début de son tour, maudit les ennemis à 2 cases : -25 précision pendant 2 tours.',
    onTurnStart: (b, u) => {
      const t = unitsWithin(b, u, 2).filter((e) => e.team !== u.team);
      for (const e of t) setStatus(b, e, 'cursed', 2);
      if (t.length) log(b, `🕯️ ${u.name} maudit ${t.map((e) => e.name).join(', ')}.`, 'gimmick');
    },
  },
  nothing_over: {
    name: 'Rien n’est jamais fini',
    desc: '+2 MOV. Mouvements aériens +25 %, mais il subit 10 % des dégâts qu’il inflige.',
    modMov: (b, u, mov) => mov + 2,
    modOutDamage: (b, u, t, m, dmg) => (m.type === 'aerial' ? dmg * 1.25 : dmg),
    onHit: (b, u, t, m, dmg) => { const s = Math.round(dmg * 0.1); if (s > 0) b.api.applyDamage(u, s, null, { self: true, silent: true }); },
  },
  mami_on_top: {
    name: 'Mami est toujours au-dessus',
    desc: 'Aura : les ennemis adjacents ont -2 DEF.',
    auraStats: (b, u, other) => (other.team !== u.team && manhattan(u, other) <= 1 ? { def: -2 } : null),
  },
  showtime: {
    name: 'C’est l’heure du show',
    desc: 'Mouvements aériens +30 %. Provoquer : +10 chaleur. Se relève avec +30 momentum.',
    modOutDamage: (b, u, t, m, dmg) => (m.type === 'aerial' ? dmg * 1.3 : dmg),
    onTaunt: (b, u) => addHeat(b, 10),
    onStandUp: (b, u) => addMomentum(b, u, 30),
  },
  the_list: {
    name: 'La Liste',
    desc: 'Chaque cible touchée est inscrite sur la Liste : +2 dégâts par inscription (max 4).',
    onHit: (b, u, t) => addStatus(b, t, 'listed', 1, 4),
    modOutDamage: (b, u, t, m, dmg) => dmg + 2 * (t.statuses.listed || 0),
  },
  deathmatch: {
    name: 'Deathmatch',
    desc: 'Armes +50 % dégâts. Sous 50 % PV : +3 FOR.',
    modOutDamage: (b, u, t, m, dmg) => (m.type === 'weapon' ? dmg * 1.5 : dmg),
    selfStats: (b, u) => (hpRatio(u) < 0.5 ? { str: 3 } : null),
  },
  discipline: {
    name: 'Discipline du Ring',
    desc: 'Ses frappes ajoutent une marque (welt) de plus. +2 dégâts par marque sur la cible.',
    onHit: (b, u, t, m) => { if (m.type === 'strike') addStatus(b, t, 'welt', 1, 4); },
    modOutDamage: (b, u, t, m, dmg) => dmg + 2 * (t.statuses.welt || 0),
  },
  sing_along: {
    name: 'Chantez sa chanson',
    desc: 'Début de tour dans le ring : +5 chaleur. Tous les 3 tours : +1 à une stat aléatoire (nouvel habit !).',
    onTurnStart: (b, u) => {
      if (!b.api.isOutside(u)) addHeat(b, 5);
      if (b.turn % 3 === 0) { const s = b.rng.pick(['str', 'agi', 'tec', 'def']); u.stats[s] += 1; log(b, `👗 ${u.name} change d’habit : +1 ${s.toUpperCase()}.`, 'gimmick'); }
    },
  },
  aerial_assassin: {
    name: 'Assassin aérien',
    desc: 'Ses mouvements aériens n’exigent pas de coin. Aérien +15 %.',
    onMatchStart: (b, u) => { u.flags.ignoreTurnbuckle = true; },
    modOutDamage: (b, u, t, m, dmg) => (m.type === 'aerial' ? dmg * 1.15 : dmg),
  },
  whose_house: {
    name: 'C’est la maison à qui ?',
    desc: 'Provoquer : +12 chaleur et +15 momentum aux alliés à 3 cases.',
    onTaunt: (b, u) => { addHeat(b, 12); for (const a of unitsWithin(b, u, 3, u.team)) addMomentum(b, a, 15); },
  },
  timeless: {
    name: 'Intemporelle',
    desc: 'Subit -25 % des frappes. Provoquer : monologue, +10 chaleur, -10 momentum aux ennemis adjacents.',
    modInDamage: (b, u, a, m, dmg) => (m && m.type === 'strike' ? dmg * 0.75 : dmg),
    onTaunt: (b, u) => { addHeat(b, 10); for (const e of unitsWithin(b, u, 1).filter((x) => x.team !== u.team)) addMomentum(b, e, -10); },
  },
  prime_time: {
    name: 'Prime Time',
    desc: 'Une fois, sous 40 % PV : boit une Prime, soigne 25. Aérien +30 %. Peu de cœur (grit faible).',
    onTurnStart: (b, u) => { if (!u.memory.prime && hpRatio(u) < 0.4) { u.memory.prime = true; heal(b, u, 25); log(b, `🧃 ${u.name} boit une Prime. Hydratation légendaire.`, 'gimmick'); } },
    modOutDamage: (b, u, t, m, dmg) => (m.type === 'aerial' ? dmg * 1.3 : dmg),
  },
  pipebomb: {
    name: 'Pipe Bomb',
    desc: 'Début de tour : les ennemis à 2 cases perdent 8 momentum, +3 chaleur.',
    onTurnStart: (b, u) => { const es = unitsWithin(b, u, 2).filter((e) => e.team !== u.team); for (const e of es) addMomentum(b, e, -8); if (es.length) addHeat(b, 3); },
  },
  immovable: {
    name: 'Inamovible',
    desc: 'Ne peut être projeté (Irish Whip) ni jeté par-dessus les cordes tant qu’il a plus de 25 % PV. -30 % chance d’être jeté.',
    canBeWhipped: (b, u) => hpRatio(u) <= 0.25,
    modTossChance: (b, u, c, role) => (role === 'target' ? c - 0.3 : c),
  },
  yes_movement: {
    name: 'Mouvement YES!',
    desc: 'Provoquer : alliés à 3 cases +15 momentum, +10 chaleur. Soumissions +10 % d’abandon.',
    onTaunt: (b, u) => { addHeat(b, 10); for (const a of unitsWithin(b, u, 3, u.team)) addMomentum(b, a, 15); log(b, `YES! YES! YES!`, 'gimmick'); },
    modTapChance: (b, u, a, t, c, role) => (role === 'attacker' ? c + 0.1 : c),
  },
  the_man: {
    name: 'The Man',
    desc: 'Soumissions +15 % d’abandon. Gagne 8 momentum à chaque coup reçu.',
    modTapChance: (b, u, a, t, c, role) => (role === 'attacker' ? c + 0.15 : c),
    onDamaged: (b, u) => addMomentum(b, u, 8),
  },
  fiend: {
    name: 'Laisse-moi entrer',
    desc: 'Une fois, sous 40 % PV : devient le Démon — remonte à 60 % PV, +4 FOR, immunisé à l’étourdissement.',
    onTurnStart: (b, u) => {
      if (u.memory.fiend) { delete u.statuses.dazed; return; }
      if (hpRatio(u) < 0.4) { u.memory.fiend = true; u.hp = Math.round(u.maxHp * 0.6); u.stats.str += 4; u.nick = 'Le Démon'; addHeat(b, 15); log(b, `🔥 Les lumières s’éteignent… ${u.name} devient LE DÉMON.`, 'gimmick'); }
    },
  },
  anxiety: {
    name: 'Cowboy anxieux',
    desc: '-5 momentum par tour. Quand il se relève : +50 momentum et +3 FOR permanents (Cowboy Shit).',
    onTurnStart: (b, u) => addMomentum(b, u, -5),
    onStandUp: (b, u) => { addMomentum(b, u, 50); u.stats.str += 3; log(b, `🤠 ${u.name} : COWBOY SHIT !`, 'gimmick'); },
  },
  lucha: {
    name: 'Lucha Libre',
    desc: '+1 MOV et passe à travers les ennemis. Léger : plus facile à jeter par-dessus les cordes.',
    onMatchStart: (b, u) => { u.flags.ghost = true; },
    modMov: (b, u, mov) => mov + 1,
  },
  underdog: {
    name: 'Espoir local',
    desc: 'La foule l’adore : +15 momentum à chaque coup reçu. Peu de cœur.',
    onDamaged: (b, u) => addMomentum(b, u, 15),
  },
  faction: {
    name: 'Force du nombre',
    desc: '+1 FOR et +1 DEF par allié à 2 cases.',
    selfStats: (b, u) => { const n = unitsWithin(b, u, 2, u.team).length; return { str: n, def: n }; },
  },
  final_boss: {
    name: 'Le Boss Final',
    desc: 'Ne tombe jamais à la première chute (se relève à 50 %). Provoquer : +30 momentum, +15 chaleur. Aura : ennemis adjacents -1 DEF.',
    beforeDown: (b, u) => { if (u.memory.boss) return false; u.memory.boss = true; u.hp = Math.round(u.maxHp * 0.5); addHeat(b, 20); log(b, `👑 ${u.name} : « Tu crois vraiment que c’est fini ? »`, 'gimmick'); return true; },
    onTaunt: (b, u) => { addMomentum(b, u, 30); addHeat(b, 15); },
    auraStats: (b, u, other) => (other.team !== u.team && manhattan(u, other) <= 1 ? { def: -1 } : null),
  },
};

export const gimmickName = (id) => (GIMMICKS[id] ? GIMMICKS[id].name : id);
export const gimmickDesc = (id) => (GIMMICKS[id] ? GIMMICKS[id].desc : '');
export { clamp };
