// LES RIVALITÉS PERSISTANTES
//
// Un match d'exhibition ne laissait aucune trace : les mêmes deux lutteurs
// pouvaient se rencontrer dix fois sans que la dixième ressemble à autre chose
// qu'à la première. Or dans le catch, l'histoire EST le produit — « la belle »
// ne se vend pas parce que le match sera meilleur, mais parce qu'il y en a eu
// deux avant.
//
// Ce module garde la fiche de chaque paire de lutteurs dans le navigateur, et
// la transforme en trois choses qui changent le match suivant :
//   · de la CHALEUR au coup d'envoi — la salle connaît déjà l'histoire ;
//   · une REVANCHE pour celui qui a perdu la dernière fois : il entre avec du
//     momentum et une rancune qui pèse sur ses coups ;
//   · une PHRASE affichée avant et après, pour qu'on sache où on en est.
//
// Volontairement local et sans compte : tout vit dans le navigateur du joueur,
// et un stockage indisponible (navigation privée) fait retomber proprement sur
// « première rencontre ».
export const RIVALRY_KEY = 'ppw-rivalries-v1';
export const RIVALRY_HEAT = 7;                    // de chaleur par rencontre passée
export const RIVALRY_HEAT_MAX = 28;
export const REVENGE_MOMENTUM = 20;

export const pairKey = (a, b) => [a, b].sort().join('|');

export function loadRivalries() {
  try { return JSON.parse(localStorage.getItem(RIVALRY_KEY) || '{}') || {}; } catch { return {}; }
}
export function saveRivalries(db) {
  try { localStorage.setItem(RIVALRY_KEY, JSON.stringify(db)); } catch { /* stockage indisponible */ }
}
export function clearRivalries() {
  try { localStorage.removeItem(RIVALRY_KEY); } catch { /* ignore */ }
}

const vide = () => ({ meetings: 0, wins: {}, last: null, streak: null });
export function getRivalry(db, a, b) {
  return (db && db[pairKey(a, b)]) || vide();
}

// Enregistre le résultat. `winnerId` peut être nul (limite de temps sans
// vainqueur clair) : la rencontre compte quand même, c'est elle qui construit
// l'histoire.
export function recordMatch(db, { a, b, winnerId, turns, stars, headline, finish }) {
  const k = pairKey(a, b);
  const r = db[k] ? { ...db[k], wins: { ...db[k].wins } } : vide();
  r.meetings += 1;
  if (winnerId) {
    r.wins[winnerId] = (r.wins[winnerId] || 0) + 1;
    r.streak = r.streak && r.streak.id === winnerId ? { id: winnerId, n: r.streak.n + 1 } : { id: winnerId, n: 1 };
  } else r.streak = null;
  r.last = { winner: winnerId || null, turns, stars, headline, finish, at: Date.now() };
  db[k] = r;
  return r;
}

// Ce que le match qui vient doit savoir de leur passé commun.
export function rivalryFor(db, a, b, names = {}) {
  const r = getRivalry(db, a, b);
  const nom = (id) => names[id] || id;
  if (!r.meetings) {
    return { meetings: 0, heat: 0, revenge: null, note: 'Première rencontre : personne ne leur doit rien.', record: r };
  }
  const wa = r.wins[a] || 0, wb = r.wins[b] || 0;
  const perdant = r.last && r.last.winner ? (r.last.winner === a ? b : a) : null;
  const bits = [`${ordinal(r.meetings + 1)} affrontement.`];
  if (wa === wb) bits.push(`Ils sont à ${wa} partout.`);
  else {
    const [tete, n, m] = wa > wb ? [a, wa, wb] : [b, wb, wa];
    bits.push(`${nom(tete)} mène ${n} à ${m}.`);
  }
  if (r.streak && r.streak.n >= 2) bits.push(`${nom(r.streak.id)} a gagné les ${r.streak.n} dernières.`);
  if (perdant) bits.push(`${nom(perdant)} vient chercher sa revanche.`);
  if (r.last && r.last.headline) bits.push(`La dernière fois : « ${r.last.headline} ».`);
  return {
    meetings: r.meetings,
    heat: Math.min(RIVALRY_HEAT_MAX, r.meetings * RIVALRY_HEAT),
    revenge: perdant,
    note: bits.join(' '),
    record: r,
  };
}

function ordinal(n) {
  if (n === 1) return 'Premier';
  if (n === 2) return 'Deuxième';
  if (n === 3) return 'Troisième';
  return `${n}e`;
}
