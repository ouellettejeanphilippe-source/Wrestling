'use strict';
// Scénarios du robot de test : voir l'en-tête de bot.cjs pour l'usage.
const fs = require('fs');
const path = require('path');
const { Scenario, playMatch, leaveResult, ARGS, OUT, SEED, VIEW, chromium } = require('./bot.cjs');

const TYPES = ['singles', 'tag', 'hardcore', 'street_fight', 'last_man_standing', 'submission_only', 'battle_royal', 'ladder', 'tlc', 'cage', 'hell_in_cell', 'showdown'];

// ------------------------------------------------------------------ carrière
async function overlays(S) {
  // ferme ce qui traîne : fenêtres de choix du hub (lutteur, statistique, annulation)
  const page = S.page;
  for (let k = 0; k < 6; k++) {
    const o = page.locator('.overlay .btn.offer-card, .overlay .offer-card, .overlay button');
    if (!(await page.locator('.overlay').count())) return;
    const btn = page.locator('.overlay .btn:not([disabled])');
    const n = await btn.count();
    if (!n) return;
    await btn.nth(Math.floor(S.rng() * Math.max(1, n - 1))).click().catch(() => {});
    await page.waitForTimeout(60);
  }
}

async function bookFight(S, card, label) {
  const page = S.page;
  // remplit l'équipe : « x/N » dans la première ligne de .team-pick
  for (let k = 0; k < 8; k++) {
    const txt = await card.locator('.team-pick .muted').first().innerText();
    const m = txt.match(/(\d+)\/(\d+)/);
    if (!m || +m[1] >= +m[2]) break;
    const libres = card.locator('.team-pick .tp:not(.on):not([disabled])');
    if (!(await libres.count())) { await S.find('equipe-incomplete', `${label} : ${txt}`); break; }
    await libres.first().click();
    await page.waitForTimeout(40);
  }
  await card.locator('.team-pick .btn.primary').click();
  try { await page.waitForSelector('.m-hand, .m-scene', { timeout: 6000 }); return true; }
  catch (e) { await S.find('booking-refuse', `${label} : le match ne démarre pas`); return false; }
}

async function hubWeek(S) {
  const page = S.page;
  S.where = 'hub';
  await overlays(S);
  // de temps en temps : écurie (entraîner, recruter) et historique
  if (S.rng() < 0.5) {
    await page.locator('.tab').nth(1).click();
    await page.waitForTimeout(80);
    const rec = page.locator('.recruit .tp:not([disabled])');
    if ((await rec.count()) && S.rng() < 0.7) { await rec.first().click(); await page.waitForTimeout(80); S.recruits = (S.recruits || 0) + 1; }
    const tr = page.locator('.train .btn.small:not([disabled])');
    const nt = await tr.count();
    for (let i = 0; i < Math.min(2, nt); i++) { await page.locator('.train .btn.small:not([disabled])').first().click().catch(() => {}); await page.waitForTimeout(40); }
    if (S.rng() < 0.3) { await page.locator('.tab').nth(2).click(); await page.waitForTimeout(60); }
    await page.locator('.tab').first().click();
    await page.waitForTimeout(80);
  }
  const fights = page.locator('.matches .mcard:not(.node-card)');
  const nodes = page.locator('.matches .node-card');
  const nf = await fights.count(), nn = await nodes.count();
  if (!nf && !nn) { await S.find('hub-vide', 'aucune porte cette semaine'); return 'stuck'; }
  // les semaines à choix : on alterne combat et autres portes, mais un match au moins 3 fois sur 4
  if (nf && (!nn || S.rng() < 0.75)) {
    const card = fights.nth(Math.floor(S.rng() * nf));
    const title = (await card.locator('h3').first().innerText()).replace(/\s+/g, ' ');
    if (!(await bookFight(S, card, title))) return 'stuck';
    return { fight: title };
  }
  const card = nodes.nth(Math.floor(S.rng() * nn));
  const title = (await card.locator('h3').first().innerText()).replace(/\s+/g, ' ');
  S.where = 'node: ' + title;
  for (let k = 0; k < 10; k++) {
    const btns = card.locator('.node-actions .btn:not([disabled])');
    const nb = await btns.count();
    if (!nb) { await S.find('porte-sans-bouton', title); return 'stuck'; }
    const before = await page.evaluate(() => document.querySelector('.hub-head').innerText);
    await btns.nth(Math.floor(S.rng() * nb)).click();
    await page.waitForTimeout(100);
    await overlays(S);
    await page.waitForTimeout(80);
    // la semaine est passée si la carte n'est plus là (ou le hub a changé de semaine)
    const still = await page.locator('.matches .node-card').count();
    const after = await page.evaluate(() => document.querySelector('.hub-head') ? document.querySelector('.hub-head').innerText : 'FIN');
    if (!still || after !== before || !(await page.locator('.hub').count())) return { node: title };
    if (k === 5) { const ghost = page.locator('.node-actions .btn.ghost'); if (await ghost.count()) await ghost.first().click().catch(() => {}); }
  }
  await S.find('porte-qui-ne-passe-pas', title);
  return 'stuck';
}

