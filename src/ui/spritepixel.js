// ---------------------------------------------------------------------------
// RENDU DES PLANCHES DESSINÉES À LA MAIN
//
// Prend une planche de spriteart.js (un caractère = un pixel), y superpose les
// couches d'identité du lutteur (coiffure, masque, casquette, barbe, lunettes),
// puis remplace chaque caractère par la couleur correspondante DANS SA PALETTE :
// c'est le palette swap, la méthode des jeux 2D pour habiller tout un roster
// avec un seul dessin.
//
// Le rendu fusionne les pixels voisins de même couleur en un seul rectangle,
// pour garder un SVG léger même avec une planche complète.
// ---------------------------------------------------------------------------
export { facingTo } from '../engine/grid.js';
import { ART_W, ART_H, BASE_FRONT, BASE_BACK, BASE_DOWN, BASE_GIANT, BASE_GIANT_BACK, BASE_FEM, BASE_HEAVY, BASE_SLIM, BASE_BIGHEAD,
  OVERLAYS, TORSO, STANCES, FACES, IDLE_FRAMES } from './spriteart.js';

export const SPRITE_W = ART_W;
export const SPRITE_H = ART_H;
export const DIRECTIONS = ['se', 'sw', 'ne', 'nw'];
const POSE = {
  se: { art: 'front', mirror: false }, sw: { art: 'front', mirror: true },
  ne: { art: 'back', mirror: false }, nw: { art: 'back', mirror: true },
};
// Le dessin occupe les lignes 1 à 30 : on recadre dessus, sinon le sprite
// flotte au milieu d'une boîte à moitié vide. Le buste se cadre sur la boîte
// crânienne (colonnes 8 à 15, lignes 1 à 8), élargie d'un peu d'air.
const ART_TOP = 1, ART_USED = 30;
const VIEWBOX = { full: `0 ${ART_TOP} ${ART_W} ${ART_USED}`, bust: '7 0 10 10' };
// Le lutteur au sol s'étale : son cadrage prend toute la largeur, plus bas.
const VIEWBOX_DOWN = `0 ${ART_TOP} ${ART_W} ${ART_USED}`;

const SKIN = { light: '#f2c79b', tan: '#d79a68', brown: '#a96c3d', dark: '#7c4b28', pale: '#f8e2d2' };
const INK = '#241830';
const WHITE = '#f8f4ee';

const parse = (hex) => {
  let s = String(hex || '#888').replace('#', '');
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) || 0);
};
const mix = (hex, target, amount) => {
  const a = parse(hex), b = parse(target);
  return `#${a.map((n, i) => Math.round(n + (b[i] - n) * amount)).map((n) => n.toString(16).padStart(2, '0')).join('')}`;
};

