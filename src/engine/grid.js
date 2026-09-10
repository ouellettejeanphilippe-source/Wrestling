// Grille et terrain de l'aréna.
export const TERRAIN = {
  floor: { name: 'Plancher', cost: 1, passable: true, outside: true, icon: '' },
  ring: { name: 'Ring', cost: 1, passable: true, outside: false, icon: '' },
  rope: { name: 'Cordes', cost: 2, passable: true, outside: false, icon: '' },
  turnbuckle: { name: 'Coin (turnbuckle)', cost: 2, passable: true, outside: false, icon: '' },
  ramp: { name: "Rampe d'entrée", cost: 1, passable: true, outside: true, icon: '' },
  table: { name: 'Table des commentateurs', cost: 99, passable: false, outside: true, hazard: 25, breakable: true, icon: '🪑' },
  debris: { name: 'Table brisée', cost: 1, passable: true, outside: true, icon: '💥' },
  barricade: { name: 'Barricade', cost: 99, passable: false, outside: true, hazard: 10, icon: '' },
  steps: { name: "Marches d'acier", cost: 2, passable: true, outside: true, hazard: 12, icon: '🪜' },
  ladder: { name: 'Échelle', cost: 1, passable: true, outside: false, icon: '🏆' },
  cage: { name: "Mur de la cage", cost: 99, passable: false, outside: false, hazard: 15, icon: '' },
  void: { name: '—', cost: 99, passable: false, outside: false, icon: '' },
};

export const key = (x, y) => `${x},${y}`;

// ---------------------------------------------------------------- gabarits
// Un lutteur occupe un rectangle de cases, ancré en haut à gauche sur (x, y).
// `size` s'écrit au choix : 2 (carré 2×2), [3, 2] ou { w: 3, h: 2 }. De quoi
// avoir des colosses en 3×2, des poids lourds en 2×2 et des voltigeurs en 1×1
// (ou 1×2) sur la même grille.
export function sizeOf(u) {
  const s = u && u.size;
  if (!s) return { w: 1, h: 1 };
  if (typeof s === 'number') return { w: s, h: s };
  if (Array.isArray(s)) return { w: s[0] || 1, h: s[1] || s[0] || 1 };
  return { w: s.w || 1, h: s.h || 1 };
}
export const unitSize = (u) => Math.max(sizeOf(u).w, sizeOf(u).h);   // plus grande dimension
export function cellsOf(u) {
  const { w, h } = sizeOf(u), out = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) out.push({ x: u.x + dx, y: u.y + dy });
  return out;
}
export const occupies = (u, x, y) => {
  const { w, h } = sizeOf(u);
  return x >= u.x && x < u.x + w && y >= u.y && y < u.y + h;
};
// Écart entre deux segments sur un axe : 0 s'ils se chevauchent, 1 s'ils se touchent.
const axisGap = (a0, al, b0, bl) => Math.max(0, a0 - (b0 + bl - 1), b0 - (a0 + al - 1));
// Distance de Manhattan entre deux gabarits (donc « === 1 » = corps à corps,
// quelles que soient les tailles des deux lutteurs).
export function manhattan(a, b) {
  const A = sizeOf(a), B = sizeOf(b);
  if (A.w === 1 && A.h === 1 && B.w === 1 && B.h === 1) return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  return axisGap(a.x, A.w, b.x, B.w) + axisGap(a.y, A.h, b.y, B.h);
}

// Le gabarit de `unit` tient-il en (x, y) ? Renvoie null si non, sinon le coût de
// terrain (le plus cher des cases couvertes : un colosse à cheval sur les cordes
// paie le prix des cordes).
export function fitCost(grid, units, unit, x, y, opts = {}) {
  const { w, h } = sizeOf(unit);
  const ghost = !!(unit.flags && unit.flags.ghost);
  let cost = 0;
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
    const nx = x + dx, ny = y + dy;
    if (!inBounds(grid, nx, ny)) return null;
    const t = terrainAt(grid, nx, ny);
    if (!t.passable) return null;
    cost = Math.max(cost, t.cost);
    for (const o of units) {
      if (o === unit || o.eliminated || !occupies(o, nx, ny)) continue;
      if (opts.anyUnitBlocks) return null;
      if (o.team !== unit.team && !ghost) return null;   // les adversaires bloquent le passage
    }
  }
  return cost;
}
export const fits = (grid, units, unit, x, y, opts = {}) => fitCost(grid, units, unit, x, y, opts) !== null;

export function createGrid(w, h, fill = 'floor') {
  return { w, h, tiles: Array(w * h).fill(fill), ring: null, arena: 'standard' };
}
export const inBounds = (g, x, y) => x >= 0 && y >= 0 && x < g.w && y < g.h;
export const tileAt = (g, x, y) => (inBounds(g, x, y) ? g.tiles[y * g.w + x] : 'void');
export const setTile = (g, x, y, t) => { if (inBounds(g, x, y)) g.tiles[y * g.w + x] = t; };
export const terrainAt = (g, x, y) => TERRAIN[tileAt(g, x, y)];
export const isOutside = (g, x, y) => !!terrainAt(g, x, y).outside;
export const isRingFloor = (g, x, y) => ['ring', 'ladder'].includes(tileAt(g, x, y));
export const isOnRope = (g, x, y) => tileAt(g, x, y) === 'rope';
export const isOnTurnbuckle = (g, x, y) => tileAt(g, x, y) === 'turnbuckle';

