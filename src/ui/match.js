// ÉCRAN DE MATCH — construit autour de la main
//
// La première version était un Fire Emblem : on sélectionnait un lutteur, on
// le déplaçait, un menu contextuel s'ouvrait, une catégorie, une liste, une
// cible, une confirmation. Six couches pour jouer une carte, dans un jeu qui
// est devenu un deckbuilder. Et des cartes qui étaient des boutons gris dans
// un panneau.
//
// Celui-ci est construit comme Fights in Tight Spaces : LA MAIN EST EN BAS,
// toujours visible, avec de vraies cartes (coût, pictogramme, effet, précision)
// ; on lève une carte, les cibles s'allument, on clique la cible, c'est joué.
// Se déplacer, c'est cliquer une case quand aucune carte n'est levée. Le
// plateau occupe le centre, la caméra suit l'action ; une fiche compacte de
// chaque côté (vous à gauche, lui à droite, avec son annonce) ; un bandeau
// minimal en haut ; le journal réduit à une ligne.
import { h, clear, sleep, bar, toast } from './dom.js';
import { avatar } from './avatar.js';
import { WRESTLERS_BY_ID } from '../data/wrestlers.js';
import { listActions, executeAction, moveUnit, undoMove, getReachable, endPlayerPhase, enemySteps, endEnemyPhase, hitChance, computeDamage, getStats, moveRange, elanLabel, refState, reverseChance, winded, tapChance, novelty, moveUses, activeCombos, teamworkPartners, TEAMWORK_RATIO } from '../engine/battle.js';
import { movePart, wearFrom, wearOf, wornParts, PARTS, WEAR_MAX, WEAR_HURT, WEAR_BROKEN } from '../engine/wear.js';
import { TERRAIN, tileAt, key, manhattan, sizeOf, heightAt, pathIn } from '../engine/grid.js';
import { deckState, isCard } from '../engine/hand.js';
import { unitAt, living, avgHeat } from '../engine/util.js';
import { MOVES, MOVE_TIER_LABEL } from '../data/moves.js';
import { CLASSES, SPECIALTIES } from '../data/classes.js';
import { GIMMICKS } from '../data/gimmicks.js';
import { SEASON } from '../data/campaign.js';
import { play, startCrowd, setCrowd, crowdPop, stopCrowd, soundOn, setSound } from './sound.js';
import { rankLabel, titleTerms } from '../game/rank.js';
import { describeFinish, evaluateDirectives, evaluateScript, starsText } from '../game/script.js';
import { matchPhase } from '../engine/phases.js';
import { winRoutes } from '../engine/rules.js';
import { showTutorial, tutorialSeen } from './tutorial.js';
import { matchStory } from '../game/story.js';

// Les animations de coup passent par l'API Web Animations, sur la propriété
// `translate` : elle s'applique AVANT la contre-rotation isométrique du pion,
// donc on peut animer un pion sans toucher à son `transform`. Elles sont
// coupées pour qui a demandé moins de mouvement.
const REDUCED = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const ONOMATOPEE = { strike: 'POW !', grapple: 'SLAM !', aerial: 'BOOM !', submission: 'CRAC !', weapon: 'CLANG !', special: 'WHAM !' };
const ATTACK_TYPES = new Set(['strike', 'grapple', 'aerial', 'submission', 'weapon']);
const TACTIC_ICON = { guard: '🛡️', regroup: '🏃', draw: '🧠', heal: '🩹', hype: '🔥', feint: '🎭' };
const TYPE_ICON = { tactic: '🛡️', strike: '👊', grapple: '🤼', aerial: '🦅', submission: '🔗', special: '🌀', weapon: '🪑', taunt: '📣', pin: '🤝', toss: '🚀', teamwork: '🤝', climb: '🪜', tag: '🖐️', manager: '🎩', wait: '⏳', redraw: '🔄', scavenge: '🔦', pickup: '🪑', rollin: '↩️', sell: '🎭', job: '📜' };
const TILE_HELP = {
  floor: 'Plancher : hors du ring. Compte de l’arbitre dans les matchs avec règles.',
  ring: 'Tapis du ring.',
  rope: 'Cordes : tremplin. Y entrer coûte 1, en repartir est gratuit — passer par les cordes fait aller plus loin, et déclenche 💨 Course dans les cordes. Y être projeté étourdit.',
  turnbuckle: 'Coin : coût 2, on y monte. Plongeons +25 % depuis ici. Y être projeté = 10 dégâts + étourdi.',
  ramp: 'Rampe d’entrée : hors du ring. Les renforts arrivent par ici.',
  table: 'Table des commentateurs : projetez-y quelqu’un pour 25 dégâts.',
  debris: 'Table brisée.',
  barricade: 'Barricade : infranchissable. Y être projeté = 10 dégâts.',
  steps: 'Marches d’acier : coût 2. Y être projeté = 12 dégâts.',
  ladder: 'Échelle : deux échelons, un par tour, sans être mis au sol ni projeté, pour la ceinture.',
  cage: 'Mur de la cage : infranchissable. Y être projeté = 15 dégâts.',
  void: '',
};
const TOUCH = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover: none), (pointer: coarse)').matches;

// Vue, rotation et zoom de la caméra, mémorisés.
const VIEW_KEY = 'ppw.boardView', ROT_KEY = 'ppw.boardRot', ZOOM_KEY = 'ppw.boardZoom';
const ZOOM_MIN = 0.5, ZOOM_MAX = 2.5;
const clampZoom = (z) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
const boardRot = () => { try { return (Number(localStorage.getItem(ROT_KEY)) || 0) % 4; } catch { return 0; } };
const setBoardRot = (r) => { try { localStorage.setItem(ROT_KEY, String(r)); } catch { /* mode privé */ } };
const boardZoom = () => { try { return clampZoom(Number(localStorage.getItem(ZOOM_KEY)) || 1); } catch { return 1; } };
const setBoardZoom = (z) => { try { localStorage.setItem(ZOOM_KEY, String(z)); } catch { /* mode privé */ } };
const boardView = () => { try { return localStorage.getItem(VIEW_KEY) === 'top' ? 'top' : 'iso'; } catch { return 'iso'; } };
const setBoardView = (v) => { try { localStorage.setItem(VIEW_KEY, v); } catch { /* mode privé */ } };
// Hauteur des trois câbles et des poteaux, en cases (voir ringRopes).
const ROPE_LEVELS = [0.42, 0.74, 1.06];
const POST_H = 1.28;
const FACE_ORDER = ['se', 'sw', 'nw', 'ne'];
function screenFacing(facing, rot) {
  const i = FACE_ORDER.indexOf(facing || 'se');
  return FACE_ORDER[(i + (i < 0 ? 0 : rot)) % 4] || 'se';
}
const shortName = (name) => {
  const parts = name.replace(/\(.*\)/, '').trim().split(/\s+/);
  return parts.length > 2 ? `${parts[0]} ${parts[parts.length - 1]}` : name;
};
const enMain = (a, u) => !!(a.move && a.move.id && (u.hand || []).includes(a.move.id));
const estMerite = (a) => !!(a.move && ['signature', 'finisher'].includes(a.move.tier));
// `append` natif écrit « [object HTMLDivElement] » pour un tableau et « null »
// pour une branche vide : on aplatit et on saute le vide.
const put = (parent, ...kids) => { for (const k of kids.flat(Infinity)) if (k != null && k !== false) parent.append(k); return parent; };
const aCible = (a) => !!(a.targets && a.targets.length && a.targets[0].unit);

