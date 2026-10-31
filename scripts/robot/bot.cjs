'use strict';
// ROBOT DE TEST — joue le jeu par l'interface, avec de vrais clics.
//
// Pas dans `npm test` : il lui faut un navigateur et un serveur (`npm start`),
// et une carrière complète prend deux minutes. Playwright n'est pas une
// dépendance du dépôt ; il est préinstallé dans les sessions cloud
// (`require('playwright')` marche depuis n'importe où).
//
// Ce qu'il trouve, et que les tests de moteur ne voient pas : un écran qui ne
// défile pas, une carte « levée » qu'aucun style ne montre, un bouton qui ne
// démarre rien, un bandeau posé sur « Fin du tour ». Il compte aussi tout ce
// qui ressemble à un blocage (match sans fin, geste sans effet, tour adverse
// qui ne rend jamais la main) et il enregistre une capture à chaque constat.
//
//   node scripts/robot/run.cjs --scenario=career:kayfabe --seed=1
//   node scripts/robot/run.cjs --scenario=career:scenario --view=phone
//   node scripts/robot/run.cjs --scenario=exhibition --sizes   (toutes les stipulations, 1v1 puis 2v2)
//   node scripts/robot/run.cjs --scenario=exhibition:ladder:1  (une seule : type:taille)
//   plusieurs à la suite : --scenario=career:kayfabe,exhibition:tag:2
//   options : --view=desktop|phone|landscape  --seed=N  --repeat=N  --out=dossier
//             --win=0.8  (« gagne » d'un coup avec cette probabilité : pour voir les
//                         écrans de victoire, de ceinture, de déblocage)
//             --trace    (une ligne par geste : acteur, énergie, cartes jouables)
// Le rapport JSON et les captures vont dans local/robot/.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ARGS = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true]; }));
const BASE = ARGS.base || 'http://localhost:8080/';
const OUT = ARGS.out || path.join(process.cwd(), 'local', 'robot');   // `local/` est ignoré par git
const SEED = Number(ARGS.seed || 1);
const VIEW = { desktop: { width: 1280, height: 900 }, phone: { width: 390, height: 844 }, landscape: { width: 844, height: 390 } }[ARGS.view || 'desktop'];
const MATCH_MS = Number(ARGS.matchms || 150000);
fs.mkdirSync(OUT, { recursive: true });

function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Le temps du jeu passe à l'échelle 1/8 pour les attentes longues (tour adverse,
// bannières) : le robot n'a pas besoin de regarder les animations. Math.random
// est ensemencé pour que deux passes donnent les mêmes tirages côté page.
const initScript = (seed) => `(() => {
  let a = ${seed} | 0;
  Math.random = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const st = window.setTimeout.bind(window);
  window.setTimeout = (f, d, ...r) => st(f, d > 150 ? d / 8 : d, ...r);
  try { localStorage.setItem('ppw-tutorial-seen', '1'); } catch (e) {}
})();`;

class Scenario {
  constructor(name, browser) { this.name = name; this.browser = browser; this.matches = []; this.findings = []; this.seen = new Set(); this.rng = mulberry(SEED * 7919 + name.length); this.n = 0; }
  async open() {
    this.ctx = await this.browser.newContext({ viewport: VIEW, hasTouch: false });
    await this.ctx.addInitScript(initScript(SEED));
    this.page = await this.ctx.newPage();
    this.page.setDefaultTimeout(8000);
    this.page.on('pageerror', (e) => this.find('pageerror', e.message));
    this.page.on('console', (m) => { if (m.type() === 'error') this.find('console.error', m.text()); });
    this.page.on('dialog', (d) => d.accept());
    await this.page.goto(BASE);
    await this.page.waitForSelector('.title-menu');
  }
  pick(arr) { return arr[Math.floor(this.rng() * arr.length)]; }
  weighted(items) { const tot = items.reduce((s, i) => s + i.w, 0); let r = this.rng() * tot; for (const i of items) { r -= i.w; if (r <= 0) return i; } return items[items.length - 1]; }
  async find(kind, detail, label = '') {
    const key = kind + '|' + String(detail).slice(0, 80);
    if (this.seen.has(key)) return;
    this.seen.add(key);
    const f = { kind, detail: String(detail).slice(0, 400), where: label || this.where || '' };
    try {
      const file = `${this.name.replace(/[^\w]+/g, '_')}-${this.findings.length + 1}-${kind.replace(/\W+/g, '')}.png`;
      await this.page.screenshot({ path: path.join(OUT, file) });
      f.shot = file;
      f.text = (await this.page.evaluate(() => document.body.innerText)).slice(0, 600).replace(/\n+/g, ' | ');
    } catch (e) { /* page fermée */ }
    this.findings.push(f);
    console.log(`  ⚠ [${this.name}] ${kind}: ${f.detail.slice(0, 160)}${f.where ? ' @ ' + f.where : ''}`);
  }
}

