// Évaluation des directives (mode Kayfabe) et des scripts (mode Scénarios).
import { DIRECTIVES } from '../data/directives.js';
import { avgHeat } from '../engine/util.js';

export function evaluateDirectives(battle, ids) {
  return (ids || []).map((id) => ({ id, ...DIRECTIVES[id], done: !!DIRECTIVES[id] && DIRECTIVES[id].check(battle) }));
}

export function finishMatches(battle, finish) {
  const r = battle.result;
  if (!r || !finish) return false;
  if (r.winner !== finish.winner) return false;
  const method = finish.method || 'any';
  const escaped = battle.units.some((u) => u.flags.escaped && u.team === r.winner);
  const belt = battle.units.some((u) => u.flags.belt && u.team === r.winner);
  let methodOk = true;
  if (method === 'escape') methodOk = escaped;
  else if (method === 'belt') methodOk = belt;
  else if (method !== 'any') methodOk = battle.stats.lastElimReason === method;
  if (!methodOk) return false;
  if (finish.finisher && !battle.stats.finisherFinish) return false;
  return true;
}

export function describeFinish(finish) {
  if (!finish) return '';
  const who = finish.winner === 'player' ? 'Votre équipe gagne' : 'Votre équipe PERD';
  const m = { any: 'n’importe comment', pin: 'par tombé', submission: 'par soumission', toss: 'par-dessus la corde', escape: 'par évasion', belt: 'en décrochant la ceinture', countout: 'par compte à l’extérieur', dq: 'par disqualification' }[finish.method || 'any'];
  return `${who} ${m}${finish.finisher ? ' après un finisher' : ''}.`;
}

// Note en étoiles : finish respecté + spots réalisés + chaleur de la foule.
export function evaluateScript(battle, script) {
  const finishOk = finishMatches(battle, script.finish);
  const beats = evaluateDirectives(battle, script.beats);
  const ratio = beats.length ? beats.filter((b) => b.done).length / beats.length : 1;
  // Même raison : la chaleur finale valait 100 pour tout le monde, donc cette
  // moitié d'étoile et demie était offerte à tous les shows. La moyenne se
  // situe entre 34 et 77 — on la ramène sur la même échelle.
  let stars = 1 + ratio * 2.5 + Math.min(1, avgHeat(battle) / 75) * 1.5;
  if (!finishOk) stars = Math.min(stars, 1.5);
  stars = Math.max(1, Math.min(5, Math.round(stars * 2) / 2));
  return { finishOk, beats, stars };
}

export const starsText = (n) => '★'.repeat(Math.floor(n)) + (n % 1 ? '½' : '') + '☆'.repeat(5 - Math.ceil(n));