async function career(browser, mode) {
  const S = new Scenario(`career-${mode}`, browser);
  await S.open();
  const page = S.page;
  const t0 = Date.now();
  await page.click('text=Nouvelle saison');
  await page.waitForSelector('.setup');
  if (mode === 'scenario') await page.click('.mode-card[data-mode="scenario"]');
  // premier portrait : tiré selon la graine
  const tiles = page.locator('.picker-tile');
  const nt = await tiles.count();
  const tile = tiles.nth(Math.floor(S.rng() * nt));
  await tile.click();
  if (!(await tile.evaluate((e) => e.classList.contains('picked')))) await page.locator('.pick-btn').click();
  await page.click('text=Lancer la carrière');
  await page.waitForSelector('.hub', { timeout: 5000 }).catch(() => S.find('carriere-ne-demarre-pas', 'pas de hub'));
  let weeks = 0, ended = null;
  for (let step = 0; step < 60; step++) {
    if (await page.locator('.season-end').count()) { ended = await page.locator('.season-end h1').innerText(); break; }
    if (!(await page.locator('.hub').count())) { await S.find('ecran-inconnu', 'ni hub ni fin de saison'); break; }
    const r = await hubWeek(S);
    if (r === 'stuck') break;
    weeks++;
    if (r.fight) {
      const info = await playMatch(S, `${S.name} · ${r.fight}`);
      S.matches.push(info);
      console.log(`  ${info.result ? (info.result.winner === 'player' ? '✓' : '✗') : '?'} ${r.fight.slice(0, 50)} — ${info.result ? info.result.turns + ' t, ' + info.result.reason.slice(0, 50) : 'PAS DE FIN'} (${info.actions} gestes, ${Math.round((info.ms || 0) / 1000)} s)`);
      if (info.stuck) break;
      if (!(await leaveResult(S))) break;
      await page.waitForTimeout(100);
    }
  }
  if (!ended && (await page.locator('.season-end').count())) ended = await page.locator('.season-end h1').innerText();
  // l'écran de fin : on clique « Nouvelle carrière » pour voir qu'on revient au titre ou à la création
  let back = null;
  if (ended) {
    await page.locator('.season-end .btn.primary').click().catch(() => {});
    await page.waitForTimeout(150);
    back = (await page.locator('.title-menu').count()) ? 'titre' : (await page.locator('.setup').count()) ? 'setup' : 'inconnu';
    if (back === 'inconnu') await S.find('apres-fin-de-saison', 'écran inconnu après « Nouvelle carrière »');
  } else await S.find('carriere-sans-fin', `${weeks} semaines jouées, pas d’écran de fin`);
  return { S, summary: { weeks, ended, back, ms: Date.now() - t0, recruits: S.recruits || 0 } };
}

// ------------------------------------------------------------------ exhibition
async function pickN(S, picker, n, avoid = []) {
  const tiles = picker.locator('.picker-tile');
  const total = await tiles.count();
  const idx = [...Array(total).keys()].filter((i) => !avoid.includes(i)).sort(() => S.rng() - 0.5).slice(0, n);
  for (const i of idx) {
    const t = tiles.nth(i);
    await t.click();
    if (!(await t.evaluate((e) => e.classList.contains('picked')))) await picker.locator('.pick-btn').click();
    await S.page.waitForTimeout(20);
  }
  return idx;
}

