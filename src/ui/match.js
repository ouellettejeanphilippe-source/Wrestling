// Écran de match : grille, sélection, actions, phase ennemie animée, résultat.
import { h, clear, sleep, bar, toast } from './dom.js';
import { unitCard } from './cards.js';
import { listActions, executeAction, moveUnit, undoMove, getReachable, endPlayerPhase, enemySteps, endEnemyPhase } from '../engine/battle.js';
import { TERRAIN, tileAt, key } from '../engine/grid.js';
import { unitAt, living } from '../engine/util.js';
import { MOVE_TIER_LABEL } from '../data/moves.js';
import { DIRECTIVES } from '../data/directives.js';
import { describeFinish, evaluateDirectives, evaluateScript, starsText } from '../game/script.js';

const TIER_ORDER = ['base', 'class', 'specialty', 'signature', 'finisher', 'script'];
const TIER_LABELS = { ...MOVE_TIER_LABEL, script: 'Script (coulisses)' };

export function mountMatch(root, { battle, matchDef, onFinish, onContinue, onQuit }) {
  const ui = { sel: null, mode: 'idle', action: null, reach: null, hover: null, busy: false, resultShown: false };
  const g = battle.grid;
  clear(root);
  const el = {
    top: h('div', { class: 'match-top' }),
    board: h('div', { class: 'board', style: { gridTemplateColumns: `repeat(${g.w}, var(--cell))` } }),
    side: h('aside', { class: 'side' }),
    log: h('div', { class: 'log' }),
  };
  root.append(h('div', { class: 'match' }, el.top, h('div', { class: 'match-body' }, h('div', { class: 'board-wrap' }, el.board, el.log), el.side)));
  render();

  // ------------------------------------------------------------ rendu
  function render() {
    renderTop(); renderBoard(); renderSide(); renderLog(); flushEvents();
    if (battle.result && !ui.resultShown) { ui.resultShown = true; setTimeout(showResult, 900); }
  }

  function renderTop() {
    clear(el.top);
    const r = battle.rules;
    const phase = battle.result ? 'Terminé' : battle.phase === 'player' ? 'Votre tour' : 'Tour adverse';
    const survive = r.victory === 'survive' ? ` · Survivre : tour ${Math.min(battle.turn, battle.match.turns)}/${battle.match.turns}` : '';
    el.top.append(
      h('div', { class: 'match-title' },
        h('div', {}, h('b', {}, battle.match.title || r.name), h('span', { class: 'muted' }, ` — ${r.icon} ${r.name}${battle.mode === 'scenario' ? ' · 🎬 Mode Scénarios' : ''}`)),
        h('div', {}, `Tour ${battle.turn}${survive} · `, h('b', { class: battle.phase }, phase), battle.refDistracted > 0 ? h('span', { class: 'muted' }, ' · 👀 arbitre distrait') : null),
        h('div', { class: 'heat' }, h('span', { class: 'lbl' }, '🔥 Chaleur'), bar(battle.heat, 100, 'heatbar', `${battle.heat}`)),
      ),
      renderObjectives(),
      h('button', { class: 'btn small ghost quit', onclick: () => { if (confirm('Abandonner ce match ? (compte comme une défaite)')) onQuit(); } }, 'Quitter'),
    );
  }

  function renderObjectives() {
    const r = battle.rules;
    const box = h('div', { class: 'objectives' });
    box.append(h('div', { class: 'obj-rule' }, h('b', {}, 'Règles : '), r.desc));
    if (battle.mode === 'scenario' && battle.script) {
      const ev = evaluateScript(battle, battle.script);
      box.append(h('div', { class: 'obj-script' }, h('b', {}, '🎬 Script : '), battle.script.summary));
      box.append(h('div', { class: `obj-item ${battle.result ? (ev.finishOk ? 'done' : 'fail') : ''}` }, `${battle.result ? (ev.finishOk ? '✅' : '❌') : '📜'} Finish : ${describeFinish(battle.script.finish)}`));
      for (const b of ev.beats) {
        const pending = b.final && !battle.result;
        box.append(h('div', { class: `obj-item ${b.done && !pending ? 'done' : ''}` }, `${pending ? (b.done ? '⏳' : '⬜') : b.done ? '✅' : '⬜'} ${b.name} — ${b.desc}`));
      }
      box.append(h('div', { class: 'obj-item muted' }, `Note en direct : ${starsText(ev.stars)}`));
    } else if (matchDef && matchDef.directives && matchDef.directives.length) {
      box.append(h('div', { class: 'obj-script' }, h('b', {}, '📺 Directives du Network (bonus) :')));
      for (const d of evaluateDirectives(battle, matchDef.directives)) {
        const pending = d.final && !battle.result;
        box.append(h('div', { class: `obj-item ${d.done && !pending ? 'done' : ''}` }, `${pending ? (d.done ? '⏳' : '⬜') : d.done ? '✅' : '⬜'} ${d.name} — ${d.desc} (+${d.reward.fans} fans, +${d.reward.money} $)`));
      }
    }
    return box;
  }

  function renderBoard() {
    clear(el.board);
    const reach = ui.mode === 'move' ? ui.reach : null;
    const targets = ui.mode === 'target' ? new Map(ui.action.targets.filter((t) => t.unit).map((t) => [key(t.unit.x, t.unit.y), t])) : null;
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        const tile = tileAt(g, x, y);
        const k = key(x, y);
        const cell = h('div', { class: `cell t-${tile}`, 'data-x': x, 'data-y': y, onclick: () => onCell(x, y), onmouseenter: () => onHover(x, y), onmouseleave: () => onHover(null) , title: TERRAIN[tile].name });
        if (TERRAIN[tile].icon) cell.append(h('span', { class: 'ticon' }, TERRAIN[tile].icon));
        if (reach && reach.get(k) && !reach.get(k).blocked) cell.classList.add('reach');
        if (targets && targets.has(k)) {
          cell.classList.add('target');
          const t = targets.get(k);
          const b = t.hit != null ? `${t.hit} %` : t.chance != null ? `${Math.round(t.chance * 100)} %` : '';
          if (b) cell.append(h('span', { class: 'badge' }, b));
        }
        const item = battle.items.find((i) => i.x === x && i.y === y);
        if (item) cell.append(h('span', { class: 'item', title: item.weapon.name }, item.weapon.icon));
        const u = unitAt(battle, x, y);
        if (u) { const tok = unitToken(u); if (ui.sel === u) tok.classList.add('selected'); cell.append(tok); }
        el.board.append(cell);
      }
    }
  }

  function unitToken(u) {
    const icons = [];
    if (u.statuses.dazed) icons.push('😵');
    if (u.statuses.cursed) icons.push('🕯️');
    if (u.statuses.finished) icons.push('☠️');
    if (u.weapon) icons.push(u.weapon.icon);
    if (battle.rules.tag && u.legal) icons.push('⭐');
    if (u.climb > 0) icons.push('🧗');
    if (u.outsideCount > 0 && battle.rules.countOut) icons.push(`⏱${u.outsideCount}`);
    const cls = `unit team-${u.team}${u.down ? ' down' : ''}${u.acted && u.team === 'player' && battle.phase === 'player' ? ' acted' : ''}`;
    return h('div', { class: cls, style: { '--c': u.color }, title: `${u.name} — ${u.hp}/${u.maxHp} PV, momentum ${u.momentum}` },
      h('span', { class: 'ini' }, u.initials),
      h('div', { class: 'mini hp' }, h('div', { style: { width: `${(u.hp / u.maxHp) * 100}%` } })),
      h('div', { class: 'mini mom' }, h('div', { style: { width: `${u.momentum}%` } })),
      icons.length ? h('span', { class: 'sicons' }, icons.join('')) : null,
    );
  }

  function renderSide() {
    clear(el.side);
    if (ui.sel) el.side.append(unitCard(battle, ui.sel, { class: 'selected' }));
    el.inspect = h('div', { class: 'inspect' });
    el.side.append(el.inspect);
    renderInspect();
    if (!ui.sel) {
      el.side.append(h('div', { class: 'hint' }, battle.phase === 'player' ? 'Cliquez sur un de vos lutteurs pour le sélectionner. Déplacez-le (cases bleues), puis choisissez une action.' : 'Tour adverse…'));
      el.side.append(h('div', { class: 'roster-mini' }, living(battle).map((u) => h('div', { class: `rm team-${u.team}${u.acted && u.team === 'player' ? ' acted' : ''}`, onclick: () => { if (u.team === 'player' && canSelect(u)) select(u); } }, h('span', { class: 'chip', style: { '--c': u.color } }, u.initials), ` ${u.name} `, h('small', {}, `${u.hp}/${u.maxHp} PV · ${u.momentum} mom.${u.down ? ' · au sol' : ''}`)))));
    }
    if (ui.sel && !battle.result) el.side.append(renderActions());
    const controls = h('div', { class: 'controls' });
    if (ui.sel && ui.sel.moved && !ui.sel.acted) controls.append(h('button', { class: 'btn ghost', onclick: () => { undoMove(battle, ui.sel); select(ui.sel); } }, '↩ Annuler le déplacement'));
    if (ui.mode === 'target') controls.append(h('button', { class: 'btn ghost', onclick: () => { ui.mode = 'action'; ui.action = null; render(); } }, '← Retour'));
    if (ui.sel) controls.append(h('button', { class: 'btn ghost', onclick: deselect }, 'Désélectionner'));
    if (!battle.result) controls.append(h('button', { class: 'btn primary', disabled: ui.busy || battle.phase !== 'player', onclick: endTurn }, '⏭ Fin du tour'));
    el.side.append(controls);
  }

  function renderActions() {
    const u = ui.sel;
    const actions = listActions(battle, u);
    const box = h('div', { class: 'actions' });
    if (ui.mode === 'target') box.append(h('div', { class: 'hint' }, `Choisissez une cible pour ${ui.action.name} (cases rouges).`));
    if (u.onlyPin) box.append(h('div', { class: 'hint hot' }, 'Finisher réussi : couvrez immédiatement !'));
    for (const tier of TIER_ORDER) {
      const list = actions.filter((a) => (a.tier || 'base') === tier);
      if (!list.length) continue;
      const group = h('div', { class: `agroup tier-${tier}` }, h('div', { class: 'tier-label' }, TIER_LABELS[tier]));
      for (const a of list) {
        const cost = a.cost ? h('span', { class: `cost ${u.momentum >= a.cost ? 'ok' : 'no'}` }, `⚡${a.cost}`) : null;
        const btn = h('button', { class: `act ${a.ok ? '' : 'disabled'} ${ui.action && ui.action.id === a.id ? 'active' : ''}`, disabled: !a.ok || ui.busy, title: a.desc, onclick: () => chooseAction(a) },
          h('span', { class: 'act-name' }, a.name, cost), h('span', { class: 'act-desc' }, a.ok ? a.desc : `✗ ${a.reason}`));
        group.append(btn);
      }
      box.append(group);
    }
    return box;
  }

  function renderInspect() {
    if (!el.inspect) return;
    clear(el.inspect);
    const inspect = ui.hover && ui.hover !== ui.sel ? ui.hover : null;
    if (inspect) el.inspect.append(h('div', { class: 'inspect-label' }, 'Inspection'), unitCard(battle, inspect));
  }

  function renderLog() {
    clear(el.log);
    const entries = battle.log.slice(-14).reverse();
    el.log.append(h('div', { class: 'log-title' }, '📝 Commentaires'));
    for (const e of entries) el.log.append(h('div', { class: `le ${e.cls || ''}` }, h('span', { class: 'lt' }, `T${e.turn}`), ' ', e.text));
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
        default: continue;
      }
      const f = h('span', { class: `float ${cls}` }, text);
      cell.append(f);
      setTimeout(() => f.remove(), 1400);
    }
  }

  // ------------------------------------------------------------ interactions
  const canSelect = (u) => u.team === 'player' && !u.acted && !u.down && !u.eliminated && battle.phase === 'player';
  function select(u) {
    ui.sel = u; ui.action = null;
    if (u.moved || u.onlyPin) { ui.mode = 'action'; ui.reach = null; }
    else { ui.mode = 'move'; ui.reach = getReachable(battle, u); }
    render();
  }
  function deselect() { ui.sel = null; ui.mode = 'idle'; ui.action = null; ui.reach = null; render(); }
  function onHover(x, y) {
    const u = x == null ? null : unitAt(battle, x, y);
    if (u !== ui.hover) { ui.hover = u; renderInspect(); }
  }
  function onCell(x, y) {
    if (ui.busy || battle.result || battle.phase !== 'player') return;
    const u = unitAt(battle, x, y);
    if (ui.mode === 'target') {
      const t = ui.action.targets.find((t) => t.unit && t.unit.x === x && t.unit.y === y);
      if (t) doAction(ui.action.id, { unit: t.unit });
      else { ui.mode = 'action'; ui.action = null; render(); }
      return;
    }
    if (ui.mode === 'move') {
      if (u === ui.sel) { ui.mode = 'action'; render(); return; }
      const n = ui.reach.get(key(x, y));
      if (n && !n.blocked) { moveUnit(battle, ui.sel, x, y); ui.mode = 'action'; ui.reach = null; render(); return; }
      if (u && canSelect(u)) { select(u); return; }
      deselect(); return;
    }
    if (ui.mode === 'action') {
      if (u && canSelect(u) && u !== ui.sel) select(u);
      else if (!u && !ui.sel.moved) { ui.mode = 'move'; ui.reach = getReachable(battle, ui.sel); render(); }
      return;
    }
    if (u && canSelect(u)) select(u);
  }
  function chooseAction(a) {
    if (!a.ok || ui.busy) return;
    if (ui.mode === 'move') { ui.mode = 'action'; ui.reach = null; }
    if (a.targets.length && a.targets[0].unit) {
      if (a.targets.length === 1) { doAction(a.id, { unit: a.targets[0].unit }); return; }
      ui.mode = 'target'; ui.action = a; render(); return;
    }
    doAction(a.id, null);
  }
  function doAction(id, target) {
    const u = ui.sel;
    const r = executeAction(battle, u, id, target);
    if (!r.ok) { toast(r.reason, 'warn'); return; }
    if (r.countered) toast('CONTRÉ !', 'warn');
    if (u.onlyPin && !battle.result) { ui.mode = 'action'; ui.action = null; render(); return; }
    deselect();
  }
  async function endTurn() {
    if (ui.busy || battle.result || battle.phase !== 'player') return;
    ui.busy = true; ui.sel = null; ui.mode = 'idle'; ui.action = null; ui.reach = null;
    endPlayerPhase(battle); render();
    await sleep(500);
    for (const step of enemySteps(battle)) {
      render();
      await sleep(step.type === 'move' ? 380 : 750);
      if (battle.result) break;
    }
    if (!battle.result) endEnemyPhase(battle);
    ui.busy = false; render();
  }

  // ------------------------------------------------------------ résultat
  function showResult() {
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
