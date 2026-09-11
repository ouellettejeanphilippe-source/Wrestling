// Écran titre : nouvelle saison (nom, mode, lutteurs de départ), continuer, exhibition.
import { h, clear, toast } from './dom.js';
import { wrestlerCard } from './cards.js';
import { avatar } from './avatar.js';
import { WRESTLERS, WRESTLERS_BY_ID, STARTER_CHOICES } from '../data/wrestlers.js';
import { MATCH_TYPES } from '../data/matchTypes.js';
import { EXHIBITION_TYPES } from '../data/campaign.js';
import { load } from '../game/state.js';
import { showTutorial } from './tutorial.js';

export function showTitle(root, app) {
  clear(root);
  const saved = load();
  const menu = h('div', { class: 'title-menu' },
    h('button', { class: 'btn primary big', onclick: () => showSetup(root, app) }, '🆕 Nouvelle saison'),
    saved ? h('button', { class: 'btn big', onclick: () => app.continueCampaign() }, `▶ Continuer (${saved.promoName}, épisode ${Math.min(saved.showIndex + 1, 8)})`) : null,
    h('button', { class: 'btn big', onclick: () => showExhibition(root, app) }, '🥊 Match d’exhibition'),
    h('button', { class: 'btn big', onclick: () => showTutorial(root, {}) }, '📖 Comment jouer'),
  );
  root.append(h('div', { class: 'title' },
    h('h1', {}, 'Parodie Pro Wrestling', h('span', {}, 'Tactics')),
    h('p', { class: 'tagline' }, 'Un jeu tactique sur grille à la Fire Emblem × Chroma Squad, avec des parodies de lutteurs, des gimmicks passifs et des tas de façons de gagner (ou de perdre avec panache).'),
    menu,
    parade(),
    h('div', { class: 'title-help' },
      h('h3', {}, 'Comment ça marche'),
      h('ul', {},
        h('li', {}, h('b', {}, 'Gimmick'), ' = passif unique (comme dans LoL). ', h('b', {}, 'Classe'), ' et ', h('b', {}, 'spécialité'), ' donnent des mouvements ; chaque lutteur a en plus un ', h('b', {}, 'signature'), ' (50 momentum) et un ', h('b', {}, 'finisher'), ' (100 momentum).'),
        h('li', {}, 'À 0 PV un lutteur est ', h('b', {}, 'au sol'), ' : c’est le moment de le ', h('b', {}, 'couvrir'), '. Il peut se dégager (kick-out), mais chaque kick-out use son cœur ❤️.'),
        h('li', {}, 'Les coins permettent les plongeons, les cordes étourdissent, les tables se brisent, les marches font mal. Les armes sont illégales… si l’arbitre regarde.'),
        h('li', {}, h('b', {}, 'Mode Kayfabe'), ' : gagnez les matchs, remplissez les directives du Network. ', h('b', {}, 'Mode Scénarios (IRL)'), ' : vous êtes le booker ; réalisez le script (finish imposé + spots), même si ça veut dire faire le job.'),
      ),
    ),
  ));
}

// Défilé d'entrée : une poignée de sprites alignés sur la rampe, comme au générique.
function parade() {
  const cast = WRESTLERS.filter((w) => !w.npc).sort(() => Math.random() - 0.5).slice(0, 10);
  return h('div', { class: 'parade' }, cast.map((d, i) => {
    const a = avatar(d, 56, { view: 'full', bg: 'none', class: 'parade-unit', facing: i % 2 ? -1 : 1 });
    a.style.setProperty('--delay', `${(i % 5) * 0.12}s`);
    return a;
  }));
}