// ---------------------------------------------------------------------------
// DÉGRADÉS À TEINTE TOURNANTE
//
// Un dégradé de sprite ne va pas du noir au blanc : il TOURNE. L'ombre glisse
// vers le bleu-violet EN GAGNANT de la saturation, la lumière glisse vers le
// jaune et en perd un peu. C'est la règle du pixel art depuis les années 80,
// et c'est ce qui sépare une palette vivante d'une palette morte.
//
// Éclaircir et assombrir une même teinte — mix(couleur, noir) et
// mix(couleur, blanc) — donne des ombres grises et des lumières délavées :
// la couleur perd sa saturation aux deux bouts, exactement là où l'œil la
// cherche. C'est la signature du pixel art amateur.
// ---------------------------------------------------------------------------
const clamp01 = (n) => Math.max(0, Math.min(1, n));
function toHsl(hex) {
  const [r, g, b] = parse(hex).map((n) => n / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  const l = (mx + mn) / 2;
  if (!d) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = (mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  return [h, s, l];
}
function fromHsl(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const seg = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h / 60) % 6];
  return `#${seg.map((n) => Math.round((n + m) * 255).toString(16).padStart(2, '0')).join('')}`;
}
// Fait glisser une teinte vers une cible, par le chemin le plus court.
function towards(h, target, amount) {
  const d = ((target - h + 540) % 360) - 180;
  return h + Math.sign(d) * Math.min(Math.abs(d), amount);
}
// k négatif = vers l'ombre, positif = vers la lumière.
//
// Deux réglages comptent, et se tromper dessus casse tout :
//   · la rotation de teinte reste PETITE (14° au maximum). À 40° l'ombre de la
//     peau vire au rouge pur et le bleu s'écroule au noir — la couleur change
//     d'identité au lieu de s'assombrir.
//   · la luminosité se réduit en PROPORTION, elle ne se soustrait pas. Une
//     soustraction fixe écrase les couleurs déjà sombres jusqu'au noir plat,
//     et fait déborder les claires jusqu'au blanc.
const HUE_SHADOW = 268, HUE_LIGHT = 48;
const HUE_MAX = 14;
function shade(hex, k) {
  const [h, s, l] = toHsl(hex);
  const a = Math.abs(k), dark = k < 0;
  const target = dark ? HUE_SHADOW : HUE_LIGHT;
  // Une couleur presque grise n'a pas de teinte à faire tourner : on lui en
  // donne une, sinon elle s'assombrit en gris sale.
  const flat = s < 0.08;
  const hh = flat ? target : towards(h, target, Math.min(HUE_MAX, 6 * a));
  // Le gain de saturation se prend sur la MARGE restante. Un gain additif
  // pousse une couleur déjà saturée — la peau — jusqu'au néon : les ombres
  // deviennent des coups de soleil.
  const ss = clamp01(dark ? s + (1 - s) * 0.14 * a : s * (1 - 0.06 * a));
  // Le pas clair est plafonné : sans plafond, une matière très sombre a plus
  // de marge vers le blanc qu'elle n'en a besoin et son reflet vire au gris.
  // Des cheveux noirs prenaient un reflet de cheveux gris.
  // Le plafond du reflet est ABSOLU, pas proportionnel à l'écart demandé :
  // une matière très sombre a plus de marge vers le blanc qu'elle n'en a
  // besoin, et son reflet vire au gris. Des cheveux noirs prenaient un reflet
  // de cheveux gris.
  const ll = clamp01(dark ? l * (1 - 0.30 * a) : l + Math.min((1 - l) * 0.38 * a, 0.26));
  return fromHsl(hh, ss, ll);
}

// Trois tons par matière : c'est le registre des sprites 16 bits, et c'est ce
// qui garde la silhouette lisible à la taille d'une case. Chaque ton sort de
// shade(), donc la teinte tourne au lieu de simplement s'éclaircir.
function palette(def) {
  const L = def.look || {};
  const skin = SKIN[L.skin] || L.skin || SKIN.light;
  const hair = L.hair || '#3b2a1a';
  const attire = L.attire || def.color || '#5a5a6e';
  const accent = L.accent || mix(attire, '#ffffff', 0.45);
  const boots = mix(attire, '#000000', 0.55);
  return {
    '.': null, K: INK,
    1: shade(skin, -1.3), 2: shade(skin, -0.6), 3: skin,
    4: shade(skin, 0.6), 5: shade(skin, 1.2),
    h: shade(hair, -1.8), H: hair, G: shade(hair, 1.9),
    a: shade(attire, -1.4), A: attire, B: shade(attire, 1),
    n: shade(accent, -1.4), N: accent,
    b: shade(boots, -1.5), V: boots, W: shade(boots, 1),
    e: WHITE, E: shade(hair, -2.4), m: shade(mix(skin, '#8c2f28', 0.55), -0.4),
    w: WHITE, o: '#191423',
  };
}

