// L'USURE CIBLÉE — travailler une partie du corps
//
// Un match de trente tours était long, mais il n'accumulait rien : chaque coup
// retirait des PV et rien d'autre, si bien que le trentième tour ressemblait
// au troisième en plus court. Ce qui manquait, c'est la seule stratégie longue
// du catch : CHOISIR UN MEMBRE ET LE TRAVAILLER. Dix tours sur la jambe, et la
// clé de jambe finit le match — pas parce qu'elle fait plus mal, parce que la
// jambe ne tient plus.
//
// Chaque coup marque une partie du corps selon ce qu'il est. Deux seuils :
//   · 45 « touchée »     : le membre gêne
//   · 75 « hors service » : le membre lâche
//
// L'usure ne descend jamais pendant un match. C'est l'arc, et c'est lisible :
// on voit l'adversaire se dégrader là où on a frappé.
export const WEAR_MAX = 100;
export const WEAR_HURT = 45;
export const WEAR_BROKEN = 85;

// Combien d'usure par point de dégât — et tout tient dans l'écart entre ces
// deux nombres. Un coup qui VISE le membre l'use quatre fois plus qu'un coup
// qui l'atteint au passage. Sans cet écart, l'offensive ordinaire suffisait à
// mettre un membre hors service dans 90 % des matchs : « hors service »
// devenait la normale, donc ne racontait plus rien.
export const WEAR_RATE = 0.85;                    // le coup vise le membre
export const WEAR_DRIFT = 0.22;                   // il l'atteint sans le viser

export const PARTS = {
  head: { key: 'head', name: 'Tête', icon: '🤕', short: 'tête',
    hurt: 'encaisse mal', broken: 'ne suit plus' },
  arms: { key: 'arms', name: 'Bras', icon: '💪', short: 'bras',
    hurt: 'ne serre plus', broken: 'ne porte plus rien' },
  torso: { key: 'torso', name: 'Côtes', icon: '🫁', short: 'côtes',
    hurt: 'coupe le souffle', broken: 'plus d’air du tout' },
  legs: { key: 'legs', name: 'Jambe', icon: '🦵', short: 'jambe',
    hurt: 'boite', broken: 'ne le porte plus' },
};
export const PART_KEYS = Object.keys(PARTS);

export const newWear = () => ({ head: 0, arms: 0, torso: 0, legs: 0 });

// Ce que chaque type de coup marque par défaut, quand le mouvement ne le dit
// pas lui-même. Une projection ou une insulte ne marque rien : ce n'est pas un
// coup porté sur un corps.
//
// LE TORSE EST LE FOURRE-TOUT, ET C'EST VOULU. Quand les frappes usaient la
// tête par défaut, l'usure « tête » montait toute seule à chaque échange : les
// prises de tête devenaient décisives sans que personne ait rien décidé, et le
// chinlock représentait 30 % de tous les coups du jeu. Travailler un membre
// doit être un CHOIX — donc ce qui n'est pas choisi tombe sur les côtes, dont
// le paiement est le souffle et non l'abandon.
const PART_BY_TYPE = {
  strike: 'torso', grapple: 'torso', aerial: 'torso',
  submission: 'arms', weapon: 'head', collision: 'torso', hazard: 'torso',
};

export function movePart(move) {
  if (!move) return null;
  if (move.part) return PARTS[move.part] ? move.part : null;
  return PART_BY_TYPE[move.type] || null;
}
// Le mouvement vise-t-il vraiment ce membre, ou l'attrape-t-il au passage ?
export const isAimed = (move) => !!(move && move.part && PARTS[move.part]);

// L'usure produite par un coup, en un seul endroit : le moteur l'applique,
// l'IA l'anticipe, la prévision l'affiche. Trois lectures, une formule.
export function wearFrom(move, amount) {
  const part = movePart(move);
  if (!part || !(amount > 0)) return null;
  const aimed = isAimed(move);
  const bonus = (move.effects && move.effects.wear) || 0;
  return { part, aimed, n: amount * (aimed ? WEAR_RATE : WEAR_DRIFT) + bonus };
}

