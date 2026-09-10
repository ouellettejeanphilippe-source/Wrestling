// Écran de match façon Fire Emblem / Banner Saga : portées visibles, menu contextuel près du lutteur,
// prévision de combat avant confirmation, barre d'équipe avec portraits, bannière de tour.
import { h, clear, sleep, bar, toast } from './dom.js';
import { unitCard } from './cards.js';
import { avatar } from './avatar.js';
import { WRESTLERS_BY_ID } from '../data/wrestlers.js';
import { listActions, executeAction, moveUnit, undoMove, getReachable, endPlayerPhase, enemySteps, endEnemyPhase, hitChance, computeDamage, getStats, moveRange } from '../engine/battle.js';
import { TERRAIN, tileAt, key, manhattan, sizeOf, heightAt } from '../engine/grid.js';
import { unitAt, living } from '../engine/util.js';
import { MOVES, MOVE_TIER_LABEL, MOVE_TIERS } from '../data/moves.js';
import { describeFinish, evaluateDirectives, evaluateScript, starsText } from '../game/script.js';
import { matchPhase } from '../engine/phases.js';
import { activeCombos } from '../engine/battle.js';
import { winRoutes } from '../engine/rules.js';
import { showTutorial, tutorialSeen } from './tutorial.js';

const TIER_ORDER = ['base', 'class', 'specialty', 'signature', 'finisher', 'script'];
const TIER_LABELS = { base: 'Base', class: `Classe · ⚡${MOVE_TIERS.class.unlock}+`, specialty: `Spécialité · ⚡${MOVE_TIERS.specialty.unlock}+`, signature: `Signature · ⚡${MOVE_TIERS.signature.unlock}+`, finisher: `Finisher · ⚡${MOVE_TIERS.finisher.unlock}`, script: 'Script' };
const ATTACK_TYPES = new Set(['strike', 'grapple', 'aerial', 'submission', 'weapon']);
const TILE_HELP = {
  floor: 'Plancher : hors du ring. Compte de l’arbitre dans les matchs avec règles.',
  ring: 'Tapis du ring.',
  rope: 'Cordes : coût 2 pour y entrer. Y être projeté étourdit. Rope break possible pour les soumissions. Bataille royale : on peut y être jeté par-dessus.',
  turnbuckle: 'Coin : coût 2. Plongeons aériens +25 % depuis ici. Y être projeté = 10 dégâts + étourdi. Cage : point d’escalade.',
  ramp: 'Rampe d’entrée : hors du ring. Les renforts arrivent par ici.',
  table: 'Table des commentateurs : projetez-y quelqu’un pour 25 dégâts et un moment mémorable.',
  debris: 'Table brisée. Rien à voir ici, circulez.',
  barricade: 'Barricade : infranchissable. Y être projeté = 10 dégâts.',
  steps: 'Marches d’acier : coût 2. Y être projeté = 12 dégâts.',
  ladder: 'Échelle : grimpez deux tours de suite sans subir de dégâts pour la ceinture.',
  cage: 'Mur de la cage : infranchissable. Y être projeté = 15 dégâts.',
  void: '',
};
const CATS = [
  { id: 'attack', icon: '⚔️', name: 'Attaquer', match: (a) => ATTACK_TYPES.has(a.type) },
  { id: 'pin', icon: '🤝', name: 'Tombé', match: (a) => a.type === 'pin' },
  { id: 'taunt', icon: '📣', name: 'Provoquer', match: (a) => a.type === 'taunt' },
  { id: 'special', icon: '🎯', name: 'Spécial', match: (a) => ['special', 'toss', 'climb', 'tag', 'pickup', 'sell', 'job'].includes(a.type) },
  { id: 'wait', icon: '⏳', name: 'Attendre', match: (a) => a.type === 'wait' },
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
      h('div', { class: 'm-title' }, h('b', {}, battle.match.title || r.name), h('span', { class: 'muted' }, ` ${r.icon} ${r.name}${battle.mode === 'scenario' ? ' · 🎬 Scénarios' : ''}${battle.refDistracted > 0 ? ' · 👀 arbitre distrait' : ''}`)),
      h('div', { class: 'heat' }, h('span', { class: 'lbl' }, '🔥 Chaleur'), bar(battle.heat, 100, 'heatbar', `${battle.heat}`)),
      h('button', { class: 'btn small ghost', title: 'Basculer entre la caméra isométrique et la vue de dessus', onclick: toggleView }, boardWrap.classList.contains('view-iso') ? '🎥 Vue iso' : '🗺️ Vue dessus'),
      boardWrap.classList.contains('view-iso') ? h('button', { class: 'btn small ghost', title: 'Tourner la caméra d’un quart de tour (touche R)', onclick: () => rotateBoard(1) }, '↻') : null,
      h('button', { class: 'btn small ghost', onclick: () => showTutorial(root, {}) }, '📖 Aide'),
      h('button', { class: 'btn small ghost', onclick: () => { if (confirm('Abandonner ce match ? (compte comme une défaite)')) { cleanup(); onQuit(); } } }, 'Quitter'),
    );
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
    }
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
      avatar(def, 0, { fill: true, view: 'full', bg: 'none', dir: screenFacing(u.facing, boardRot()), pose: u.down ? 'down' : null }),
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
      pop.append(renderActionList(u, listActions(battle, u).filter(ui.cat.match)));
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
        const list = actions.filter(c.match);
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
      const actions = listActions(battle, u).filter(ui.cat.match);
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

  function renderActionList(u, actions) {
    const box = h('div', { class: 'actions' });
    for (const tier of TIER_ORDER) {
      const list = actions.filter((a) => (a.tier || 'base') === tier);
      if (!list.length) continue;
      const locked = list.every((a) => !a.ok && a.reason && a.reason.startsWith('🔒'));
      const group = h('div', { class: `agroup tier-${tier} ${locked ? 'locked' : ''}` }, h('div', { class: 'tier-label' }, TIER_LABELS[tier], locked ? ' 🔒' : ''));
      for (const a of list) {
        const m = a.move;
        const meta = [];
        if (m && m.power != null) meta.push(`💥 ${m.power}`);
        if (m && m.acc != null) meta.push(`🎯 ${m.acc}`);
        if (m && m.range) meta.push(`↔ ${m.range[0] === m.range[1] ? m.range[0] : `${m.range[0]}-${m.range[1]}`}`);
        if (a.cost) meta.push(`⚡ -${a.cost}`);
        if (m && m.momentum && ATTACK_TYPES.has(a.type)) meta.push(`⚡ +${m.momentum} si touché`);
        const best = a.targets.length ? a.targets.reduce((x, y) => ((y.hit ?? y.chance * 100) > (x.hit ?? x.chance * 100) ? y : x)) : null;
        const combos = m && best && best.unit ? activeCombos(battle, u, best.unit, m) : [];
        const btn = h('button', { class: `act ${a.ok ? '' : 'disabled'}`, disabled: !a.ok || ui.busy, onclick: () => chooseAction(a) },
          h('span', { class: 'act-name' }, a.name, best && best.hit != null ? h('span', { class: 'act-hit' }, `${best.hit} %`) : best && best.chance != null ? h('span', { class: 'act-hit' }, `${Math.round(best.chance * 100)} %`) : null),
          meta.length ? h('span', { class: 'act-meta' }, meta.join('  ')) : null,
          combos.length ? h('span', { class: 'act-combo' }, combos.map((c) => `${c.icon} ${c.name}`).join(' + ')) : null,
          h('span', { class: 'act-desc' }, a.ok ? a.desc : `✗ ${a.reason}`));
        group.append(btn);
      }
      box.append(group);
    }
    return box;
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
      const hit = hitChance(battle, u, tgt, a.move);
      const { dmg } = computeDamage(battle, u, tgt, a.move, { noRng: true });
      const crit = Math.round((0.05 + getStats(battle, u).tec * 0.01) * 100);
      afterT = Math.max(0, tgt.hp - dmg);
      mid = [['Précision', `${hit} %`], ['Dégâts', `~${dmg}`], ['Critique', `${crit} %`]];
      const cbs = activeCombos(battle, u, tgt, a.move);
      for (const c of cbs) mid.push([`${c.icon} ${c.name}`, `+${Math.round((c.dmg - 1) * 100)} % dégâts`]);
      if (dmg >= tgt.hp && !tgt.down) mid.push(['Résultat', '💫 AU SOL']);
      if (a.type === 'submission') mid.push(['Abandon', 'possible si affaibli']);
      if (a.move.tier === 'finisher') mid.push(['Finisher', 'tombé immédiat +30 %']);
      if (tgt.gimmick === 'outta_nowhere' && tgt.momentum >= 50) mid.push(['⚠️ Risque', 'contre RKO 35 %']);
      if (a.move.effects && a.move.effects.illegal && battle.rules.dq && battle.refDistracted <= 0) mid.push(['⚠️ DQ', '~35 %']);
      if (a.type === 'weapon' && battle.rules.dq && battle.refDistracted <= 0) mid.push(['⚠️ DQ', '~35 %']);
      if (a.move.effects && a.move.effects.selfDamage) afterU = u.hp - a.move.effects.selfDamage;
      mid.push(['Momentum', `${u.momentum} → ${Math.min(100, Math.max(0, u.momentum - (a.cost || 0)) + (a.move.momentum || 0))}`]);
    } else if (a.type === 'pin') mid = [['Tombé', `${Math.round(t.chance * 100)} %`], ['Cœur adverse', '❤️'.repeat(tgt.grit) || '—'], ['Si kick-out', 'cœur -1, +15 momentum']];
    else if (a.type === 'toss') mid = [['Par-dessus la corde', `${Math.round(t.chance * 100)} %`]];
    else if (a.id === 'whip') mid = [['Précision', `${t.hit} %`], ['Projection', whipPreview(u, tgt)]];
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
        avatar(def, 44), h('div', { class: 'pm-info' }, h('b', {}, u.name), bar(u.hp, u.maxHp, 'hpbar', `${u.hp}`), bar(u.momentum, 100, 'mombar', `${u.momentum}`)), h('span', { class: 'pm-st' }, u.eliminated ? '❌' : st));
    };
    el.party.append(h('div', { class: 'pgroup' }, h('div', { class: 'pg-label' }, 'Votre équipe'), battle.units.filter((u) => u.team === 'player').map(mk)));
    el.party.append(h('div', { class: 'pgroup' }, h('div', { class: 'pg-label' }, 'Adversaires'), battle.units.filter((u) => u.team === 'enemy').map(mk)));
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
    if (e.key !== 'Escape' || ui.busy) return;
    if (ui.mode === 'target') { ui.mode = ui.cat ? 'list' : 'menu'; ui.action = null; render(); }
    else if (ui.mode === 'list') { ui.mode = 'menu'; ui.cat = null; render(); }
    else if (ui.sel) deselect();
  }
  function cleanup() {
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', fitBoard);
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
    boardWrap.style.setProperty('--cell', `${Math.max(14, Math.min(112, Math.floor(cell)))}px`);
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
    box.append(h('button', { class: 'btn primary', onclick: onContinue }, 'Continuer'));
    root.append(h('div', { class: 'overlay' }, box));
  }
}
