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
// Un lutteur occupe un carré de `size` cases, ancré en haut à gauche sur (x, y).
// Les colosses (weight 'super') tiennent sur 2×2 : ils bloquent plus de terrain,
// se font encadrer plus facilement, et ne rentrent pas partout.
export const unitSize = (u) => (u && u.size) || 1;
export function cellsOf(u) {
  const s = unitSize(u), out = [];
  for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) out.push({ x: u.x + dx, y: u.y + dy });
  return out;
}
export const occupies = (u, x, y) => {
  const s = unitSize(u);
  return x >= u.x && x < u.x + s && y >= u.y && y < u.y + s;
};
// Écart entre deux segments sur un axe : 0 s'ils se chevauchent, 1 s'ils se touchent.
const axisGap = (a0, al, b0, bl) => Math.max(0, a0 - (b0 + bl - 1), b0 - (a0 + al - 1));
// Distance de Manhattan entre deux gabarits (donc « === 1 » = corps à corps,
// quelle que soit la taille des deux lutteurs).
export function manhattan(a, b) {
  const as = unitSize(a), bs = unitSize(b);
  if (as === 1 && bs === 1) return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  return axisGap(a.x, as, b.x, bs) + axisGap(a.y, as, b.y, bs);
}

// Le gabarit de `unit` tient-il en (x, y) ? Renvoie null si non, sinon le coût de
// terrain (le plus cher des cases couvertes : un colosse à cheval sur les cordes
// paie le prix des cordes).
export function fitCost(grid, units, unit, x, y, opts = {}) {
  const s = unitSize(unit);
  const ghost = !!(unit.flags && unit.flags.ghost);
  let cost = 0;
  for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) {
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

// Construit une aréna 14x10. Le ring occupe x 3..10 / y 2..7 (cordes incluses).
export function buildArena(kind = 'standard') {
  const w = 14, h = 10;
  const g = createGrid(w, h, 'floor');
  g.arena = kind;
  g.ring = { x0: 4, y0: 3, x1: 9, y1: 6, rx0: 3, ry0: 2, rx1: 10, ry1: 7 };
  for (let x = 3; x <= 10; x++) {
    for (let y = 2; y <= 7; y++) {
      const ex = x === 3 || x === 10, ey = y === 2 || y === 7;
      setTile(g, x, y, ex && ey ? 'turnbuckle' : ex || ey ? 'rope' : 'ring');
    }
  }
  if (kind === 'cage') {
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) {
      const inCage = x >= 2 && x <= 11 && y >= 1 && y <= 8;
      const wall = inCage && (x === 2 || x === 11 || y === 1 || y === 8);
      if (!inCage) setTile(g, x, y, 'void');
      else if (wall) setTile(g, x, y, 'cage');
    }
    return g;
  }
  for (let y = 0; y < h; y++) setTile(g, 0, y, 'ramp');
  for (let x = 1; x < w; x++) { setTile(g, x, 0, 'barricade'); setTile(g, x, 9, 'barricade'); }
  setTile(g, 12, 4, 'table'); setTile(g, 12, 5, 'table');
  setTile(g, 2, 7, 'steps'); setTile(g, 11, 2, 'steps');
  if (kind === 'hardcore') { setTile(g, 2, 2, 'table'); setTile(g, 11, 7, 'table'); }
  if (kind === 'ladder') setTile(g, 6, 4, 'ladder');
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
