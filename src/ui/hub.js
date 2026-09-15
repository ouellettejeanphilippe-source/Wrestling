// Hub de promotion : carte du show, roster/entraînement, agents libres, historique, fin de saison.
import { h, clear, toast } from './dom.js';
import { wrestlerCard, chip } from './cards.js';
import { WRESTLERS_BY_ID } from '../data/wrestlers.js';
import { MATCH_TYPES } from '../data/matchTypes.js';
import { DIRECTIVES } from '../data/directives.js';
import { SEASON } from '../data/campaign.js';
import { CLASSES, SPECIALTIES } from '../data/classes.js';
import { currentShow, weekNodes, ensureRoute, takeNode, train, trainCost, recruit, TRAINABLE, MAX_TRAIN } from '../game/state.js';
import { NODE_TYPES, SEMAINE_TITRE, isFight, rankStep } from '../game/route.js';
import { restOptions, restTrain, restTrim, restGate, trimmable, eventFor, applyEvent, shopStock, buyCard, buyTrain, buyAds, buyAgent, SHOP_PRICES, SHOP_FANS } from '../game/week.js';
import { rankLabel, titleTerms, championName, rankOf } from '../game/rank.js';
import { describeFinish } from '../game/script.js';
import { knownMoves, deckSize, forgetCard, DECK_MAX, DECK_MIN } from '../game/deck.js';
import { isCard } from '../engine/hand.js';
import { MOVES, MOVE_TIER_LABEL } from '../data/moves.js';

export function showHub(root, app, tab = 'show') {
  const st = app.state;
  clear(root);
  const show = currentShow(st);
  const header = h('header', { class: 'hub-head' },
    h('div', {}, h('h1', {}, st.promoName), h('div', { class: 'muted' }, `${st.mode === 'scenario' ? '🎬 Mode Scénarios (IRL)' : '🎭 Mode Kayfabe'} · ${SEASON.name} · Épisode ${st.showIndex + 1}/${SEASON.shows.length}`)),
    h('div', { class: 'hub-stats' }, h('span', {}, `💰 ${st.money} $`), h('span', {}, `👥 ${st.fans} fans`)),
  );
  // LA ROUTE VERS LA CEINTURE, TOUJOURS À L'ÉCRAN. C'est la seule question de
  // la carrière : on doit pouvoir lire à tout moment où on en est et ce que ça
  // vaudra le soir du titre.
  const t = titleTerms(rankOf(st));
  const reste = SEASON.shows.length - 1 - st.showIndex;
  header.append(h('div', { class: `rank-band terms-${t.key}` },
    h('b', {}, `🥇 ${rankLabel(rankOf(st))}`),
    h('span', {}, reste > 0
      ? `${reste} match${reste > 1 ? 's' : ''} avant le ${SEASON.beltName} contre ${championName(SEASON.champion)}.`
      : `Ce soir : ${SEASON.beltName} contre ${championName(SEASON.champion)}.`),
    h('span', { class: 'terms' }, `${t.icon} ${t.name} — ${t.odds}`),
    h('span', { class: 'muted' }, 'Chaque victoire vous fait monter d’une place, chaque défaite en fait perdre une. Vous aurez votre match de titre quoi qu’il arrive : c’est votre classement qui en fixe les conditions.'),
  ));
  const tabs = h('nav', { class: 'tabs' }, [['show', '📺 Le show'], ['roster', '🧑‍🤝‍🧑 Roster & entraînement'], ['agents', '📝 Agents libres'], ['history', '📜 Historique']].map(([id, label]) =>
    h('button', { class: `tab ${tab === id ? 'on' : ''}`, onclick: () => showHub(root, app, id) }, label)));
  const body = h('div', { class: 'hub-body' });
  if (tab === 'show') body.append(renderShow(show, st, app, root));
  if (tab === 'roster') body.append(renderRoster(st, app, root));
  if (tab === 'agents') body.append(renderAgents(st, app, root));
  if (tab === 'history') body.append(renderHistory(st));
  root.append(h('div', { class: 'hub' }, header, tabs, body,
    h('div', { class: 'row hub-foot' }, h('button', { class: 'btn ghost', onclick: () => app.toTitle() }, '← Menu (la partie est sauvegardée)'), h('button', { class: 'btn ghost danger', onclick: () => { if (confirm('Supprimer la sauvegarde et recommencer ?')) app.abandonCampaign(); } }, '🗑 Abandonner la saison'))));
}