export function neighbors(g, x, y) {
  const out = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, ny = y + dy;
    if (inBounds(g, nx, ny)) out.push([nx, ny]);
  }
  return out;
}
export function isAdjacentToTerrain(g, x, y, type) {
  return neighbors(g, x, y).some(([nx, ny]) => tileAt(g, nx, ny) === type);
}

// Construit une aréna 20×14. Le ring occupe x 4..15 / y 3..10 (cordes incluses),
// soit un tapis de 10×6 : de la place pour manœuvrer, et pour les gabarits qui
// tiennent sur plusieurs cases sans boucher tout le ring.
export function buildArena(kind = 'standard') {
  const w = 20, h = 14;
  const g = createGrid(w, h, 'floor');
  g.arena = kind;
  g.ring = { x0: 5, y0: 4, x1: 14, y1: 9, rx0: 4, ry0: 3, rx1: 15, ry1: 10 };
  for (let x = 4; x <= 15; x++) {
    for (let y = 3; y <= 10; y++) {
      const ex = x === 4 || x === 15, ey = y === 3 || y === 10;
      setTile(g, x, y, ex && ey ? 'turnbuckle' : ex || ey ? 'rope' : 'ring');
    }
  }
  if (kind === 'cage') {
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) {
      const inCage = x >= 2 && x <= 17 && y >= 1 && y <= 12;
      const wall = inCage && (x === 2 || x === 17 || y === 1 || y === 12);
      if (!inCage) setTile(g, x, y, 'void');
      else if (wall) setTile(g, x, y, 'cage');
    }
    return g;
  }
  for (let y = 0; y < h; y++) setTile(g, 0, y, 'ramp');
  for (let x = 1; x < w; x++) { setTile(g, x, 0, 'barricade'); setTile(g, x, 13, 'barricade'); }
  // table des commentateurs : trois places, côté cour
  for (let y = 6; y <= 8; y++) setTile(g, 18, y, 'table');
  setTile(g, 3, 11, 'steps'); setTile(g, 16, 2, 'steps');
  if (kind === 'hardcore') { setTile(g, 3, 2, 'table'); setTile(g, 16, 11, 'table'); }
  if (kind === 'ladder') setTile(g, 9, 6, 'ladder');
  return g;
}

// Tuiles atteignables (Dijkstra) avec coût de terrain. Les ennemis bloquent, les alliés se traversent.
export function reachable(grid, units, unit, mov, from = null) {
  const sx = from ? from.x : unit.x, sy = from ? from.y : unit.y;
  const start = key(sx, sy);
  const best = new Map([[start, { cost: 0, from: null, x: sx, y: sy }]]);
  const frontier = [{ x: sx, y: sy, cost: 0 }];
  while (frontier.length) {
    frontier.sort((a, b) => a.cost - b.cost);
    const cur = frontier.shift();
    for (const [nx, ny] of neighbors(grid, cur.x, cur.y)) {
      const step = fitCost(grid, units, unit, nx, ny);   // gabarit complet, terrain et adversaires
      if (step == null) continue;
      const c = cur.cost + step;
      if (c > mov) continue;
      const k = key(nx, ny);
      if (!best.has(k) || best.get(k).cost > c) {
        best.set(k, { cost: c, from: key(cur.x, cur.y), x: nx, y: ny });
        frontier.push({ x: nx, y: ny, cost: c });
      }
    }
  }
  // une case reste « atteignable mais bloquée » si on ne peut pas s'y arrêter
  for (const [k, v] of best) {
    if (k === start) continue;
    if (!fits(grid, units, unit, v.x, v.y, { anyUnitBlocks: true })) v.blocked = true;
  }
  return best;
}

// Chemin complet (sans limite de mouvement) vers une tuile cible ; renvoie la liste des tuiles.
export function pathTo(grid, units, unit, target) {
  const all = reachable(grid, units, unit, 999);
  const k = key(target.x, target.y);
  if (!all.has(k)) return null;
  const path = [];
  let cur = k;
  while (cur) { const n = all.get(cur); path.unshift({ x: n.x, y: n.y, cost: n.cost }); cur = n.from; }
  return path;
}

// Meilleure tuile atteignable en direction d'une cible (pour l'IA).
export function stepToward(grid, units, unit, target, mov) {
  const reach = reachable(grid, units, unit, mov);
  let best = null, bestD = manhattan(unit, target);
  for (const [, v] of reach) {
    if (v.blocked) continue;
    const d = manhattan(v, target);
    if (d < bestD || (d === bestD && best && v.cost < best.cost)) { bestD = d; best = v; }
  }
  return best;
}