async function exhibition(browser, type, size) {
  const S = new Scenario(`exh-${type}-${size}`, browser);
  await S.open();
  const page = S.page;
  S.where = `exhibition ${type} ${size}v${size}`;
  await page.click('text=Match d’exhibition');
  await page.waitForSelector('.setup select');
  await page.locator('.setup select').nth(0).selectOption(type);
  if (type !== 'battle_royal') await page.locator('.setup select').nth(1).selectOption(String(size));
  const pickers = page.locator('.picker');
  const mine = await pickN(S, pickers.nth(0), type === 'battle_royal' ? 3 : size);
  if (S.rng() < 0.5) { await page.locator('text=Adversaires au hasard').click(); }
  else await pickN(S, pickers.nth(1), type === 'battle_royal' ? 4 : size, mine);
  // managers de temps en temps
  const sels = page.locator('.setup select');
  if (S.rng() < 0.5) { const n = await sels.nth(2).locator('option').count(); await sels.nth(2).selectOption({ index: 1 + Math.floor(S.rng() * (n - 1)) }); }
  if (S.rng() < 0.5) { const n = await sels.nth(3).locator('option').count(); await sels.nth(3).selectOption({ index: 1 + Math.floor(S.rng() * (n - 1)) }); }
  await page.click('text=Ding ding ding');
  try { await page.waitForSelector('.m-hand', { timeout: 6000 }); } catch (e) { await S.find('exhibition-ne-demarre-pas', S.where); return { S, summary: { type, size, started: false } }; }
  const info = await playMatch(S, S.where);
  S.matches.push(info);
  console.log(`  ${info.result ? (info.result.winner === 'player' ? '✓' : '✗') : '?'} ${S.where} — ${info.result ? info.result.turns + ' t, ' + info.result.reason.slice(0, 55) : 'PAS DE FIN'} (${info.actions} gestes, ${Math.round((info.ms || 0) / 1000)} s)`);
  if (!info.stuck) {
    await leaveResult(S);
    await page.waitForTimeout(150);
    if (!(await page.locator('.title-menu').count())) await S.find('apres-exhibition', 'on ne revient pas au titre');
  }
  return { S, summary: { type, size, started: true, ...info } };
}

// ------------------------------------------------------------------ main
(async () => {
  const which = ARGS.scenario || 'career:kayfabe';
  const browser = await chromium.launch();
  const all = [];
  try {
    for (const w of which.split(',')) {
      const [kind, a, b] = w.split(':');
      if (kind === 'career') {
        const n = Number(ARGS.repeat || 1);
        for (let i = 0; i < n; i++) { console.log(`▶ carrière ${a} #${i + 1}`); const r = await career(browser, a); all.push(r); await r.S.ctx.close(); }
      } else if (kind === 'exhibition') {
        const list = a ? [[a, Number(b || 1)]] : TYPES.flatMap((t) => (t === 'tag' ? [[t, 2]] : t === 'battle_royal' ? [[t, 3]] : [[t, 1]]));
        if (!a && ARGS.sizes) for (const t of TYPES) if (!['battle_royal', 'tag'].includes(t)) list.push([t, 2]);
        for (const [t, n] of list) { console.log(`▶ exhibition ${t} ${n}v${n}`); const r = await exhibition(browser, t, n); all.push(r); await r.S.ctx.close(); }
      }
    }
  } finally { await browser.close(); }
  const report = all.map(({ S, summary }) => ({ name: S.name, summary, matches: S.matches.map((m) => ({ label: m.label, turns: m.turns, actions: m.actions, anomalies: m.anomalies, stuck: !!m.stuck, result: m.result })), findings: S.findings }));
  const file = path.join(OUT, `rapport-${(ARGS.tag || which).replace(/\W+/g, '_')}-s${SEED}-${ARGS.view || 'desktop'}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 1));
  const nf = report.reduce((n, r) => n + r.findings.length, 0);
  console.log(`\n=== ${report.length} scénario(s), ${report.reduce((n, r) => n + r.matches.length, 0)} match(s), ${nf} constat(s) → ${file}`);
  for (const r of report) for (const f of r.findings) console.log(` - [${r.name}] ${f.kind}: ${f.detail.slice(0, 140)}`);
})().catch((e) => { console.error('ROBOT PLANTÉ', e); process.exit(2); });
