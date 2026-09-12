// État de la promotion (campagne) : roster, argent, fans, progression, sauvegarde.
import { WRESTLERS, WRESTLERS_BY_ID } from '../data/wrestlers.js';
import { SEASON } from '../data/campaign.js';
import { MATCH_TYPES } from '../data/matchTypes.js';
import { createRng } from '../engine/rng.js';
import { evaluateDirectives, evaluateScript } from './script.js';

export const SAVE_KEY = 'ppw-save-v1';
export const TRAIN_COST = 150;
export const MAX_TRAIN = 5;
export const TRAINABLE = [['str', 'FOR', 1], ['agi', 'AGI', 1], ['tec', 'TEC', 1], ['def', 'DEF', 1], ['cha', 'CHA', 1], ['hp', 'PV', 10]];

export function newGame({ promoName, mode, starters }) {
  const seed = Date.now() % 1000000;
  const state = {
    version: 1, promoName: promoName || 'PPW — Parodie Pro Wrestling', mode: mode || 'kayfabe', showIndex: 0,
    money: 800, fans: 100, seed, roster: starters.map((id) => rosterEntry(id)), freeAgents: [], history: [], finished: false, ending: null,
  };
  refreshFreeAgents(state);
  return state;
}

export const rosterEntry = (id) => ({ id, bonus: { str: 0, agi: 0, tec: 0, def: 0, cha: 0, hp: 0 }, wins: 0, losses: 0, trainings: 0 });

export function save(state) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* stockage indisponible */ }
}
export function load() {
  try { const raw = localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }

export const currentShow = (state) => SEASON.shows[state.showIndex] || null;
export const rosterDefs = (state) => state.roster.map((r) => WRESTLERS_BY_ID[r.id]);
export const playerBonuses = (state) => Object.fromEntries(state.roster.map((r) => [r.id, r.bonus]));

export function refreshFreeAgents(state) {
  const rng = createRng(state.seed + state.showIndex * 97);
  const owned = new Set(state.roster.map((r) => r.id));
  const pool = WRESTLERS.filter((w) => !w.npc && !w.boss && !owned.has(w.id)).map((w) => w.id);
  state.freeAgents = rng.shuffle(pool).slice(0, 3);
}

export function recruit(state, id) {
  const def = WRESTLERS_BY_ID[id];
  if (!def || state.roster.some((r) => r.id === id)) return { ok: false, reason: 'Déjà dans le roster' };
  if (state.money < def.salary) return { ok: false, reason: 'Pas assez d’argent' };
  state.money -= def.salary;
  state.roster.push(rosterEntry(id));
  state.freeAgents = state.freeAgents.filter((f) => f !== id);
  return { ok: true };
}

export function train(state, id, stat) {
  const r = state.roster.find((x) => x.id === id);
  const spec = TRAINABLE.find((t) => t[0] === stat);
  if (!r || !spec) return { ok: false, reason: 'Invalide' };
  const cost = TRAIN_COST + r.trainings * 25;
  if (state.money < cost) return { ok: false, reason: 'Pas assez d’argent' };
  const current = r.bonus[stat] / spec[2];
  if (current >= MAX_TRAIN) return { ok: false, reason: 'Maximum atteint' };
  state.money -= cost;
  r.bonus[stat] += spec[2];
  r.trainings += 1;
  return { ok: true, cost };
}
export const trainCost = (r) => TRAIN_COST + r.trainings * 25;

export function buildMatch(state, matchDef) {
  return { ...matchDef, mode: state.mode, script: state.mode === 'scenario' ? matchDef.script : null };
}

// Applique le résultat d'un match de campagne. Renvoie un résumé pour l'écran de résultat.
export function applyResult(state, battle, matchDef, teamIds) {
  const won = battle.result.winner === 'player';
  const summary = { won, matchTitle: matchDef.title, money: 0, fans: 0, directives: [], script: null, advance: false, message: '' };
  if (state.mode === 'scenario') {
    const ev = evaluateScript(battle, matchDef.script);
    summary.script = ev;
    summary.money = Math.round(matchDef.reward.money * (ev.stars / 5) * 1.2);
    summary.fans = Math.round(matchDef.reward.fans * (ev.stars / 5) * 1.3);
    summary.advance = ev.stars >= 2.5;
    summary.message = !ev.finishOk
      ? 'Vous n’avez pas respecté le finish. Le Network parle de « shoot ». Reprise obligatoire.'
      : ev.stars >= 4.5 ? 'Match de l’année ! Le Network est aux anges.' : ev.stars >= 2.5 ? 'Épisode validé par le Network.' : 'Note trop basse : le Network exige une reprise.';
  } else {
    summary.directives = won ? evaluateDirectives(battle, matchDef.directives) : [];
    const bonus = summary.directives.filter((d) => d.done).reduce((a, d) => ({ money: a.money + d.reward.money, fans: a.fans + d.reward.fans }), { money: 0, fans: 0 });
    const heatMult = 0.8 + battle.heat / 250;
    summary.money = won ? Math.round(matchDef.reward.money * heatMult + bonus.money) : Math.round(matchDef.reward.money * 0.3);
    summary.fans = won ? Math.round(matchDef.reward.fans * heatMult + bonus.fans) : -Math.round(state.fans * 0.05);
    summary.advance = won;
    summary.message = won ? 'Victoire ! Le show continue.' : 'Défaite. Le Network vous accorde une reprise de l’épisode… avec moins de fans.';
  }
  state.money += summary.money;
  state.fans = Math.max(0, state.fans + summary.fans);
  for (const r of state.roster) if (teamIds.includes(r.id)) { if (won) r.wins++; else r.losses++; }
  state.history.push({ show: state.showIndex + 1, match: matchDef.title, won, stars: summary.script ? summary.script.stars : null, money: summary.money, fans: summary.fans, turns: battle.turn });
  if (summary.advance) {
    state.showIndex += 1;
    if (state.showIndex >= SEASON.shows.length) {
      state.finished = true;
      state.ending = state.fans >= SEASON.finalFansGoal ? 'good' : 'ok';
    } else refreshFreeAgents(state);
  }
  return summary;
}

// Le quatrième argument accepte un nombre (l'ancienne graine) ou un objet
// d'options : { seed, managers: { player, enemy }, rivalry }. L'exhibition est
// devenue le mode où l'on choisit tout — adversaire, manager, et où l'histoire
// entre les deux lutteurs se poursuit d'un match à l'autre.
export function exhibitionMatch(type, playerIds, enemyIds, opts = {}) {
  const o = typeof opts === 'number' ? { seed: opts } : (opts || {});
  const rules = MATCH_TYPES[type];
  return {
    id: 'exhibition', title: `Exhibition — ${rules.name}`, type, teamSize: playerIds.length, enemies: enemyIds, directives: [], reward: { money: 0, fans: 0 },
    desc: rules.desc, mode: 'kayfabe', seed: o.seed, turns: 8,
    managers: o.managers || null, rivalry: o.rivalry || null,
    reinforcements: type === 'survival' ? [{ turn: 3, enemies: ['invader'], spawns: [[0, 7]] }, { turn: 6, enemies: ['invader'], spawns: [[0, 7]] }] : undefined,
  };
}