// VÊTEMENTS : PEINTS SUR LE CORPS, PAS DESSINÉS À CÔTÉ
//
// Un habit n'est pas une planche de plus : c'est une tranche de lignes dans
// laquelle on repeint la peau aux couleurs du tissu. Le vêtement épouse donc
// la silhouette réelle — y compris celle du colosse et celle du corps
// féminin, qui ont chacun leur cadre — et il hérite gratuitement de l'ombrage
// du corps : le creux sous les pectoraux devient un pli du t-shirt.
//
// Un rectangle fixe, lui, flottait à côté du torse dès qu'on changeait de
// carrure.
const SKIN_CHARS = new Set(['1', '2', '3', '4', '5']);
const TONE = { 1: 0, 2: 0, 3: 1, 4: 1, 5: 2 };     // ombre, base, éclat
const MATERIAL = {
  attire: ['a', 'A', 'B'],
  accent: ['n', 'N', 'N'],
  tattoo: ['1', '1', '2'],
};
// rows : la tranche couverte sur le torse. sleeves : jusqu'où descend la
// manche sur les bras (null = sans manches). open : le vêtement s'ouvre sur
// la poitrine et laisse voir la peau. straps : deux bretelles sur les épaules.
const GARMENTS = {
  shirt: { keys: ['shirt'], rows: [10, 17], sleeves: [11, 13], mat: 'accent' },
  jacket: { keys: ['jacket'], rows: [10, 17], sleeves: [11, 17], mat: 'attire', open: true },
  coat: { keys: ['coat'], rows: [10, 25], sleeves: [11, 17], mat: 'attire', open: true },
  vest: { keys: ['vest', 'suit'], rows: [10, 17], sleeves: null, mat: 'attire', open: true },
  singlet: { keys: ['singlet'], rows: [13, 17], sleeves: null, mat: 'attire', straps: [11, 12] },
  sleeve: { keys: ['tattoo_arms'], rows: null, sleeves: [11, 17], mat: 'tattoo', speckle: true },
};
// L'ordre compte : l'encre du tatouage passe sous le tissu, le manteau
// par-dessus la veste.
const GARMENT_ORDER = ['sleeve', 'shirt', 'singlet', 'vest', 'jacket', 'coat'];

// Couches dessinées, dans l'ordre de l'habillage : le crâne, puis la
// pilosité, puis le visage, puis ce qui le couvre, puis ce qu'on tient.
const LAYER_ORDER = [
  'long_hair', 'streak',
  'beard', 'goatee', 'mustache', 'horseshoe_stache',
  'paint_full', 'paint_half', 'mask',
  'cap', 'bandana', 'cowboy_hat', 'hood',
  'sunglasses',
  'bat', 'beer',
];
// Certaines caractéristiques du roster partagent un même dessin.
const ALIASES = {
  long_hair: ['long_hair', 'curly_hair', 'messy_hair'],
  beard: ['beard', 'beard_big', 'stubble'],
  mask: ['mask', 'fiend_mask'],
  paint_full: ['paint_full', 'paint_evil'],
  bat: ['bat', 'skateboard'],
  horseshoe_stache: ['horseshoe'],
  cap: ['cap', 'headband'],
  beer: ['beer', 'bottle', 'teeth_jar'],
};
// De dos, on ne voit ni visage ni barbe.
const BACK_LAYERS = new Set(['long_hair', 'streak', 'mask', 'cap', 'bandana', 'cowboy_hat', 'hood', 'bat']);

const featuresOf = (def) => new Set((def.look || {}).features || []);
const has = (f, name) => (ALIASES[name] || [name]).some((k) => f.has(k));

function layersFor(def, back) {
  const f = featuresOf(def);
  return LAYER_ORDER.filter((n) => OVERLAYS[n] && has(f, n) && (!back || BACK_LAYERS.has(n)))
    .map((n) => OVERLAYS[n]);
}

// Choix de la carrure. Le colosse est imposé par les règles (il occupe
// plusieurs cases) ; les autres se déclarent dans les données, parce qu'un
// physique de lutteur ne se déduit pas de sa classe : deux techniciens
// peuvent être l'un sec et découpé, l'autre épais.
const isGiant = (def) => def.weight === 'super' || (def.size && def.size !== 1);
const BUILDS = { heavy: BASE_HEAVY, slim: BASE_SLIM, bighead: BASE_BIGHEAD };
function archetypeOf(def) {
  if (isGiant(def)) return 'giant';
  if (def.body === 'fem') return 'fem';
  const b = (def.look || {}).build;
  return BUILDS[b] ? b : 'normal';
}
// Colonnes du torse à une ligne donnée. La table vient du dessin lui-même :
// au-dessus des épaules et sous les hanches il n'y a pas de torse, donc pas
// de vêtement à y peindre.
function torsoAt(kind, y) {
  const t = TORSO[kind] || TORSO.normal;
  return t[y] || null;
}

