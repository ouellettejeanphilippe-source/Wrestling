// Cartes de lutteurs (hub, titre) et fiche d'unité (match).
import { h, bar } from './dom.js';
import { avatar } from './avatar.js';
import { WRESTLERS_BY_ID } from '../data/wrestlers.js';
import { CLASSES, SPECIALTIES } from '../data/classes.js';
import { GIMMICKS } from '../data/gimmicks.js';
import { MOVES, MOVE_TIER_LABEL, MOVE_TIERS } from '../data/moves.js';
import { movesFor } from '../engine/units.js';
import { getStats, moveRange } from '../engine/battle.js';

export const STAT_LABELS = { str: 'FOR', agi: 'AGI', tec: 'TEC', cha: 'CHA', def: 'DEF', mov: 'MOV' };
const ALIGN = { face: 'Face (gentil)', heel: 'Heel (méchant)', tweener: 'Tweener' };

// « chip » = vignette buste (listes, barres). « big » = carte de casting corps entier.
export function chip(def, size = '') {
  const d = def.look ? def : WRESTLERS_BY_ID[def.id] || def;
  if (size === 'big') return avatar(d, 62, { class: 'chip big', view: 'full' });
  return avatar(d, 34, { class: `chip ${size}` });
}

export function wrestlerCard(def, opts = {}) {
  const bonus = opts.bonus || {};
  const cls = CLASSES[def.cls], spec = SPECIALTIES[def.spec], g = GIMMICKS[def.gimmick];
  const stats = h('div', { class: 'stats' },
    ['str', 'agi', 'tec', 'def', 'cha', 'mov'].map((k) => {
      const v = def.stats[k] + (bonus[k] || 0);
      return h('div', { class: 'stat' }, h('span', { class: 'stat-k' }, STAT_LABELS[k]), bar(v, 16, 'stat-bar', `${v}${bonus[k] ? ` (+${bonus[k]})` : ''}`));
    }),
    h('div', { class: 'stat' }, h('span', { class: 'stat-k' }, 'PV'), bar(def.stats.hp + (bonus.hp || 0), 170, 'stat-bar hpbar', `${def.stats.hp + (bonus.hp || 0)}${bonus.hp ? ` (+${bonus.hp})` : ''}`)),
    h('div', { class: 'stat' }, h('span', { class: 'stat-k' }, 'Cœur'), h('span', { class: 'hearts' }, '❤️'.repeat(def.grit || 3))),
  );
  const moves = movesFor(def);
  const tiers = ['base', 'class', 'specialty', 'signature', 'finisher'];
  const moveList = h('div', { class: 'movelist' }, tiers.map((t) => {
    const ms = moves.filter((m) => MOVES[m].tier === t);
    if (!ms.length) return null;
    return h('div', { class: `movetier tier-${t}` }, h('span', { class: 'tier-label' }, MOVE_TIER_LABEL[t] + (t === 'class' ? ` (${cls.name})` : t === 'specialty' ? ` (${spec.name})` : '') + (MOVE_TIERS[t].unlock ? ` ⚡${MOVE_TIERS[t].unlock}+` : '')), h('span', {}, ms.map((m) => MOVES[m].name).join(' · ')));
  }));
  return h('div', { class: `wcard ${opts.class || ''}` },
    h('div', { class: 'wcard-head' }, chip(def, 'big'), h('div', {}, h('div', { class: 'wname' }, def.name), h('div', { class: 'wnick' }, `« ${def.nick} »`), h('div', { class: 'wink' }, `Clin d’œil : ${def.wink}`))),
    h('div', { class: 'badges' }, h('span', { class: 'badge-cls' }, `${cls.icon} ${cls.name}`), h('span', { class: 'badge-spec' }, `${spec.icon} ${spec.name}`), h('span', { class: `badge-align ${def.alignment}` }, ALIGN[def.alignment] || def.alignment), def.weight === 'super' ? h('span', { class: 'badge-w' }, '🗿 Super-lourd') : def.weight === 'light' ? h('span', { class: 'badge-w' }, '🪶 Léger') : null),
    h('div', { class: 'gimmick' }, h('b', {}, `Gimmick (passif) : ${g ? g.name : def.gimmick}`), h('div', {}, g ? g.desc : '')),
    h('p', { class: 'bio' }, def.bio),
    stats, moveList,
    opts.extra || null,
  );
}

