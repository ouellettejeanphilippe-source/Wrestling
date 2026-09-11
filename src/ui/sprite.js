// ---------------------------------------------------------------------------
// SPRITES PIXEL — lutteurs dessinés sans aucune image externe.
//
// Méthode : on ne empile pas des rectangles, on décrit une SILHOUETTE ligne par
// ligne (une portée de pixels par rangée), comme on tracerait le contour dans un
// éditeur de pixel art. Le reste est calculé à partir de ce masque :
//   · le détourage (tout pixel bordant le vide reçoit un contour teinté),
//   · l'ombrage (bord gauche éclairé par la clé chaude, bord droit en rim light
//     froide, sommet lumineux, bas et jonctions de matières en occlusion),
//   · puis on tamponne les détails dessinés à la main (visage, muscles, tenue).
//
// Grille 32×48, rendue en SVG à arêtes franches, avec fusion des pixels voisins
// de même couleur pour garder un fichier léger.
//
// SPRITES DIRECTIONNELS sur les quatre diagonales de la projection isométrique :
//   'se' = vers +x (bas-droite à l'écran) : trois-quarts avant, tourné à droite
//   'sw' = vers +y (bas-gauche)           : le même, en miroir
//   'ne' = vers -y (haut-droite)          : trois-quarts arrière
//   'nw' = vers -x (haut-gauche)          : le même, en miroir
// ---------------------------------------------------------------------------
export { facingTo } from '../engine/grid.js';

export const SPRITE_W = 32;
export const SPRITE_H = 48;
const VIEWBOX = { full: `0 0 ${SPRITE_W} ${SPRITE_H}`, bust: '8 0 16 16' };

export const DIRECTIONS = ['se', 'sw', 'ne', 'nw'];
const POSE = {
  se: { back: false, mirror: false }, sw: { back: false, mirror: true },
  ne: { back: true, mirror: false }, nw: { back: true, mirror: true },
};

const SKIN = { light: '#f2c79b', tan: '#d79a68', brown: '#a96c3d', dark: '#7c4b28', pale: '#f8e2d2' };
const INK = '#160f20';
const WHITE = '#f8f4ee';
const KEY = '#ffeccb';        // lumière clé, chaude (haut-gauche)
const RIM = '#93b9ff';        // lumière d'appoint, froide (arête droite)

// ---------------------------------------------------------------- couleurs
const parse = (hex) => {
  let s = String(hex || '#888').replace('#', '');
  if (s.length === 3) s = s.split('').map((ch) => ch + ch).join('');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) || 0);
};
const mix = (hex, target, amount) => {
  const a = parse(hex), b = parse(target);
  return `#${a.map((n, i) => Math.round(n + (b[i] - n) * amount)).map((n) => n.toString(16).padStart(2, '0')).join('')}`;
};
const dark = (hex, a = 0.35) => mix(hex, '#000000', a);
const light = (hex, a = 0.3) => mix(hex, '#ffffff', a);

// Rampe : sept valeurs par matière, contour compris.
function ramp(hex) {
  return {
    lit: mix(mix(hex, KEY, 0.45), hex, 0.08),
    hi: mix(hex, KEY, 0.22),
    base: hex,
    sh2: mix(hex, '#2b1d3d', 0.17),
    sh: mix(hex, '#2b1d3d', 0.34),
    deep: mix(hex, '#140e22', 0.56),
    rim: mix(hex, RIM, 0.5),
    line: mix(hex, INK, 0.74),
  };
}

// ---------------------------------------------------------------- silhouette
// Chaque entrée : [rangée, x de début, x de fin] — le contour se lit ligne à ligne.
const mirrorSpans = (list) => list.map(([y, a, b]) => [y, SPRITE_W - 1 - b, SPRITE_W - 1 - a]);