// Repeint la peau d'une tranche de lignes aux couleurs d'un tissu, en gardant
// l'ombrage du corps : c'est lui qui fait les plis.
function wear(grid, kind, spec) {
  const mat = MATERIAL[spec.mat];
  const paint = (y, x, edge) => { grid[y][x] = edge ? mat[0] : mat[1]; };
  const bounds = (y) => torsoAt(kind, y);
  if (spec.rows) {
    for (let y = spec.rows[0]; y <= spec.rows[1] && y < ART_H; y++) {
      const span = bounds(y);
      if (!span) continue;
      const [l, r] = span;
      const mid = (l + r) / 2;
      for (let x = l; x <= r; x++) {
        if (!SKIN_CHARS.has(grid[y][x])) continue;
        // Un vêtement ouvert laisse une bande de peau au milieu de la poitrine.
        if (spec.open && Math.abs(x - mid) < 1 && y <= spec.rows[0] + 5) continue;
        paint(y, x, x === l || x === r);
      }
    }
  }
  if (spec.straps) {
    for (let y = spec.straps[0]; y <= spec.straps[1]; y++) {
      const span = bounds(y);
      if (!span) continue;
      const [l, r] = span;
      for (const x of [l, l + 1, r - 1, r]) if (SKIN_CHARS.has(grid[y][x])) paint(y, x, false);
    }
  }
  if (spec.sleeves) {
    for (let y = spec.sleeves[0]; y <= spec.sleeves[1] && y < ART_H; y++) {
      const span = bounds(y);
      if (!span) continue;
      const [l, r] = span;
      for (let x = 0; x < ART_W; x++) {
        if (x >= l && x <= r) continue;                       // le torse, pas le bras
        if (!SKIN_CHARS.has(grid[y][x])) continue;
        // Le tatouage est ajouré, sinon le bras devient un bloc noir.
        if (spec.speckle && (x * 3 + y * 5) % 4 === 0) continue;
        paint(y, x, x < l - 2 || x > r + 2);
      }
    }
  }
}

// Retire les bras du dessin de base sur une tranche de lignes. La coupe se
// déduit des colonnes du torse — on garde une colonne de contour de chaque
// côté — donc elle s'adapte au poids léger comme au colosse sans qu'aucune
// posture n'ait à connaître la carrure.
function cutArms(grid, kind, from, to) {
  for (let y = from; y <= to && y < ART_H; y++) {
    const span = torsoAt(kind, y);
    if (!span) continue;
    for (let x = 0; x < ART_W; x++) {
      if (x < span[0] - 1 || x > span[1] + 1) grid[y][x] = '.';
    }
  }
}

function stamp(grid, layer) {
  layer.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') grid[y][x] = ch; }));
}

// Repos : un mouvement CSS pour tout le monde, et une seconde image dessinée
// pour les quelques gestes qui font le personnage. `still` n'est pas
// « immobile » — c'est une respiration à peine visible, parce qu'un sprite
// vraiment figé a l'air mort.
export const IDLE_MOTION = {
  breathe: 1.1, bounce: 0.6, sway: 1.4, still: 2.2, cantsee: 0.7, stroke: 1.6,
};
export const idleOf = (def) => {
  const k = (def.look || {}).idle;
  return IDLE_MOTION[k] ? k : 'breathe';
};
// Une animation n'a une seconde image que si son geste en demande une.
export const idleHasFrames = (def) => !!IDLE_FRAMES[idleOf(def)];

