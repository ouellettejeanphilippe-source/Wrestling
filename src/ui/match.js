// Écran de match façon Fire Emblem / Banner Saga : portées visibles, menu contextuel près du lutteur,
// prévision de combat avant confirmation, barre d'équipe avec portraits, bannière de tour.
import { h, clear, sleep, bar, toast } from './dom.js';
import { unitCard } from './cards.js';
import { avatar } from './avatar.js';
import { WRESTLERS_BY_ID } from '../data/wrestlers.js';
import { listActions, executeAction, moveUnit, undoMove, getReachable, endPlayerPhase, enemySteps, endEnemyPhase, hitChance, computeDamage, getStats, moveRange, elanLabel, refState, reverseChance, winded, tapChance, novelty, moveUses, STAMINA_LOW } from '../engine/battle.js';
import { movePart, wearFrom, wearOf, wearLevel, wornParts, PARTS, WEAR_MAX, WEAR_HURT, WEAR_BROKEN } from '../engine/wear.js';
import { TERRAIN, tileAt, key, manhattan, sizeOf, heightAt, pathIn } from '../engine/grid.js';
import { deckState, isCard } from '../engine/hand.js';
import { unitAt, living } from '../engine/util.js';
import { MOVES, MOVE_TIER_LABEL, MOVE_TIERS } from '../data/moves.js';
import { describeFinish, evaluateDirectives, evaluateScript, starsText } from '../game/script.js';
import { matchPhase } from '../engine/phases.js';
import { activeCombos } from '../engine/battle.js';
import { winRoutes } from '../engine/rules.js';
import { showTutorial, tutorialSeen } from './tutorial.js';
import { matchStory } from '../game/story.js';

const TIER_ORDER = ['base', 'class', 'specialty', 'signature', 'finisher', 'script'];
const TIER_LABELS = { base: 'Base', class: `Classe · ⚡${MOVE_TIERS.class.unlock}+`, specialty: `Spécialité · ⚡${MOVE_TIERS.specialty.unlock}+`, signature: `Signature · ⚡${MOVE_TIERS.signature.unlock}+`, finisher: `Finisher · ⚡${MOVE_TIERS.finisher.unlock}`, script: 'Script' };
const ATTACK_TYPES = new Set(['strike', 'grapple', 'aerial', 'submission', 'weapon']);
const TILE_HELP = {
  floor: 'Plancher : hors du ring. Compte de l’arbitre dans les matchs avec règles.',
  ring: 'Tapis du ring.',
  rope: 'Cordes : TREMPLIN. Y entrer coûte 1, en repartir est GRATUIT — passer par les cordes fait aller plus loin qu’aller tout droit, et déclenche 💨 Course dans les cordes. Y être projeté étourdit. Rope break pour les soumissions. Bataille royale : on peut y être jeté par-dessus.',
  turnbuckle: 'Coin : coût 2, on y MONTE. Plongeons aériens +25 % depuis ici (et le dénivelé ajoute encore). Y être projeté = 10 dégâts + étourdi. Cage : point d’escalade.',
  ramp: 'Rampe d’entrée : hors du ring. Les renforts arrivent par ici.',
  table: 'Table des commentateurs : projetez-y quelqu’un pour 25 dégâts et un moment mémorable.',
  debris: 'Table brisée. Rien à voir ici, circulez.',
  barricade: 'Barricade : infranchissable. Y être projeté = 10 dégâts.',
  steps: 'Marches d’acier : coût 2. Y être projeté = 12 dégâts.',
  ladder: 'Échelle : grimpez deux tours de suite sans subir de dégâts pour la ceinture.',
  cage: 'Mur de la cage : infranchissable. Y être projeté = 15 dégâts.',
  void: '',
};
// LE MENU S'OUVRE SUR LA MAIN
//
// Classé par famille de coup, il décrivait un catalogue — « Attaquer », et
// dedans les dix-huit mouvements du lutteur. Il décrit maintenant une
// SITUATION : ce que j'ai pioché ce tour-ci, ce que je peux toujours faire, ce
// que la jauge a ouvert, et le ring. C'est dans cet ordre qu'on décide.
const enMain = (a, u) => !!(a.move && a.move.id && (u.hand || []).includes(a.move.id));
const estMerite = (a) => !!(a.move && ['signature', 'finisher'].includes(a.move.tier));
const CATS = [
  { id: 'main', icon: '🃏', name: 'Votre main', match: (a, u) => enMain(a, u) },
  { id: 'base', icon: '👊', name: 'Fondamentaux', match: (a, u) => !!a.move && !enMain(a, u) && !estMerite(a) && a.type !== 'taunt' },
  { id: 'merite', icon: '⚡', name: 'Mérité', match: (a) => estMerite(a) },
  { id: 'pin', icon: '🤝', name: 'Tombé', match: (a) => a.type === 'pin' },
  { id: 'taunt', icon: '📣', name: 'Provoquer', match: (a) => a.type === 'taunt' },
  { id: 'ring', icon: '🔔', name: 'Le ring', match: (a) => ['toss', 'climb', 'tag', 'pickup', 'scavenge', 'rollin', 'manager', 'sell', 'job'].includes(a.type) },
  { id: 'wait', icon: '⏳', name: 'Souffler', match: (a) => ['wait', 'redraw'].includes(a.type) },
];

const TOUCH = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover: none), (pointer: coarse), (max-width: 800px)').matches;

// Vue du plateau : 'iso' = caméra isométrique (losanges, lutteurs debout sur le
// tapis), 'top' = vue de dessus classique. Le choix est mémorisé.
const VIEW_KEY = 'ppw.boardView';
const ROT_KEY = 'ppw.boardRot';
// Rotation de caméra : quatre quarts de tour, comme dans un tactical faux-3D.
// Tourner permet de voir derrière une plateforme et de reprendre un angle de tir.
function boardRot() {
  try { return (Number(localStorage.getItem(ROT_KEY)) || 0) % 4; } catch { return 0; }
}
function setBoardRot(r) { try { localStorage.setItem(ROT_KEY, String(r)); } catch { /* mode privé */ } }
// Zoom de caméra : multiplicateur appliqué à la taille de case calculée par
// fitBoard. 1 = « tout le plateau tient à l'écran », au-delà on s'approche des
// sprites et le plateau devient défilable.
const ZOOM_KEY = 'ppw.boardZoom';
const ZOOM_MIN = 0.6, ZOOM_MAX = 3;
const clampZoom = (z) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
function boardZoom() {
  try { return clampZoom(Number(localStorage.getItem(ZOOM_KEY)) || 1); } catch { return 1; }
}
function setBoardZoom(z) { try { localStorage.setItem(ZOOM_KEY, String(z)); } catch { /* mode privé */ } }
// Hauteur des trois câbles et des poteaux, en cases (voir ringRopes).
const ROPE_LEVELS = [0.42, 0.74, 1.06];
const POST_H = 1.28;
// Les quatre directions du regard, dans l'ordre des quarts de tour (+x, +y, -x, -y).
const FACE_ORDER = ['se', 'sw', 'nw', 'ne'];
// Direction telle qu'elle apparaît À L'ÉCRAN une fois la caméra tournée.
function screenFacing(facing, rot) {
  const i = FACE_ORDER.indexOf(facing || 'se');
  return FACE_ORDER[(i + (i < 0 ? 0 : rot)) % 4] || 'se';
}
function boardView() {
  try { return localStorage.getItem(VIEW_KEY) === 'top' ? 'top' : 'iso'; } catch { return 'iso'; }
}
function setBoardView(v) { try { localStorage.setItem(VIEW_KEY, v); } catch { /* mode privé : tant pis */ } }

