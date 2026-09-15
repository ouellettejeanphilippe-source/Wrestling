// LA PROGRESSION ENTRE LES CARRIÈRES — FAIRE LE TOUR DU VESTIAIRE
//
// Une carrière dure quarante minutes et finit sur une ceinture, gagnée ou pas.
// Mais une fois la ceinture prise, il n'y avait plus aucune raison de
// recommencer : la carrière suivante repartait exactement du même vestiaire.
// C'est le manque que l'audit avait relevé — un roguelike sans méta-jeu n'a
// qu'une seule bonne partie.
//
// Le modèle est celui de Slay the Spire (on débloque la Silencieuse en
// terminant avec l'Ironclad) et de Binding of Isaac : CHAQUE CARRIÈRE OUVRE
// LE VESTIAIRE UN PEU PLUS. Six lutteurs au départ, vingt-neuf en tout.
//
// DEUX RÈGLES qui décident de tout le reste :
//
//   1. On débloque en JOUANT, pas seulement en gagnant. La moitié des
//      conditions ne demandent pas la ceinture — passer un adversaire à
//      travers une table, gagner une cage, arriver premier prétendant. Une
//      carrière ratée doit quand même avoir servi à quelque chose.
//   2. Chaque condition est ÉCRITE À L'ÉCRAN, avant d'être remplie. Un déblocage
//      surprise ne récompense rien : on ne peut pas viser ce qu'on ne voit pas.
import { WRESTLERS, WRESTLERS_BY_ID, STARTER_CHOICES } from '../data/wrestlers.js';

export const UNLOCK_KEY = 'ppw-unlocks-v1';

// Le vestiaire de départ : les six lutteurs qui étaient déjà proposés.
export const STARTERS = [...STARTER_CHOICES];

export const emptyProgress = () => ({
  version: 1,
  wrestlers: [...STARTERS],   // débloqués
  careers: 0,                 // carrières terminées
  belts: 0,                   // ceintures gagnées
  beltHeadliners: [],         // avec quelles têtes d'affiche
});

export function loadProgress() {
  try {
    const raw = localStorage.getItem(UNLOCK_KEY);
    if (!raw) return emptyProgress();
    const p = { ...emptyProgress(), ...JSON.parse(raw) };
    // On ne verrouille jamais un lutteur de départ, même si la sauvegarde est
    // abîmée : le jeu doit toujours être jouable.
    p.wrestlers = [...new Set([...STARTERS, ...(p.wrestlers || [])])].filter((id) => WRESTLERS_BY_ID[id]);
    p.beltHeadliners = [...new Set(p.beltHeadliners || [])];
    return p;
  } catch { return emptyProgress(); }
}

export function saveProgress(p) {
  try { localStorage.setItem(UNLOCK_KEY, JSON.stringify(p)); } catch { /* stockage indisponible */ }
}
export function resetProgress() {
  try { localStorage.removeItem(UNLOCK_KEY); } catch { /* ignore */ }
  return emptyProgress();
}

export const isUnlocked = (p, id) => (p.wrestlers || []).includes(id);

// Les exploits d'une carrière, tels que `state.feats` les accumule, plus ce
// que la progression sait des carrières précédentes.
//   run = { headliner, champion, terms, rank, mode, fans, money, feats }
//   p   = la progression persistante

