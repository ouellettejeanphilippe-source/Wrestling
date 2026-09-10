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
  if (!winner && battle.turn > (battle.match.maxTurns || 30)) {
    // Limite de temps : décision aux points (PV restants), pas une défaite automatique.
    const share = (team) => {
      const us = living(battle, team);
      return us.length ? us.reduce((a, u) => a + u.hp / u.maxHp, 0) / us.length : 0;
    };
    const p = share('player'), e = share('enemy');
    winner = p > e ? 'player' : 'enemy';
    reason = p === e
      ? 'Limite de temps : match nul, l’arbitre donne la décision aux visiteurs.'
      : `Limite de temps : décision aux points pour ${winner === 'player' ? 'votre équipe' : 'l’adversaire'} (${Math.round((winner === 'player' ? p : e) * 100)} % de PV restants).`;
  }
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