export function unitCard(battle, u, opts = {}) {
  const s = getStats(battle, u);
  const cls = CLASSES[u.cls], spec = SPECIALTIES[u.spec], g = GIMMICKS[u.gimmick];
  const st = [];
  if (u.down) st.push('💫 Au sol');
  if (u.statuses.dazed) st.push(`😵 Étourdi (${u.statuses.dazed})`);
  if (u.statuses.cursed) st.push(`🕯️ Maudit (${u.statuses.cursed})`);
  if (u.statuses.finished) st.push('☠️ Sonné par un finisher (tombé +30 %)');
  if (u.statuses.welt) st.push(`🔴 Marques ×${u.statuses.welt} (-DEF)`);
  if (u.statuses.listed) st.push(`📋 Sur la Liste ×${u.statuses.listed}`);
  if (u.weapon) st.push(`${u.weapon.icon} ${u.weapon.name} (${u.weapon.uses})`);
  if (battle.rules.tag) st.push(u.legal ? '⭐ Légal' : '🚫 Non légal');
  if (battle.rules.countOut > 0 && u.outsideCount > 0) st.push(`⏱ Compte ${u.outsideCount}/${battle.rules.countOut}`);
  if (u.climb > 0) st.push(`🧗 Escalade ${u.climb}/2`);
  if (u.eliminated) st.push('❌ Éliminé');
  const diff = (k) => { const d = s[k] - u.stats[k]; return d ? h('small', { class: d > 0 ? 'up' : 'dn' }, ` (${d > 0 ? '+' : ''}${d})`) : null; };
  return h('div', { class: `ucard team-${u.team} ${opts.class || ''}` },
    h('div', { class: 'wcard-head' }, chip(u), h('div', {}, h('div', { class: 'wname' }, u.name), h('div', { class: 'wnick' }, `« ${u.nick} » · ${cls.icon} ${cls.name} / ${spec.icon} ${spec.name}`))),
    h('div', { class: 'ubars' },
      h('div', {}, h('span', { class: 'lbl' }, 'PV'), bar(u.hp, u.maxHp, 'hpbar', `${u.hp}/${u.maxHp}`)),
      h('div', {}, h('span', { class: 'lbl' }, 'Momentum'), bar(u.momentum, 100, 'mombar ticks', `${u.momentum}/100`)),
      h('div', {}, h('span', { class: 'lbl' }, 'Cœur'), h('span', { class: 'hearts' }, '❤️'.repeat(u.grit) + '🖤'.repeat(Math.max(0, u.maxGrit - u.grit)))),
    ),
    h('div', { class: 'ustats' }, ['str', 'agi', 'tec', 'def', 'cha'].map((k) => h('span', {}, h('b', {}, STAT_LABELS[k]), ` ${s[k]}`, diff(k))), h('span', {}, h('b', {}, 'MOV'), ` ${moveRange(battle, u)}`)),
    st.length ? h('div', { class: 'ustatus' }, st.map((x) => h('span', {}, x))) : null,
    h('div', { class: 'gimmick small' }, h('b', {}, g ? g.name : u.gimmick), h('div', {}, g ? g.desc : '')),
  );
}

// Sélection de lutteurs façon borne d'arcade : une grille de portraits, et la
// fiche complète qui se remplit en dessous quand on en pointe un. Empiler
// trente fiches entières demandait un défilement interminable sur téléphone,
// alors que la grille tient en un écran et garde les choix visibles.
//
// Un premier appui pointe (la fiche se remplit), un second choisit. Le bouton
// de la fiche fait la même chose pour qui préfère viser une cible large.
export function rosterPicker(defs, opts = {}) {
  const max = opts.max || Infinity;
  const picked = new Set(opts.picked || []);
  const onChange = opts.onChange || (() => {});
  let focus = defs[0];

  const detail = h('div', { class: 'picker-detail' });
  const grid = h('div', { class: 'picker-grid' });
  const tiles = new Map();

  function toggle(def) {
    if (picked.has(def.id)) picked.delete(def.id);
    else if (picked.size >= max) return { ok: false, reason: `Maximum ${max} lutteur(s)` };
    else picked.add(def.id);
    paint();
    onChange([...picked]);
    return { ok: true };
  }
  function paint() {
    for (const [id, t] of tiles) {
      t.classList.toggle('picked', picked.has(id));
      t.classList.toggle('focus', focus && id === focus.id);
      t.setAttribute('aria-pressed', picked.has(id) ? 'true' : 'false');
    }
    detail.replaceChildren(wrestlerCard(focus, {
      extra: h('button', {
        class: `btn ${picked.has(focus.id) ? 'ghost' : 'primary'} pick-btn`,
        onclick: () => { const r = toggle(focus); if (!r.ok && opts.onFull) opts.onFull(r.reason); },
      }, picked.has(focus.id) ? '✗ Retirer de l’équipe' : '✓ Ajouter à l’équipe'),
    }));
  }

  for (const def of defs) {
    const tile = h('button', {
      class: 'picker-tile', type: 'button', title: `${def.name} — « ${def.nick} »`,
      onclick: () => {
        // Pointer d'abord, choisir ensuite : on peut lire la fiche avant de
        // s'engager, et un second appui au même endroit valide.
        if (focus && focus.id === def.id) { const r = toggle(def); if (!r.ok && opts.onFull) opts.onFull(r.reason); return; }
        focus = def;
        paint();
      },
    }, avatar(def, 0, { view: 'full', bg: 'none', fill: true, class: 'picker-art' }),
      h('span', { class: 'picker-name' }, def.name),
      h('span', { class: 'picker-mark' }, '✓'));
    tiles.set(def.id, tile);
    grid.append(tile);
  }
  paint();

  const box = h('div', { class: 'picker' }, grid, detail);
  box.picked = picked;
  return box;
}