const HEAD = [
  [3, 14, 17], [4, 13, 18], [5, 12, 19], [6, 12, 19], [7, 12, 19], [8, 12, 19],
  [9, 12, 19], [10, 12, 19], [11, 13, 19], [12, 13, 18], [13, 14, 17],
];
const NECK = [[13, 14, 18], [14, 14, 18], [15, 14, 18]];
const TORSO = [
  [15, 11, 21], [16, 9, 23], [17, 9, 23], [18, 9, 23], [19, 9, 23],
  [20, 10, 22], [21, 10, 22], [22, 10, 22],
  [23, 11, 21], [24, 11, 21], [25, 11, 21],
  [26, 10, 22], [27, 10, 22], [28, 10, 22],
];
const ARM_L = [
  [16, 7, 10], [17, 6, 10], [18, 6, 10], [19, 6, 10], [20, 6, 10],
  [21, 6, 9], [22, 6, 9], [23, 7, 9], [24, 7, 9], [25, 7, 9], [26, 7, 9],
  [27, 7, 10], [28, 6, 10], [29, 6, 10], [30, 7, 10],
];
const LEG_L = [
  [29, 11, 14], [30, 11, 14], [31, 11, 14], [32, 11, 14], [33, 11, 14], [34, 11, 14],
  [35, 11, 14], [36, 12, 14], [37, 12, 14], [38, 12, 14], [39, 12, 14], [40, 12, 14],
  [41, 12, 14], [42, 12, 14],
];
const BOOT_L = [
  [41, 11, 15], [42, 10, 15], [43, 10, 15], [44, 10, 15], [45, 10, 15], [46, 9, 15], [47, 9, 15],
];
const TRUNKS = [
  [25, 11, 21], [26, 10, 22], [27, 10, 22], [28, 10, 22],
  [29, 10, 14], [29, 17, 22], [30, 11, 14], [30, 17, 21],
];

// bibliothèque de coiffures : contour + volume, dessinés à la main
const HAIR_SHAPES = {
  short: [[1, 13, 18], [2, 12, 19], [3, 11, 20], [4, 11, 20], [5, 11, 12], [5, 19, 20], [6, 11, 11], [6, 20, 20]],
  long: [[1, 13, 18], [2, 12, 19], [3, 11, 20], [4, 10, 21], [5, 10, 11], [5, 20, 21], [6, 10, 11], [6, 20, 21],
    [7, 10, 11], [7, 20, 21], [8, 10, 11], [8, 20, 21], [9, 10, 11], [9, 20, 21], [10, 11, 12], [10, 20, 21],
    [11, 11, 12], [11, 19, 20], [12, 12, 12], [12, 19, 19]],
  messy: [[0, 13, 14], [0, 17, 18], [1, 12, 19], [2, 11, 20], [3, 11, 20], [4, 11, 20], [5, 11, 12], [5, 19, 20]],
  curly: [[0, 13, 18], [1, 11, 20], [2, 10, 21], [3, 10, 21], [4, 9, 22], [5, 9, 10], [5, 21, 22],
    [6, 9, 10], [6, 21, 22], [7, 10, 11], [7, 20, 21]],
  mohawk: [[-1, 14, 17], [0, 14, 17], [1, 14, 17], [2, 13, 18], [3, 13, 18], [4, 12, 19]],
  horseshoe: [[4, 11, 12], [5, 11, 12], [6, 11, 12], [7, 11, 12], [8, 11, 12], [9, 11, 12],
    [4, 19, 20], [5, 19, 20], [6, 19, 20], [7, 19, 20], [8, 19, 20], [9, 19, 20]],
  half: [[1, 16, 18], [2, 16, 19], [3, 16, 20], [4, 16, 20], [5, 19, 20], [6, 19, 21], [7, 20, 21], [8, 20, 21]],
  back: [[1, 13, 18], [2, 11, 20], [3, 11, 20], [4, 11, 20], [5, 11, 20], [6, 11, 20], [7, 11, 20],
    [8, 11, 20], [9, 11, 20], [10, 12, 19], [11, 12, 19], [12, 13, 18]],
};
const HATS = {
  cap: { shape: [[1, 12, 19], [2, 11, 20], [3, 11, 20], [4, 11, 20], [5, 11, 23], [6, 13, 22]], mat: 'accent' },
  bandana: { shape: [[2, 11, 20], [3, 10, 21], [4, 10, 21], [5, 10, 21], [6, 20, 23], [7, 20, 24], [8, 21, 24]], mat: 'accent' },
  cowboy_hat: { shape: [[0, 13, 18], [1, 12, 19], [2, 12, 19], [3, 11, 20], [4, 6, 25], [5, 5, 26], [6, 7, 24]], mat: 'accent' },
  hat: { shape: [[-2, 12, 19], [-1, 12, 19], [0, 12, 19], [1, 12, 19], [2, 12, 19], [3, 12, 19], [4, 8, 23], [5, 7, 24]], mat: 'dark' },
  hood: { shape: [[0, 12, 19], [1, 10, 21], [2, 9, 22], [3, 9, 22], [4, 9, 22], [5, 9, 10], [5, 21, 22],
    [6, 9, 10], [6, 21, 22], [7, 9, 10], [7, 21, 22], [8, 10, 11], [8, 20, 21]], mat: 'accent' },
  headband: { shape: [[4, 11, 20], [5, 11, 20]], mat: 'accent' },
  tiara: { shape: [[0, 15, 16], [1, 13, 18], [2, 12, 19]], mat: 'gold' },
  crown: { shape: [[0, 12, 12], [0, 15, 16], [0, 19, 19], [1, 12, 19], [2, 12, 19]], mat: 'gold' },
};