// --------------------------------------------------------------------- lecture de l'écran
const SNAP = () => {
  const b = window.__battle;
  if (!b) return null;
  const U = b.units.map((u) => ({ uid: u.uid, id: u.id, t: u.team, x: u.x, y: u.y, hp: Math.round(u.hp), a: u.acted ? 1 : 0, m: u.moved ? 1 : 0, d: u.down ? 1 : 0, e: u.eliminated ? 1 : 0, en: u.energy, leg: u.legal ? 1 : 0, cl: u.climb || 0 }));
  const sel = document.querySelector('.m-left .fiche.sel');
  const left = [...document.querySelectorAll('.m-left .fiche')];
  const players = b.units.filter((u) => u.team === 'player');
  const actor = sel ? players[left.indexOf(sel)] : null;
  const end = document.querySelector('.m-hand .end');
  return {
    turn: b.turn, phase: b.phase, result: b.result ? b.result.winner : null, reason: b.result ? b.result.reason : null, U,
    sig: JSON.stringify([b.turn, b.phase, !!b.result, U, b.items ? b.items.length : 0]),
    actor: actor ? { uid: actor.uid, id: actor.id, x: actor.x, y: actor.y, moved: !!actor.moved, acted: !!actor.acted, energy: actor.energy } : null,
    hasEnd: !!end, endDisabled: end ? end.disabled : null,
    handMsg: (document.querySelector('.hand-msg') || {}).textContent || '',
  };
};
const DOMQ = () => {
  const txt = (e) => (e.textContent || '').replace(/\s+/g, ' ').trim();
  return {
    cards: [...document.querySelectorAll('.cards .card')].map((c, i) => ({ i, id: c.dataset.id, off: c.classList.contains('off'), dis: c.disabled, type: ([...c.classList].find((k) => k.startsWith('type-')) || '').slice(5), tier: ([...c.classList].find((k) => k.startsWith('tier-')) || '').slice(5), merite: c.classList.contains('merite'), name: txt(c.querySelector('.c-name') || c) })),
    strip: [...document.querySelectorAll('.strip .strip-btn')].map((b, i) => ({ i, t: txt(b), off: b.classList.contains('off') || b.disabled })),
    ringBtn: !!document.querySelector('.strip > .btn:not(.strip-btn):not(.end)'),
    ring: [...document.querySelectorAll('.ring-menu button')].map((b, i) => ({ i, t: txt(b), off: b.disabled })),
    raised: !!document.querySelector('.card.raised, .strip-btn.raised, .ring-menu .btn.raised'),
    reach: [...document.querySelectorAll('.cell.reach')].map((c) => [+c.dataset.x, +c.dataset.y]),
    target: [...document.querySelectorAll('.cell.target')].map((c) => [+c.dataset.x, +c.dataset.y]),
    tutorial: !!document.querySelector('.tutorial, .tuto'),
  };
};
const snap = (page) => page.evaluate(SNAP);
const domq = (page) => page.evaluate(DOMQ);
const clickCell = (page, x, y) => page.evaluate(([x, y]) => { const c = document.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`); if (!c) return false; c.click(); return true; }, [x, y]);

// --------------------------------------------------------------------- un tour du joueur
async function endTurn(page) {
  const b = page.locator('.m-hand .end');
  if (await b.count()) await b.first().click({ timeout: 4000 }).catch(async () => { await page.keyboard.press('e'); });
}

// Joue une action « levable » : clic sur la carte (ou le bouton), puis sur une cible.
async function playRaisable(S, s, click, label, info) {
  const page = S.page;
  const before = s.sig;
  await click();
  await page.waitForTimeout(50);
  let d = await domq(page);
  const dbg = { raised0: d.raised, targets0: d.target.length };
  if (d.raised || d.target.length) {
    if (!d.target.length) { await page.keyboard.press('Escape'); S.find('carte-sans-cible', `${label} se lève mais n’éclaire aucune case`, S.where); info.anomalies++; await page.waitForTimeout(30); const d2 = await domq(page); if (d2.raised || d2.target.length) { S.find('carte-collee', `${label} reste levée après Échap`); } return; }
    // vise le plus faible parmi les cibles : joue pour gagner
    const enemies = s.U.filter((u) => u.t === 'enemy' && !u.e);
    const withHp = d.target.map(([x, y]) => ({ x, y, hp: (enemies.find((u) => u.x === x && u.y === y) || { hp: 999 }).hp }));
    const t = S.rng() < 0.7 ? withHp.reduce((a, b) => (b.hp < a.hp ? b : a)) : S.pick(withHp);
    dbg.cell = [t.x, t.y]; dbg.clicked = await clickCell(page, t.x, t.y);
    await page.waitForTimeout(60);
  }
  const after = await snap(page);
  if (after && after.sig === before && !after.result) {
    // rien n'a bougé : soit un coup dans le vide qui ne change aucun chiffre (rare), soit un clic mort
    S.find('clic-sans-effet', `${label} n’a rien changé ${JSON.stringify(dbg)} phase=${after.phase} actor=${JSON.stringify(s.actor)}`, S.where);
    info.anomalies++;
    const dd = await domq(page); if (dd.raised) await page.keyboard.press('Escape');
  }
  info.actions++;
}

async function playerAction(S, s, info) {
  const page = S.page;
  const d = await domq(page);
  if (d.tutorial) { await page.keyboard.press('Escape'); return; }
  const actor = s.actor;
  const foes = s.U.filter((u) => u.t === 'enemy' && !u.e);
  if (!actor) { await endTurn(page); return; }
  const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  const near = foes.length ? foes.reduce((a, b) => (dist(actor, b) < dist(actor, a) ? b : a)) : null;

  // Parfois, un autre lutteur prend la main.
  const eligible = s.U.filter((u) => u.t === 'player' && !u.a && !u.d && !u.e);
  if (eligible.length > 1 && S.rng() < 0.12) {
    const players = s.U.filter((u) => u.t === 'player');
    const other = S.pick(eligible.filter((u) => u.uid !== actor.uid));
    await page.locator('.m-left .fiche').nth(players.findIndex((u) => u.uid === other.uid)).click().catch(() => {});
    await page.waitForTimeout(40);
    return;
  }

  // Déplacement d'abord (on se rapproche), sauf si déjà au contact.
  if (!actor.moved && d.reach.length && near && dist(actor, near) > 1 && S.rng() < 0.85) {
    const best = d.reach.map(([x, y]) => ({ x, y, k: dist({ x, y }, near) + S.rng() * 0.5 })).reduce((a, b) => (b.k < a.k ? b : a));
    await clickCell(page, best.x, best.y);
    await page.waitForTimeout(50);
    info.moves = (info.moves || 0) + 1;
    return;
  }

  const items = [];
  if (ARGS.trace) console.log(`    t${s.turn} ${actor.id} (${actor.x},${actor.y}) mv=${actor.moved} en=${actor.energy} foe=${near ? near.id + '@' + dist(actor, near) : '-'} cartes ok=${d.cards.filter((c) => !c.off).map((c) => c.id).join(',')} off=${d.cards.filter((c) => c.off).length} strip=${d.strip.filter((b) => !b.off).map((b) => b.t).join('/')}`);
  d.cards.forEach((c) => { if (!c.off && !c.dis) items.push({ w: c.merite ? 6 : c.type === 'tactic' ? 1.4 : c.type === 'attack' || c.type === 'strike' ? 3 : 2.2, kind: 'card', c }); });
  d.strip.forEach((b) => { if (!b.off) items.push({ w: /Tombé/.test(b.t) ? 7 : /Double/.test(b.t) ? 1.6 : /Souffler/.test(b.t) ? 0.25 : 1, kind: 'strip', b }); });
  if (d.ringBtn) items.push({ w: 1.3, kind: 'ring' });
  if (!items.length || S.rng() < 0.03) {
    // plus rien à jouer (ou envie de passer) : on se déplace une dernière fois, sinon fin du tour
    if (!actor.moved && d.reach.length && S.rng() < 0.5) { const [x, y] = S.pick(d.reach); await clickCell(page, x, y); await page.waitForTimeout(40); return; }
    await endTurn(page); await page.waitForTimeout(40); return;
  }
  const it = S.weighted(items);
  if (it.kind === 'card') {
    await playRaisable(S, s, () => page.locator('.cards .card').nth(it.c.i).click({ timeout: 4000 }), `carte ${it.c.name} [${it.c.id}]`, info);
  } else if (it.kind === 'strip') {
    await playRaisable(S, s, () => page.locator('.strip .strip-btn').nth(it.b.i).click({ timeout: 4000 }), `bouton ${it.b.t}`, info);
  } else {
    await page.locator('.strip > .btn:not(.strip-btn):not(.end)').first().click({ timeout: 4000 });
    await page.waitForTimeout(40);
    const dd = await domq(page);
    const ok = dd.ring.filter((r) => !r.off);
    if (!ok.length) { await page.locator('.strip > .btn:not(.strip-btn):not(.end)').first().click().catch(() => {}); return; }
    const pri = ok.filter((r) => /grimp|escalad|monter|ceinture|cl[ée]|attrap|ramass|arme|fouill|table|chaise|échelle|sortir|rentrer|entrer|tag|relais|manager/i.test(r.t));
    const r = (pri.length && S.rng() < 0.7) ? S.pick(pri) : S.pick(ok);
    await playRaisable(S, s, () => page.locator('.ring-menu button').nth(r.i).click({ timeout: 4000 }), `ring ${r.t.slice(0, 40)}`, info);
  }
}

async function playMatch(S, label) {
  const page = S.page;
  S.where = label;
  const t0 = Date.now();
  const info = { label, actions: 0, anomalies: 0, turns: 0 };
  let last = '', same = 0, wait = 0;
  for (let it = 0; it < 6000; it++) {
    if (Date.now() - t0 > MATCH_MS) { await S.find('match-trop-long', `${Math.round((Date.now() - t0) / 1000)} s sans fin`, label); info.stuck = true; return info; }
    if (await page.locator('.result').count()) break;
    const s = await snap(page);
    if (!s) { await page.waitForTimeout(100); if (++wait > 100) { await S.find('plus-de-combat', 'window.__battle absent', label); info.stuck = true; return info; } continue; }
    info.turns = s.turn;
    if (s.result) {
      try { await page.waitForSelector('.result', { timeout: 6000 }); } catch (e) { await S.find('resultat-sans-ecran', `${s.result} / ${s.reason}`, label); info.stuck = true; return info; }
      break;
    }
    if (s.phase !== 'player' || !s.hasEnd || s.endDisabled) {
      await page.waitForTimeout(50);
      if (++wait > 900) { await S.find('tour-adverse-bloque', `phase=${s.phase} msg=${s.handMsg.slice(0, 60)}`, label); info.stuck = true; return info; }
      continue;
    }
    wait = 0;
    // --win=p : avec la probabilité p, le robot « gagne » d'un coup (résultat posé
    // à la main, puis un clic de l'interface force le rendu). C'est le seul moyen
    // de voir les écrans qu'un joueur médiocre n'atteint jamais : victoire,
    // ceinture, fin de saison gagnée, déblocages.
    if (ARGS.win && info.actions >= 2 && S.rng() < Number(ARGS.win) && !info.forced) {
      info.forced = true;
      await page.evaluate(() => { const b = window.__battle; if (!b.result) b.result = { winner: 'player', reason: 'Victoire imposée par le robot.', turns: b.turn }; });
      await page.locator('.mt-btns button[title^="Tourner"]').first().click({ timeout: 2000 }).catch(() => page.keyboard.press('r'));
      continue;
    }
    if (s.sig === last) same++; else { same = 0; last = s.sig; }
    if (same >= 25) { await S.find('bloque-sans-progres', `tour ${s.turn}, ${same} gestes sans changement`, label); info.stuck = true; return info; }
    if (same >= 8) { await endTurn(page); await page.waitForTimeout(60); continue; }
    try { await playerAction(S, s, info); }
    catch (e) { await S.find('geste-impossible', e.message.split('\n')[0], label); info.anomalies++; await page.keyboard.press('Escape').catch(() => {}); if (info.anomalies > 40) { info.stuck = true; return info; } }
  }
  const b = await page.evaluate(() => { const b = window.__battle; return b && b.result ? { winner: b.result.winner, reason: b.result.reason, turns: b.turn, stats: { tables: b.stats.tables, finishers: b.stats.finishers, kickouts: b.stats.kickouts } } : null; });
  info.result = b;
  info.ms = Date.now() - t0;
  return info;
}

// Écran de résultat : cartes proposées, puis « Continuer ».
async function leaveResult(S) {
  const page = S.page;
  for (let k = 0; k < 40; k++) {
    const btn = page.locator('.result .btn.primary').last();
    if (!(await btn.count())) return true;
    if (await btn.isEnabled()) { await btn.click(); await page.waitForTimeout(150); return true; }
    const offers = page.locator('.result .offer-card:not(.skip)');
    const n = await offers.count();
    if (n && S.rng() < 0.85) await offers.nth(Math.floor(S.rng() * n)).click();
    else { const skip = page.locator('.result .offer-card.skip'); if (await skip.count()) await skip.first().click(); else { await S.find('offre-sans-issue', 'Continuer reste grisé, aucune carte, aucun « Passer »'); return false; } }
    await page.waitForTimeout(40);
  }
  await S.find('offre-boucle', 'trop de cartes proposées à la suite');
  return false;
}

module.exports = { Scenario, playMatch, leaveResult, snap, domq, clickCell, sleep, ARGS, BASE, OUT, SEED, VIEW, mulberry, chromium };
