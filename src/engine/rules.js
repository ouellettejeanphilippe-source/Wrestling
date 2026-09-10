// Conditions de victoire et routes de victoire ouvertes.
import { living } from './util.js';
import { MOVES } from '../data/moves.js';

const MOVE_TYPES = Object.fromEntries(Object.entries(MOVES).map(([k, m]) => [k, m.type]));

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
    case 'stoppage': return `L’arbitre a arrêté le match : ${u.name} ne pouvait plus continuer.`;
    default: return `${u.name} est éliminé.`;
  }
}

// Toutes les façons de gagner ouvertes dans ce match, avec leur état.
// Sert à l'interface : le joueur doit voir en permanence qu'il a plusieurs sorties possibles.
export function winRoutes(battle) {
  const r = battle.rules;
  const enemies = battle.units.filter((u) => u.team === 'enemy' && !u.eliminated);
  const mine = battle.units.filter((u) => u.team === 'player' && !u.eliminated);
  const routes = [];
  const worst = enemies.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  const pct = (u) => Math.round((u.hp / u.maxHp) * 100);

  if (!r.noPin) {
    routes.push({
      id: 'pin', icon: '🤝', name: 'Tombé',
      how: 'Amenez un adversaire au sol (0 PV), puis couvrez-le. Sous 60 % de PV ou juste après un finisher, le tombé est aussi possible debout.',
      state: worst ? (worst.down ? `${worst.name} est au sol : couvrez !` : `Cible la plus usée : ${worst.name}, ${pct(worst)} % de PV`) : '',
      ready: !!worst && (worst.down || worst.hp / worst.maxHp <= 0.6),
    });
    routes.push({
      id: 'stoppage', icon: '🛑', name: 'Arrêt de l’arbitre',
      how: 'Chaque kick-out et chaque relevé coûte un cœur ❤️. Un adversaire sans cœur qui retombe ne se relève plus.',
      state: worst ? `${worst.name} : ${'❤️'.repeat(worst.grit) || 'plus aucun cœur'}` : '',
      ready: !!worst && worst.grit <= 1,
    });
  }
  const submitters = mine.some((u) => u.moves.some((m) => (MOVE_TYPES[m] || '') === 'submission'));
  if (submitters) {
    routes.push({
      id: 'submission', icon: '🔗', name: 'Soumission',
      how: 'Une prise de soumission ne fait abandonner qu’un adversaire déjà usé (sous 65 % de PV), et jamais près des cordes quand il y a un arbitre.',
      state: worst ? `${worst.name} : ${pct(worst)} % de PV` : '',
      ready: !!worst && worst.hp / worst.maxHp < 0.65,
    });
  }
  if (r.countOut > 0) {
    const out = enemies.filter((u) => u.outsideCount > 0);
    routes.push({
      id: 'countout', icon: '⏱️', name: 'Compte à l’extérieur',
      how: `Un adversaire laissé hors du ring ${r.countOut} tours de suite est compté. Projetez-le dehors et gardez vos distances.`,
      state: out.length ? out.map((u) => `${u.name} ${u.outsideCount}/${r.countOut}`).join(', ') : 'Personne dehors',
      ready: out.some((u) => u.outsideCount >= r.countOut - 2),
    });
  }
  if (r.dq) {
    routes.push({
      id: 'dq', icon: '🚨', name: 'Disqualification adverse',
      how: 'Les armes et les coups bas sont illégaux. Un adversaire qui triche devant l’arbitre peut se faire disqualifier.',
      state: battle.refDistracted > 0 ? 'L’arbitre est distrait : personne ne risque rien' : 'L’arbitre regarde',
      ready: false,
    });
  }
  if (r.toss) {
    routes.push({
      id: 'toss', icon: '👑', name: 'Par-dessus la troisième corde',
      how: 'Poussez un adversaire sur les cordes ou dans un coin, usez-le ou étourdissez-le, puis jetez-le.',
      state: enemies.filter((u) => u.statuses.dazed).length ? 'Une cible est étourdie : c’est le moment' : 'Amenez-les aux cordes',
      ready: enemies.some((u) => u.statuses.dazed || u.hp / u.maxHp < 0.5),
    });
  }
  if (r.victory === 'belt') {
    routes.push({ id: 'belt', icon: '🪜', name: 'Décrocher la ceinture', how: 'Montez sur l’échelle au centre du ring et grimpez deux tours de suite sans subir de dégâts.', state: '', ready: true });
  }
  if (r.cage) {
    routes.push({ id: 'escape', icon: '🧗', name: 'Évasion de la cage', how: 'Depuis un coin, escaladez deux tours de suite sans subir de dégâts.', state: '', ready: true });
  }
  if (r.victory === 'survive') {
    routes.push({ id: 'survive', icon: '⏳', name: 'Survivre au chrono', how: `Tenez jusqu’au tour ${battle.match.turns} avec au moins un lutteur debout.`, state: `Tour ${battle.turn}/${battle.match.turns}`, ready: false });
  }
  if (!r.firstFall && ['fall', 'showdown'].includes(r.victory)) {
    routes.push({ id: 'sweep', icon: '⚔️', name: 'Éliminer tout le monde', how: 'Chaque adversaire doit être éliminé, par n’importe quel moyen.', state: `${enemies.length} adversaire(s) debout`, ready: enemies.length === 1 });
  }
  return routes;
}