// ---------------------------------------------------------------- moteur
function makeGrid() { return Array.from({ length: SPRITE_H }, () => Array(SPRITE_W).fill(null)); }
function paint(g, list, mat, dx = 0) {
  for (const [y, a, b] of list) {
    if (y < 0 || y >= SPRITE_H) continue;
    for (let x = Math.max(0, a + dx); x <= Math.min(SPRITE_W - 1, b + dx); x++) g[y][x] = { mat, tone: 'base' };
  }
}
const at = (g, x, y) => (y >= 0 && y < SPRITE_H && x >= 0 && x < SPRITE_W ? g[y][x] : null);

// Ombrage déduit du masque : c'est lui qui donne le volume, pas des rectangles posés à la main.
function shade(g) {
  for (let y = 0; y < SPRITE_H; y++) {
    let x = 0;
    while (x < SPRITE_W) {
      const cur = g[y][x];
      if (!cur) { x++; continue; }
      let end = x;
      while (end + 1 < SPRITE_W && g[y][end + 1] && g[y][end + 1].mat === cur.mat) end++;
      const len = end - x + 1;
      for (let i = x; i <= end; i++) {
        const up = at(g, i, y - 1), down = at(g, i, y + 1);
        let tone = 'base';
        if (len > 3) {
          if (i === x) tone = 'lit';
          else if (i === x + 1 && len > 6) tone = 'hi';
          else if (i === end) tone = 'rim';
          else if (i === end - 1) tone = 'sh';
          else if (i === end - 2 && len > 8) tone = 'sh2';
        } else if (i === end && len > 1) tone = 'sh';
        if (!up || up.mat !== cur.mat) tone = i === end ? 'sh' : 'hi';       // arête supérieure
        if (!down || down.mat !== cur.mat) tone = 'deep';                     // appui / occlusion
        g[y][i].tone = tone;
      }
      x = end + 1;
    }
  }
}

// Détourage : un pixel de contour partout où la silhouette borde le vide.
function outline(g) {
  const out = [];
  for (let y = 0; y < SPRITE_H; y++) {
    for (let x = 0; x < SPRITE_W; x++) {
      if (g[y][x]) continue;
      const n = at(g, x - 1, y) || at(g, x + 1, y) || at(g, x, y - 1) || at(g, x, y + 1);
      if (n) out.push([x, y, n.mat]);
    }
  }
  return out;
}

