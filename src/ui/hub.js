// Hub de promotion : carte du show, roster/entraînement, agents libres, historique, fin de saison.
import { h, clear, toast } from './dom.js';
import { wrestlerCard, chip } from './cards.js';
import { WRESTLERS_BY_ID } from '../data/wrestlers.js';
import { MATCH_TYPES } from '../data/matchTypes.js';
import { DIRECTIVES } from '../data/directives.js';
import { SEASON } from '../data/campaign.js';
import { CLASSES, SPECIALTIES } from '../data/classes.js';
import { currentShow, showMatches, train, trainCost, recruit, TRAINABLE, MAX_TRAIN } from '../game/state.js';
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
  const box = h('div', {});
  box.append(h('h2', {}, show.title), h('p', { class: 'intro' }, show.intro));
  box.append(h('p', { class: 'muted' }, st.mode === 'scenario' ? 'Choisissez un match à booker. Le script indique le finish imposé et les spots à réaliser ; la note en étoiles décide du cachet et du public. Le show continue quoi qu’il arrive — mais un finish non respecté est un « shoot », et ça se paie.' : 'Choisissez un match à booker. Les directives du Network sont des bonus si vous gagnez. Une défaite ne bloque pas la saison : elle vous coûte une partie de la salle.'));
  const list = h('div', { class: 'matches' });
  for (const m of showMatches(st)) list.append(matchCard(m, st, app, root));
  box.append(list);
  return box;
}

function matchCard(m, st, app, root) {
  const rules = MATCH_TYPES[m.type];
  const opp = m.enemies.map((e) => WRESTLERS_BY_ID[typeof e === 'string' ? e : e.id]);
  const card = h('div', { class: 'mcard' },
    h('h3', {}, `${rules.icon} ${m.title}`, h('span', { class: 'muted' }, ` — ${rules.name}, ${m.teamSize} de vos lutteurs`)),
    m.termsLabel ? h('p', { class: `terms-line terms-${m.terms}` }, m.termsLabel) : null,
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
    h('button', { class: 'btn primary', onclick: () => { if (picked.size !== m.teamSize) return toast(`Choisissez exactement ${m.teamSize} lutteur(s)`, 'warn'); app.bookMatch(m, [...picked]); } }, '🔔 Booker ce match'));
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
