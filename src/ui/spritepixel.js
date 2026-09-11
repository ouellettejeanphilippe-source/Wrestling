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
import { ART_W, ART_H, BASE_FRONT, BASE_BACK, BASE_DOWN, BASE_GIANT, BASE_FEM, OVERLAYS, GIANT_OVERLAYS } from './spriteart.js';

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

// Ordre des couches : le corps d'abord, puis la tête, puis ce qui la couvre,
// et enfin ce que le lutteur tient. Chaque couche a la même règle : le '.'
// laisse voir le dessous, tout le reste écrase.
const LAYER_ORDER = [
  'sleeve',                                           // peau (tatouages)
  'shirt', 'singlet', 'vest', 'jacket', 'coat',       // torse
  'scarf',                                            // cou
  'bald', 'long_hair', 'streak',                      // crâne
  'beard', 'goatee', 'mustache', 'horseshoe_stache',  // pilosité
  'paint_full', 'paint_half', 'mask',                 // visage
  'cap', 'bandana', 'cowboy_hat', 'hood',             // couvre-chef
  'sunglasses',                                       // yeux
  'bat', 'beer',                                      // objets tenus
];
// Certaines caractéristiques du roster partagent un même dessin.
const ALIASES = {
  long_hair: ['long_hair', 'curly_hair', 'messy_hair'],
  sleeve: ['tattoo_arms'],
  scarf: ['scarf'],
  beard: ['beard', 'beard_big', 'stubble'],
  mustache: ['mustache'],
  cap: ['cap', 'headband'],
  mask: ['mask', 'fiend_mask'],
  paint_full: ['paint_full', 'paint_evil'],
  vest: ['vest', 'suit'],
  bat: ['bat', 'skateboard'],
  coat: ['coat'],
  horseshoe_stache: ['horseshoe'],
  streak: ['streak'],
  beer: ['beer', 'bottle', 'teeth_jar'],
};
function layersFor(def) {
  const f = new Set((def.look || {}).features || []);
  const out = [];
  for (const name of LAYER_ORDER) {
    const art = OVERLAYS[name];
    if (!art) continue;
    const keys = ALIASES[name] || [name];
    if (!keys.some((k) => f.has(k))) continue;
    out.push(art);
  }
  return out;
}
// De dos, seul ce qui se voit par derrière subsiste.
const BACK_LAYERS = new Set(['bald', 'shirt', 'singlet', 'vest', 'jacket', 'coat', 'sleeve', 'mask', 'cap', 'bandana', 'cowboy_hat', 'hood', 'long_hair', 'streak', 'bat']);
function layersForBack(def) {
  const f = new Set((def.look || {}).features || []);
  return LAYER_ORDER.filter((n) => BACK_LAYERS.has(n) && OVERLAYS[n]
    && (ALIASES[n] || [n]).some((k) => f.has(k))).map((n) => OVERLAYS[n]);
}

// Choix de l'archétype de corps. Le colosse est dessiné plus grand dans le même
// cadre : sa taille vient du dessin, pas d'un agrandissement — les pixels
// gardent donc exactement la même taille que ceux des autres lutteurs.
const isGiant = (def) => def.weight === 'super' || (def.size && def.size !== 1);

function compose(def, back, down) {
  const base = down ? BASE_DOWN
    : isGiant(def) ? BASE_GIANT
      : def.body === 'fem' && !back ? BASE_FEM
        : back ? BASE_BACK : BASE_FRONT;
  const grid = base.map((r) => [...r]);
  const apply = (layers) => {
    for (const layer of layers) {
      layer.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') grid[y][x] = ch; }));
    }
    return grid;
  };
  // Le colosse est dessiné dans son propre cadre : ses couches lui sont propres.
  if (isGiant(def) && !down) {
    const f = new Set((def.look || {}).features || []);
    return apply(Object.entries(GIANT_OVERLAYS)
      .filter(([n]) => (ALIASES[n] || [n]).some((k) => f.has(k)))
      .map(([, art]) => art));
  }
  // Au sol, la tête n'est plus au même endroit : les couches de tête ne
  // s'appliquent pas, seule la palette distingue les lutteurs.
  if (down) return grid;
  // De dos, on ne voit ni visage ni barbe : seules les couches de tête comptent.
  return apply(back ? layersForBack(def) : layersFor(def));
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