function compose(def, back, down, frame) {
  const kind = archetypeOf(def);
  // De dos, seuls le colosse et le corps standard ont leur propre dessin :
  // les autres carrures se distinguent par la face, pas par l'échine.
  const base = down ? BASE_DOWN
    : kind === 'giant' ? (back ? BASE_GIANT_BACK : BASE_GIANT)
      : back ? BASE_BACK
        : kind === 'fem' ? BASE_FEM
          : BUILDS[kind] || BASE_FRONT;
  const grid = base.map((r) => [...r]);
  // Au sol, la tête n'est plus au même endroit : seule la palette distingue
  // les lutteurs.
  if (down) return grid;
  const L = def.look || {};
  // La posture d'abord : c'est de l'anatomie, elle doit passer AVANT les
  // vêtements pour qu'un t-shirt habille les bras là où ils sont réellement.
  // De dos, tout le monde reprend la posture neutre : un bras croisé ne se
  // lit pas par derrière, et la découpe abîmerait la silhouette pour rien.
  const st = !back && STANCES[L.stance];
  if (st) {
    cutArms(grid, kind, st.cut[0], st.cut[1]);
    stamp(grid, st.art);
  }
  if (!back && FACES[L.face]) stamp(grid, FACES[L.face]);
  // La seconde image du repos se pose comme une posture : après l'anatomie,
  // avant les vêtements, pour qu'une manche suive la main si elle passe dans
  // sa tranche de lignes.
  if (frame === 1 && !back) {
    const extra = IDLE_FRAMES[idleOf(def)];
    if (extra) stamp(grid, extra);
  }
  const f = featuresOf(def);
  // Le crâne dégarni n'est pas un dessin : on rend simplement les cheveux à
  // la peau, donc la silhouette du crâne reste exactement la même.
  if (f.has('bald')) {
    for (let y = 0; y < ART_H; y++) {
      for (let x = 0; x < ART_W; x++) {
        const c = grid[y][x];
        if (c === 'h') grid[y][x] = '2';
        else if (c === 'H') grid[y][x] = '3';
        else if (c === 'G') grid[y][x] = '4';
      }
    }
  }
  for (const name of GARMENT_ORDER) {
    const spec = GARMENTS[name];
    if (spec.keys.some((k) => f.has(k))) wear(grid, kind, spec);
  }
  for (const layer of layersFor(def, back)) stamp(grid, layer);
  return grid;
}

export function spriteSvg(def, opts = {}) {
  const view = opts.view === 'bust' ? 'bust' : 'full';
  const dir = POSE[opts.dir] ? opts.dir : 'se';
  const pose = POSE[dir];
  const grid = compose(def, pose.art === 'back', opts.pose === 'down', opts.frame || 0);
  const P = palette(def);

  let body = '';
  for (let y = 0; y < ART_H; y++) {
    let x = 0;
    while (x < ART_W) {
      const color = P[grid[y][x]];
      if (!color) { x++; continue; }
      let end = x;
      while (end + 1 < ART_W && P[grid[y][end + 1]] === color) end++;
      body += `<rect x="${x}" y="${y}" width="${end - x + 1}" height="1" fill="${color}"/>`;
      x = end + 1;
    }
  }

  const size = opts.size;
  const dim = size === undefined ? ''
    : size === 'fill' ? 'width="100%" height="100%"'
      : `width="${size}" height="${size * (view === 'full' ? ART_USED / ART_W : 1)}"`;
  const mirror = pose.mirror || opts.facing === -1;
  const flip = mirror ? ` transform="translate(${ART_W} 0) scale(-1 1)"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX[view]}" ${dim} shape-rendering="crispEdges" class="sprite sprite-${view}" preserveAspectRatio="xMidYMax meet"><g${flip}>${body}</g></svg>`;
}

export function spriteBadgeSvg(def, opts = {}) {
  const bg = opts.bg || def.color || '#3d3b52';
  return `<span class="sprite-badge" style="--badge-bg:${bg}">${spriteSvg(def, { ...opts, view: 'bust', size: undefined })}</span>`;
}
