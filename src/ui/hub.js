// Hub de promotion : carte du show, roster/entraînement, agents libres, historique, fin de saison.
import { h, clear, toast } from './dom.js';
import { wrestlerCard, chip } from './cards.js';
import { WRESTLERS_BY_ID } from '../data/wrestlers.js';
import { MATCH_TYPES } from '../data/matchTypes.js';
import { DIRECTIVES } from '../data/directives.js';
import { SEASON } from '../data/campaign.js';
import { CLASSES, SPECIALTIES } from '../data/classes.js';
import { currentShow, train, trainCost, recruit, TRAINABLE, MAX_TRAIN } from '../game/state.js';
import { describeFinish } from '../game/script.js';

export function showHub(root, app, tab = 'show') {
  const st = app.state;
  clear(root);
  const show = currentShow(st);
  const header = h('header', { class: 'hub-head' },
    h('div', {}, h('h1', {}, st.promoName), h('div', { class: 'muted' }, `${st.mode === 'scenario' ? '🎬 Mode Scénarios (IRL)' : '🎭 Mode Kayfabe'} · ${SEASON.name} · Épisode ${st.showIndex + 1}/${SEASON.shows.length}`)),
    h('div', { class: 'hub-stats' }, h('span', {}, `💰 ${st.money} $`), h('span', {}, `👥 ${st.fans} fans`), h('span', { class: 'muted' }, `Objectif PPV : ${SEASON.finalFansGoal} fans`)),
  );
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
  box.append(h('p', { class: 'muted' }, st.mode === 'scenario' ? 'Choisissez un match à booker. Le script indique le finish imposé et les spots à réaliser ; la note en étoiles décide des récompenses (2,5★ minimum pour valider l’épisode).' : 'Choisissez un match à booker. Les directives du Network sont des bonus si vous gagnez.'));
  const list = h('div', { class: 'matches' });
  for (const m of show.matches) list.append(matchCard(m, st, app, root));
  box.append(list);
  return box;
}

function matchCard(m, st, app, root) {
  const rules = MATCH_TYPES[m.type];
  const opp = m.enemies.map((e) => WRESTLERS_BY_ID[typeof e === 'string' ? e : e.id]);
  const card = h('div', { class: 'mcard' },
    h('h3', {}, `${rules.icon} ${m.title}`, h('span', { class: 'muted' }, ` — ${rules.name}, ${m.teamSize} de vos lutteurs`)),
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
  const good = st.ending === 'good';
  root.append(h('div', { class: 'setup season-end' },
    h('h1', {}, good ? '🏆 Fin de saison : succès total' : '📺 Fin de saison'),
    h('p', {}, good
      ? `${st.promoName} termine la saison avec ${st.fans} fans. Le Network signe un contrat de cinq ans, le buffet est enfin chaud, et quelqu’un a même acheté un vrai ring.`
      : `${st.promoName} termine la saison avec ${st.fans} fans (objectif : ${SEASON.finalFansGoal}). Le Network renouvelle pour six épisodes, à condition de trouver une meilleure salle que le bingo.`),
    h('p', { class: 'muted' }, `Argent final : ${st.money} $ · Matchs : ${st.history.filter((x) => x.won).length} victoires / ${st.history.length}`),
    renderHistory(st),
    h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => app.abandonCampaign() }, 'Nouvelle saison'), h('button', { class: 'btn ghost', onclick: () => app.toTitle() }, 'Menu')),
  ));
}