// Rendu : on fusionne les pixels voisins de même couleur en un seul rectangle.
function render(g, outlinePx, palette) {
  const rows = [];
  const push = (x, y, w, color) => rows.push(`<rect x="${x}" y="${y}" width="${w}" height="1" fill="${color}"/>`);
  const back = [];
  for (const [x, y, mat] of outlinePx) back.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${(palette[mat] || palette.skin).line}"/>`);
  for (let y = 0; y < SPRITE_H; y++) {
    let x = 0;
    while (x < SPRITE_W) {
      const cell = g[y][x];
      if (!cell) { x++; continue; }
      const color = cell.color || (palette[cell.mat] || palette.skin)[cell.tone] || (palette[cell.mat] || palette.skin).base;
      let end = x;
      while (end + 1 < SPRITE_W) {
        const nx = g[y][end + 1];
        if (!nx) break;
        const nc = nx.color || (palette[nx.mat] || palette.skin)[nx.tone] || (palette[nx.mat] || palette.skin).base;
        if (nc !== color) break;
        end++;
      }
      push(x, y, end - x + 1, color);
      x = end + 1;
    }
  }
  return back.join('') + rows.join('');
}

// ---------------------------------------------------------------------------
export function spriteSvg(def, opts = {}) {
  const view = opts.view === 'bust' ? 'bust' : 'full';
  const dir = POSE[opts.dir] ? opts.dir : 'se';
  const back = POSE[dir].back;
  const L = def.look || {};
  const f = new Set(L.features || []);
  const skin = SKIN[L.skin] || L.skin || SKIN.light;
  const hair = L.hair || '#3b2a1a';
  const attire = L.attire || def.color || '#5a5a6e';
  const accent = L.accent || light(attire, 0.5);

  const palette = {
    skin: ramp(skin), hair: ramp(hair), attire: ramp(attire), accent: ramp(accent),
    boots: ramp(dark(attire, 0.45)), dark: ramp('#241d38'), gold: ramp('#ffc93c'),
    white: ramp(WHITE), red: ramp('#c0392f'), wood: ramp('#a97240'),
  };

  const g = makeGrid();
  const huge = f.has('big') || def.weight === 'super';
  const wide = huge ? 2 : def.weight === 'heavy' ? 1 : 0;   // élargissement des épaules
  const fx = back ? 0 : 1;                                   // décalage du visage en trois-quarts

  // --- corps : jambes, bottes, torse, bras (le masque d'abord, l'ombre ensuite)
  paint(g, LEG_L, 'skin'); paint(g, mirrorSpans(LEG_L), 'skin');
  paint(g, BOOT_L, 'boots'); paint(g, mirrorSpans(BOOT_L), 'boots');
  const torso = TORSO.map(([y, a, b]) => [y, a - wide, b + wide]);
  paint(g, torso, f.has('shirt') || f.has('suit') || f.has('jacket') ? 'accent' : 'skin');
  paint(g, NECK, 'skin');
  paint(g, TRUNKS.map(([y, a, b]) => [y, a - wide, b + wide]), 'attire');
  const armL = ARM_L.map(([y, a, b]) => [y, a - wide, b - (back ? 0 : 0)]);
  paint(g, armL, 'skin'); paint(g, mirrorSpans(armL), 'skin');
  paint(g, HEAD, 'skin', fx);

  // --- couches de tenue
  if (f.has('vest')) { paint(g, torso.filter(([y]) => y < 26).map(([y, a]) => [y, a, a + 3]), 'dark'); paint(g, torso.filter(([y]) => y < 26).map(([y, , b]) => [y, b - 3, b]), 'dark'); }
  if (f.has('jacket')) { paint(g, torso.filter(([y]) => y < 27).map(([y, a]) => [y, a, a + 4]), 'accent'); paint(g, torso.filter(([y]) => y < 27).map(([y, , b]) => [y, b - 4, b]), 'accent'); }
  if (f.has('singlet')) {
    paint(g, torso.filter(([y]) => y >= 16).map(([y, a]) => [y, a + 2, a + 4]), 'attire');
    paint(g, torso.filter(([y]) => y >= 16).map(([y, , b]) => [y, b - 4, b - 2]), 'attire');
  }
  if (f.has('scarf')) paint(g, [[15, 11, 21], [16, 10, 22], [17, 19, 22], [18, 19, 21]], 'accent');
  if (f.has('wristbands')) { const b = [[26, 7, 9], [27, 7, 10]]; paint(g, b, 'accent'); paint(g, mirrorSpans(b), 'accent'); }
  if (f.has('gloves')) { const b = [[26, 7, 9], [27, 7, 10], [28, 6, 10], [29, 6, 10], [30, 7, 10]]; paint(g, b, 'dark'); paint(g, mirrorSpans(b), 'dark'); }
  if (f.has('belt')) paint(g, [[26, 10 - wide, 22 + wide], [27, 10 - wide, 22 + wide]], 'gold');

  // --- masques et peintures faciales (recouvrent la tête)
  const masked = f.has('mask') || f.has('fiend_mask') || f.has('paint_full') || f.has('paint_evil');
  if (f.has('mask')) paint(g, HEAD, 'accent', fx);
  if (f.has('fiend_mask')) paint(g, HEAD, 'red', fx);
  if (f.has('paint_full') || f.has('paint_evil')) paint(g, HEAD, 'white', fx);

  // --- cheveux et couvre-chefs
  const hairKey = back ? 'back'
    : f.has('long_hair') ? 'long' : f.has('messy_hair') ? 'messy' : f.has('curly_hair') ? 'curly'
      : f.has('mohawk') ? 'mohawk' : f.has('horseshoe') ? 'horseshoe' : f.has('half_shaved') ? 'half'
        : f.has('short_hair') ? 'short' : null;
  const hasHair = !f.has('bald') && (hairKey || back);
  if (hasHair && !(back && (f.has('bald') || f.has('horseshoe')))) {
    if (back && f.has('long_hair')) paint(g, [...HAIR_SHAPES.back, [16, 12, 20], [17, 12, 20], [18, 12, 20], [19, 13, 19]], 'hair', fx);
    else if (back) paint(g, HAIR_SHAPES.back, 'hair', fx);
    else if (hairKey) paint(g, HAIR_SHAPES[hairKey], 'hair', fx);
  }
  for (const [name, hat] of Object.entries(HATS)) if (f.has(name)) paint(g, hat.shape, hat.mat, fx);

  // --- ombrage et contour calculés depuis le masque
  shade(g);
  const outlinePx = outline(g);

  // --- détails tamponnés par-dessus (couleurs absolues, hors rampe)
  const P = palette;
  const stamp = (x, y, w, color) => { for (let i = x; i < x + w; i++) { const cell = at(g, i, y); if (cell) cell.color = color; } };

  if (!back) {
    if (!masked || f.has('mask')) {
      const eyeY = 8, ex = fx;
      if (f.has('sunglasses')) { stamp(12 + ex, 7, 8, P.dark.base); stamp(12 + ex, 8, 8, P.dark.sh); stamp(13 + ex, 7, 2, P.dark.hi); }
      else if (f.has('goggles')) { stamp(12 + ex, 7, 8, '#2f8fd0'); stamp(13 + ex, 7, 3, light('#2f8fd0', 0.5)); }
      else {
        stamp(12 + ex, eyeY - 1, 3, P.hair.sh); stamp(16 + ex, eyeY - 1, 3, P.hair.sh);       // sourcils
        stamp(13 + ex, eyeY, 2, WHITE); stamp(17 + ex, eyeY, 2, WHITE);                       // blanc de l'œil
        stamp(13 + ex, eyeY, 1, mix(hair, INK, 0.35)); stamp(17 + ex, eyeY, 1, mix(hair, INK, 0.35));   // iris
        stamp(12 + ex, eyeY + 1, 3, P.skin.sh); stamp(16 + ex, eyeY + 1, 3, P.skin.sh);       // paupière basse
      }
      if (!f.has('mask')) {
        stamp(15 + ex, 10, 2, P.skin.sh); stamp(16 + ex, 10, 1, P.skin.deep);                 // nez
        stamp(14 + ex, 12, 4, P.skin.deep); stamp(14 + ex, 11, 4, P.skin.hi);                 // bouche
        stamp(12, 10, 2, mix(skin, '#e0705f', 0.26));                                          // pommette
      } else {
        stamp(14 + ex, 11, 4, P.skin.base); stamp(14 + ex, 12, 4, P.skin.sh);                 // bouche du masque
      }
    }
    if (f.has('paint_half')) for (let y = 3; y <= 13; y++) stamp(16, y, 4, INK);
    if (f.has('paint_evil')) { stamp(12, 7, 3, INK); stamp(17, 7, 3, INK); stamp(12, 8, 3, INK); stamp(17, 8, 3, INK); stamp(13, 12, 6, INK); }
    if (f.has('paint_full')) { stamp(12, 7, 3, INK); stamp(17, 7, 3, INK); stamp(13, 12, 6, INK); }
    if (f.has('fiend_mask')) { stamp(12, 7, 3, INK); stamp(17, 7, 3, INK); for (let y = 10; y <= 12; y++) stamp(12, y, 8, WHITE); for (let x = 13; x <= 19; x += 2) { stamp(x, 10, 1, INK); stamp(x, 11, 1, INK); stamp(x, 12, 1, INK); } }
    if (f.has('mask')) for (let y = 4; y <= 10; y += 3) stamp(12 + fx, y, 8, P.accent.sh);     // coutures du masque

    // pilosité
    if (f.has('beard_big')) { for (let y = 10; y <= 15; y++) stamp(11, y, 10, P.hair.base); stamp(11, 10, 3, P.hair.hi); stamp(14 + fx, 12, 4, P.skin.deep); }
    else if (f.has('beard')) { for (let y = 11; y <= 14; y++) stamp(12, y, 8, P.hair.base); stamp(12, 11, 3, P.hair.hi); stamp(14 + fx, 12, 4, P.skin.deep); }
    else if (f.has('goatee')) { for (let y = 12; y <= 14; y++) stamp(14 + fx, y, 4, P.hair.base); }
    else if (f.has('stubble')) { for (let y = 11; y <= 13; y++) stamp(12, y, 8, mix(hair, skin, 0.62)); stamp(14 + fx, 12, 4, P.skin.deep); }
    if (f.has('mustache')) { stamp(13 + fx, 11, 6, P.hair.base); stamp(13 + fx, 11, 2, P.hair.hi); }
  } else {
    stamp(14, 14, 5, P.skin.deep);                                                             // nuque
    if (f.has('mask')) for (let y = 5; y <= 11; y += 2) stamp(13, y, 6, P.hair.base);          // laçage du masque
  }

  // muscles / dos
  const cx0 = 10 - wide, cx1 = 22 + wide;
  if (!f.has('shirt') && !f.has('suit') && !f.has('jacket')) {
    if (!back) {
      stamp(cx0 + 1, 17, 4 + wide, P.skin.lit); stamp(cx1 - 4 - wide, 17, 4 + wide, P.skin.hi);   // pectoraux
      stamp(cx0 + 1, 19, 4 + wide, P.skin.sh); stamp(cx1 - 4 - wide, 19, 4 + wide, P.skin.sh);
      for (let y = 21; y <= 25; y += 2) { stamp(cx0 + 2, y, 3, P.skin.sh2); stamp(cx1 - 4, y, 3, P.skin.sh2); }
      for (let y = 17; y <= 25; y++) stamp(15, y, 2, P.skin.sh);                                  // sillon central
    } else {
      for (let y = 16; y <= 25; y++) stamp(15, y, 2, P.skin.sh);                                  // colonne
      stamp(cx0 + 1, 17, 4, P.skin.lit); stamp(cx1 - 4, 17, 4, P.skin.hi);                        // omoplates
      stamp(cx0 + 1, 19, 4, P.skin.sh); stamp(cx1 - 4, 19, 4, P.skin.sh);
      stamp(cx0 + 1, 25, cx1 - cx0 - 1, P.skin.deep);                                             // reins
    }
    if (f.has('tattoo_arms')) for (const ax of [6 - wide, 21 + wide]) { stamp(ax, 18, 4, '#2f4f3a'); stamp(ax, 20, 4, '#2f4f3a'); }
    if (f.has('chops') && !back) { stamp(cx0 + 2, 18, 2, '#e0453f'); stamp(cx0 + 5, 20, 2, '#e0453f'); stamp(cx1 - 5, 19, 2, '#e0453f'); }
  }
  if (f.has('suit') && !back) { stamp(14, 16, 5, WHITE); for (let y = 17; y <= 23; y++) stamp(15, y, 3, '#c1272d'); }
  if (f.has('chain')) { stamp(13, 16, 6, '#ffd34d'); stamp(15, 18, 2, '#ffb300'); }
  if (f.has('x_hands')) { stamp(6 - wide, 28, 5, INK); stamp(21 + wide, 28, 5, INK); }

  // lacets des bottes
  for (let y = 43; y <= 45; y += 2) { stamp(11, y, 4, P.boots.lit); stamp(17, y, 4, P.boots.lit); }

  // objets tenus
  const hand = 22 + wide;
  if (f.has('beer')) { for (let y = 28; y <= 33; y++) stamp(hand + 3, y, 4, y > 29 && y < 32 ? '#2f6fbe' : '#c9ccd6'); }
  if (f.has('bottle')) { for (let y = 26; y <= 33; y++) stamp(hand + 3, y, 3, '#39b7c4'); }
  if (f.has('teeth_jar')) { for (let y = 28; y <= 33; y++) stamp(hand + 3, y, 4, '#cfeef0'); }
  if (f.has('bat')) { for (let y = 20; y <= 33; y++) stamp(4 - wide, y, 3, y < 25 ? '#c79055' : '#a97240'); }
  if (f.has('lantern')) { for (let y = 28; y <= 33; y++) stamp(4 - wide, y, 4, y > 29 ? '#ffe28a' : '#f2a03c'); }
  if (f.has('skateboard')) { for (let y = 22; y <= 36; y++) stamp(3 - wide, y, 3, y % 6 === 0 ? accent : '#191723'); }
  if (f.has('ring')) stamp(hand + 2, 29, 1, '#ffd34d');
  if (f.has('bandage')) { stamp(cx0 + 1, 22, 4, '#efe6d8'); stamp(cx0 + 1, 23, 4, '#cfc4b4'); }
  if (f.has('lip_ring') && !back) stamp(14 + fx, 13, 1, '#c9ccd6');
  if (f.has('choker') && !back) stamp(14, 14, 5, INK);

  const svgBody = render(g, outlinePx, palette);
  const size = opts.size;
  const dim = size === undefined ? ''
    : size === 'fill' ? 'width="100%" height="100%"'
      : `width="${size}" height="${size * (view === 'full' ? SPRITE_H / SPRITE_W : 1)}"`;
  const mirror = POSE[dir].mirror || opts.facing === -1;
  const flip = mirror ? ` transform="translate(${SPRITE_W} 0) scale(-1 1)"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX[view]}" ${dim} shape-rendering="crispEdges" class="sprite sprite-${view}" preserveAspectRatio="xMidYMax meet"><g${flip}>${svgBody}</g></svg>`;
}

export function spriteBadgeSvg(def, opts = {}) {
  const bg = opts.bg || def.color || '#3d3b52';
  return `<span class="sprite-badge" style="--badge-bg:${bg}">${spriteSvg(def, { ...opts, view: 'bust', size: undefined })}</span>`;
}
