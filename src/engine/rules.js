// Conditions de victoire.
import { living } from './util.js';

export function checkWin(battle) {
  if (battle.result) return battle.result;
  const victory = battle.match.victory || battle.rules.victory;
  const firstFall = battle.match.firstFall ?? battle.rules.firstFall;
  const P = living(battle, 'player'), E = living(battle, 'enemy');
  let winner = null, reason = '';

  const escapee = battle.units.find((u) => u.flags.escaped);
  const beltHolder = battle.units.find((u) => u.flags.belt);
  if (escapee) { winner = escapee.team; reason = `${escapee.name} s’est évadé de la cage !`; }
  else if (beltHolder) { winner = beltHolder.team; reason = `${beltHolder.name} décroche la ceinture !`; }
  else if (victory === 'survive') {
    if (!P.length) { winner = 'enemy'; reason = 'Tous vos lutteurs ont été éliminés.'; }
    else if (battle.turn > (battle.match.turns || 8)) { winner = 'player'; reason = 'Vous avez tenu jusqu’à la fin du chrono !'; }
  } else if (victory === 'boss') {
    const boss = battle.units.find((u) => u.team === 'enemy' && u.id === battle.match.bossId);
    if (boss && boss.eliminated) { winner = 'player'; reason = `${boss.name} est éliminé !`; }
    else if (!P.length) { winner = 'enemy'; reason = 'Tous vos lutteurs ont été éliminés.'; }
  } else {
    if (firstFall && battle.lastElimination) {
      const u = battle.lastElimination;
      winner = u.team === 'player' ? 'enemy' : 'player';
      reason = elimText(u);
    } else if (!E.length) { winner = 'player'; reason = 'Tous les adversaires sont éliminés !'; }
    else if (!P.length) { winner = 'enemy'; reason = 'Tous vos lutteurs ont été éliminés.'; }
  }
  if (!winner && battle.turn > (battle.match.maxTurns || 30)) { winner = 'enemy'; reason = 'Limite de temps : match nul. Le Network déteste les matchs nuls.'; }
  if (winner) battle.result = { winner, reason, turns: battle.turn };
  return battle.result;
}

export function elimText(u) {
  switch (u.elimReason) {
    case 'pin': return `${u.name} a été épinglé : 1… 2… 3 !`;
    case 'submission': return `${u.name} a abandonné !`;
    case 'countout': return `${u.name} a été compté à l’extérieur.`;
    case 'dq': return `${u.name} a été disqualifié.`;
    case 'toss': return `${u.name} est passé par-dessus la troisième corde.`;
    default: return `${u.name} est éliminé.`;
  }
}