export function mountMatch(root, { battle, matchDef, onFinish, onContinue, onQuit, onLearn, deckOf }) {
  const ui = { sel: null, card: null, pending: null, hover: null, hoverXY: null, hoverTile: null, reach: null, busy: false, resultShown: false, acting: null, setupFor: null, animUntil: 0, panel: null, ringOpen: false, expanded: new Set(), focusKey: '' };
  const g = battle.grid;
  clear(root);
  const el = {
    top: h('header', { class: 'mt' }),
    left: h('aside', { class: 'm-side m-left' }),
    right: h('aside', { class: 'm-side m-right' }),
    board: h('div', { class: 'board', style: { gridTemplateColumns: `repeat(${g.w}, var(--cell))` } }),
    ticker: h('div', { class: 'ticker' }),
    hand: h('footer', { class: 'm-hand' }),
    banner: h('div', { class: 'turn-banner', hidden: true }),
    panel: h('div', { class: 'm-panel', hidden: true }),
    tileInfo: h('div', { class: 'tile-tip', hidden: true }),
  };
  const stage = h('div', { class: 'board-stage' }, el.board);
  const boardWrap = h('div', { class: `board-wrap zoomed view-${boardView()}`, style: { '--rows': g.h, '--cols': g.w, '--rot': boardRot() } }, stage);
  boardWrap.dataset.rot = boardRot();
  const scene = h('div', { class: 'm-scene' }, boardWrap, el.ticker, el.tileInfo, el.panel);
  const mid = h('div', { class: 'm-mid' }, el.left, scene, el.right);
  const rotate = h('div', { class: 'rotate-hint' },
    h('span', {}, '📱↻ Tournez votre appareil : le plateau a besoin de largeur.'),
    h('button', { class: 'btn small', onclick: () => rotate.remove() }, 'OK'));
  root.append(h('div', { class: `match fits ${TOUCH ? 'touch' : ''}` }, el.top, mid, el.hand, el.banner, rotate));
  document.addEventListener('keydown', onKey);
  document.body.classList.add('in-match');
  window.addEventListener('resize', onResize);

  // ------------------------------------------------------------ caméra
  let zoom = boardZoom();
  function rotateBoard(step) {
    const next = (boardRot() + step + 4) % 4;
    setBoardRot(next);
    boardWrap.style.setProperty('--rot', next);
    boardWrap.dataset.rot = next;
    ui.focusKey = '';
    render();
  }
  function zoomBoard(mult) {
    const next = clampZoom(zoom * mult);
    if (next === zoom) return;
    zoom = next; setBoardZoom(next);
    ui.focusKey = '';
    renderTop(); fitBoard();
  }
  function resetZoom() { zoom = 1; setBoardZoom(1); ui.focusKey = ''; renderTop(); fitBoard(); }
  function toggleView() {
    const next = boardWrap.classList.contains('view-iso') ? 'top' : 'iso';
    boardWrap.classList.toggle('view-iso', next === 'iso');
    boardWrap.classList.toggle('view-top', next === 'top');
    setBoardView(next);
    ui.focusKey = '';
    render();
  }
  function onResize() { ui.focusKey = ''; fitBoard(); }
  // Molette = zoom. Glisser = déplacer la vue.
  boardWrap.addEventListener('wheel', (e) => { e.preventDefault(); zoomBoard(e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
  let pinch = 0, drag = null;
  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  boardWrap.addEventListener('touchstart', (e) => { if (e.touches.length === 2) pinch = dist(e.touches); }, { passive: true });
  boardWrap.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 2 || !pinch) return;
    e.preventDefault();
    const d = dist(e.touches);
    if (Math.abs(d - pinch) < 12) return;
    zoomBoard(d > pinch ? 1.12 : 1 / 1.12); pinch = d;
  }, { passive: false });
  boardWrap.addEventListener('touchend', () => { pinch = 0; }, { passive: true });
  boardWrap.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; drag = { x: e.clientX, y: e.clientY, sl: boardWrap.scrollLeft, st: boardWrap.scrollTop, moved: false }; });
  window.addEventListener('pointermove', onDragMove);
  window.addEventListener('pointerup', onDragUp, true);
  function onDragMove(e) {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    drag.moved = true; boardWrap.classList.add('panning');
    boardWrap.scrollLeft = drag.sl - dx; boardWrap.scrollTop = drag.st - dy;
  }
  function onDragUp(e) {
    if (drag && drag.moved) { e.preventDefault(); e.stopPropagation(); }
    drag = null; boardWrap.classList.remove('panning');
  }

  // LA CAMÉRA SUIT L'ACTION. Le plateau fait 20 cases sur 16 et presque tout
  // est vide : cadré entier, le ring était un petit losange perdu dans le
  // violet. On cadre maintenant la boîte qui contient le ring et tous les
  // lutteurs debout, plus une marge — et on recentre quand elle change, pas à
  // chaque rendu, pour ne pas voler la vue à qui l'a déplacée.
  function focusBox() {
    const r = g.ring;
    let x0 = r ? r.rx0 : 0, y0 = r ? r.ry0 : 0, x1 = r ? r.rx1 : g.w - 1, y1 = r ? r.ry1 : g.h - 1;
    for (const u of living(battle)) { x0 = Math.min(x0, u.x); y0 = Math.min(y0, u.y); x1 = Math.max(x1, u.x); y1 = Math.max(y1, u.y); }
    return { x0: Math.max(0, x0 - 1), y0: Math.max(0, y0 - 1), x1: Math.min(g.w - 1, x1 + 1), y1: Math.min(g.h - 1, y1 + 1) };
  }
  function fitBoard() {
    const availW = boardWrap.clientWidth, availH = boardWrap.clientHeight;
    if (!availW || !availH) return;
    const iso = boardWrap.classList.contains('view-iso');
    const box = focusBox();
    const bw = box.x1 - box.x0 + 1, bh = box.y1 - box.y0 + 1;
    const span = bw + bh;
    const cell = iso
      ? Math.min(availW / (span * 0.7072), (availH - 4) / (span * 0.3536 + 1.6))
      : Math.min(availW / bw, (availH - 4) / bh) - 2;
    const fit = Math.max(16, Math.min(140, Math.floor(cell)));
    boardWrap.style.setProperty('--cell', `${Math.max(12, Math.round(fit * zoom))}px`);
    const k = `${box.x0},${box.y0},${box.x1},${box.y1},${fit},${zoom},${boardRot()},${iso}`;
    if (k !== ui.focusKey) {
      ui.focusKey = k;
      requestAnimationFrame(() => {
        const cx = Math.round((box.x0 + box.x1) / 2), cy = Math.round((box.y0 + box.y1) / 2);
        const c = el.board.querySelector(`.cell[data-x="${cx}"][data-y="${cy}"]`);
        if (!c) return;
        const b = boardWrap.getBoundingClientRect(), r = c.getBoundingClientRect();
        boardWrap.scrollLeft += (r.left + r.width / 2) - (b.left + b.width / 2);
        boardWrap.scrollTop += (r.top + r.height / 2) - (b.top + b.height / 2);
      });
    }
  }


  // ------------------------------------------------------------ rendu global
  function render() {
    ensureSel();
    renderTop(); renderBoard(); renderSides(); renderHand(); renderTicker(); renderPanel(); flushEvents(); fitBoard();
    setCrowd(battle.heat);
    if (battle.result && !ui.resultShown) { ui.resultShown = true; setTimeout(showResult, 1100); }
  }
  function canSelect(u) { return u.team === 'player' && !u.acted && !u.down && !u.eliminated && battle.phase === 'player'; }
  // Le lutteur actif se choisit tout seul : le premier qui peut encore jouer.
  // En un contre un, c'est toujours le vôtre, et il n'y a rien à sélectionner.
  function ensureSel() {
    if (ui.sel && canSelect(ui.sel)) return;
    ui.sel = living(battle, 'player').find(canSelect) || null;
    ui.card = null; ui.pending = null; ui.reach = ui.sel && !ui.sel.moved ? getReachable(battle, ui.sel) : null;
  }

  // ------------------------------------------------------------ bandeau
  function renderTop() {
    clear(el.top);
    const r = battle.rules;
    const mp = matchPhase(battle);
    const phase = battle.result ? 'Terminé' : battle.phase === 'player' ? 'Votre tour' : 'Tour adverse';
    const survive = r.victory === 'survive' ? ` · survivre ${Math.min(battle.turn, battle.match.turns)}/${battle.match.turns}` : '';
    el.top.append(
      h('div', { class: `mt-turn ${battle.phase}` }, h('b', {}, `T${battle.turn}`), h('span', {}, phase + survive)),
      h('div', { class: `mt-act act-${mp.key}`, title: mp.desc }, `${mp.icon} ${mp.name}`),
      h('div', { class: 'mt-heat', title: 'La foule refroidit si on ne lui donne rien. C’est la moyenne tenue sur tout le match qui paie.' },
        h('span', { class: 'lbl' }, '🔥'), bar(battle.heat, 100, 'heatbar', `${Math.round(battle.heat)}`), h('span', { class: 'moy' }, `moy. ${Math.round(avgHeat(battle))}`)),
      h('div', { class: 'mt-title' }, h('b', {}, battle.match.title || r.name), h('span', {}, `${r.icon} ${r.name}${battle.mode === 'scenario' ? ' · 🎬' : ''}`), refBadge(), mgrBadge('player'), mgrBadge('enemy')),
      h('div', { class: 'mt-btns' },
        h('button', { class: `btn small ghost${ui.panel === 'obj' ? ' on' : ''}`, title: 'Objectifs, directives, script', onclick: () => togglePanel('obj') }, '🎯'),
        h('button', { class: `btn small ghost${ui.panel === 'routes' ? ' on' : ''}`, title: 'Comment gagner', onclick: () => togglePanel('routes') }, '🏆'),
        h('button', { class: `btn small ghost${ui.panel === 'log' ? ' on' : ''}`, title: 'Journal du match', onclick: () => togglePanel('log') }, '📝'),
        h('span', { class: 'mt-sep' }),
        h('button', { class: 'btn small ghost', title: 'Basculer entre la caméra isométrique et la vue de dessus', onclick: toggleView }, boardWrap.classList.contains('view-iso') ? '🎥' : '🗺️'),
        boardWrap.classList.contains('view-iso') ? h('button', { class: 'btn small ghost', title: 'Tourner la caméra (R)', onclick: () => rotateBoard(1) }, '↻') : null,
        h('button', { class: 'btn small ghost', title: 'Dézoomer (−)', disabled: zoom <= ZOOM_MIN + 1e-6, onclick: () => zoomBoard(1 / 1.25) }, '−'),
        h('button', { class: 'btn small ghost zoom-val', title: 'Recadrer sur l’action (0)', onclick: resetZoom }, `${Math.round(zoom * 100)} %`),
        h('button', { class: 'btn small ghost', title: 'Zoomer (+)', disabled: zoom >= ZOOM_MAX - 1e-6, onclick: () => zoomBoard(1.25) }, '+'),
        h('span', { class: 'mt-sep' }),
        soundBtn(),
        h('button', { class: 'btn small ghost', title: 'Aide', onclick: () => showTutorial(root, {}) }, '📖'),
        h('button', { class: 'btn small ghost', title: 'Abandonner le match', onclick: () => { if (confirm('Abandonner ce match ? (compte comme une défaite)')) { cleanup(); onQuit(); } } }, '✕')),
    );
  }
  function refBadge() {
    if (!battle.rules.dq || !battle.ref) return null;
    const rs = refState(battle);
    return h('span', { class: `chip ref${rs.danger ? ' danger' : ''}${rs.blind ? ' blind' : ''}`, title: rs.label }, `🦓 ${battle.ref.name || 'Arbitre'} · ${rs.blind ? '👀' : `${battle.ref.patience}⚠️`}`);
  }
  function mgrBadge(team) {
    const m = battle.managers[team];
    if (!m) return null;
    return h('span', { class: `chip mgr team-${team}`, title: `${m.name} — ${m.desc}` }, `${m.icon} ${m.left}`);
  }
  function soundBtn() {
    const b = h('button', { class: 'btn small ghost', title: 'Couper ou remettre le son', onclick: () => {
      setSound(!soundOn()); b.textContent = soundOn() ? '🔊' : '🔇';
      if (soundOn()) { startCrowd(); setCrowd(battle.heat); play('ui'); }
    } }, soundOn() ? '🔊' : '🔇');
    return b;
  }
  function togglePanel(id) { ui.panel = ui.panel === id ? null : id; renderTop(); renderPanel(); }
  function renderPanel() {
    clear(el.panel);
    el.panel.hidden = !ui.panel;
    if (!ui.panel) return;
    const close = h('button', { class: 'btn small ghost close', onclick: () => togglePanel(ui.panel) }, '✖');
    if (ui.panel === 'obj') {
      const r = battle.rules;
      const items = [h('p', { class: 'muted' }, r.desc)];
      if (battle.mode === 'scenario' && battle.script) {
        const ev = evaluateScript(battle, battle.script);
        items.push(h('div', { class: 'obj-script' }, '🎬 ', battle.script.summary));
        items.push(h('div', { class: `obj-item ${battle.result ? (ev.finishOk ? 'done' : 'fail') : ''}` }, `${battle.result ? (ev.finishOk ? '✅' : '❌') : '📜'} Finish : ${describeFinish(battle.script.finish)}`));
        for (const b of ev.beats) { const pending = b.final && !battle.result; items.push(h('div', { class: `obj-item ${b.done && !pending ? 'done' : ''}` }, `${pending ? (b.done ? '⏳' : '⬜') : b.done ? '✅' : '⬜'} ${b.name} — ${b.desc}`)); }
        items.push(h('div', { class: 'obj-item muted' }, `Note en direct : ${starsText(ev.stars)}`));
      } else if (matchDef && matchDef.directives && matchDef.directives.length) {
        for (const d of evaluateDirectives(battle, matchDef.directives)) { const pending = d.final && !battle.result; items.push(h('div', { class: `obj-item ${d.done && !pending ? 'done' : ''}` }, `${pending ? (d.done ? '⏳' : '⬜') : d.done ? '✅' : '⬜'} ${d.name} — ${d.desc} (+${d.reward.fans} fans, +${d.reward.money} $)`)); }
      }
      put(el.panel, h('h3', {}, `🎯 ${r.name}`), close, items);
    } else if (ui.panel === 'routes') {
      const routes = winRoutes(battle);
      put(el.panel, h('h3', {}, '🏆 Comment gagner'), close,
        routes.map((r) => h('div', { class: `route ${r.ready ? 'ready' : ''}` }, h('b', {}, `${r.icon} ${r.name}`), h('span', { class: 'route-how' }, r.how), r.state ? h('span', { class: 'route-state' }, r.state) : null)));
    } else if (ui.panel === 'log') {
      el.panel.append(h('h3', {}, '📝 Journal'), close,
        h('div', { class: 'log-list' }, battle.log.slice(-40).reverse().map((e) => h('div', { class: `le ${e.cls || ''}` }, h('span', { class: 'lt' }, `T${e.turn}`), ' ', e.text))));
    }
  }
  function renderTicker() {
    clear(el.ticker);
    const last = battle.log.slice(-2).reverse();
    for (const [i, e] of last.entries()) el.ticker.append(h('div', { class: `tk ${e.cls || ''}${i ? ' old' : ''}`, onclick: () => togglePanel('log') }, e.text));
  }

  // ------------------------------------------------------------ plateau
  function renderBoard() {
    clear(el.board);
    const u0 = ui.sel;
    const reach = u0 && !ui.card && !u0.moved && battle.phase === 'player' ? ui.reach : null;
    const path = new Set();
    if (reach && ui.hoverXY) {
      let k = key(ui.hoverXY.x, ui.hoverXY.y), guard = 0;
      while (k && reach.has(k) && guard++ < 200) { path.add(k); k = reach.get(k).from; }
    }
    const targets = ui.card ? new Map(ui.card.targets.filter((t) => t.unit).map((t) => [key(t.unit.x, t.unit.y), t])) : null;
    const vias = ui.card ? new Set(ui.card.targets.filter((t) => t.via && (t.via.x !== u0.x || t.via.y !== u0.y)).map((t) => key(t.via.x, t.via.y))) : null;
    const threat = ui.hover && ui.hover.team === 'enemy' && !ui.hover.eliminated && !ui.card ? threatRange(ui.hover) : null;
    const setup = ui.setupFor && u0 ? setupTiles(u0, ui.setupFor) : null;
    // L'annonce adverse, sur le plateau : la case d'où partira le coup et
    // celle qui le recevra.
    const intentMoves = new Map(), intentTargets = new Map();
    if (battle.phase === 'player' && !battle.result) {
      for (const e of living(battle, 'enemy')) {
        if (!e.intent) continue;
        if (e.intent.moveTo) intentMoves.set(key(e.intent.moveTo.x, e.intent.moveTo.y), e);
        const t = e.intent.targetUid ? battle.units.find((v) => v.uid === e.intent.targetUid) : null;
        if (t && !t.eliminated) intentTargets.set(key(t.x, t.y), e);
      }
    }
    // Ordre du peintre : du fond vers l'avant, selon l'angle de caméra.
    const rot = boardRot();
    const depth = (x, y) => (rot === 0 ? x + y : rot === 1 ? x - y : rot === 2 ? -(x + y) : y - x);
    const order = [];
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) order.push([x, y]);
    order.sort((a, b) => depth(a[0], a[1]) - depth(b[0], b[1]));
    for (const [x, y] of order) {
      const tile = tileAt(g, x, y);
      const k = key(x, y);
      const lvl = heightAt(g, x, y);
      const cell = h('div', { class: `cell t-${tile}${lvl ? ' raised' : ''}`, 'data-x': x, 'data-y': y, 'data-p': (x + y) % 2, style: lvl ? { '--lvl': lvl } : {}, onclick: () => onCell(x, y), onpointerenter: (e) => { if (e.pointerType === 'mouse') onHover(x, y); }, onpointerleave: (e) => { if (e.pointerType === 'mouse') onHover(null); } });
      if (TERRAIN[tile].icon) cell.append(h('span', { class: 'ticon' }, TERRAIN[tile].icon));
      if (intentMoves.has(k)) { cell.classList.add('intent-move'); cell.append(h('span', { class: 'intent-ghost' }, intentMoves.get(k).intent.icon)); }
      if (intentTargets.has(k)) cell.classList.add('intent-target');
      if (reach && reach.get(k) && !reach.get(k).blocked) cell.classList.add('reach');
      if (path.has(k)) cell.classList.add('path');
      if (threat && threat.has(k)) cell.classList.add('threat');
      if (setup && setup.has(k)) cell.classList.add('setup');
      if (vias && vias.has(k)) cell.classList.add('via');
      if (targets && targets.has(k)) {
        cell.classList.add('target');
        if (ui.pending && ui.pending.unit && ui.pending.unit.x === x && ui.pending.unit.y === y) cell.classList.add('pending');
        const t = targets.get(k);
        const b = t.hit != null ? `${t.hit} %` : t.chance != null ? `${Math.round(t.chance * 100)} %` : '';
        if (b) cell.append(h('span', { class: 'badge' }, b));
      }
      const item = battle.items.find((i) => i.x === x && i.y === y);
      if (item) cell.append(h('span', { class: 'item', title: item.weapon.name }, item.weapon.icon));
      const u = unitAt(battle, x, y);
      if (u) cell.append(h('span', { class: `tile-mark team-${u.team}${ui.sel === u ? ' sel' : ''}${u.acted && u.team === 'player' ? ' acted' : ''}${u.teamwork ? ' teamwork' : ''}` }));
      if (u && (u.x !== x || u.y !== y)) cell.classList.add('unit-body');
      if (u && u.x === x && u.y === y) {
        const tok = unitToken(u);
        if (ui.sel === u) tok.classList.add('selected');
        if (ui.acting === u) tok.classList.add('acting');
        if (u.intent && u.team === 'enemy' && battle.phase === 'player') tok.classList.add('announcing');
        tok.style.zIndex = 10 + x + y + heightAt(g, x, y);
        tok.style.setProperty('--lvl', heightAt(g, x, y));
        cell.append(tok);
      }
      cell.style.gridColumn = String(x + 1);
      cell.style.gridRow = String(y + 1);
      el.board.append(cell);
    }
    const ring = g.ring;
    if (ring) {
      const box = (x0, y0, w, hh, cls, kid) => h('div', { class: cls, style: { left: `calc(${x0} * (var(--cell) + 2px))`, top: `calc(${y0} * (var(--cell) + 2px))`, width: `calc(${w} * (var(--cell) + 2px))`, height: `calc(${hh} * (var(--cell) + 2px))` } }, kid || null);
      const cx = (ring.x0 + ring.x1 + 1) / 2, cy = (ring.y0 + ring.y1 + 1) / 2;
      el.board.append(box(cx - 2, cy - 1, 4, 2, 'ring-logo', h('span', {}, 'PPW')));
      if (boardWrap.classList.contains('view-iso')) {
        for (const { el: rope, depth: d } of ringRopes(ring, depth)) {
          const after = [...el.board.children].find((c) => c.dataset.x !== undefined && depth(Number(c.dataset.x), Number(c.dataset.y)) > d);
          el.board.insertBefore(rope, after || null);
        }
      }
    }
  }
  // CORDES EN FAUX 3D : un ruban le long d'une arête, décalé à parts égales sur
  // les deux axes, ce qui « monte » après la projection isométrique. Inséré
  // dans l'ordre du peintre pour que le fond passe derrière les lutteurs.
  function ringRopes(ring, depth) {
    const rot = boardRot();
    const LX = [-1, -1, 1, 1][rot], LY = [-1, 1, 1, -1][rot];
    const px = (n) => `calc(${n} * (var(--cell) + 2px))`;
    const up = (n) => `translate(${px(LX * n)}, ${px(LY * n)})`;
    const x0 = ring.rx0, y0 = ring.ry0, x1 = ring.rx1 + 1, y1 = ring.ry1 + 1;
    const out = [];
    const sides = [{ left: x0, top: y0, w: x1 - x0, horiz: true }, { left: x0, top: y1, w: x1 - x0, horiz: true }, { left: x0, top: y0, w: y1 - y0, horiz: false }, { left: x1, top: y0, w: y1 - y0, horiz: false }];
    for (const s of sides) {
      const mx = s.horiz ? (s.left + s.w / 2) : s.left, my = s.horiz ? s.top : (s.top + s.w / 2);
      for (let i = 0; i < ROPE_LEVELS.length; i++) {
        out.push({ depth: depth(mx, my), el: h('div', { class: `ring-rope ${s.horiz ? 'h' : 'v'} rope-${i}`, style: { left: px(s.left), top: px(s.top), [s.horiz ? 'width' : 'height']: px(s.w), transform: up(ROPE_LEVELS[i]) } }) });
      }
    }
    for (const [cx2, cy2] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) {
      out.push({ depth: depth(cx2, cy2), el: h('div', { class: 'ring-post', style: { left: px(cx2), top: px(cy2), '--post': px(POST_H), transform: up(POST_H) } }) });
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
  function unitToken(u) {
    const def = WRESTLERS_BY_ID[u.id];
    const icons = [];
    if (u.statuses.dazed) icons.push('😵');
    if (u.statuses.cursed) icons.push('🕯️');
    if (u.statuses.finished) icons.push('☠️');
    if (u.weapon) icons.push(u.weapon.icon);
    if (battle.rules.tag && u.legal) icons.push('⭐');
    if (u.teamwork) icons.push('🤝');
    if (u.acted && u.team === 'player' && battle.phase === 'player') icons.push('✔');
    if (u.climb > 0) icons.push('🧗');
    if (u.outsideCount > 0 && battle.rules.countOut) icons.push(`⏱${u.outsideCount}`);
    const { w: uw, h: uh } = sizeOf(u);
    const big = uw > 1 || uh > 1;
    const hurt = u.hp / u.maxHp <= 0.4;
    const it = u.intent && u.team === 'enemy' && battle.phase === 'player' && !battle.result ? u.intent : null;
    return h('div', { class: `unit team-${u.team}${big ? ' big' : ''}${hurt ? ' hurt' : ''}${u.down ? ' down' : ''}${u.acted && u.team === 'player' && battle.phase === 'player' ? ' acted' : ''}`, style: big ? { '--uw': uw, '--uh': uh } : {}, title: `${u.name} — ${u.hp}/${u.maxHp} PV, momentum ${u.momentum}` },
      h('span', { class: 'unit-shadow' }),
      avatar(def, 0, { fill: true, view: 'full', bg: 'none', anim: true, dir: screenFacing(u.facing, boardRot()), pose: u.down ? 'down' : null }),
      h('div', { class: 'mini hp' }, h('div', { style: { width: `${(u.hp / u.maxHp) * 100}%` } })),
      icons.length ? h('span', { class: 'sicons' }, icons.join('')) : null,
      it ? h('span', { class: 'intent-bubble', title: intentText(it) }, `${it.icon} ${it.name.replace(/^[^\w\p{L}]+\s*/u, '').slice(0, 16)}${it.dmg != null ? ` ~${it.dmg}` : ''}`) : null,
      h('span', { class: 'uname' }, h('b', {}, shortName(u.name)), h('i', {}, `${u.hp}`)),
    );
  }
  function intentText(it) {
    let t = `Annonce : ${it.name}`;
    if (it.targetName) t += ` sur ${it.targetName}`;
    if (it.dmg != null) t += ` (~${it.dmg} dégâts, ${it.hit} %)`;
    else if (it.hit != null) t += ` (${it.hit} %)`;
    if (it.moveTo) t += ' — après s’être déplacé';
    return t;
  }
  // Les cases depuis lesquelles une carte à condition deviendrait jouable : la
  // carte survolée devient un itinéraire sur le plateau.
  const SETUPS = [
    ['ran', (n) => ['🏃', `${n} case${n > 1 ? 's' : ''} de course`]],
    ['crossedRope', () => ['🪢', 'traverser les cordes']],
    ['turnbuckle', () => ['🪜', 'depuis un coin']],
    ['attackerOnRope', () => ['🪢', 'depuis les cordes']],
    ['targetOnRope', () => ['🎯', 'cible sur les cordes']],
    ['targetDown', () => ['💫', 'cible au sol']],
    ['targetDownOrDazed', () => ['💫', 'cible au sol ou étourdie']],
    ['targetDazedOrCorner', () => ['💫', 'cible étourdie ou dans un coin']],
    ['targetNearTable', () => ['🪑', 'cible contre une table']],
  ];
  function setupOf(move) {
    const req = (move && move.requires) || {};
    for (const [k, f] of SETUPS) if (req[k]) return f(req[k]);
    return null;
  }
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

  // ------------------------------------------------------------ fiches
  function renderSides() {
    clear(el.left); clear(el.right);
    for (const u of battle.units.filter((x) => x.team === 'player')) el.left.append(fiche(u));
    for (const u of battle.units.filter((x) => x.team === 'enemy')) el.right.append(fiche(u));
    // La prévision, sous la fiche de la cible : ce que la carte levée ferait.
    const t = ui.pending || (ui.hover && ui.card ? ui.card.targets.find((x) => x.unit === ui.hover) : null) || (ui.card && ui.card.targets.length === 1 ? ui.card.targets[0] : null);
    if (ui.card && ui.sel && t && t.unit) el.right.append(renderForecast(ui.sel, t));
    else if (ui.card && ui.sel) el.right.append(h('div', { class: 'hint' }, TOUCH ? 'Touchez une cible allumée.' : 'Survolez une cible allumée pour la prévision, cliquez pour jouer.'));
  }
  // UNE FICHE COMPACTE : le portrait, le nom, trois jauges, le cœur, l'énergie
  // pour les vôtres, l'annonce pour les leurs, et au plus trois statuts. Les
  // stats, le gimmick et l'usure complète se déplient d'un clic.
  function fiche(u) {
    const def = WRESTLERS_BY_ID[u.id];
    const sel = ui.sel === u;
    const open = ui.expanded.has(u.uid);
    const st = [];
    if (u.down) st.push('💫 au sol');
    if (u.statuses.dazed) st.push(`😵 étourdi ${u.statuses.dazed}`);
    if (u.statuses.finished) st.push('☠️ sonné');
    if (u.statuses.cursed) st.push('🕯️ maudit');
    if (u.statuses.welt) st.push(`🔴 marques ×${u.statuses.welt}`);
    if (u.weapon) st.push(`${u.weapon.icon} ${u.weapon.name} (${u.weapon.uses})`);
    if (battle.rules.tag) st.push(u.legal ? '⭐ légal' : '🚫 non légal');
    if (battle.rules.countOut > 0 && u.outsideCount > 0) st.push(`⏱ compte ${u.outsideCount}/${battle.rules.countOut}`);
    if (u.climb > 0) st.push(`🧗 ${u.climb}`);
    if (u.teamwork) st.push('🤝 double équipe');
    if (u.guard) st.push('🛡️ couvert');
    if (u.hyped) st.push('🔥 foule debout');
    if (u.feint) st.push('🎭 feinte');
    if (winded(u)) st.push('😮‍💨 à bout de souffle');
    if (u.eliminated) st.push('❌ éliminé');
    const it = u.intent && u.team === 'enemy' && battle.phase === 'player' && !battle.result ? u.intent : null;
    const parts = wornParts(u).filter((w) => w.n >= 18);
    const s = getStats(battle, u);
    const cls = CLASSES[u.cls], spec = SPECIALTIES[u.spec], gk = GIMMICKS[u.gimmick];
    return h('div', { class: `fiche team-${u.team}${sel ? ' sel' : ''}${u.acted && u.team === 'player' && battle.phase === 'player' ? ' acted' : ''}${u.eliminated ? ' out' : ''}${u.hp / u.maxHp <= 0.3 ? ' danger' : ''}`,
      onclick: () => { if (u.team === 'player' && canSelect(u) && !sel) { select(u); } else { toggleExpand(u); } },
      onpointerenter: (e) => { if (e.pointerType !== 'mouse') return; ui.hover = u; renderBoard(); },
      onpointerleave: (e) => { if (e.pointerType !== 'mouse') return; ui.hover = null; renderBoard(); } },
      h('div', { class: 'fiche-head' }, avatar(def, 40), h('div', { class: 'fiche-name' }, h('b', {}, shortName(u.name)), h('span', {}, `${cls.icon} ${cls.name} · ${spec.icon} ${spec.name}`))),
      h('div', { class: 'fiche-bars' },
        h('div', { class: 'fb' }, h('i', {}, 'PV'), bar(u.hp, u.maxHp, 'hpbar', `${u.hp}/${u.maxHp}`)),
        h('div', { class: 'fb' }, h('i', {}, '⚡'), bar(u.momentum, 100, 'mombar ticks', `${u.momentum}`)),
        h('div', { class: 'fb' }, h('i', {}, '😮‍💨'), bar(u.stamina, u.maxStamina, `stambar${winded(u) ? ' low' : ''}`, `${Math.round(u.stamina)}`))),
      h('div', { class: 'fiche-row' },
        h('span', { class: 'hearts', title: `Cœur ${u.grit}/${u.maxGrit} : le plafond du tombé` }, `❤️ ${u.grit}`),
        u.team === 'player' ? h('span', { class: 'energy-pips', title: 'Énergie du tour' }, Array.from({ length: u.maxEnergy || 3 }, (_, i) => h('i', { class: i < (u.energy ?? 0) ? 'on' : '' }, '⚡'))) : null,
        parts.length ? h('span', { class: 'pm-wear' }, parts.map((w) => h('span', { class: `wp lvl${w.level}`, title: `${w.name} : ${Math.round(w.n)}/${WEAR_MAX} — ${w.level >= 2 ? w.broken : w.level === 1 ? w.hurt : 'commence à prendre'}` }, w.icon))) : null),
      st.length ? h('div', { class: 'fiche-st' }, st.slice(0, 3).map((x) => h('span', {}, x))) : null,
      it ? h('div', { class: 'fiche-intent', title: intentText(it) }, `🎯 ${it.icon} ${it.name}${it.targetName ? ` → ${shortName(it.targetName)}` : ''}${it.dmg != null ? ` · ~${it.dmg} · ${it.hit} %` : it.hit != null ? ` · ${it.hit} %` : ''}`) : null,
      open ? h('div', { class: 'fiche-more' },
        h('div', { class: 'ustats' }, ['str', 'agi', 'tec', 'def', 'cha'].map((k) => h('span', {}, h('b', {}, { str: 'FOR', agi: 'AGI', tec: 'TEC', def: 'DEF', cha: 'CHA' }[k]), ` ${s[k]}`)), h('span', {}, h('b', {}, 'MOV'), ` ${moveRange(battle, u)}`)),
        h('div', { class: 'gimmick small' }, h('b', {}, gk ? gk.name : u.gimmick), h('div', {}, gk ? gk.desc : '')),
        st.length > 3 ? h('div', { class: 'fiche-st' }, st.slice(3).map((x) => h('span', {}, x))) : null) : null,
      h('span', { class: 'fiche-toggle' }, open ? '▴' : '▾'),
    );
  }
  function toggleExpand(u) { if (ui.expanded.has(u.uid)) ui.expanded.delete(u.uid); else ui.expanded.add(u.uid); renderSides(); }

  // ------------------------------------------------------------ la main
  function renderHand() {
    clear(el.hand);
    const u = ui.sel;
    if (battle.result) return;
    if (battle.phase !== 'player') {
      el.hand.append(h('div', { class: 'hand-msg' }, `Tour adverse… ${ui.acting ? `${shortName(ui.acting.name)} joue.` : ''}`));
      return;
    }
    const left = living(battle, 'player').filter((x) => !x.acted && !x.down).length;
    const endBtn = h('button', { class: `btn primary end${left ? '' : ' hot'}`, disabled: ui.busy, onclick: endTurn, title: 'Fin du tour (E)' }, left ? `Fin du tour (${left})` : 'Fin du tour');
    if (!u) {
      el.hand.append(h('div', { class: 'hand-msg' }, 'Tous vos lutteurs ont joué.'), endBtn);
      return;
    }
    const actions = listActions(battle, u);
    const d = deckState(u);
    const cartes = actions.filter((a) => enMain(a, u));
    const merites = actions.filter((a) => estMerite(a));
    const fixes = { pin: actions.find((a) => a.type === 'pin'), teamwork: actions.find((a) => a.type === 'teamwork'), wait: actions.find((a) => a.type === 'wait') };
    const autres = actions.filter((a) => !enMain(a, u) && !estMerite(a) && !['pin', 'teamwork', 'wait'].includes(a.type));
    // À gauche : qui joue, l'énergie, le talon.
    const who = h('div', { class: 'hand-who' },
      avatar(WRESTLERS_BY_ID[u.id], 34),
      h('div', {}, h('b', {}, shortName(u.name)),
        h('span', { class: 'energy-pips big' }, Array.from({ length: u.maxEnergy || 3 }, (_, i) => h('i', { class: i < (u.energy ?? 0) ? 'on' : '' }, '⚡'))),
        h('span', { class: 'deck-counts', title: 'Talon · défausse' }, `🂠 ${d.talon} · 🗑 ${d.defausse}`)),
      u.moved && !u.acted && u.prev ? h('button', { class: 'btn small ghost', title: 'Annuler le déplacement', onclick: () => { undoMove(battle, u); ui.reach = getReachable(battle, u); ui.card = null; render(); } }, '↩') : null,
      !u.moved ? h('span', { class: 'hand-hint' }, 'cliquez une case bleue pour vous déplacer') : null);
    // Au centre : la main, puis les cartes méritées.
    const main = h('div', { class: 'cards' }, cartes.map((a) => cardEl(a, u)), merites.map((a) => cardEl(a, u, true)));
    // À droite : les actions fixes, et le ring quand il a quelque chose à dire.
    const strip = h('div', { class: 'strip' },
      stripBtn(fixes.pin, '🤝', 'Tombé'),
      stripBtn(fixes.teamwork, '🤝', 'Double équipe'),
      autres.length ? h('button', { class: `btn small${ui.ringOpen ? ' on' : ''}`, onclick: () => { ui.ringOpen = !ui.ringOpen; renderHand(); } }, `🔔 Le ring ${ui.ringOpen ? '▴' : '▾'}`) : null,
      stripBtn(fixes.wait, '⏳', 'Souffler'),
      endBtn);
    el.hand.append(who, main, strip);
    if (ui.ringOpen && autres.length) {
      el.hand.append(h('div', { class: 'ring-menu' }, autres.map((a) => h('button', { class: `btn small${a.ok ? '' : ' off'}`, disabled: !a.ok, title: a.ok ? a.desc : a.reason, onclick: () => raise(a) }, `${TYPE_ICON[a.type] || '•'} ${a.name}`, h('small', {}, a.ok ? '' : a.reason)))));
    }
  }
  function stripBtn(a, icon, label) {
    if (!a) return null;
    const best = a.targets && a.targets.length && a.targets[0].unit ? a.targets.reduce((x, y) => ((y.chance ?? 0) > (x.chance ?? 0) ? y : x)) : null;
    const pct = best && best.chance != null ? ` ${Math.round(best.chance * 100)} %` : '';
    return h('button', { class: `btn small strip-btn${a.ok ? '' : ' off'}${ui.card === a ? ' raised' : ''}`, disabled: !a.ok || ui.busy, title: a.ok ? a.desc : a.reason, onclick: () => raise(a) }, `${icon} ${label}${pct}`);
  }
  // UNE CARTE. Le coût en haut à gauche, le pictogramme du type, le nom, une
  // ligne de chiffres, la condition s'il y en a une, et la précision sur la
  // meilleure cible. Grisée avec sa raison quand elle ne se joue pas.
  function cardEl(a, u, merite = false) {
    const m = a.move;
    const best = a.targets.length && a.targets[0].unit ? a.targets.reduce((x, y) => ((y.hit ?? (y.chance || 0) * 100) > (x.hit ?? (x.chance || 0) * 100) ? y : x)) : null;
    const prep = setupOf(m);
    const combos = m && best && best.unit ? activeCombos(battle, u, best.unit, m) : [];
    const stats = [];
    if (m && m.power != null) stats.push(`💥${m.power}`);
    if (m && m.acc != null) stats.push(`🎯${m.acc}`);
    if (m && m.range && m.range[1] > 1) stats.push(`↔${m.range[1]}`);
    if (m && m.part && PARTS[m.part]) stats.push(`${PARTS[m.part].icon}`);
    if (a.cost) stats.push(`⚡−${a.cost}`);
    const raised = ui.card === a;
    const eff = (m && m.effects) || {};
    const tags = [];
    if (eff.daze) tags.push('😵 étourdit');
    if (eff.push) tags.push(`↗️ recul ${eff.push}`);
    if (eff.pull) tags.push('↙️ attire');
    if (eff.line) tags.push('➡️ ligne');
    if (eff.splash) tags.push('💥 zone');
    if (eff.illegal) tags.push('⚠️ illégal');
    if (m && m.type === 'submission') tags.push('🔗 soumission');
    if (m && m.blurb) tags.push(m.blurb);
    const cost = a.energy === 'all' ? '⏳' : a.energy === 0 ? '0' : String(a.energy);
    return h('button', {
      'data-id': a.id,
      class: `card tier-${m ? m.tier : 'base'} type-${a.type}${a.ok ? '' : ' off'}${raised ? ' raised' : ''}${merite ? ' merite' : ''}`,
      disabled: ui.busy,
      title: a.ok ? (m && m.desc) || a.desc : a.reason,
      onclick: () => (a.ok ? raise(a) : toast(a.reason, 'warn')),
      onpointerenter: () => { if (!prep) return; ui.setupFor = m; renderBoard(); },
      onpointerleave: () => { if (ui.setupFor !== m) return; ui.setupFor = null; renderBoard(); },
    },
      h('span', { class: 'c-cost' }, cost),
      h('span', { class: 'c-icon' }, (m && TACTIC_ICON[m.tactic]) || TYPE_ICON[a.type] || '•'),
      merite ? h('span', { class: 'c-tier' }, MOVE_TIER_LABEL[m.tier] || m.tier) : null,
      h('span', { class: 'c-name' }, a.name.replace(/^[^\w\p{L}]+\s*/u, '')),
      h('span', { class: 'c-stats' }, stats.join(' ')),
      tags.length ? h('span', { class: 'c-tags' }, tags.join(' · ')) : null,
      prep ? h('span', { class: `c-prep${a.ok ? ' done' : ''}` }, `${prep[0]} ${prep[1]}`) : null,
      combos.length ? h('span', { class: 'c-combo' }, combos.map((c) => c.icon).join('')) : null,
      !a.ok ? h('span', { class: 'c-why' }, a.reason.replace(/^[^\w\p{L}]+\s*/u, '')) : best && (best.hit != null || best.chance != null) ? h('span', { class: 'c-hit' }, `${best.hit ?? Math.round(best.chance * 100)} %`) : null,
    );
  }

  // ------------------------------------------------------------ prévision
  function renderForecast(u, t) {
    const a = ui.card;
    const tgt = t.unit;
    const box = h('div', { class: 'forecast' });
    let mid = [], afterT = null;
    if (a.move && ATTACK_TYPES.has(a.type)) {
      const pos = t.via || u;
      const hit = hitChance(battle, u, tgt, a.move, { pos });
      const { dmg } = computeDamage(battle, u, tgt, a.move, { noRng: true });
      afterT = Math.max(0, tgt.hp - dmg);
      mid = [['Précision', `${hit} %`], ['Dégâts', `~${dmg}`]];
      const rev = reverseChance(battle, u, tgt, a.move);
      if (rev > 0.005) mid.push(['🔄 Renversement', `${Math.round(rev * 100)} %`]);
      if (winded(u)) mid.push(['😮‍💨 Essoufflé', '−25 % dégâts, −10 précision']);
      const us = wearFrom(a.move, dmg);
      if (us) {
        const P = PARTS[us.part];
        const avant = wearOf(tgt, us.part), apres = Math.min(WEAR_MAX, avant + us.n);
        const seuil = apres >= WEAR_BROKEN ? ' — HORS SERVICE' : apres >= WEAR_HURT ? ' — touchée' : '';
        mid.push([`${P.icon} ${P.name}${us.aimed ? ' (visée)' : ''}`, `${Math.round(avant)} → ${Math.round(apres)}${seuil}`]);
      }
      if (a.type === 'submission') {
        const tap = tapChance(battle, u, tgt, a.move);
        const p = movePart(a.move);
        mid.push(['🔗 Abandon', `${Math.round(tap * 100)} %${p ? ` (${PARTS[p].short} à ${Math.round(wearOf(tgt, p))})` : ''}`]);
      }
      const nv = novelty(u, a.move);
      if (nv < 0.99) mid.push(['👥 Déjà vu', `${moveUses(u, a.move)}× — ×${nv.toFixed(2)}`]);
      const el2 = elanLabel(u.movedTiles, a.move, u);
      if (el2) mid.push([`🏃 ${el2.name}`, `${el2.travel} case${el2.travel > 1 ? 's' : ''} · ${el2.good ? '+' : ''}${Math.round((el2.mult - 1) * 100)} %`]);
      const eff = a.move.effects || {};
      if (eff.push) mid.push(['↗️ Recul', `${eff.push} case${eff.push > 1 ? 's' : ''} — ${whipPreview(u, tgt, eff.push)}`]);
      for (const row of spreadPreview(u, tgt, a.move, dmg)) mid.push(row);
      for (const c of activeCombos(battle, u, tgt, a.move)) mid.push([`${c.icon} ${c.name}`, `+${Math.round((c.dmg - 1) * 100)} %`]);
      for (const al of teamworkPartners(battle, u)) {
        if (manhattan(al, tgt) !== 1) continue;
        const d2 = Math.max(1, Math.round(computeDamage(battle, al, tgt, MOVES.punch, { noRng: true }).dmg * TEAMWORK_RATIO));
        mid.push(['🤝 Double équipe', `${shortName(al.name)} enchaîne : ~${d2}`]);
        afterT = Math.max(0, afterT - d2);
      }
      if (dmg >= tgt.hp && !tgt.down) mid.push(['Résultat', '💫 AU SOL']);
      if (a.move.tier === 'finisher') mid.push(['Finisher', 'tombé immédiat +30 %']);
      if (tgt.gimmick === 'outta_nowhere' && tgt.momentum >= 50) mid.push(['⚠️ Risque', 'contre RKO 35 %']);
      if (((a.move.effects || {}).illegal || a.type === 'weapon') && battle.rules.dq) { const rs = refState(battle); mid.push([rs.blind ? '👀 Arbitre' : rs.danger ? '🚨 Arbitre' : '⚠️ Arbitre', rs.label]); }
      mid.push(['Momentum', `${u.momentum} → ${Math.min(100, Math.max(0, u.momentum - (a.cost || 0)) + (a.move.momentum || 0))}`]);
    } else if (a.type === 'pin') mid = [['Tombé', `${Math.round(t.chance * 100)} %`], ['Cœur adverse', `❤️ ${tgt.grit}`], ['Si kick-out', 'cœur −1, +15 momentum']];
    else if (a.type === 'toss') mid = [['Par-dessus la corde', `${Math.round(t.chance * 100)} %`]];
    else if (a.id === 'whip') mid = [['Précision', `${t.hit} %`], ['Projection', whipPreview(u, tgt, 2)]];
    else if (a.type === 'manager') mid = [[`${a.manager.icon} ${a.manager.name}`, a.manager.nick], ['Effet', a.manager.desc], ['Il reste', `${a.manager.left}`]];
    else if (a.type === 'tag') mid = [['Tag', `${shortName(tgt.name)} devient légal`], ['Réussite', `${Math.round((t.chance ?? 1) * 100)} %`], ['Bonus', '+30 momentum, +25 souffle']];
    else if (a.type === 'job') mid = [['Script', 'votre lutteur perd volontairement']];
    else if (a.move && a.move.effects && a.move.effects.drainMomentum) mid = [['Momentum adverse', `−${a.move.effects.drainMomentum}`]];
    put(box, h('div', { class: 'fc-name' }, `${TYPE_ICON[a.type] || ''} ${a.name} → ${shortName(tgt.name)}`),
      mid.map(([k, v]) => h('div', { class: 'fc-row' }, h('span', {}, k), h('b', {}, v))),
      afterT != null ? h('div', { class: 'fc-row hp' }, h('span', {}, 'PV'), h('b', {}, `${tgt.hp} → ${afterT}`)) : null,
      TOUCH && ui.pending ? h('button', { class: 'btn primary wide', onclick: () => doAction(a, tgt) }, `✅ ${a.name}`) : h('div', { class: 'hint center' }, 'Cliquez la cible pour jouer'));
    return box;
  }
  function whipPreview(u, tgt, n = 2) {
    const dx = Math.sign(tgt.x - u.x), dy = Math.sign(tgt.y - u.y);
    for (let i = 1; i <= n; i++) {
      const tile = tileAt(g, tgt.x + dx * i, tgt.y + dy * i);
      if (unitAt(battle, tgt.x + dx * i, tgt.y + dy * i)) return 'collision (6 dégâts chacun)';
      if (tile === 'table') return '💥 TABLE ! 25 dégâts';
      if (tile === 'cage') return 'cage : 15 dégâts';
      if (tile === 'barricade') return 'barricade : 10 dégâts';
      if (tile === 'steps') return 'marches : 12 dégâts';
      if (tile === 'turnbuckle') return 'coin : 10 dégâts + étourdi';
      if (tile === 'rope') return battle.rules.toss && ['rope', 'turnbuckle'].includes(tileAt(g, tgt.x, tgt.y)) ? 'par-dessus la corde ?' : 'cordes : étourdi';
      if (TERRAIN[tile] && TERRAIN[tile].outside && !TERRAIN[tileAt(g, tgt.x, tgt.y)].outside && battle.rules.toss) return 'par-dessus la corde !';
    }
    return `recule de ${n} case${n > 1 ? 's' : ''}`;
  }
  function spreadPreview(u, tgt, move, dmg) {
    const eff = (move && move.effects) || {};
    const out = [];
    if (!eff.line && !eff.splash) return out;
    const pris = new Set();
    if (eff.line) {
      const dx = Math.sign(tgt.x - u.x), dy = Math.sign(tgt.y - u.y);
      if (dx || dy) for (let i = 1; i <= eff.line; i++) { const v = unitAt(battle, tgt.x + dx * i, tgt.y + dy * i); if (v && v !== u && v !== tgt) pris.add(v); }
    }
    if (eff.splash) for (const v of battle.units) { if (v === u || v === tgt || v.eliminated) continue; if (manhattan(v, tgt) === 1) pris.add(v); }
    for (const v of pris) out.push([`${v.team === u.team ? '⚠️' : '↳'} ${shortName(v.name)}`, `${v.team === u.team ? 'votre partenaire' : 'aussi'} : ~${Math.round(dmg * (eff.splash ? (eff.splash === true ? 0.5 : eff.splash) : 0.7))}`]);
    return out;
  }

  // ------------------------------------------------------------ interactions
  function select(u) { ui.sel = u; ui.card = null; ui.pending = null; ui.ringOpen = false; ui.reach = u.moved ? null : getReachable(battle, u); render(); }
  function raise(a) {
    if (!a || !a.ok || ui.busy) return;
    if (!aCible(a)) { doAction(a, null); return; }
    ui.card = ui.card === a ? null : a;
    ui.pending = null;
    // Une seule cible et pas de tactile : on montre la prévision, on ne joue
    // pas tout seul — c'est au joueur de confirmer d'un clic sur la cible.
    render();
  }
  function lower() { ui.card = null; ui.pending = null; render(); }
  function onCell(x, y) {
    if (ui.busy || battle.result || battle.phase !== 'player') return;
    const u = unitAt(battle, x, y);
    if (ui.card) {
      const t = ui.card.targets.find((t) => t.unit && t.unit === u);
      if (t && TOUCH && !(ui.pending && ui.pending.unit === t.unit)) { ui.pending = t; render(); return; }
      if (t) { doAction(ui.card, t.unit); return; }
      lower(); return;
    }
    if (u && canSelect(u) && u !== ui.sel) { select(u); return; }
    if (ui.sel && !ui.sel.moved && ui.reach) {
      const n = ui.reach.get(key(x, y));
      if (n && !n.blocked) { moveUnit(battle, ui.sel, x, y); ui.reach = null; play('ui'); render(); return; }
    }
    if (u && u.team === 'enemy') { toggleExpand(u); return; }
  }
  function doAction(a, target) {
    const u = ui.sel;
    const vol = captureCard(a);
    const r = executeAction(battle, u, a.id, target ? { unit: target } : null);
    if (!r.ok) { toast(r.reason, 'warn'); lower(); return; }
    ui.pendingFlight = vol ? { ...vol, to: target ? { x: target.x, y: target.y } : { x: u.x, y: u.y } } : null;
    if (isCard(a.id)) play('card');
    if (MOVES[a.id] && MOVES[a.id].tier === 'finisher') { play('finisher'); crowdPop(1.2); shake(); }
    if (r.countered) toast('CONTRÉ !', 'warn');
    ui.card = null; ui.pending = null; ui.setupFor = null;
    // « Reprendre sa course » redonne un déplacement : on recalcule la portée.
    ui.reach = !u.acted && !u.moved ? getReachable(battle, u) : null;
    if (u.onlyPin && !battle.result) { render(); const pin = listActions(battle, u).find((x) => x.id === 'pin'); if (pin && pin.ok) { ui.card = pin; render(); } return; }
    if (u.acted || u.down || u.eliminated) ui.sel = null;
    render();
  }
  function onHover(x, y) {
    const u = x == null ? null : unitAt(battle, x, y);
    const tile = x == null ? null : tileAt(g, x, y);
    if (tile !== ui.hoverTile) {
      ui.hoverTile = tile;
      const txt = tile && TILE_HELP[tile] ? `${TERRAIN[tile].name} — ${TILE_HELP[tile]}` : '';
      el.tileInfo.textContent = txt; el.tileInfo.hidden = !txt;
    }
    const moved = !ui.hoverXY || x !== ui.hoverXY.x || y !== ui.hoverXY.y;
    ui.hoverXY = x == null ? null : { x, y };
    if (performance.now() < ui.animUntil) { ui.hover = u; return; }       // pas pendant un coup : le rendu couperait l'animation
    if (u !== ui.hover) { ui.hover = u; renderBoard(); if (ui.card) renderSides(); }
    else if (moved && ui.sel && !ui.card && !ui.sel.moved) renderBoard();
  }
  function onKey(e) {
    if (e.ctrlKey || e.metaKey) return;
    if ((e.key === 'r' || e.key === 'R') && boardWrap.classList.contains('view-iso')) { rotateBoard(e.shiftKey ? -1 : 1); return; }
    if (e.key === '+' || e.key === '=') { zoomBoard(1.25); return; }
    if (e.key === '-' || e.key === '_') { zoomBoard(1 / 1.25); return; }
    if (e.key === '0') { resetZoom(); return; }
    if ((e.key === 'e' || e.key === 'E') && !ui.busy && battle.phase === 'player' && !battle.result) { endTurn(); return; }
    if (e.key === 'Escape' && !ui.busy) { if (ui.panel) togglePanel(ui.panel); else if (ui.card) lower(); }
    // 1 à 5 : lever la carte correspondante de la main.
    if (/^[1-7]$/.test(e.key) && ui.sel && battle.phase === 'player' && !ui.busy) {
      const cards = [...el.hand.querySelectorAll('.card')];
      const c = cards[Number(e.key) - 1];
      if (c) c.click();
    }
  }
  function cleanup() {
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragUp, true);
    document.body.classList.remove('in-match');
    stopCrowd();
  }

  // ------------------------------------------------------------ retour à l'écran
  function sonner(ev) {
    switch (ev.type) {
      case 'damage': play(ev.crit ? 'bigHit' : 'hit'); if (ev.crit) { crowdPop(0.8); shake(); } break;
      case 'miss': case 'whiff': play('miss'); break;
      case 'down': play('slam'); crowdPop(0.5); shake(); break;
      case 'pin': play('count', ev.count); if (ev.count === 2.9 || ev.count === 2) { play('kickout'); crowdPop(1); } if (ev.count === 3) crowdPop(1); break;
      case 'eliminated': crowdPop(1); break;
      case 'taunt': crowdPop(0.35); break;
      case 'combo': crowdPop(0.5); break;
      default: break;
    }
  }
  const cellAt = (x, y) => el.board.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`);
  const centre = (c) => { const r = c.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  // Un vecteur d'ÉCRAN, ramené dans le repère du plateau (celui où `translate`
  // s'applique) : l'inverse de « aplatir par deux puis tourner de 45° ».
  function toBoard(sx, sy) {
    if (!boardWrap.classList.contains('view-iso')) return [sx, sy];
    const th = ((45 + boardRot() * 90) * Math.PI) / 180, x = sx, y = sy * 2;
    return [x * Math.cos(th) + y * Math.sin(th), -x * Math.sin(th) + y * Math.cos(th)];
  }
  const cellPx = () => parseFloat(getComputedStyle(boardWrap).getPropertyValue('--cell')) || 48;
  // Faire bouger un pion le long d'un vecteur d'écran, puis le ramener.
  function pousse(tok, sx, sy, ms, aller = 0.4) {
    if (!tok || REDUCED) return;
    const [bx, by] = toBoard(sx, sy);
    tok.animate([{ translate: '0 0' }, { translate: `${bx}px ${by}px`, offset: aller }, { translate: '0 0' }], { duration: ms, easing: 'steps(4, end)' });
    ui.animUntil = Math.max(ui.animUntil, performance.now() + ms + 40);
  }
  // L'ÉLAN : l'attaquant part vers sa cible, au pas de pixel.
  function elan(ev, de, vers) {
    const a = cellAt(de.x, de.y), t = vers;
    if (!a || !t) return null;
    const [ax, ay] = centre(a), [tx, ty] = centre(t);
    const dx = tx - ax, dy = ty - ay, len = Math.hypot(dx, dy) || 1;
    const lunge = Math.min(len * 0.6, cellPx() * 1.1);
    const vx = (dx / len) * lunge, vy = (dy / len) * lunge;
    const finisher = ev.tier === 'finisher';
    pousse(a.querySelector('.unit'), vx, vy, finisher ? 520 : 300, 0.38);
    return { vx, vy, len };
  }
  // L'IMPACT : une onomatopée en étoile sur la case touchée.
  function impact(cell, texte, cls = '') {
    if (!cell) return;
    const i = h('span', { class: `impact ${cls}` }, texte);
    cell.append(i);
    setTimeout(() => i.remove(), 600);
  }
  // LA CARTE FILE VERS SA CIBLE. On garde un double de la carte avant que la
  // main soit redessinée, puis on le lance de sa place jusqu'à la case visée.
  function captureCard(a) {
    if (REDUCED || !a.move) return null;
    const c = el.hand.querySelector(`.card.raised`) || el.hand.querySelector(`.card[data-id="${a.id}"]`);
    if (!c) return null;
    const r = c.getBoundingClientRect();
    const ghost = c.cloneNode(true);
    ghost.classList.remove('raised'); ghost.removeAttribute('title');
    return { ghost, rect: r };
  }
  function volCarte(vol) {
    const cible = cellAt(vol.to.x, vol.to.y);
    if (!vol || !cible) return;
    const [tx, ty] = centre(cible);
    const g = vol.ghost;
    Object.assign(g.style, { position: 'fixed', left: `${vol.rect.left}px`, top: `${vol.rect.top}px`, width: `${vol.rect.width}px`, height: `${vol.rect.height}px`, margin: '0', zIndex: 80, pointerEvents: 'none', transform: 'none' });
    document.body.append(g);
    const dx = tx - (vol.rect.left + vol.rect.width / 2), dy = ty - (vol.rect.top + vol.rect.height / 2);
    const fin = g.animate([
      { translate: '0 0', scale: '1', rotate: '0deg', opacity: 1 },
      { translate: `${dx * 0.55}px ${dy * 0.55 - 30}px`, scale: '0.7', rotate: '-6deg', opacity: 1, offset: 0.55 },
      { translate: `${dx}px ${dy}px`, scale: '0.28', rotate: '10deg', opacity: 0.1 },
    ], { duration: 340, easing: 'ease-in' });
    fin.onfinish = () => g.remove();
    setTimeout(() => g.remove(), 600);
  }

  function flushEvents() {
    const evs = battle.events.splice(0, battle.events.length);
    for (const ev of evs) sonner(ev);
    if (ui.pendingFlight) { const v = ui.pendingFlight; ui.pendingFlight = null; volCarte(v); }
    let dernier = null;                        // le dernier élan de ce lot : le recul le prolonge
    for (const ev of evs) {
      const cell = el.board.querySelector(`.cell[data-x="${ev.x}"][data-y="${ev.y}"]`);
      if (!cell) continue;
      let text = '', cls = '';
      switch (ev.type) {
        case 'attack': dernier = { ...(elan(ev, ev.from, cell) || {}), kind: ev.kind, tier: ev.tier }; continue;
        case 'whiff': {
          const cible = ev.to && cellAt(ev.to.x, ev.to.y);
          const v = elan(ev, { x: ev.x, y: ev.y }, cible);
          // celui qui a vu venir le coup fait un saut de côté
          if (v && cible) pousse(cible.querySelector('.unit'), -v.vy * 0.8, v.vx * 0.8, 360, 0.45);
          continue;
        }
        case 'damage': {
          text = `-${ev.amount}`; cls = ev.crit ? 'crit' : 'dmg'; flash(cell);
          const tok = cell.querySelector('.unit');
          if (dernier && dernier.vx !== undefined) pousse(tok, dernier.vx * (ev.crit ? 0.7 : 0.4), dernier.vy * (ev.crit ? 0.7 : 0.4), ev.crit ? 380 : 260, 0.3);
          else pousse(tok, 5, 0, 200, 0.5);
          impact(cell, ev.crit ? 'WHAM !!' : (dernier && ONOMATOPEE[dernier.kind]) || 'BAM !', ev.crit || (dernier && dernier.tier === 'finisher') ? 'big' : '');
          if (dernier && dernier.tier === 'finisher') { scene.classList.remove('flashed'); void scene.offsetWidth; scene.classList.add('flashed'); setTimeout(() => scene.classList.remove('flashed'), 300); }
          break;
        }
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
  // Le sprite touché clignote, l'écran tremble sur les gros coups. Ce n'est
  // pas une animation de coup, mais c'est déjà un impact.
  function flash(cell) {
    const tok = cell.querySelector('.unit');
    if (!tok) return;
    tok.classList.add('hit');
    setTimeout(() => tok.classList.remove('hit'), 320);
  }
  function shake() {
    scene.classList.remove('shake'); void scene.offsetWidth; scene.classList.add('shake');
    setTimeout(() => scene.classList.remove('shake'), 350);
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

  // ------------------------------------------------------------ fin de tour
  async function endTurn() {
    if (ui.busy || battle.result || battle.phase !== 'player') return;
    ui.busy = true; ui.sel = null; ui.card = null; ui.pending = null; ui.reach = null; ui.ringOpen = false;
    endPlayerPhase(battle);
    showBanner('TOUR ADVERSE', 'enemy');
    render();
    await sleep(600);
    for (const step of enemySteps(battle)) {
      ui.acting = step.unit;
      render();
      if (step.type === 'action') {
        const a = step.action; const name = MOVES[a.id] ? MOVES[a.id].name : a.id === 'pin' ? 'Tombé' : a.id;
        if (MOVES[a.id] && MOVES[a.id].tier === 'finisher') { play('finisher'); crowdPop(1.2); }
        floatAt(step.unit, name);
      } else if (step.type === 'whiff') {
        floatAt(step.unit, `${step.intent.name} : DANS LE VIDE !`, 'miss');
        if (step.target) floatAt(step.target, 'ESQUIVÉ !', 'heal');
      }
      await sleep(step.type === 'move' ? 380 : 720);
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
    play('bell');
    setTimeout(() => play(res.winner === 'player' ? 'win' : 'lose'), 550);
    stopCrowd();
    const summary = onFinish ? onFinish(battle) : null;
    const won = res.winner === 'player';
    const box = h('div', { class: 'result' });
    box.append(h('h2', { class: won ? 'win' : 'lose' }, won ? '🏆 VICTOIRE' : '💀 DÉFAITE'), h('p', { class: 'reason' }, res.reason), h('p', { class: 'muted' }, `${battle.turn} tours · chaleur moyenne ${Math.round(avgHeat(battle))} · ${battle.stats.kickouts} kick-out(s) · ${battle.stats.tables} table(s) · ${battle.stats.finishers} finisher(s)${battle.stats.playerDodges ? ` · ${battle.stats.playerDodges} esquive(s)` : ''}`));
    if (summary) {
      if (summary.script) {
        box.append(h('div', { class: 'stars' }, starsText(summary.script.stars), h('span', { class: 'muted' }, ` (${summary.script.stars}/5)`)));
        box.append(h('div', { class: `obj-item ${summary.script.finishOk ? 'done' : 'fail'}` }, `${summary.script.finishOk ? '✅' : '❌'} Finish : ${describeFinish(battle.script.finish)}`));
        for (const b of summary.script.beats) box.append(h('div', { class: `obj-item ${b.done ? 'done' : ''}` }, `${b.done ? '✅' : '⬜'} ${b.name}`));
      } else if (summary.directives.length) {
        for (const d of summary.directives) box.append(h('div', { class: `obj-item ${d.done ? 'done' : ''}` }, `${d.done ? '✅' : '⬜'} ${d.name} ${d.done ? `(+${d.reward.fans} fans, +${d.reward.money} $)` : ''}`));
      }
      box.append(h('p', { class: 'reward' }, `${summary.money >= 0 ? '+' : ''}${summary.money} $ · ${summary.fans >= 0 ? '+' : ''}${summary.fans} fans`), h('p', {}, summary.message));
      if (summary.title) {
        box.append(h('p', { class: `rank-move ${summary.champion ? 'up' : 'down'}` }, summary.champion ? `🏆 LA CEINTURE EST À VOUS. ${SEASON.beltName}.` : `🥈 Le champion garde le ${SEASON.beltName}.`));
      } else if (summary.rank !== undefined) {
        const monte = summary.rank < summary.rankBefore;
        const t = titleTerms(summary.rank);
        box.append(h('p', { class: `rank-move ${monte ? 'up' : 'down'}` }, `${monte ? '▲' : '▼'} ${rankLabel(summary.rankBefore)} → ${rankLabel(summary.rank)}`, h('span', { class: 'muted' }, ` · au titre ce serait : ${t.icon} ${t.name}`)));
      }
    }
    const story = matchStory(battle, { rivalry: matchDef && matchDef.rivalry });
    box.append(h('div', { class: 'story' },
      h('div', { class: 'story-head' }, h('div', { class: 'story-stars', title: `Note du match : ${story.stars}/5` }, story.starsText), h('h3', {}, `« ${story.headline} »`)),
      story.acts.map((a) => h('div', { class: 'story-act' }, h('b', {}, `${a.icon} ${a.title}`), h('p', {}, a.text)))));
    const suite = h('button', { class: 'btn primary', onclick: onContinue }, 'Continuer');
    const offres = (summary && summary.cards) ? [...summary.cards] : [];
    if (offres.length) {
      const zone = h('div', { class: 'card-offer' });
      box.append(zone);
      suite.disabled = true;
      suite.textContent = 'Choisissez d’abord une carte';
      const suivant = () => {
        clear(zone);
        const o = offres.shift();
        if (!o) { suite.disabled = false; suite.textContent = 'Continuer'; return; }
        zone.append(h('h3', {}, `🃏 ${o.name} apprend un mouvement`),
          h('p', { class: 'muted' }, o.mustForget ? `Deck plein (${o.deck}/${o.max}) : la nouvelle carte en remplacera une. Vous choisirez laquelle.` : `Deck : ${o.deck}/${o.max}. Une carte de plus, c’est un outil de plus — et chacune des autres revient un peu moins souvent.`));
        const grille = h('div', { class: 'offer-grid' });
        for (const id of o.offer) {
          const m = MOVES[id];
          grille.append(h('button', { class: 'offer-card', onclick: () => prendre(o, id) }, h('b', {}, m.name), h('span', { class: 'tier' }, MOVE_TIER_LABEL[m.tier] || m.tier), h('span', { class: 'muted' }, m.desc), h('span', { class: 'stats' }, `${m.power ? `💥 ${m.power}` : ''} ${m.acc ? `· 🎯 ${m.acc} %` : ''}${m.requires && m.requires.ran ? ` · 🏃 course ${m.requires.ran}` : ''}`)));
        }
        grille.append(h('button', { class: 'offer-card skip', onclick: suivant }, h('b', {}, 'Passer'), h('span', { class: 'muted' }, 'Garder son deck tel quel : moins d’outils, mais chacun revient plus souvent.')));
        zone.append(grille);
      };
      const prendre = (o, id) => {
        if (o.mustForget) return choisirOubli(o, id);
        const r = onLearn ? onLearn(o.id, id) : { ok: true };
        if (!r.ok && r.mustForget) return choisirOubli(o, id);
        suivant();
      };
      const choisirOubli = (o, id) => {
        clear(zone);
        zone.append(h('h3', {}, `🗑️ ${o.name} doit oublier un mouvement`), h('p', { class: 'muted' }, `Pour apprendre ${MOVES[id].name}, il faut laisser tomber autre chose.`));
        const grille = h('div', { class: 'offer-grid' });
        for (const vieux of (deckOf ? deckOf(o.id) : []).filter(isCard).sort((a, b) => MOVES[a].name.localeCompare(MOVES[b].name))) {
          const m = MOVES[vieux];
          grille.append(h('button', { class: 'offer-card', onclick: () => { if (onLearn) onLearn(o.id, id, vieux); suivant(); } }, h('b', {}, m.name), h('span', { class: 'tier' }, MOVE_TIER_LABEL[m.tier] || m.tier), h('span', { class: 'muted' }, m.desc)));
        }
        grille.append(h('button', { class: 'offer-card skip', onclick: suivant }, h('b', {}, 'Renoncer à la carte'), h('span', { class: 'muted' }, 'Garder son deck intact.')));
        zone.append(grille);
      };
      suivant();
    }
    box.append(suite);
    root.append(h('div', { class: 'overlay' }, box));
  }

  // ------------------------------------------------------------ coup d'envoi
  // Tout est déclaré : on peut dessiner. (Le premier rendu, plus haut,
  // appelait des constantes locales avant leur déclaration.)
  showBanner('🔔 DING DING DING !', 'start');
  render();
  startCrowd(); setCrowd(battle.heat); play('bell');
  if (!tutorialSeen()) showTutorial(root, {});
}