function renderShow(show, st, app, root) {
  ensureRoute(st);
  const box = h('div', {});
  box.append(h('h2', {}, show.title), h('p', { class: 'intro' }, show.intro));
  box.append(renderRoute(st));
  const ouverts = weekNodes(st);
  box.append(h('p', { class: 'muted' }, st.path.length >= SEMAINE_TITRE
    ? 'Le dernier soir. Il n’y a plus qu’une question.'
    : st.mode === 'scenario'
      ? 'Choisissez par où passer cette semaine. Un match rapporte au classement, le reste rapporte autre chose — et une semaine sans match est une place que vous n’aurez pas le soir du titre.'
      : 'Choisissez par où passer cette semaine. Un match rapporte au classement, le reste rapporte autre chose — et une semaine sans match est une place que vous n’aurez pas le soir du titre.'));
  const list = h('div', { class: 'matches' });
  for (const node of ouverts) {
    list.append(isFight(node.type) ? matchCard(node.match, st, app, root, node) : nodeCard(node, st, app, root));
  }
  box.append(list);
  return box;
}

// LA CARTE. Les semaines de bas en haut — on monte vers la ceinture. Les
// arêtes sont tracées pour de vrai : sans elles on ne voit pas une route, on
// voit une liste de colonnes.
function renderRoute(st) {
  const rows = st.route.rows;
  const ouverts = new Set(weekNodes(st).map((n) => `${n.row}:${n.col}`));
  const passes = new Set((st.path || []).map((p) => `${p.row}:${p.col}`));
  const H = rows.length, pos = (row, col, len) => ({
    x: ((col + 0.5) / len) * 100,
    y: 100 - ((row + 0.5) / H) * 100,
  });

  const traits = [];
  rows.forEach((row, r) => row.forEach((node) => {
    for (const c of (node.next || [])) {
      const a = pos(r, node.col, row.length), b = pos(r + 1, c, rows[r + 1].length);
      const vif = passes.has(`${r}:${node.col}`) || ouverts.has(`${r + 1}:${c}`);
      traits.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${vif ? 'vif' : ''}" />`);
    }
  }));
  const svg = h('div', { class: 'route-lines' });
  svg.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${traits.join('')}</svg>`;

  const grille = h('div', { class: 'route-rows' }, [...rows].reverse().map((row) => {
    const r = row[0].row;
    return h('div', { class: 'route-row' },
      h('span', { class: 'route-week' }, r === SEMAINE_TITRE ? 'PPV' : `S${r + 1}`),
      h('div', { class: 'route-nodes' }, row.map((node) => {
        const t = NODE_TYPES[node.type];
        const etat = passes.has(`${r}:${node.col}`) ? 'done' : ouverts.has(`${r}:${node.col}`) ? 'open' : 'far';
        return h('span', { class: `route-node n-${node.type} ${etat}`, title: `${t.name} — ${t.desc}` }, t.icon);
      })));
  }));
  return h('div', { class: 'route-map' }, svg, grille,
    h('p', { class: 'route-key muted' }, Object.values(NODE_TYPES).map((t) => `${t.icon} ${t.name}`).join(' · ')));
}

// Les nœuds sans match : semaine off, coulisses, bureau du booker.
function nodeCard(node, st, app, root) {
  const t = NODE_TYPES[node.type];
  const card = h('div', { class: `mcard node-card n-${node.type}` },
    h('h3', {}, `${t.icon} ${t.name}`),
    h('p', {}, t.desc),
    h('p', { class: 'muted small' }, 'Pas de match cette semaine : le classement ne bouge pas.'));
  if (node.type === 'rest') card.append(renderRest(node, st, app, root));
  if (node.type === 'event') card.append(renderEvent(node, st, app, root));
  if (node.type === 'shop') card.append(renderShop(node, st, app, root));
  return card;
}

const passer = (st, app, root, node, message) => {
  takeNode(st, node);
  app.saveNow();
  if (message) toast(message);
  showHub(root, app, 'show');
};

function renderRest(node, st, app, root) {
  const box = h('div', { class: 'node-actions' });
  for (const o of restOptions(st)) {
    box.append(h('button', { class: 'btn', disabled: !o.ok, onclick: () => {
      if (o.key === 'gate') return passer(st, app, root, node, restGate(st).message);
      if (o.key === 'train') return choisirLutteur(root, app, st, 'Qui s’entraîne ?', (r) => choisirStat(root, app, st, r, (stat) => {
        const res = restTrain(st, r.id, stat);
        if (!res.ok) return toast(res.reason, 'warn');
        passer(st, app, root, node, res.message);
      }));
      return choisirLutteur(root, app, st, 'Quel deck resserrer ?', (r) => choisirCarte(root, app, st, r, (mv) => {
        const res = restTrim(st, r.id, mv);
        if (!res.ok) return toast(res.reason, 'warn');
        passer(st, app, root, node, res.message);
      }));
    } }, `${o.icon} ${o.name}`, h('span', { class: 'muted' }, ` — ${o.desc}`)));
  }
  return box;
}

function renderEvent(node, st, app, root) {
  const ev = eventFor(st, node);
  const box = h('div', { class: 'node-actions' },
    h('p', { class: 'event-text' }, `${ev.icon} ${ev.text}`));
  ev.choices.forEach((c, i) => box.append(h('button', { class: 'btn', onclick: () => {
    const res = applyEvent(st, node, i);
    passer(st, app, root, node, res.message);
  } }, c.label, h('span', { class: 'muted' }, ` — ${c.hint}`))));
  return box;
}

function renderShop(node, st, app, root) {
  const stock = shopStock(st, node);
  const box = h('div', { class: 'node-actions' });
  const lutteur = WRESTLERS_BY_ID[stock.lutteur];
  for (const mv of stock.cartes) {
    box.append(h('button', { class: 'btn', disabled: st.money < SHOP_PRICES.card, onclick: () => {
      const res = buyCard(st, stock.lutteur, mv);
      if (!res.ok) return toast(res.reason, 'warn');
      passer(st, app, root, node, res.message);
    } }, `🃏 ${MOVES[mv].name} pour ${lutteur ? lutteur.name : '—'} — ${SHOP_PRICES.card} $`,
      h('span', { class: 'muted' }, ` ${MOVES[mv].desc}`)));
  }
  box.append(h('button', { class: 'btn', disabled: st.money < SHOP_PRICES.train, onclick: () => {
    choisirLutteur(root, app, st, 'Qui s’entraîne ?', (r) => choisirStat(root, app, st, r, (stat) => {
      const res = buyTrain(st, r.id, stat);
      if (!res.ok) return toast(res.reason, 'warn');
      passer(st, app, root, node, res.message);
    }));
  } }, `🏋️ Une séance — ${SHOP_PRICES.train} $`, h('span', { class: 'muted' }, ' Moins cher qu’au hub, et sans surcoût cumulé.')));
  box.append(h('button', { class: 'btn', disabled: st.money < SHOP_PRICES.fans, onclick: () => {
    const res = buyAds(st);
    if (!res.ok) return toast(res.reason, 'warn');
    passer(st, app, root, node, res.message);
  } }, `📣 Campagne d’affichage — ${SHOP_PRICES.fans} $`, h('span', { class: 'muted' }, ` +${SHOP_FANS} fans.`)));
  if (stock.agent && WRESTLERS_BY_ID[stock.agent]) {
    box.append(h('button', { class: 'btn', disabled: st.money < stock.agentPrix, onclick: () => {
      const res = buyAgent(st, stock.agent, stock.agentPrix);
      if (!res.ok) return toast(res.reason, 'warn');
      passer(st, app, root, node, res.message);
    } }, `✍️ Signer ${WRESTLERS_BY_ID[stock.agent].name} — ${stock.agentPrix} $`, h('span', { class: 'muted' }, ' Tarif de faveur, cette semaine seulement.')));
  }
  box.append(h('button', { class: 'btn ghost', onclick: () => passer(st, app, root, node, 'Vous ressortez les mains vides.') }, 'Repartir sans rien acheter'));
  return box;
}

// Deux petits sélecteurs partagés par la semaine off et la boutique.
function choisirLutteur(root, app, st, titre, suite) {
  overlayChoix(root, titre, st.roster.map((r) => ({
    label: `${(WRESTLERS_BY_ID[r.id] || {}).name || r.id}`,
    hint: `${r.wins}V-${r.losses}D · deck ${deckSize(r)}`,
    onPick: () => suite(r),
  })));
}
function choisirStat(root, app, st, r, suite) {
  overlayChoix(root, `Quelle progression pour ${(WRESTLERS_BY_ID[r.id] || {}).name || r.id} ?`,
    TRAINABLE.filter(([k, , step]) => r.bonus[k] / step < MAX_TRAIN).map(([k, label, step]) => ({
      label: `+${step} ${label}`, hint: `actuel : ${r.bonus[k] / step}/${MAX_TRAIN}`, onPick: () => suite(k),
    })));
}
function choisirCarte(root, app, st, r, suite) {
  overlayChoix(root, `Quel mouvement ${(WRESTLERS_BY_ID[r.id] || {}).name || r.id} laisse-t-il tomber ?`,
    trimmable(r).map((mv) => ({ label: MOVES[mv].name, hint: MOVES[mv].desc, onPick: () => suite(mv) })));
}
function overlayChoix(root, titre, options) {
  const box = h('div', { class: 'result choix' }, h('h2', {}, titre));
  if (!options.length) box.append(h('p', { class: 'muted' }, 'Rien de disponible.'));
  const overlay = h('div', { class: 'overlay' }, box);
  for (const o of options) {
    box.append(h('button', { class: 'btn offer-card', onclick: () => { overlay.remove(); o.onPick(); } },
      h('b', {}, o.label), h('span', { class: 'muted' }, o.hint || '')));
  }
  box.append(h('button', { class: 'btn ghost', onclick: () => overlay.remove() }, 'Annuler'));
  root.append(overlay);
}

function matchCard(m, st, app, root, node = null) {
  const rules = MATCH_TYPES[m.type];
  const opp = m.enemies.map((e) => WRESTLERS_BY_ID[typeof e === 'string' ? e : e.id]);
  const card = h('div', { class: 'mcard' },
    h('h3', {}, `${rules.icon} ${m.title}`, h('span', { class: 'muted' }, ` — ${rules.name}, ${m.teamSize} de vos lutteurs`)),
    m.termsLabel ? h('p', { class: `terms-line terms-${m.terms}` }, m.termsLabel) : null,
    node && node.type === 'elite' ? h('p', { class: 'terms-line terms-net' }, `⭐ Main event — une victoire vaut ${rankStep('elite')} places au classement.`) : null,
    h('p', {}, m.desc), h('p', { class: 'muted small' }, rules.desc),
    h('div', { class: 'opps' }, 'Adversaires : ', opp.map((d) => h('span', { class: 'opp', title: d.bio }, chip(d), ` ${d.name} (${CLASSES[d.cls].icon} ${CLASSES[d.cls].name} / ${SPECIALTIES[d.spec].icon} ${SPECIALTIES[d.spec].name})`))),
    m.reinforcements ? h('p', { class: 'small' }, `🚨 Renforts : ${m.reinforcements.map((r) => `tour ${r.turn} (${r.enemies.map((e) => WRESTLERS_BY_ID[e].name).join(', ')})`).join(' · ')}`) : null,
    st.mode === 'scenario'
      ? h('div', { class: 'script-box' }, h('b', {}, '🎬 Script : '), m.script.summary, h('div', { class: 'obj-item' }, `📜 Finish : ${describeFinish(m.script.finish)}`), m.script.beats.map((b) => h('div', { class: 'obj-item' }, `⬜ ${DIRECTIVES[b].name} — ${DIRECTIVES[b].desc}`)))
      : h('div', { class: 'script-box' }, h('b', {}, '📺 Directives du Network : '), m.directives.map((d) => h('div', { class: 'obj-item' }, `⬜ ${DIRECTIVES[d].name} — ${DIRECTIVES[d].desc} (+${DIRECTIVES[d].reward.fans} fans, +${DIRECTIVES[d].reward.money} $)`))),
    h('p', { class: 'reward' }, `Récompense de base : ${m.reward.money} $ · ${m.reward.fans} fans`),
  );
  const picked = new Set();
  const teamBox = h('div', { class: 'team-pick' }, h('div', { class: 'muted' }, `Choisissez ${m.teamSize} lutteur(s) :`),
    h('div', { class: 'team-list' }, st.roster.map((r) => {
      const d = WRESTLERS_BY_ID[r.id];
      const b = h('button', { class: 'tp', onclick: () => { if (picked.has(r.id)) picked.delete(r.id); else if (picked.size < m.teamSize) picked.add(r.id); else return toast(`Maximum ${m.teamSize}`, 'warn'); b.classList.toggle('on', picked.has(r.id)); } }, chip(d), ` ${d.name} `, h('small', {}, `${CLASSES[d.cls].icon} ${r.wins}V-${r.losses}D`));
      return b;
    })),
    h('button', { class: 'btn primary', onclick: () => { if (picked.size !== m.teamSize) return toast(`Choisissez exactement ${m.teamSize} lutteur(s)`, 'warn'); app.bookMatch(m, [...picked], node); } }, '🔔 Booker ce match'));
  card.append(teamBox);
  return card;
}

function renderRoster(st, app, root) {
  const box = h('div', {}, h('p', { class: 'muted' }, `Entraînement : +1 stat (ou +10 PV) pour ${150} $ (+25 $ par entraînement déjà suivi par ce lutteur), maximum ${MAX_TRAIN} par stat. Les lutteurs guérissent entièrement entre les shows.`));
  const cards = h('div', { class: 'cards' });
  for (const r of st.roster) {
    const d = WRESTLERS_BY_ID[r.id];
    const cost = trainCost(r);
    const extra = h('div', { class: 'train' }, h('div', { class: 'muted small' }, `Fiche : ${r.wins} victoire(s), ${r.losses} défaite(s) · Entraînement : ${cost} $`),
      h('div', { class: 'train-btns' }, TRAINABLE.map(([k, label, step]) => {
        const lvl = r.bonus[k] / step;
        return h('button', { class: 'btn small', disabled: lvl >= MAX_TRAIN || st.money < cost, onclick: () => { const res = train(st, r.id, k); if (!res.ok) return toast(res.reason, 'warn'); app.saveNow(); toast(`+${step} ${label} pour ${d.name}`); showHub(root, app, 'roster'); } }, `+${step} ${label} (${lvl}/${MAX_TRAIN})`);
      })));
    // LE DECK, ENTRE DEUX ÉPISODES. On ne peut pas décider quoi apprendre si
    // on ne sait pas ce qu'on a déjà. Les cartes apprises en carrière sont
    // marquées, et on peut en laisser tomber ici plutôt qu'au pied du mur.
    const taille = deckSize(r);
    const piochables = [...knownMoves(r)].filter(isCard).sort((a, b) => MOVES[a].name.localeCompare(MOVES[b].name));
    const apprises = new Set(r.cards || []);
    extra.append(h('details', { class: 'deck-box' },
      h('summary', {}, `🃏 Deck — ${taille}/${DECK_MAX} cartes${apprises.size ? ` (${apprises.size} apprise${apprises.size > 1 ? 's' : ''})` : ''}`),
      h('p', { class: 'muted small' }, `Ce qui se pioche en match. Les fondamentaux, la signature et le finisher n’en font pas partie : ils sont toujours disponibles. Mesuré : avec ${taille} cartes, il faut environ ${Math.round(taille * 0.7)} tours pour revoir une carte précise — un deck de 12 la ramène en 8. Plancher : ${DECK_MIN} cartes.`),
      h('div', { class: 'deck-list' }, piochables.map((id) => h('span', { class: `deck-card${apprises.has(id) ? ' learned' : ''}`, title: `${MOVE_TIER_LABEL[MOVES[id].tier] || ''} — ${MOVES[id].desc}` },
        h('b', {}, MOVES[id].name),
        h('button', { class: 'deck-drop', title: 'Laisser tomber ce mouvement', onclick: () => {
          if (!confirm(`${d.name} oublie « ${MOVES[id].name} » ? C’est définitif pour cette saison.`)) return;
          const res = forgetCard(r, id, true);
          if (!res.ok) return toast(res.reason, 'warn');
          app.saveNow(); toast(`${d.name} oublie ${MOVES[id].name}`); showHub(root, app, 'roster');
        } }, '✕')))),
    ));
    cards.append(wrestlerCard(d, { bonus: r.bonus, extra }));
  }
  box.append(cards);
  return box;
}

function renderAgents(st, app, root) {
  const box = h('div', {}, h('p', { class: 'muted' }, 'Trois agents libres par épisode. Le salaire est payé une fois à la signature.'));
  const cards = h('div', { class: 'cards' });
  for (const id of st.freeAgents) {
    const d = WRESTLERS_BY_ID[id];
    const extra = h('button', { class: 'btn primary', disabled: st.money < d.salary, onclick: () => { const res = recruit(st, id); if (!res.ok) return toast(res.reason, 'warn'); app.saveNow(); toast(`${d.name} rejoint ${st.promoName} !`); showHub(root, app, 'agents'); } }, `Recruter — ${d.salary} $`);
    cards.append(wrestlerCard(d, { extra }));
  }
  if (!st.freeAgents.length) box.append(h('p', {}, 'Plus personne à recruter pour l’instant.'));
  box.append(cards);
  return box;
}

function renderHistory(st) {
  if (!st.history.length) return h('p', { class: 'muted' }, 'Aucun match encore.');
  return h('table', { class: 'history' }, h('tr', {}, ['Épisode', 'Match', 'Résultat', 'Note', 'Argent', 'Fans', 'Tours'].map((x) => h('th', {}, x))),
    st.history.map((e) => h('tr', {}, h('td', {}, e.show), h('td', {}, e.match), h('td', { class: e.won ? 'win' : 'lose' }, e.won ? 'Victoire' : 'Défaite'), h('td', {}, e.stars != null ? `${e.stars}★` : '—'), h('td', {}, `${e.money >= 0 ? '+' : ''}${e.money} $`), h('td', {}, `${e.fans >= 0 ? '+' : ''}${e.fans}`), h('td', {}, e.turns))));
}

export function showSeasonEnd(root, app) {
  const st = app.state;
  clear(root);
  // UNE CARRIÈRE SE RACONTE EN UNE PHRASE. Cet écran affichait un total de
  // fans ; il doit répondre à la seule question qu'on se posait depuis le
  // premier épisode.
  const champion = st.champion === true || st.ending === 'champion';
  const route = st.history.filter((x) => !x.title);
  const victoires = route.filter((x) => x.won).length;
  const terme = titleTerms(rankOf(st));
  root.append(h('div', { class: `setup season-end ${champion ? 'won' : 'lost'}` },
    h('h1', {}, champion ? `🏆 CHAMPION DU MONDE` : '🥈 La ceinture attendra'),
    h('p', {}, champion
      ? `${st.promoName} repart avec le ${SEASON.beltName}. ${championName(SEASON.champion)} a lâché la ceinture au bout de sept matchs de route et d’un main event que la salle n’oubliera pas.`
      : `${championName(SEASON.champion)} garde le ${SEASON.beltName}. Vous êtes arrivé jusqu’au main event — ${rankLabel(rankOf(st)).toLowerCase()}, ${terme.name.toLowerCase()} — et il s’en est fallu de peu, ou de beaucoup.`),
    h('p', { class: 'muted' }, champion
      ? 'Une carrière, huit soirs, une ceinture. La prochaine repart de la salle de bingo : nouveau roster, nouveau deck, nouveau champion à aller chercher.'
      : `La route décide des conditions du soir : ${victoires} victoire${victoires > 1 ? 's' : ''} sur ${route.length} vous ont amené ${rankLabel(rankOf(st)).toLowerCase()}. Six victoires ou plus, et le champion vous doit un match propre.`),
    h('p', { class: 'muted' }, `${st.fans} fans${st.sellout ? ` — la salle est pleine (objectif ${SEASON.finalFansGoal} atteint)` : ''} · ${st.money} $ · ${st.history.filter((x) => x.won).length} victoires / ${st.history.length} matchs`),
    renderHistory(st),
    h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => app.abandonCampaign() }, 'Nouvelle carrière'), h('button', { class: 'btn ghost', onclick: () => app.toTitle() }, 'Menu')),
  ));
}