function showSetup(root, app) {
  clear(root);
  const picked = new Set();
  const nameInput = h('input', { type: 'text', value: 'PPW — Parodie Pro Wrestling', maxlength: 40 });
  let mode = 'kayfabe';
  const modeBtns = h('div', { class: 'mode-pick' },
    modeCard('kayfabe', '🎭 Mode Kayfabe', 'L’histoire est vraie : gagnez vos matchs pour gagner des fans et de l’argent. Les directives du Network sont des objectifs bonus.'),
    modeCard('scenario', '🎬 Mode Scénarios (IRL)', 'Vous êtes le booker. Chaque match a un script : un finish imposé (parfois votre lutteur doit perdre !) et des spots à réaliser. Le match est noté en étoiles.'),
  );
  function modeCard(id, title, desc) {
    return h('div', { class: `mode-card ${mode === id ? 'on' : ''}`, 'data-mode': id, onclick: () => { mode = id; modeBtns.querySelectorAll('.mode-card').forEach((c) => c.classList.toggle('on', c.dataset.mode === id)); } }, h('b', {}, title), h('p', {}, desc));
  }
  const counter = h('span', { class: 'muted' }, '0/3 choisis');
  const cards = h('div', { class: 'cards' }, STARTER_CHOICES.map((id) => {
    const def = WRESTLERS_BY_ID[id];
    const card = wrestlerCard(def, { class: 'pickable' });
    card.addEventListener('click', () => {
      if (picked.has(id)) picked.delete(id); else if (picked.size < 3) picked.add(id); else return toast('Maximum 3 lutteurs de départ', 'warn');
      card.classList.toggle('picked', picked.has(id));
      counter.textContent = `${picked.size}/3 choisis`;
    });
    return card;
  }));
  root.append(h('div', { class: 'setup' },
    h('h2', {}, 'Nouvelle saison'),
    h('label', {}, 'Nom de votre promotion ', nameInput),
    h('h3', {}, 'Mode de jeu'), modeBtns,
    h('h3', {}, 'Choisissez 3 lutteurs de départ ', counter),
    cards,
    h('div', { class: 'row' },
      h('button', { class: 'btn ghost', onclick: () => showTitle(root, app) }, '← Retour'),
      h('button', { class: 'btn primary', onclick: () => { if (picked.size !== 3) return toast('Choisissez exactement 3 lutteurs', 'warn'); app.startCampaign({ promoName: nameInput.value.trim() || 'PPW', mode, starters: [...picked] }); } }, 'Lancer la saison →'),
    ),
  ));
}

function showExhibition(root, app) {
  clear(root);
  const typeSel = h('select', {}, EXHIBITION_TYPES.map((t) => h('option', { value: t }, `${MATCH_TYPES[t].icon} ${MATCH_TYPES[t].name}`)));
  const sizeSel = h('select', {}, [1, 2, 3].map((n) => h('option', { value: n, selected: n === 2 }, `${n} contre ${n}`)));
  const desc = h('p', { class: 'muted' }, MATCH_TYPES[typeSel.value].desc);
  typeSel.addEventListener('change', () => { desc.textContent = MATCH_TYPES[typeSel.value].desc; });
  const picked = new Set();
  const list = h('div', { class: 'cards compact' }, WRESTLERS.filter((w) => !w.npc).map((def) => {
    const card = wrestlerCard(def, { class: 'pickable' });
    card.addEventListener('click', () => { if (picked.has(def.id)) picked.delete(def.id); else picked.add(def.id); card.classList.toggle('picked', picked.has(def.id)); });
    return card;
  }));
  root.append(h('div', { class: 'setup' },
    h('h2', {}, 'Match d’exhibition'),
    h('div', { class: 'row' }, h('label', {}, 'Type ', typeSel), h('label', {}, 'Format ', sizeSel)), desc,
    h('h3', {}, 'Votre équipe (cliquez sur les cartes ; les adversaires sont tirés au hasard)'),
    list,
    h('div', { class: 'row' },
      h('button', { class: 'btn ghost', onclick: () => showTitle(root, app) }, '← Retour'),
      h('button', { class: 'btn primary', onclick: () => {
        const n = Number(sizeSel.value);
        if (picked.size !== n) return toast(`Choisissez exactement ${n} lutteur(s)`, 'warn');
        const pool = WRESTLERS.filter((w) => !w.npc && !picked.has(w.id)).map((w) => w.id).sort(() => Math.random() - 0.5);
        const enemies = pool.slice(0, typeSel.value === 'battle_royal' ? n + 1 : n);
        app.startExhibition(typeSel.value, [...picked], enemies);
      } }, 'Ding ding ding →'),
    ),
  ));
}