export const wearOf = (unit, part) => (unit.wear && part ? unit.wear[part] || 0 : 0);
export const wearRatio = (unit, part) => wearOf(unit, part) / WEAR_MAX;
export const wearLevel = (unit, part) => {
  const n = wearOf(unit, part);
  return n >= WEAR_BROKEN ? 2 : n >= WEAR_HURT ? 1 : 0;
};
export const isBroken = (unit, part) => wearLevel(unit, part) >= 2;

// Les membres marqués, du plus abîmé au moins, sans les intacts. Sert autant à
// l'affichage qu'à l'IA — qui doit voir où elle a déjà travaillé.
export function wornParts(unit) {
  return PART_KEYS
    .map((p) => ({ part: p, n: wearOf(unit, p), level: wearLevel(unit, p), ...PARTS[p] }))
    .filter((w) => w.n > 0)
    .sort((a, b) => b.n - a.n);
}

// Ce que l'usure retire aux caractéristiques. Un seul endroit, appliqué dans
// getStats : les malus doivent se lire partout (précision, dégâts, portée de
// déplacement) sans que chaque appelant ait à y penser.
export function wearStats(unit) {
  const s = { str: 0, agi: 0, tec: 0, def: 0, mov: 0 };
  const L = (p) => wearLevel(unit, p);
  if (L('head')) { s.tec -= L('head') === 2 ? 3 : 1; s.def -= L('head') === 2 ? 2 : 1; }
  if (L('arms')) { s.str -= L('arms') === 2 ? 4 : 2; }
  if (L('torso')) { s.def -= L('torso') === 2 ? 3 : 1; }
  // La jambe coûte de l'agilité d'abord, de la portée ensuite — et seulement
  // une case, même hors service. À deux cases, un lutteur sorti du ring ne
  // rentrait plus à temps et les décomptes avaient triplé : une blessure doit
  // gêner, pas décider du match à la place de l'adversaire.
  if (L('legs')) { s.agi -= L('legs') === 2 ? 4 : 2; s.mov -= L('legs') === 2 ? 1 : 0; }
  return s;
}

// Le souffle se refait moins bien avec les côtes prises. C'est le lien entre
// l'usure et la jauge qui referme les gros mouvements.
export const staminaFactor = (unit) => [1, 0.6, 0.3][wearLevel(unit, 'torso')];

// Un bras mort ne renverse pas ; une jambe morte non plus.
export const wearReversePenalty = (unit) => wearLevel(unit, 'arms') * 0.03 + wearLevel(unit, 'legs') * 0.02;
// Une tête qui ne suit plus se fait compter plus facilement. Reste sous le
// plafond du cœur : ça accélère la fin, ça ne la vole pas.
export const wearPinBonus = (unit) => wearLevel(unit, 'head') * 0.06;

// LE PAIEMENT. Une soumission sur un membre travaillé fait abandonner ; la
// même prise sur un corps frais ne fait rien. C'est toute la stratégie longue
// en une ligne — et c'est le terme DOMINANT de la chance d'abandon, devant les
// PV restants. Sinon « user l'adversaire » et « travailler sa jambe » seraient
// la même chose, et le choix disparaîtrait.
export const wearTapBonus = (unit, part) => (part ? wearRatio(unit, part) * 0.75 : 0);

// Ajoute de l'usure et renvoie le palier franchi, s'il y en a un, pour que le
// moteur l'annonce : une dégradation qu'on ne voit pas ne se joue pas.
export function addWear(unit, part, n) {
  if (!part || !unit.wear || n <= 0) return null;
  const before = wearLevel(unit, part);
  unit.wear[part] = Math.min(WEAR_MAX, unit.wear[part] + n);
  const after = wearLevel(unit, part);
  return after > before ? { part, level: after, ...PARTS[part] } : null;
}
