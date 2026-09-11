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
import { ART_W, ART_H, BASE_FRONT, BASE_BACK, BASE_DOWN, BASE_GIANT, BASE_FEM, OVERLAYS, TORSO } from './spriteart.js';

export const SPRITE_W = ART_W;
export const SPRITE_H = ART_H;
export const DIRECTIONS = ['se', 'sw', 'ne', 'nw'];
const POSE = {
  se: { art: 'front', mirror: false }, sw: { art: 'front', mirror: true },
  ne: { art: 'back', mirror: false }, nw: { art: 'back', mirror: true },
};
// Le dessin occupe les lignes 2 à 38 : on recadre dessus, sinon le sprite
// flotte au milieu d'une boîte à moitié vide.
const ART_TOP = 2, ART_USED = 37;
const VIEWBOX = { full: `0 ${ART_TOP} ${ART_W} ${ART_USED}`, bust: '9 1 15 15' };
// Le lutteur au sol s'étale : son cadrage prend toute la largeur, plus bas.
const VIEWBOX_DOWN = `0 ${ART_TOP} ${ART_W} ${ART_USED}`;

const SKIN = { light: '#f2c79b', tan: '#d79a68', brown: '#a96c3d', dark: '#7c4b28', pale: '#f8e2d2' };
const INK = '#140d1c';
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

// Trois tons par matière : c'est le registre des sprites 16 bits, et c'est ce
// qui garde la silhouette lisible à la taille d'une case.
function palette(def) {
  const L = def.look || {};
  const skin = SKIN[L.skin] || L.skin || SKIN.light;
  const hair = L.hair || '#3b2a1a';
  const attire = L.attire || def.color || '#5a5a6e';
  const accent = L.accent || mix(attire, '#ffffff', 0.45);
  const boots = mix(attire, '#000000', 0.55);
  return {
    '.': null, K: INK,
    1: mix(skin, '#3a1c10', 0.45), 2: mix(skin, '#7a3c1c', 0.3), 3: skin,
    4: mix(skin, '#fff2d8', 0.34), 5: mix(skin, '#ffffff', 0.6),
    h: mix(hair, '#140d1c', 0.45), H: hair, G: mix(hair, '#ffe0a8', 0.35),
    a: mix(attire, '#140d1c', 0.42), A: attire, B: mix(attire, '#ffffff', 0.35),
    n: mix(accent, '#140d1c', 0.42), N: accent,
    b: mix(boots, '#000000', 0.5), V: boots, W: mix(boots, '#ffffff', 0.3),
    e: WHITE, E: mix(hair, '#0b1b3a', 0.55), m: mix(skin, '#8c2f28', 0.55),
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
  shirt: { keys: ['shirt'], rows: [13, 24], sleeves: [14, 18], mat: 'accent' },
  jacket: { keys: ['jacket'], rows: [13, 24], sleeves: [14, 24], mat: 'attire', open: true },
  coat: { keys: ['coat'], rows: [13, 31], sleeves: [14, 24], mat: 'attire', open: true },
  vest: { keys: ['vest', 'suit'], rows: [13, 24], sleeves: null, mat: 'attire', open: true },
  singlet: { keys: ['singlet'], rows: [19, 27], sleeves: null, mat: 'attire', straps: [14, 18] },
  sleeve: { keys: ['tattoo_arms'], rows: null, sleeves: [15, 23], mat: 'tattoo', speckle: true },
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

// Choix de l'archétype de corps.
const isGiant = (def) => def.weight === 'super' || (def.size && def.size !== 1);
const archetypeOf = (def) => (isGiant(def) ? 'giant' : def.body === 'fem' ? 'fem' : 'normal');
// Colonnes du torse à une ligne donnée : la dernière tranche qui commence
// avant elle.
function torsoAt(kind, y) {
  const t = TORSO[kind] || TORSO.normal;
  let hit = t[0];
  for (const s of t) if (y >= s[0]) hit = s;
  return [hit[1], hit[2]];
}

// Repeint la peau d'une tranche de lignes aux couleurs d'un tissu, en gardant
// l'ombrage du corps : c'est lui qui fait les plis.
function wear(grid, kind, spec) {
  const mat = MATERIAL[spec.mat];
  const paint = (y, x) => { grid[y][x] = mat[TONE[grid[y][x]]]; };
  const bounds = (y) => torsoAt(kind, y);
  if (spec.rows) {
    for (let y = spec.rows[0]; y <= spec.rows[1] && y < ART_H; y++) {
      const [l, r] = bounds(y);
      const mid = (l + r) / 2;
      for (let x = l; x <= r; x++) {
        if (!SKIN_CHARS.has(grid[y][x])) continue;
        // Un vêtement ouvert laisse une bande de peau au milieu de la poitrine.
        if (spec.open && Math.abs(x - mid) < 1.5 && y <= spec.rows[0] + 8) continue;
        paint(y, x);
      }
    }
  }
  if (spec.straps) {
    for (let y = spec.straps[0]; y <= spec.straps[1]; y++) {
      const [l, r] = bounds(y);
      for (const x of [l + 1, l + 2, r - 2, r - 1]) if (SKIN_CHARS.has(grid[y][x])) paint(y, x);
    }
  }
  if (spec.sleeves) {
    for (let y = spec.sleeves[0]; y <= spec.sleeves[1] && y < ART_H; y++) {
      const [l, r] = bounds(y);
      for (let x = 0; x < ART_W; x++) {
        if (x >= l && x <= r) continue;                       // le torse, pas le bras
        if (!SKIN_CHARS.has(grid[y][x])) continue;
        // Le tatouage est ajouré, sinon le bras devient un bloc noir.
        if (spec.speckle && (x * 3 + y * 5) % 4 === 0) continue;
        paint(y, x);
      }
    }
  }
}

function compose(def, back, down) {
  const kind = archetypeOf(def);
  const base = down ? BASE_DOWN
    : kind === 'giant' ? BASE_GIANT
      : kind === 'fem' && !back ? BASE_FEM
        : back ? BASE_BACK : BASE_FRONT;
  const grid = base.map((r) => [...r]);
  // Au sol, la tête n'est plus au même endroit : seule la palette distingue
  // les lutteurs.
  if (down) return grid;
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
  for (const layer of layersFor(def, back)) {
    layer.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') grid[y][x] = ch; }));
  }
  return grid;
}

export function spriteSvg(def, opts = {}) {
  const view = opts.view === 'bust' ? 'bust' : 'full';
  const dir = POSE[opts.dir] ? opts.dir : 'se';
  const pose = POSE[dir];
  const grid = compose(def, pose.art === 'back', opts.pose === 'down');
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