export function mountMatch(root, { battle, matchDef, onFinish, onContinue, onQuit }) {
  const ui = { sel: null, mode: 'idle', cat: null, action: null, pending: null, reach: null, atkRange: null, hover: null, hoverTile: null, hoverXY: null, inspect: null, busy: false, resultShown: false, acting: null };
  const g = battle.grid;
  clear(root);
  const el = {
    top: h('div', { class: 'm-top' }),
    board: h('div', { class: 'board', style: { gridTemplateColumns: `repeat(${g.w}, var(--cell))` } }),
    popover: h('div', { class: 'popover', hidden: true }),
    tileInfo: h('div', { class: 'tile-info' }),
    right: h('aside', { class: 'm-right' }),
    party: h('div', { class: 'partybar' }),
    log: h('details', { class: 'm-log', open: !TOUCH }),
    banner: h('div', { class: 'turn-banner', hidden: true }),
  };
  // La scène porte l'encombrement réel du losange isométrique : c'est elle qui
  // définit la zone de défilement, le plateau étant transformé (donc hors flux).
  const stage = h('div', { class: 'board-stage' }, el.board);
  const boardWrap = h('div', { class: `board-wrap view-${boardView()}`, style: { '--rows': g.h, '--cols': g.w, '--rot': boardRot() } }, stage);
  boardWrap.dataset.rot = boardRot();
  function rotateBoard(step) {
    const next = (boardRot() + step + 4) % 4;
    setBoardRot(next);
    boardWrap.style.setProperty('--rot', next);
    boardWrap.dataset.rot = next;
    render();
    fitBoard();
  }
  // Zoomer garde le centre de la vue en place : sans ça, s'approcher déporte le
  // plateau et on perd de vue le lutteur qu'on regardait.
  let zoom = boardZoom();
  function zoomBoard(mult, anchor) {
    const next = clampZoom(zoom * mult);
    if (next === zoom) return;
    const before = { w: boardWrap.scrollWidth, h: boardWrap.scrollHeight };
    const ax = anchor ? anchor.x : boardWrap.clientWidth / 2;
    const ay = anchor ? anchor.y : boardWrap.clientHeight / 2;
    const px = (boardWrap.scrollLeft + ax) / (before.w || 1);
    const py = (boardWrap.scrollTop + ay) / (before.h || 1);
    zoom = next;
    setBoardZoom(next);
    fitBoard();
    boardWrap.scrollLeft = px * boardWrap.scrollWidth - ax;
    boardWrap.scrollTop = py * boardWrap.scrollHeight - ay;
    renderTop();
  }
  function resetZoom() { zoom = 1; setBoardZoom(1); fitBoard(); renderTop(); }

  function toggleView() {
    const next = boardWrap.classList.contains('view-iso') ? 'top' : 'iso';
    boardWrap.classList.toggle('view-iso', next === 'iso');
    boardWrap.classList.toggle('view-top', next === 'top');
    setBoardView(next);
    render();
    fitBoard();
  }
  // Mise en scène façon tactical console : le plateau occupe tout l'écran et le
  // HUD flotte par-dessus (coins), pour laisser un maximum de place aux sprites.
  el.endTurn = h('div', { class: 'hud-endturn' });
  const scene = h('div', { class: 'm-scene' },
    boardWrap,
    h('div', { class: 'hud hud-tl' }, el.top),
    h('div', { class: 'hud hud-bl' }, el.right, el.tileInfo),
    h('div', { class: 'hud hud-br' }, el.endTurn, el.party, el.log),
    el.popover,
  );
  // Le jeu est pensé pour le paysage sur téléphone : en portrait, l'écran ne
  // laisse pas assez de largeur au losange. On le dit, sans bloquer.
  const rotate = h('div', { class: 'rotate-hint' },
    h('span', {}, '📱↻ Tournez votre appareil : le plateau a besoin de largeur.'),
    h('button', { class: 'btn small', onclick: () => rotate.remove() }, 'OK'));
  root.append(h('div', { class: `match ${TOUCH ? 'touch' : ''}` }, scene, el.banner, rotate));
  document.addEventListener('keydown', onKey);
  document.body.classList.add('in-match');
  window.addEventListener('resize', fitBoard);
  // Molette = zoom (la page ne défile pas, la molette n'a pas d'autre usage ici).
  // L'ancre est le curseur : on zoome là où on regarde.
  const onWheel = (e) => {
    e.preventDefault();
    const box = boardWrap.getBoundingClientRect();
    zoomBoard(e.deltaY < 0 ? 1.12 : 1 / 1.12, { x: e.clientX - box.left, y: e.clientY - box.top });
  };
  boardWrap.addEventListener('wheel', onWheel, { passive: false });
  // Pincer à deux doigts : même geste que dans une carte.
  let pinch = 0;
  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const onTouchStart = (e) => { if (e.touches.length === 2) pinch = dist(e.touches); };
  const onTouchMove = (e) => {
    if (e.touches.length !== 2 || !pinch) return;
    e.preventDefault();
    const d = dist(e.touches);
    if (Math.abs(d - pinch) < 12) return;
    const box = boardWrap.getBoundingClientRect();
    zoomBoard(d > pinch ? 1.12 : 1 / 1.12, {
      x: (e.touches[0].clientX + e.touches[1].clientX) / 2 - box.left,
      y: (e.touches[0].clientY + e.touches[1].clientY) / 2 - box.top,
    });
    pinch = d;
  };
  const onTouchEnd = () => { pinch = 0; };
  boardWrap.addEventListener('touchstart', onTouchStart, { passive: true });
  boardWrap.addEventListener('touchmove', onTouchMove, { passive: false });
  boardWrap.addEventListener('touchend', onTouchEnd, { passive: true });
  // Glisser pour déplacer la vue quand le plateau dépasse. Sous le seuil de
  // 6 px, c'est un clic sur une case : on ne lui vole pas son geste.
  let drag = null;
  const onDown = (e) => {
    if (e.button !== 0 || !boardWrap.classList.contains('zoomed')) return;
    drag = { x: e.clientX, y: e.clientY, sl: boardWrap.scrollLeft, st: boardWrap.scrollTop, moved: false };
  };
  const onMove = (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    drag.moved = true;
    boardWrap.classList.add('panning');
    boardWrap.scrollLeft = drag.sl - dx;
    boardWrap.scrollTop = drag.st - dy;
  };
  const onUp = (e) => {
    if (drag && drag.moved) { e.preventDefault(); e.stopPropagation(); }
    drag = null;
    boardWrap.classList.remove('panning');
  };
  boardWrap.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp, true);
  requestAnimationFrame(fitBoard);
  showBanner('🔔 DING DING DING !', 'start');
  render();
  if (!tutorialSeen()) showTutorial(root, {});

  // ------------------------------------------------------------ rendu global
  function render() {
    renderTop(); renderBoard(); renderPopover(); renderRight(); renderEndTurn(); renderParty(); renderLog(); flushEvents(); fitBoard();
    if (battle.result && !ui.resultShown) { ui.resultShown = true; setTimeout(showResult, 1100); }
  }

  function renderTop() {
    clear(el.top);
    const r = battle.rules;
    const phase = battle.result ? 'Terminé' : battle.phase === 'player' ? 'Votre tour' : 'Tour adverse';
    const survive = r.victory === 'survive' ? ` · Survivre ${Math.min(battle.turn, battle.match.turns)}/${battle.match.turns}` : '';
    const mp = matchPhase(battle);
    el.top.append(
      h('div', { class: `phase-badge ${battle.phase}` }, h('b', {}, `Tour ${battle.turn}`), h('span', {}, phase + survive)),
      h('div', { class: `act-badge act-${mp.key}`, title: mp.desc },
        h('b', {}, `${mp.icon} ${mp.name}`), h('span', {}, mp.short)),
      h('div', { class: 'm-title' }, h('b', {}, battle.match.title || r.name),
        h('span', { class: 'muted' }, ` ${r.icon} ${r.name}${battle.mode === 'scenario' ? ' · 🎬 Scénarios' : ''}`),
        refBadge(), mgrBadge('player'), mgrBadge('enemy')),
      h('div', { class: 'heat' }, h('span', { class: 'lbl' }, '🔥 Chaleur'), bar(battle.heat, 100, 'heatbar', `${battle.heat}`)),
      h('button', { class: 'btn small ghost', title: 'Basculer entre la caméra isométrique et la vue de dessus', onclick: toggleView }, boardWrap.classList.contains('view-iso') ? '🎥 Vue iso' : '🗺️ Vue dessus'),

      h('button', { class: 'btn small ghost', onclick: () => showTutorial(root, {}) }, '📖 Aide'),
      h('button', { class: 'btn small ghost', onclick: () => { if (confirm('Abandonner ce match ? (compte comme une défaite)')) { cleanup(); onQuit(); } } }, 'Quitter'),
    );
    // Le bouton de rotation n'a de sens qu'en vue isométrique. On l'ajoute à
    // part : append() écrirait « null » si on lui passait une branche vide.
    const before = el.top.lastChild.previousSibling;
    if (boardWrap.classList.contains('view-iso')) {
      el.top.insertBefore(
        h('button', { class: 'btn small ghost', title: 'Tourner la caméra d’un quart de tour (touche R, Maj+R dans l’autre sens)', onclick: () => rotateBoard(1) }, '↻ Tourner'),
        before,
      );
    }
    el.top.insertBefore(h('span', { class: 'zoom-ctl' },
      h('button', { class: 'btn small ghost', title: 'Dézoomer (touche −)', disabled: zoom <= ZOOM_MIN + 1e-6, onclick: () => zoomBoard(1 / 1.25) }, '−'),
      h('button', { class: 'btn small ghost zoom-val', title: 'Revenir au plateau entier (touche 0)', onclick: resetZoom }, `${Math.round(zoom * 100)} %`),
      h('button', { class: 'btn small ghost', title: 'Zoomer (touche +)', disabled: zoom >= ZOOM_MAX - 1e-6, onclick: () => zoomBoard(1.25) }, '+'),
    ), before);
  }

  function renderObjectives() {
    const r = battle.rules;
    const items = [];
    if (battle.mode === 'scenario' && battle.script) {
      const ev = evaluateScript(battle, battle.script);
      items.push(h('div', { class: 'obj-script' }, '🎬 ', battle.script.summary));
      items.push(h('div', { class: `obj-item ${battle.result ? (ev.finishOk ? 'done' : 'fail') : ''}` }, `${battle.result ? (ev.finishOk ? '✅' : '❌') : '📜'} Finish : ${describeFinish(battle.script.finish)}`));
      for (const b of ev.beats) { const pending = b.final && !battle.result; items.push(h('div', { class: `obj-item ${b.done && !pending ? 'done' : ''}` }, `${pending ? (b.done ? '⏳' : '⬜') : b.done ? '✅' : '⬜'} ${b.name} — ${b.desc}`)); }
      items.push(h('div', { class: 'obj-item muted' }, `Note en direct : ${starsText(ev.stars)}`));
    } else if (matchDef && matchDef.directives && matchDef.directives.length) {
      for (const d of evaluateDirectives(battle, matchDef.directives)) { const pending = d.final && !battle.result; items.push(h('div', { class: `obj-item ${d.done && !pending ? 'done' : ''}` }, `${pending ? (d.done ? '⏳' : '⬜') : d.done ? '✅' : '⬜'} ${d.name} — ${d.desc} (+${d.reward.fans} fans, +${d.reward.money} $)`)); }
    }
    return h('details', { class: 'objectives', open: ui.mode === 'idle' && !ui.inspect && !ui.hover },
      h('summary', {}, `🎯 Objectif : ${r.name}`, items.length ? h('span', { class: 'muted' }, ` · ${items.length - (battle.mode === 'scenario' ? 2 : 0)} bonus`) : null),
      h('div', { class: 'obj-rule' }, r.desc), items);
  }

  // ------------------------------------------------------------ plateau
  function renderBoard() {
    clear(el.board);
    const reach = ui.mode === 'move' ? ui.reach : null;
    // Chemin prévu jusqu'à la case survolée : on remonte les liens du Dijkstra.
    const path = new Set();
    if (reach && ui.hoverXY) {
      let k = key(ui.hoverXY.x, ui.hoverXY.y);
      let guard = 0;
      while (k && reach.has(k) && guard++ < 200) { path.add(k); k = reach.get(k).from; }
    }
    const atk = ui.mode === 'move' ? ui.atkRange : null;
    const targets = ui.mode === 'target' ? new Map(ui.action.targets.filter((t) => t.unit).map((t) => [key(t.unit.x, t.unit.y), t])) : null;
    const threat = ui.hover && ui.hover.team === 'enemy' && !ui.hover.eliminated && ui.mode === 'idle' ? threatRange(ui.hover) : null;
    // Les cases qui débloqueraient la carte survolée.
    const setup = ui.setupFor && ui.sel ? setupTiles(ui.sel, ui.setupFor) : null;
    // Ordre du peintre : on dessine du fond vers l'avant, sinon une case
    // surélevée recouvre les lutteurs qui se tiennent derrière elle. La
    // profondeur écran dépend de l'angle de caméra ; la position dans la
    // grille, elle, est posée explicitement (sinon l'ordre casserait la mise
    // en page).
    const rot = boardRot();
    const depth = (x, y) => (rot === 0 ? x + y : rot === 1 ? x - y : rot === 2 ? -(x + y) : y - x);
    const order = [];
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) order.push([x, y]);
    order.sort((a, b) => depth(a[0], a[1]) - depth(b[0], b[1]));
    {
      for (const [x, y] of order) {
        const tile = tileAt(g, x, y);
        const k = key(x, y);
        const lvl = heightAt(g, x, y);
        const cell = h('div', { class: `cell t-${tile}${lvl ? ' raised' : ''}`, 'data-x': x, 'data-y': y, 'data-p': (x + y) % 2, style: lvl ? { '--lvl': lvl } : {}, onclick: () => onCell(x, y), onpointerenter: (e) => { if (e.pointerType === 'mouse') onHover(x, y); }, onpointerleave: (e) => { if (e.pointerType === 'mouse') onHover(null); } });
        if (TERRAIN[tile].icon) cell.append(h('span', { class: 'ticon' }, TERRAIN[tile].icon));
        if (reach && reach.get(k) && !reach.get(k).blocked) cell.classList.add('reach');
        if (path.has(k)) cell.classList.add('path');
        else if (atk && atk.has(k)) cell.classList.add('atk');
        if (threat && threat.has(k)) cell.classList.add('threat');
        if (setup && setup.has(k)) cell.classList.add('setup');
        if (targets && targets.has(k)) {
          cell.classList.add('target');
          const t = targets.get(k);
          const b = t.hit != null ? `${t.hit} %` : t.chance != null ? `${Math.round(t.chance * 100)} %` : '';
          if (b) cell.append(h('span', { class: 'badge' }, b));
        }
        const item = battle.items.find((i) => i.x === x && i.y === y);
        if (item) cell.append(h('span', { class: 'item', title: item.weapon.name }, item.weapon.icon));
        const u = unitAt(battle, x, y);
        if (u) {
          // marquage au sol aux couleurs de l'équipe : posé sur la case, donc
          // parfaitement aligné sur le losange (c'est le repère le plus lisible)
          const mark = h('span', { class: `tile-mark team-${u.team}${ui.sel === u ? ' sel' : ''}${u.acted && u.team === 'player' ? ' acted' : ''}` });
          cell.append(mark);
        }
        if (u && (u.x !== x || u.y !== y)) cell.classList.add('unit-body');   // reste du gabarit
        if (u && u.x === x && u.y === y) {
          const tok = unitToken(u);
          if (ui.sel === u) tok.classList.add('selected');
          if (ui.acting === u) tok.classList.add('acting');
          // en isométrie, un lutteur plus « en avant » (x + y grand) passe devant
          tok.style.zIndex = 10 + x + y + heightAt(g, x, y);
          tok.style.setProperty('--lvl', heightAt(g, x, y));
          cell.append(tok);
        }
        cell.style.gridColumn = String(x + 1);
        cell.style.gridRow = String(y + 1);
        el.board.append(cell);
      }
    }
    // Décor du ring, hors du flux de la grille (sinon il décalerait les cases) et
    // peint après elles, mais sous les lutteurs :
    //   · le tablier, qui donne au ring son épaisseur de plateforme surélevée
    //   · le marquage central, repère fixe pour se situer
    const ring = g.ring;
    if (ring) {
      const box = (x0, y0, w, hh, cls, kid) => h('div', {
        class: cls,
        style: {
          left: `calc(${x0} * (var(--cell) + 2px))`,
          top: `calc(${y0} * (var(--cell) + 2px))`,
          width: `calc(${w} * (var(--cell) + 2px))`,
          height: `calc(${hh} * (var(--cell) + 2px))`,
        },
      }, kid || null);
      const cx = (ring.x0 + ring.x1 + 1) / 2, cy = (ring.y0 + ring.y1 + 1) / 2;
      el.board.append(box(cx - 2, cy - 1, 4, 2, 'ring-logo', h('span', {}, 'PPW')));
      if (boardWrap.classList.contains('view-iso')) {
        // Les cordes s'insèrent dans l'ordre du peintre, comme les cases : un
        // z-index ne suffirait pas, puisque chaque case surélevée est
        // transformée, donc forme son propre contexte d'empilement.
        for (const { el: rope, depth: d } of ringRopes(ring, depth)) {
          const after = [...el.board.children].find((c) => c.dataset.x !== undefined
            && depth(Number(c.dataset.x), Number(c.dataset.y)) > d);
          el.board.insertBefore(rope, after || null);
        }
      }
    }
  }


  // CORDES EN FAUX 3D
  //
  // Une corde est un ruban posé le long d'une arête du ring, puis décalé à
  // parts égales sur les deux axes de la grille : après la projection
  // isométrique, ce décalage tombe pile vers le haut de l'écran, donc le ruban
  // « monte » au-dessus du tapis sans quitter la 2D. Trois hauteurs, quatre
  // côtés, quatre poteaux.
  //
  // Ce qui fait la lecture, c'est l'occultation : les deux côtés du fond
  // passent derrière les lutteurs, les deux côtés de devant passent par-dessus.
  // Sans ça, les cordes ne sont qu'un décor peint.
  function ringRopes(ring, depth) {
    const rot = boardRot();
    // « vers le haut de l'écran », exprimé dans le repère de la grille
    const LX = [-1, -1, 1, 1][rot], LY = [-1, 1, 1, -1][rot];
    const px = (n) => `calc(${n} * (var(--cell) + 2px))`;
    const up = (n) => `translate(${px(LX * n)}, ${px(LY * n)})`;
    const x0 = ring.rx0, y0 = ring.ry0, x1 = ring.rx1 + 1, y1 = ring.ry1 + 1;
    const out = [];
    const sides = [
      { left: x0, top: y0, w: x1 - x0, horiz: true },
      { left: x0, top: y1, w: x1 - x0, horiz: true },
      { left: x0, top: y0, w: y1 - y0, horiz: false },
      { left: x1, top: y0, w: y1 - y0, horiz: false },
    ];
    // Profondeur d'un côté : celle de son milieu, comme pour une case. Le côté
    // du fond se glisse ainsi juste après le tablier qu'il longe et juste avant
    // les lutteurs du tapis ; celui de devant passe après tout le monde.
    for (const s of sides) {
      const mx = s.horiz ? (s.left + s.w / 2) : s.left;
      const my = s.horiz ? s.top : (s.top + s.w / 2);
      for (let i = 0; i < ROPE_LEVELS.length; i++) {
        out.push({
          depth: depth(mx, my),
          el: h('div', {
            class: `ring-rope ${s.horiz ? 'h' : 'v'} rope-${i}`,
            style: {
              left: px(s.left), top: px(s.top),
              [s.horiz ? 'width' : 'height']: px(s.w),
              transform: up(ROPE_LEVELS[i]),
            },
          }),
        });
      }
    }
    for (const [cx2, cy2] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) {
      out.push({
        depth: depth(cx2, cy2),
        el: h('div', {
          class: 'ring-post',
          style: { left: px(cx2), top: px(cy2), '--post': px(POST_H), transform: up(POST_H) },
        }),
      });
    }
    return out;
  }

  function threatRange(enemy) {
    const set = new Set();
    if (enemy.down) return set;
    const reach = getReachable(battle, enemy);
    const range = maxAttackRange(enemy);
    for (const v of reach.values()) {
      if (v.blocked) continue;
      for (let dx = -range; dx <= range; dx++) for (let dy = -range; dy <= range; dy++) {
        if (Math.abs(dx) + Math.abs(dy) > range || (dx === 0 && dy === 0)) continue;
        set.add(key(v.x + dx, v.y + dy));
      }
      set.add(key(v.x, v.y));
    }
    return set;
  }
  function maxAttackRange(u) {
    let r = 1;
    for (const m of u.moves) { const mv = MOVES[m]; if (!mv || !ATTACK_TYPES.has(mv.type)) continue; if (mv.requires && mv.requires.turnbuckle && !u.flags.ignoreTurnbuckle) continue; if (mv.cost && u.momentum < mv.cost) continue; r = Math.max(r, mv.range[1]); }
    return r;
  }
  function attackRangeFrom(reach, u) {
    const set = new Set();
    const range = maxAttackRange(u);
    for (const v of reach.values()) {
      if (v.blocked && !(v.x === u.x && v.y === u.y)) continue;
      for (let dx = -range; dx <= range; dx++) for (let dy = -range; dy <= range; dy++) {
        if (Math.abs(dx) + Math.abs(dy) > range || (dx === 0 && dy === 0)) continue;
        const k = key(v.x + dx, v.y + dy);
        if (!reach.has(k) || reach.get(k).blocked) set.add(k);
      }
    }
    return set;
  }

  // Nom court pour la plaque au-dessus du sprite (« Stone Cold Steve Boston » est
  // illisible à cette taille).
  function shortName(name) {
    const parts = name.replace(/\(.*\)/, '').trim().split(/\s+/);
    return parts.length > 2 ? `${parts[0]} ${parts[parts.length - 1]}` : name;
  }

  function unitToken(u) {
    const def = WRESTLERS_BY_ID[u.id];
    const icons = [];
    if (u.statuses.dazed) icons.push('😵');
    if (u.statuses.cursed) icons.push('🕯️');
    if (u.statuses.finished) icons.push('☠️');
    if (u.weapon) icons.push(u.weapon.icon);
    if (battle.rules.tag && u.legal) icons.push('⭐');
    if (u.acted && u.team === 'player' && battle.phase === 'player') icons.push('✔');
    if (u.climb > 0) icons.push('🧗');
    if (u.outsideCount > 0 && battle.rules.countOut) icons.push(`⏱${u.outsideCount}`);
    const { w: uw, h: uh } = sizeOf(u);
    const big = uw > 1 || uh > 1;
    const hurt = u.hp / u.maxHp <= 0.4;
    const cls = `unit team-${u.team}${big ? ' big' : ''}${hurt ? ' hurt' : ''}${u.down ? ' down' : ''}${u.acted && u.team === 'player' && battle.phase === 'player' ? ' acted' : ''}`;
    return h('div', {
      class: cls,
      // le gabarit pilote la taille et le recentrage du sprite (voir styles.css)
      style: big ? { '--uw': uw, '--uh': uh } : {},
      title: `${u.name} — ${u.hp}/${u.maxHp} PV, momentum ${u.momentum}${big ? ` · gabarit ${uw}×${uh} cases` : ''}`,
    },
      h('span', { class: 'unit-shadow' }),
      avatar(def, 0, { fill: true, view: 'full', bg: 'none', anim: true, dir: screenFacing(u.facing, boardRot()), pose: u.down ? 'down' : null }),
      h('div', { class: 'mini hp' }, h('div', { style: { width: `${(u.hp / u.maxHp) * 100}%` } })),
      h('div', { class: 'mini mom' }, h('div', { style: { width: `${u.momentum}%` } })),
      icons.length ? h('span', { class: 'sicons' }, icons.join('')) : null,
      // Plaque de nom : visible pour le lutteur sélectionné, celui qu'on survole,
      // et ceux qui sont en danger — pas pour tout le monde tout le temps.
      h('span', { class: 'uname' }, h('b', {}, shortName(u.name)), h('i', {}, `${u.hp}`)),
    );
  }

  // ------------------------------------------------------------ menu contextuel (popover)
  function renderPopover() {
    const pop = el.popover;
    clear(pop);
    const sheetModes = TOUCH ? ['menu', 'list', 'target'] : ['menu'];
    if (!ui.sel || !sheetModes.includes(ui.mode) || battle.result) { pop.hidden = true; document.body.classList.remove('sheet-open'); return; }
    const u = ui.sel;
    if (TOUCH && ui.mode === 'list') {
      pop.append(h('div', { class: 'pop-head' }, h('button', { class: 'btn small ghost', onclick: () => { ui.mode = 'menu'; ui.cat = null; render(); } }, '← Menu'), h('b', {}, `${ui.cat.icon} ${ui.cat.name}`)));
      pop.append(renderActionList(u, listActions(battle, u).filter((a) => ui.cat.match(a, u))));
      pop.hidden = false; document.body.classList.add('sheet-open'); return;
    }
    if (TOUCH && ui.mode === 'target') {
      pop.append(h('div', { class: 'pop-head' }, h('button', { class: 'btn small ghost', onclick: () => { ui.mode = ui.cat ? 'list' : 'menu'; ui.action = null; ui.pending = null; render(); } }, '← Retour'), h('b', {}, ui.action.name)));
      const t = ui.pending || (ui.action.targets.length === 1 ? ui.action.targets[0] : null);
      if (t) {
        pop.append(renderForecast(u, t, true));
        pop.append(h('button', { class: 'pop-btn hot confirm', onclick: () => doAction(ui.action.id, { unit: t.unit }) }, `✅ Confirmer : ${ui.action.name} sur ${t.unit.name}`));
      } else pop.append(h('div', { class: 'hint' }, 'Touchez une cible (cases rouges) pour voir la prévision.'));
      pop.hidden = false; document.body.classList.add('sheet-open'); return;
    }
    const actions = listActions(battle, u);
    if (u.onlyPin) {
      const pin = actions.find((a) => a.id === 'pin');
      pop.append(h('div', { class: 'pop-title' }, '☠️ Finisher réussi !'));
      pop.append(h('button', { class: 'pop-btn hot', disabled: !pin || !pin.ok, onclick: () => pin && chooseAction(pin) }, '🤝 COUVRIR !', h('small', {}, pin && pin.targets[0] ? `${Math.round(pin.targets[0].chance * 100)} %` : pin ? pin.reason : '')));
      pop.append(h('button', { class: 'pop-btn', onclick: () => doAction('wait', null) }, '⏳ Ne pas couvrir'));
    } else {
      for (const c of CATS) {
        const list = actions.filter((a) => c.match(a, u));
        if (!list.length) continue;
        const okList = list.filter((a) => a.ok);
        const btn = h('button', { class: `pop-btn ${okList.length ? '' : 'off'}`, disabled: !okList.length, onclick: () => openCategory(c, list) },
          `${c.icon} ${c.name}`, h('small', {}, c.id === 'wait' ? 'Récupère 4 PV' : c.id === 'pin' && okList[0] ? `${Math.round(okList[0].targets[0].chance * 100)} %` : okList.length ? `${okList.length} option${okList.length > 1 ? 's' : ''}` : list[0].reason));
        pop.append(btn);
      }
    }
    if (u.moved && !u.acted) pop.append(h('button', { class: 'pop-btn ghost', onclick: () => { undoMove(battle, u); select(u); } }, '↩ Annuler le déplacement'));
    pop.append(h('button', { class: 'pop-btn ghost', onclick: deselect }, '✖ Fermer'));
    pop.hidden = false;
    document.body.classList.add('sheet-open');
    if (!TOUCH) placePopover(u);
  }
  function placePopover(u) {
    const cell = el.board.querySelector(`.cell[data-x="${u.x}"][data-y="${u.y}"]`);
    if (!cell) return;
    const b = boardWrap.getBoundingClientRect(), c = cell.getBoundingClientRect();
    const left = c.right - b.left + 8, top = c.top - b.top - 8;
    const flip = u.x >= g.w - 4;
    el.popover.style.left = flip ? `${c.left - b.left - 8}px` : `${left}px`;
    el.popover.style.transform = flip ? 'translateX(-100%)' : '';
    el.popover.style.top = `${Math.max(0, Math.min(top, b.height - el.popover.offsetHeight - 8))}px`;
  }

  function openCategory(c, list) {
    const ok = list.filter((a) => a.ok);
    if (c.id === 'wait') { doAction('wait', null); return; }
    if (c.id === 'pin') { chooseAction(ok[0]); return; }
    if (ok.length === 1 && c.id === 'taunt') { chooseAction(ok[0]); return; }
    ui.cat = c; ui.mode = 'list'; render();
  }

  // ------------------------------------------------------------ panneau droit
  function renderRight() {
    clear(el.right);
    const u = ui.sel;
    if (TOUCH && (ui.mode === 'list' || ui.mode === 'target') && u) {
      el.right.append(h('div', { class: 'hint' }, ui.mode === 'target' ? 'Touchez une cible rouge, puis confirmez dans le panneau du bas.' : 'Choisissez un mouvement dans le panneau du bas.'));
      el.right.append(unitCard(battle, u, { class: 'selected compact' }));
      el.right.append(renderObjectives());
      return;
    }
    if (ui.mode === 'list' && u) {
      const actions = listActions(battle, u).filter((a) => ui.cat.match(a, u));
      el.right.append(h('div', { class: 'panel-head' }, h('button', { class: 'btn small ghost', onclick: () => { ui.mode = 'menu'; ui.cat = null; render(); } }, '← Menu'), h('b', {}, `${ui.cat.icon} ${ui.cat.name}`)));
      el.right.append(renderActionList(u, actions));
      el.right.append(unitCard(battle, u, { class: 'selected compact' }));
      return;
    }
    if (ui.mode === 'target' && u) {
      el.right.append(h('div', { class: 'panel-head' }, h('button', { class: 'btn small ghost', onclick: () => { ui.mode = ui.cat ? 'list' : 'menu'; ui.action = null; render(); } }, '← Retour'), h('b', {}, ui.action.name)));
      const hoverTarget = ui.hover && ui.action.targets.find((t) => t.unit === ui.hover);
      const only = ui.action.targets.length === 1 ? ui.action.targets[0] : null;
      const t = hoverTarget || only;
      if (t) el.right.append(renderForecast(u, t));
      else el.right.append(h('div', { class: 'hint' }, 'Survolez une cible (cases rouges) pour voir la prévision, cliquez pour confirmer.'));
      if (ui.action.desc) el.right.append(h('div', { class: 'muted small' }, ui.action.desc));
      return;
    }
    if (u) {
      el.right.append(h('div', { class: 'hint' }, ui.mode === 'move' ? '🟦 Se déplacer · 🟥 portée d’attaque · cliquez le lutteur pour agir sur place' : 'Choisissez une action dans le menu.'));
      el.right.append(unitCard(battle, u, { class: 'selected' }));
    }
    const insp = ui.hover && ui.hover !== u ? ui.hover : ui.inspect && ui.inspect !== u ? ui.inspect : null;
    if (insp) el.right.append(h('div', { class: 'inspect-label' }, insp.team === 'enemy' ? '🔍 Adversaire (zone de menace en rouge)' : '🔍 Inspection'), unitCard(battle, insp));
    if (!u && !insp) el.right.append(h('div', { class: 'hint' }, battle.phase === 'player' ? '👉 Choisissez un lutteur (survolez un adversaire pour voir sa zone de menace)' : 'Tour adverse…'));
    el.right.append(renderObjectives());
    el.right.append(renderRoutes());
  }

  function renderEndTurn() {
    clear(el.endTurn);
    if (battle.result) return;
    const left = living(battle, 'player').filter((x) => !x.acted && !x.down).length;
    el.endTurn.append(h('button', { class: 'btn primary wide', disabled: ui.busy || battle.phase !== 'player', onclick: endTurn }, `⏭ Fin du tour (${left})`));
  }

  function renderRoutes() {
    const routes = winRoutes(battle);
    const ready = routes.filter((r) => r.ready).length;
    return h('details', { class: 'routes' },
      h('summary', {}, `🏆 Comment gagner · ${routes.length} route(s)`, ready ? h('span', { class: 'route-ready' }, ` ${ready} à portée`) : null),
      routes.map((r) => h('div', { class: `route ${r.ready ? 'ready' : ''}` },
        h('b', {}, `${r.icon} ${r.name}`), h('span', { class: 'route-how' }, r.how), r.state ? h('span', { class: 'route-state' }, r.state) : null)));
  }

  // CE QUE LA CARTE RÉCLAME
  //
  // Les cartes, l'histoire et le déplacement sont la même affaire : une carte
  // qui exige quatre cases de course EST la raison de traverser le ring, et le
  // coup qui en sort EST le moment du match qu'on racontera. Encore faut-il
  // que le joueur voie la préparation, sinon il tient une carte morte au lieu
  // d'avoir un plan pour les deux prochains tours.
  const SETUPS = [
    ['ran', (n) => ['🏃', `${n} case${n > 1 ? 's' : ''} de course avant de frapper`]],
    ['crossedRope', () => ['🪢', 'traverser les cordes en chemin']],
    ['turnbuckle', () => ['🪜', 'être monté dans un coin']],
    ['attackerOnRope', () => ['🪢', 'être sur les cordes ou dans un coin']],
    ['targetOnRope', () => ['🎯', 'la cible doit être sur les cordes']],
    ['targetDown', () => ['💫', 'la cible doit être au sol']],
    ['targetDownOrDazed', () => ['💫', 'la cible doit être au sol ou étourdie']],
    ['targetDazedOrCorner', () => ['💫', 'la cible doit être étourdie ou dans un coin']],
    ['targetNearTable', () => ['🪑', 'la cible doit être contre une table']],
  ];
  function setupOf(move) {
    const req = (move && move.requires) || {};
    for (const [k, f] of SETUPS) if (req[k]) return f(req[k]);
    return null;
  }

  // Les cases depuis lesquelles la carte deviendrait jouable. C'est le lien
  // direct entre la main et le plateau : on montre où aller, pas seulement ce
  // qui manque.
  function setupTiles(u, move) {
    const req = (move && move.requires) || {};
    const out = new Set();
    if (!req.ran && !req.crossedRope && !req.turnbuckle && !req.attackerOnRope) return out;
    const reach = getReachable(battle, u);
    for (const v of reach.values()) {
      if (v.blocked) continue;
      const chemin = pathIn(reach, v.x, v.y);
      const parcouru = Math.max(0, chemin.length - 1);
      const tuile = tileAt(g, v.x, v.y);
      if (req.ran && parcouru < req.ran) continue;
      if (req.crossedRope && !(chemin.length > 1 && chemin.slice(0, -1).some((c) => tileAt(g, c.x, c.y) === 'rope'))) continue;
      if (req.turnbuckle && tuile !== 'turnbuckle') continue;
      if (req.attackerOnRope && tuile !== 'rope' && tuile !== 'turnbuckle') continue;
      out.add(key(v.x, v.y));
    }
    return out;
  }

  // La liste d'une catégorie est déjà homogène (le menu s'ouvre sur la main),
  // donc plus de sous-groupes : une ligne d'état du talon, puis les options.
  function renderActionList(u, actions) {
    const box = h('div', { class: 'actions' });
    const d = deckState(u);
    box.append(h('div', { class: 'deck-state', title: 'Cartes en main · talon · défausse' },
      `🃏 ${d.main} en main · 🂠 ${d.talon} au talon · 🗑 ${d.defausse} défaussées`));
    for (const a of actions) {
      const m = a.move;
      const carte = !!(m && m.id && (u.hand || []).includes(m.id));
      const meta = [];
      if (m && m.power != null) meta.push(`💥 ${m.power}`);
      if (m && m.acc != null) meta.push(`🎯 ${m.acc}`);
      if (m && m.range) meta.push(`↔ ${m.range[0] === m.range[1] ? m.range[0] : `${m.range[0]}-${m.range[1]}`}`);
      if (a.cost) meta.push(`⚡ -${a.cost}`);
      if (m && m.part && PARTS[m.part]) meta.push(`${PARTS[m.part].icon} vise ${PARTS[m.part].short}`);
      if (m && m.momentum && ATTACK_TYPES.has(a.type)) meta.push(`⚡ +${m.momentum} si touché`);
      const best = a.targets.length ? a.targets.reduce((x, y) => ((y.hit ?? y.chance * 100) > (x.hit ?? x.chance * 100) ? y : x)) : null;
      const combos = m && best && best.unit ? activeCombos(battle, u, best.unit, m) : [];
      const prep = setupOf(m);
      const btn = h('button', {
        class: `act ${a.ok ? '' : 'disabled'}${carte ? ' card' : ''}`,
        disabled: !a.ok || ui.busy,
        onclick: () => chooseAction(a),
        // Survoler une carte allume sur le plateau les cases qui la
        // débloqueraient : la carte devient un itinéraire.
        onpointerenter: () => { if (!prep) return; ui.setupFor = m; renderBoard(); },
        onpointerleave: () => { if (ui.setupFor !== m) return; ui.setupFor = null; renderBoard(); },
      },
        h('span', { class: 'act-name' }, a.name, best && best.hit != null ? h('span', { class: 'act-hit' }, `${best.hit} %`) : best && best.chance != null ? h('span', { class: 'act-hit' }, `${Math.round(best.chance * 100)} %`) : null),
        meta.length ? h('span', { class: 'act-meta' }, meta.join('  ')) : null,
        prep ? h('span', { class: `act-setup ${a.ok ? 'done' : ''}` }, `${prep[0]} ${prep[1]}`) : null,
        combos.length ? h('span', { class: 'act-combo' }, combos.map((c) => `${c.icon} ${c.name}`).join(' + ')) : null,
        h('span', { class: 'act-desc' }, a.ok ? a.desc : `✗ ${a.reason}`));
      box.append(btn);
    }
    return box;
  }

  // Qui d'autre est pris dans le mouvement, et de quel côté il est.
  function spreadPreview(battle, u, tgt, move, dmg) {
    const eff = (move && move.effects) || {};
    const out = [];
    if (eff.push) out.push(['↗️ Recul', `${eff.push} case${eff.push > 1 ? 's' : ''} — décor complice ?`]);
    if (!eff.line && !eff.splash) return out;
    const pris = new Set();
    if (eff.line) {
      const dx = Math.sign(tgt.x - u.x), dy = Math.sign(tgt.y - u.y);
      // unitAt tient compte du gabarit : chercher la case exacte raterait un
      // colosse, qui en occupe quatre. Une prévision qui ment sur ce point est
      // pire que pas de prévision.
      if (dx || dy) for (let i = 1; i <= eff.line; i++) {
        const v = unitAt(battle, tgt.x + dx * i, tgt.y + dy * i);
        if (v && v !== u && v !== tgt) pris.add(v);
      }
    }
    if (eff.splash) {
      for (const v of battle.units) {
        if (v === u || v === tgt || v.eliminated) continue;
        if (manhattan(v, tgt) === 1) pris.add(v);          // distance entre gabarits
      }
    }
    const part = Math.round(dmg * (eff.line ? 0.7 : eff.splash === true ? 0.5 : eff.splash));
    if (!pris.size) out.push([eff.line ? '➡️ Traverse' : '💥 Zone', 'personne d’autre dans la zone']);
    for (const v of pris) {
      out.push([v.team === u.team ? `⚠️ ${v.name} (allié)` : `↳ ${v.name}`, `~${part} dégâts`]);
    }
    return out;
  }

  // L'état de l'arbitre, toujours lisible en haut : sa tolérance change d'un
  // match à l'autre, et on ne triche pas sans savoir combien il en reste.
  function refBadge() {
    if (!battle.rules.dq) return null;
    const rs = refState(battle);
    const cls = rs.blind ? 'ref-blind' : rs.danger ? 'ref-danger' : 'ref-ok';
    return h('span', { class: `refbadge ${cls}`, title: rs.trait || '' },
      rs.blind ? '👀 Arbitre distrait' : `🦓 Arbitre ${rs.name} · ${rs.label}`);
  }

  // Qui est au bord du ring, et combien il lui reste d'interventions. Une
  // menace qu'on ne voit pas ne change pas la façon de jouer.
  function mgrBadge(team) {
    const m = battle.managers && battle.managers[team];
    if (!m) return null;
    return h('span', {
      class: `mgrbadge team-${team}${m.left <= 0 ? ' spent' : ''}`,
      title: `${m.name} — ${m.nick}. ${m.desc}`,
    }, `${m.icon} ${m.name} ${'●'.repeat(m.left) || '— épuisé'}`);
  }

  function renderForecast(u, t, compact = false) {
    const a = ui.action;
    const tgt = t.unit;
    const box = h('div', { class: 'forecast' });
    const side = (unit, after, extra) => h('div', { class: `fc-side team-${unit.team}` }, avatar(WRESTLERS_BY_ID[unit.id], 56, { view: 'full', dir: screenFacing(unit.facing, boardRot()) }), h('b', {}, unit.name),
      h('div', { class: 'fc-hp' }, `PV ${unit.hp}`, after != null ? h('span', { class: after < unit.hp ? 'dn' : 'up' }, ` → ${after}`) : null),
      bar(after != null ? Math.max(0, after) : unit.hp, unit.maxHp, 'hpbar'), extra || null);
    let mid = [], afterT = null, afterU = null;
    if (a.move && ATTACK_TYPES.has(a.type)) {
      const hit = hitChance(battle, u, tgt, a.move, { pos: u });
      const { dmg } = computeDamage(battle, u, tgt, a.move, { noRng: true });
      const crit = Math.round((0.05 + getStats(battle, u).tec * 0.01) * 100);
      afterT = Math.max(0, tgt.hp - dmg);
      mid = [['Précision', `${hit} %`], ['Dégâts', `~${dmg}`], ['Critique', `${crit} %`]];
      // L'élan doit se voir AVANT de confirmer, sinon le joueur subit un
      // malus qu'il ne peut pas relier à son déplacement.
      // Le risque de renversement est LE pari du jeu : lancer son finisher sur
      // un adversaire frais peut le retourner contre soi. Il doit se lire
      // avant de confirmer, sinon ce n'est plus une décision.
      const rev = reverseChance(battle, u, tgt, a.move);
      if (rev > 0.005) mid.push(['🔄 Risque de renversement', `${Math.round(rev * 100)} %`]);
      if (winded(u)) mid.push(['😮‍💨 À bout de souffle', '−25 % dégâts, −10 précision']);
      // L'USURE CIBLÉE DOIT SE LIRE AVANT DE FRAPPER. C'est une stratégie
      // longue : si le joueur ne voit pas où il en est sur la jambe qu'il
      // travaille depuis dix tours, il n'y a pas de stratégie, il y a un
      // hasard qui finit par payer.
      const us = wearFrom(a.move, dmg);
      if (us) {
        const P = PARTS[us.part];
        const avant = wearOf(tgt, us.part), apres = Math.min(WEAR_MAX, avant + us.n);
        const seuil = apres >= WEAR_BROKEN ? ' — HORS SERVICE' : apres >= WEAR_HURT ? ' — touchée' : '';
        mid.push([`${P.icon} ${P.name}${us.aimed ? ' (visée)' : ''}`,
          `${Math.round(avant)} → ${Math.round(apres)}${seuil}`]);
      }
      if (a.type === 'submission') {
        const tap = tapChance(battle, u, tgt, a.move);
        const p = movePart(a.move);
        mid.push(['🔗 Abandon', `${Math.round(tap * 100)} %${p ? ` (${PARTS[p].short} à ${Math.round(wearOf(tgt, p))})` : ''}`]);
      }
      // Ce que la foule a déjà vu ne rapporte plus autant.
      const nv = novelty(u, a.move);
      if (nv < 0.99) mid.push(['👥 Déjà vu', `${moveUses(u, a.move)}× — momentum et chaleur ×${nv.toFixed(2)}`]);
      const el = elanLabel(u.movedTiles, a.move, u);
      if (el) mid.push([`🏃 ${el.name}`, `${el.travel} case${el.travel > 1 ? 's' : ''} · ${el.good ? '+' : ''}${Math.round((el.mult - 1) * 100)} % dégâts`]);
      if (el && el.static >= 2) mid.push(['😴 Immobile depuis', `${el.static} tour${el.static > 1 ? 's' : ''} — la foule décroche`]);
      // Ligne, zone, recul : ce que le coup fait à la GRILLE. Ça doit se voir
      // avant de confirmer, surtout quand un partenaire est dans la ligne.
      const spread = spreadPreview(battle, u, tgt, a.move, dmg);
      for (const row of spread) mid.push(row);
      const cbs = activeCombos(battle, u, tgt, a.move);
      for (const c of cbs) mid.push([`${c.icon} ${c.name}`, `+${Math.round((c.dmg - 1) * 100)} % dégâts`]);
      if (dmg >= tgt.hp && !tgt.down) mid.push(['Résultat', '💫 AU SOL']);
      if (a.type === 'submission') mid.push(['Abandon', 'possible si affaibli']);
      if (a.move.tier === 'finisher') mid.push(['Finisher', 'tombé immédiat +30 %']);
      if (tgt.gimmick === 'outta_nowhere' && tgt.momentum >= 50) mid.push(['⚠️ Risque', 'contre RKO 35 %']);
      // Ce n'est plus un pourcentage de DQ mais l'état de l'arbitre : il voit,
      // il avertit, et c'est le dernier avertissement qui coûte le match.
      const illegal = (a.move.effects && a.move.effects.illegal) || a.type === 'weapon';
      if (illegal && battle.rules.dq) {
        const rs = refState(battle);
        mid.push([rs.blind ? '👀 Arbitre' : rs.danger ? '🚨 Arbitre' : '⚠️ Arbitre', rs.label]);
      }
      if (a.move.effects && a.move.effects.selfDamage) afterU = u.hp - a.move.effects.selfDamage;
      mid.push(['Momentum', `${u.momentum} → ${Math.min(100, Math.max(0, u.momentum - (a.cost || 0)) + (a.move.momentum || 0))}`]);
    } else if (a.type === 'pin') mid = [['Tombé', `${Math.round(t.chance * 100)} %`], ['Cœur adverse', '❤️'.repeat(tgt.grit) || '—'], ['Si kick-out', 'cœur -1, +15 momentum']];
    else if (a.type === 'toss') mid = [['Par-dessus la corde', `${Math.round(t.chance * 100)} %`]];
    else if (a.id === 'whip') mid = [['Précision', `${t.hit} %`], ['Projection', whipPreview(u, tgt)]];
    else if (a.type === 'manager') mid = [[`${a.manager.icon} ${a.manager.name}`, a.manager.nick], ['Effet', a.manager.desc], ['Il reste', `${a.manager.left} intervention(s)`], a.manager.illegal && battle.rules.dq ? ['⚠️ Arbitre', refState(battle).label] : null].filter(Boolean);
    else if (a.type === 'rollin') mid = [['Rentrer', 'se rouler sous la corde du bas'], ['Décompte', 'remis à zéro'], ['Coût', 'termine le tour']];
    else if (a.type === 'tag') mid = [['Tag', `${tgt.name} devient légal`], ['Bonus', '+15 % PV, +30 momentum']];
    else if (a.type === 'job') mid = [['Script', 'votre lutteur perd volontairement']];
    else if (a.move && a.move.effects && a.move.effects.drainMomentum) mid = [['Momentum adverse', `-${a.move.effects.drainMomentum}`]];
    box.append(side(u, afterU), h('div', { class: 'fc-mid' }, h('div', { class: 'fc-name' }, a.name), mid.map(([k, v]) => h('div', { class: 'fc-row' }, h('span', {}, k), h('b', {}, v)))), side(tgt, afterT));
    if (!compact) box.append(h('div', { class: 'hint center' }, 'Cliquez la cible pour confirmer'));
    return box;
  }
  function whipPreview(u, tgt) {
    const dx = Math.sign(tgt.x - u.x), dy = Math.sign(tgt.y - u.y);
    for (let i = 1; i <= 2; i++) {
      const tile = tileAt(g, tgt.x + dx * i, tgt.y + dy * i);
      if (unitAt(battle, tgt.x + dx * i, tgt.y + dy * i)) return 'collision (6 dégâts chacun)';
      if (tile === 'table') return '💥 TABLE ! 25 dégâts';
      if (tile === 'cage') return 'cage : 15 dégâts';
      if (tile === 'barricade') return 'barricade : 10 dégâts';
      if (tile === 'steps') return 'marches : 12 dégâts';
      if (tile === 'turnbuckle') return 'coin : 10 dégâts + étourdi';
      if (tile === 'rope') return battle.rules.toss && ['rope', 'turnbuckle'].includes(tileAt(g, tgt.x, tgt.y)) ? 'par-dessus la corde ?' : 'cordes : étourdi';
      if (TERRAIN[tile].outside && !TERRAIN[tileAt(g, tgt.x, tgt.y)].outside && battle.rules.toss) return 'par-dessus la corde !';
    }
    return 'recule de 2 cases';
  }

  // ------------------------------------------------------------ barre d'équipe / journal
  function renderParty() {
    clear(el.party);
    const mk = (u) => {
      const def = WRESTLERS_BY_ID[u.id];
      const st = [u.down ? '💫' : '', u.statuses.dazed ? '😵' : '', u.statuses.finished ? '☠️' : '', u.weapon ? u.weapon.icon : '', battle.rules.tag && u.legal ? '⭐' : ''].join('');
      return h('div', { class: `pm team-${u.team}${u.acted && u.team === 'player' && battle.phase === 'player' ? ' acted' : ''}${u.eliminated ? ' out' : ''}${ui.sel === u ? ' sel' : ''}`, onclick: () => { if (u.eliminated) return; if (u.team === 'player' && canSelect(u)) select(u); else { ui.inspect = u; render(); } }, onpointerenter: (e) => { if (e.pointerType !== 'mouse') return; ui.hover = u; renderRight(); renderBoard(); }, onpointerleave: (e) => { if (e.pointerType !== 'mouse') return; ui.hover = null; renderRight(); renderBoard(); } },
        avatar(def, 44), h('div', { class: 'pm-info' }, h('b', {}, u.name),
          bar(u.hp, u.maxHp, 'hpbar', `${u.hp}`),
          bar(u.momentum, 100, 'mombar', `${u.momentum}`),
          // Le souffle : la jauge qui DESCEND. Sans elle à l'écran, le joueur
          // subit un malus et une fermeture de ses gros mouvements sans
          // comprendre d'où ça vient.
          bar(u.stamina, u.maxStamina, `stambar${winded(u) ? ' low' : ''}`, `${Math.round(u.stamina)}`),
          h('span', { class: 'pm-grit' }, '❤️'.repeat(u.grit) || '—'),
          wearStrip(u)),
        h('span', { class: 'pm-st' }, u.eliminated ? '❌' : st));
    };
    el.party.append(h('div', { class: 'pgroup' }, h('div', { class: 'pg-label' }, 'Votre équipe'), battle.units.filter((u) => u.team === 'player').map(mk)));
    el.party.append(h('div', { class: 'pgroup' }, h('div', { class: 'pg-label' }, 'Adversaires'), battle.units.filter((u) => u.team === 'enemy').map(mk)));
  }

  // Les membres abîmés, en une ligne. Un membre hors service change ce que le
  // lutteur peut faire (plus de vol, plus d'escalade, moins de souffle) : ça
  // ne peut pas vivre uniquement dans le journal.
  // Le seuil d'affichage est VOLONTAIREMENT sous le premier palier : voir un
  // membre commencer à prendre, c'est ce qui donne envie d'y revenir. Attendre
  // « touchée » à 45, c'est ne montrer la stratégie qu'une fois qu'elle a déjà
  // réussi.
  const WEAR_SHOW = 18;
  function wearStrip(u) {
    const parts = wornParts(u).filter((w) => w.n >= WEAR_SHOW);
    if (!parts.length) return null;
    return h('span', { class: 'pm-wear' }, parts.map((w) => h('span', {
      class: `wp lvl${w.level}`,
      title: `${w.name} : ${Math.round(w.n)}/${WEAR_MAX} — ${w.level >= 2 ? w.broken : w.level === 1 ? w.hurt : 'commence à prendre'}`,
    }, w.icon)));
  }

  function renderLog() {
    clear(el.log);
    el.log.append(h('summary', {}, '📝 Commentaires'));
    for (const e of battle.log.slice(-10).reverse()) el.log.append(h('div', { class: `le ${e.cls || ''}` }, h('span', { class: 'lt' }, `T${e.turn}`), ' ', e.text));
  }

  function flushEvents() {
    const evs = battle.events.splice(0, battle.events.length);
    for (const ev of evs) {
      const cell = el.board.querySelector(`.cell[data-x="${ev.x}"][data-y="${ev.y}"]`);
      if (!cell) continue;
      let text = '', cls = '';
      switch (ev.type) {
        case 'damage': text = `-${ev.amount}`; cls = ev.crit ? 'crit' : 'dmg'; break;
        case 'heal': text = `+${ev.amount}`; cls = 'heal'; break;
        case 'miss': text = 'RATÉ'; cls = 'miss'; break;
        case 'down': text = 'AU SOL !'; cls = 'down'; break;
        case 'pin': text = ev.count === 3 ? '1·2·3 !' : ev.count === 2.9 ? 'KICK OUT à 2,9 !' : ev.count === 2 ? 'KICK OUT !' : 'UN…'; cls = ev.count === 3 ? 'pin3' : 'pin'; break;
        case 'eliminated': text = 'ÉLIMINÉ'; cls = 'elim'; break;
        case 'taunt': text = '📣'; cls = 'taunt'; break;
        case 'combo': text = ev.names.join(' + '); cls = 'combo'; break;
        default: continue;
      }
      const f = h('span', { class: `float ${cls}` }, text);
      cell.append(f);
      setTimeout(() => f.remove(), 1400);
    }
  }
  function floatAt(u, text, cls = 'act') {
    const cell = el.board.querySelector(`.cell[data-x="${u.x}"][data-y="${u.y}"]`);
    if (!cell) return;
    const f = h('span', { class: `float ${cls}` }, text);
    cell.append(f);
    setTimeout(() => f.remove(), 1400);
  }
  function showBanner(text, cls = '') {
    el.banner.textContent = text; el.banner.className = `turn-banner ${cls}`; el.banner.hidden = false;
    setTimeout(() => { el.banner.hidden = true; }, 1100);
  }

  // ------------------------------------------------------------ interactions
  const canSelect = (u) => u.team === 'player' && !u.acted && !u.down && !u.eliminated && battle.phase === 'player';
  function select(u) {
    ui.sel = u; ui.action = null; ui.cat = null; ui.inspect = null;
    if (u.moved || u.onlyPin) { ui.mode = 'menu'; ui.reach = null; ui.atkRange = null; }
    else { ui.mode = 'move'; ui.reach = getReachable(battle, u); ui.atkRange = attackRangeFrom(ui.reach, u); }
    render();
    if (TOUCH) { const c = el.board.querySelector(`.cell[data-x="${u.x}"][data-y="${u.y}"]`); if (c) c.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); }
  }
  function deselect() { ui.sel = null; ui.mode = 'idle'; ui.action = null; ui.cat = null; ui.pending = null; ui.reach = null; ui.atkRange = null; render(); }
  function onHover(x, y) {
    const u = x == null ? null : unitAt(battle, x, y);
    const tile = x == null ? null : tileAt(g, x, y);
    if (tile !== ui.hoverTile) { ui.hoverTile = tile; el.tileInfo.textContent = tile && TILE_HELP[tile] ? `${TERRAIN[tile].name} — ${TILE_HELP[tile]}` : ''; }
    // La case survolée sert à dessiner le chemin prévu pendant un déplacement.
    const moved = !ui.hoverXY || x !== ui.hoverXY.x || y !== ui.hoverXY.y;
    ui.hoverXY = x == null ? null : { x, y };
    if (u !== ui.hover) {
      ui.hover = u;
      renderRight();
      if (ui.mode === 'idle') renderBoard();
    } else if (moved && ui.mode === 'move') renderBoard();
  }
  function onCell(x, y) {
    if (ui.busy || battle.result || battle.phase !== 'player') return;
    const u = unitAt(battle, x, y);
    if (ui.mode === 'target') {
      const t = ui.action.targets.find((t) => t.unit && t.unit.x === x && t.unit.y === y);
      if (t && TOUCH && !(ui.pending && ui.pending.unit === t.unit)) { ui.pending = t; render(); return; }
      if (t) doAction(ui.action.id, { unit: t.unit });
      else { ui.mode = ui.cat ? 'list' : 'menu'; ui.action = null; ui.pending = null; render(); }
      return;
    }
    if (ui.mode === 'move') {
      if (u === ui.sel) { ui.mode = 'menu'; render(); return; }
      const n = ui.reach.get(key(x, y));
      if (n && !n.blocked) { moveUnit(battle, ui.sel, x, y); ui.mode = 'menu'; ui.reach = null; ui.atkRange = null; render(); return; }
      if (u && canSelect(u)) { select(u); return; }
      if (u && u.team === 'enemy') { ui.inspect = u; render(); return; }
      deselect(); return;
    }
    if (ui.mode === 'menu' || ui.mode === 'list') {
      if (u && canSelect(u) && u !== ui.sel) { select(u); return; }
      if (u === ui.sel) { ui.mode = 'menu'; render(); return; }
      if (!u && !ui.sel.moved) { ui.mode = 'move'; ui.reach = getReachable(battle, ui.sel); ui.atkRange = attackRangeFrom(ui.reach, ui.sel); render(); }
      return;
    }
    if (u && canSelect(u)) select(u);
    else if (u) { ui.inspect = u; render(); }
    else if (ui.inspect) { ui.inspect = null; render(); }
  }
  function chooseAction(a) {
    if (!a || !a.ok || ui.busy) return;
    ui.pending = null;
    if (a.targets.length && a.targets[0].unit) { ui.mode = 'target'; ui.action = a; render(); return; }
    doAction(a.id, null);
  }
  function doAction(id, target) {
    const u = ui.sel;
    const r = executeAction(battle, u, id, target);
    if (!r.ok) { toast(r.reason, 'warn'); return; }
    if (r.countered) toast('CONTRÉ !', 'warn');
    if (u.onlyPin && !battle.result) { ui.mode = 'menu'; ui.action = null; ui.cat = null; render(); return; }
    deselect();
  }
  function onKey(e) {
    if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey && boardWrap.classList.contains('view-iso')) { rotateBoard(e.shiftKey ? -1 : 1); return; }
    if (e.key === '+' || e.key === '=') { zoomBoard(1.25); return; }
    if (e.key === '-' || e.key === '_') { zoomBoard(1 / 1.25); return; }
    if (e.key === '0') { resetZoom(); return; }
    if (e.key !== 'Escape' || ui.busy) return;
    if (ui.mode === 'target') { ui.mode = ui.cat ? 'list' : 'menu'; ui.action = null; render(); }
    else if (ui.mode === 'list') { ui.mode = 'menu'; ui.cat = null; render(); }
    else if (ui.sel) deselect();
  }
  function cleanup() {
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', fitBoard);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp, true);
    document.body.classList.remove('sheet-open', 'in-match');
  }

  // Le plateau doit tenir dans la place qui lui reste : on calcule la taille de
  // case à partir de la boîte disponible, dans les deux dimensions. En iso, le
  // losange fait (colonnes + rangées) de diagonale, et les lutteurs dépassent
  // du tapis vers le haut (d'où la marge de 1,5 case).
  function fitBoard() {
    // Le plateau se range sous le bandeau du haut et au-dessus des boîtes du bas,
    // sinon le HUD intercepte les clics des rangées qu'il recouvre.
    const scene = boardWrap.parentElement;
    const topH = el.top.offsetHeight || 0;
    const botH = Math.min(110, Math.round((scene.clientHeight || 0) * 0.14));
    boardWrap.style.top = `${topH + 6}px`;
    boardWrap.style.bottom = `${botH}px`;
    const availW = boardWrap.clientWidth, availH = boardWrap.clientHeight;
    if (!availW || !availH) return;
    const iso = boardWrap.classList.contains('view-iso');
    const h = Math.max(80, availH - 4);
    const span = g.w + g.h;
    const cell = iso
      ? Math.min(availW / (span * 0.7072), h / (span * 0.3536 + 1.5))
      : Math.min(availW / g.w, h / g.h) - 2;
    const fit = Math.max(14, Math.min(112, Math.floor(cell)));
    boardWrap.style.setProperty('--cell', `${Math.max(10, Math.round(fit * zoom))}px`);
    boardWrap.classList.toggle('zoomed', zoom > 1);
  }

  async function endTurn() {
    if (ui.busy || battle.result || battle.phase !== 'player') return;
    ui.busy = true; ui.sel = null; ui.mode = 'idle'; ui.action = null; ui.reach = null; ui.atkRange = null; ui.inspect = null;
    endPlayerPhase(battle);
    showBanner('TOUR ADVERSE', 'enemy');
    render();
    await sleep(700);
    for (const step of enemySteps(battle)) {
      ui.acting = step.unit;
      render();
      if (step.type === 'action') { const a = step.action; const name = MOVES[a.id] ? MOVES[a.id].name : a.id === 'pin' ? 'Tombé' : a.id; floatAt(step.unit, name); }
      await sleep(step.type === 'move' ? 420 : 800);
      if (battle.result) break;
    }
    ui.acting = null;
    if (!battle.result) { endEnemyPhase(battle); showBanner(`VOTRE TOUR — ${battle.turn}`, 'player'); }
    ui.busy = false; render();
  }

  // ------------------------------------------------------------ résultat
  function showResult() {
    cleanup();
    const res = battle.result;
    const summary = onFinish ? onFinish(battle) : null;
    const won = res.winner === 'player';
    const box = h('div', { class: 'result' });
    box.append(h('h2', { class: won ? 'win' : 'lose' }, won ? '🏆 VICTOIRE' : '💀 DÉFAITE'), h('p', { class: 'reason' }, res.reason), h('p', { class: 'muted' }, `${battle.turn} tours · chaleur finale ${battle.heat} · ${battle.stats.kickouts} kick-out(s) · ${battle.stats.tables} table(s) · ${battle.stats.finishers} finisher(s)`));
    if (summary) {
      if (summary.script) {
        box.append(h('div', { class: 'stars' }, starsText(summary.script.stars), h('span', { class: 'muted' }, ` (${summary.script.stars}/5)`)));
        box.append(h('div', { class: `obj-item ${summary.script.finishOk ? 'done' : 'fail'}` }, `${summary.script.finishOk ? '✅' : '❌'} Finish : ${describeFinish(battle.script.finish)}`));
        for (const b of summary.script.beats) box.append(h('div', { class: `obj-item ${b.done ? 'done' : ''}` }, `${b.done ? '✅' : '⬜'} ${b.name}`));
      } else if (summary.directives.length) {
        for (const d of summary.directives) box.append(h('div', { class: `obj-item ${d.done ? 'done' : ''}` }, `${d.done ? '✅' : '⬜'} ${d.name} ${d.done ? `(+${d.reward.fans} fans, +${d.reward.money} $)` : ''}`));
      }
      box.append(h('p', { class: 'reward' }, `${summary.money >= 0 ? '+' : ''}${summary.money} $ · ${summary.fans >= 0 ? '+' : ''}${summary.fans} fans`), h('p', {}, summary.message));
    }
    // L'HISTOIRE DU MATCH. C'est ce qu'on raconte le lendemain, et c'est ce qui
    // manquait : le match produisait des chiffres, jamais une phrase. Elle est
    // écrite à partir des temps forts réellement enregistrés — rien n'est
    // inventé, et deux matchs différents ne donnent jamais le même texte.
    const story = matchStory(battle, { rivalry: matchDef && matchDef.rivalry });
    box.append(h('div', { class: 'story' },
      h('div', { class: 'story-head' },
        h('div', { class: 'story-stars', title: `Note du match : ${story.stars}/5` }, story.starsText),
        h('h3', {}, `« ${story.headline} »`)),
      story.acts.map((a) => h('div', { class: 'story-act' },
        h('b', {}, `${a.icon} ${a.title}`), h('p', {}, a.text)))));
    box.append(h('button', { class: 'btn primary', onclick: onContinue }, 'Continuer'));
    root.append(h('div', { class: 'overlay' }, box));
  }
}