// ---------------------------------------------------------- LES DÉBLOCAGES
//
// `by` est la clef d'affichage : ce qu'on lit dans le vestiaire, sous le
// portrait grisé. `check(run, p)` répond oui ou non à la fin d'une carrière.
export const UNLOCKS = [
  // --- L'HÉRITAGE. Gagner la ceinture avec quelqu'un ouvre la porte à celui
  // qui lui ressemble, ou à celui qui l'attendait au tournant.
  { id: 'hulk_gogane', by: 'Gagnez la ceinture avec John Sena.', check: (r) => r.champion && r.headliner === 'jean_sina' },
  { id: 'pendu_paige', by: 'Gagnez la ceinture avec Darby All-In.', check: (r) => r.champion && r.headliner === 'derby_allin' },
  { id: 'gm_punk', by: 'Gagnez la ceinture avec Bryan Danielsonne.', check: (r) => r.champion && r.headliner === 'brian_danielsson' },
  { id: 'randy_python', by: 'Gagnez la ceinture avec Stone Cold Steve Boston.', check: (r) => r.champion && r.headliner === 'pierre_frette' },
  { id: 'kenny_alpha', by: 'Gagnez la ceinture avec Orange Casually.', check: (r) => r.champion && r.headliner === 'clementine_cassidy' },
  { id: 'rhea_ripplay', by: 'Gagnez la ceinture avec Becky Lunch.', check: (r) => r.champion && r.headliner === 'becky_lunch' },

  // --- LES EXPLOITS. Aucun ne demande la ceinture : ils récompensent une
  // manière de jouer, et ils tombent même dans une carrière perdue.
  { id: 'cody_roads', by: 'Arrivez au match de titre en premier prétendant.', check: (r) => r.terms === 'net' },
  { id: 'bill_osprey', by: 'Gagnez un match à l’échelle ou un TLC.', check: (r) => (r.feats.winsByType.ladder || 0) + (r.feats.winsByType.tlc || 0) > 0 },
  { id: 'stingue', by: 'Gagnez un match en cage.', check: (r) => (r.feats.winsByType.cage || 0) > 0 },
  // MESURÉ, PAS DEVINÉ. Le seuil était à trois tables : sur trente carrières
  // simulées, la médiane est de ZÉRO et le maximum de deux. Une condition que
  // personne ne peut remplir n'est pas difficile, elle est cassée — et elle
  // rendait un lutteur injouable à vie. Une table, ça se cherche : il faut
  // prendre un nœud hardcore ou TLC et s'en servir.
  { id: 'jon_moxie', by: 'Passez un adversaire à travers une table.', check: (r) => r.feats.tables >= 1 },
  { id: 'gunter', by: 'Gagnez 3 matchs par soumission dans une carrière.', check: (r) => r.feats.submissionWins >= 3 },
  { id: 'curve_stricklande', by: 'Gagnez un match en jetant quelqu’un par-dessus les cordes.', check: (r) => r.feats.tossWins > 0 },
  { id: 'dannemaison', by: 'Gagnez un match par disqualification ou par compte à l’extérieur.', check: (r) => r.feats.cheapWins > 0 },
  { id: 'fray_wyatt', by: 'Gagnez un match par arrêt de l’arbitre.', check: (r) => r.feats.stoppageWins > 0 },
  { id: 'le_geant', by: 'Battez un colosse (Günter, Andrei le Géant, The Undertacker…).', check: (r) => r.feats.beatGiant },
  { id: 'kris_gericault', by: 'Gagnez 3 main events dans une seule carrière.', check: (r) => r.feats.eliteWins >= 3 },
  // Celui-ci ne tombe jamais tout seul : il faut aller tailler son deck dans
  // le hub (le plancher est à 8). C'est voulu — une condition qu'on remplit
  // sans le vouloir ne récompense pas une manière de jouer.
  { id: 'rey_mysterioso', by: 'Gagnez un match avec un deck de 12 cartes ou moins (taillez-le dans le hub).', check: (r) => r.feats.smallestDeckWin > 0 && r.feats.smallestDeckWin <= 12 },
  { id: 'tonie_tempete', by: 'Terminez une carrière avec 2 500 fans ou plus.', check: (r) => r.fans >= 2500 },
  // Mesuré : une carrière sans un sou dépensé finit entre 4 000 et 9 700 $.
  // Le seuil est donc « n'ayez pas tout claqué en entraînements » — un vrai
  // arbitrage, puisqu'un roster non entraîné gagne moins souvent.
  { id: 'logan_pole', by: 'Terminez une carrière avec 4 000 $ en caisse.', check: (r) => r.money >= 4000 },
  { id: 'seth_rollmops', by: 'Terminez une carrière en mode Scénarios.', check: (r) => r.mode === 'scenario' },
  { id: 'mjg', by: 'Gagnez la ceinture alors que le champion n’était pas venu seul.', check: (r) => r.champion && r.terms === 'handicap' },

  // --- LE HAUT DE L'AFFICHE. Les deux derniers ne se prennent pas en une
  // carrière : ils demandent d'avoir fait le tour.
  { id: 'entrepreneur', by: 'Gagnez la ceinture dans deux carrières différentes.', check: (r, p) => (p.belts || 0) + (r.champion ? 1 : 0) >= 2 },
  { id: 'ronan_rains', by: 'Gagnez la ceinture avec cinq têtes d’affiche différentes.', check: (r, p) => new Set([...(p.beltHeadliners || []), ...(r.champion ? [r.headliner] : [])]).size >= 5 },
];

export const UNLOCK_BY_ID = Object.fromEntries(UNLOCKS.map((u) => [u.id, u]));

// Comment ce lutteur s'obtient. Les lutteurs de départ n'ont pas de condition ;
// tous les autres doivent en avoir une, sinon ils sont injouables à vie — un
// test le vérifie.
export const unlockHint = (id) => (STARTERS.includes(id) ? 'Disponible dès le départ.' : (UNLOCK_BY_ID[id] || {}).by || '');

// LE BILAN D'UNE CARRIÈRE. On évalue toutes les conditions non encore
// remplies, on met à jour les compteurs, et on renvoie ce qui vient de
// s'ouvrir pour que l'écran de fin puisse le montrer.
export function finishCareer(progress, run) {
  const p = { ...progress, wrestlers: [...progress.wrestlers], beltHeadliners: [...(progress.beltHeadliners || [])] };
  const nouveaux = [];
  for (const u of UNLOCKS) {
    if (p.wrestlers.includes(u.id)) continue;
    let ok = false;
    try { ok = !!u.check(run, progress); } catch { ok = false; }
    if (ok) { p.wrestlers.push(u.id); nouveaux.push(u); }
  }
  p.careers = (p.careers || 0) + 1;
  if (run.champion) {
    p.belts = (p.belts || 0) + 1;
    if (!p.beltHeadliners.includes(run.headliner)) p.beltHeadliners.push(run.headliner);
  }
  return { progress: p, unlocked: nouveaux };
}

// Ce que le vestiaire affiche : tout le monde, dans l'ordre, avec son état.
export function locker(progress) {
  return WRESTLERS.filter((w) => !w.npc && !w.boss).map((w) => ({
    def: w,
    unlocked: isUnlocked(progress, w.id),
    hint: unlockHint(w.id),
  }));
}
