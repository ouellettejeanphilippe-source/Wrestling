// Écran titre : nouvelle saison (nom, mode, lutteurs de départ), continuer, exhibition.
import { h, clear, toast } from './dom.js';
import { rosterPicker } from './cards.js';
import { avatar } from './avatar.js';
import { WRESTLERS, WRESTLERS_BY_ID, STARTER_CHOICES } from '../data/wrestlers.js';
import { MATCH_TYPES } from '../data/matchTypes.js';
import { EXHIBITION_TYPES } from '../data/campaign.js';
import { load } from '../game/state.js';
import { MANAGER_LIST, MANAGERS } from '../data/managers.js';
import { loadRivalries, rivalryFor } from '../game/rivalry.js';
import { showTutorial } from './tutorial.js';
import { EVENT as INSTALLABLE, canInstall, promptInstall, isInstalled, needsIosHint } from '../pwa.js';

// Bouton d'installation : présent seulement quand le navigateur a vraiment de
// quoi installer. Sur iOS il n'y a pas d'événement — l'installation passe par
// le menu de partage — donc on donne la marche à suivre au lieu d'un bouton
// qui ne ferait rien.
function installButton() {
  if (isInstalled()) return null;
  if (needsIosHint()) {
    return h('p', { class: 'install-hint' }, 'Sur iPhone : bouton Partager, puis « Sur l’écran d’accueil » — le jeu s’installe et marche hors ligne.');
  }
  const btn = h('button', {
    class: 'btn big install',
    onclick: async () => { if (await promptInstall()) toast('Installé — le jeu marche maintenant hors ligne', 'good'); },
  }, '📲 Installer le jeu');
  // L'événement peut arriver avant comme après ce rendu : on lit l'état
  // maintenant, et on se réabonne pour la suite.
  btn.hidden = !canInstall();
  const sync = () => {
    if (!btn.isConnected) return window.removeEventListener(INSTALLABLE, sync);
    btn.hidden = !canInstall();
  };
  window.addEventListener(INSTALLABLE, sync);
  return btn;
}

export function showTitle(root, app) {
  clear(root);
  const saved = load();
  const menu = h('div', { class: 'title-menu' },
    h('button', { class: 'btn primary big', onclick: () => showSetup(root, app) }, '🆕 Nouvelle saison'),
    saved ? h('button', { class: 'btn big', onclick: () => app.continueCampaign() }, `▶ Continuer (${saved.promoName}, épisode ${Math.min(saved.showIndex + 1, 8)})`) : null,
    h('button', { class: 'btn big', onclick: () => showExhibition(root, app) }, '🥊 Match d’exhibition'),
    h('button', { class: 'btn big', onclick: () => showTutorial(root, {}) }, '📖 Comment jouer'),
    installButton(),
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
  const cards = rosterPicker(STARTER_CHOICES.map((id) => WRESTLERS_BY_ID[id]), {
    max: 3, picked,
    onChange: (ids) => { picked.clear(); ids.forEach((i) => picked.add(i)); counter.textContent = `${picked.size}/3 choisis`; },
    onFull: () => toast('Maximum 3 lutteurs de départ', 'warn'),
  });
  root.append(h('div', { class: 'setup' },
    h('h2', {}, 'Nouvelle saison'),
    h('label', {}, 'Nom de votre promotion ', nameInput),
    h('h3', {}, 'Mode de jeu'), modeBtns,
    h('h3', {}, 'Choisissez 3 lutteurs de départ ', counter),
    h('p', { class: 'muted hint' }, 'Appuyez sur un portrait pour lire sa fiche, une seconde fois pour l’ajouter.'),
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
  const sizeSel = h('select', {}, [1, 2, 3].map((n) => h('option', { value: n, selected: n === 1 }, `${n} contre ${n}`)));
  const desc = h('p', { class: 'muted' }, MATCH_TYPES[typeSel.value].desc);
  const roster = WRESTLERS.filter((w) => !w.npc);
  const mine = new Set(), theirs = new Set();

  // LE MANAGER. Deux interventions pour tout le match, et le choix se fait
  // AVANT : savoir que l'autre a Jimmy Lacravate change la façon de se placer
  // près des cordes pendant trente tours.
  const mgrSel = (label) => h('select', {}, [h('option', { value: '' }, '— aucun —'),
    ...MANAGER_LIST.map((m) => h('option', { value: m.id }, `${m.icon} ${m.name} — ${m.nick}`))]);
  const myMgr = mgrSel(), foeMgr = mgrSel();
  const mgrNote = h('p', { class: 'muted small mgr-note' });
  const paintMgr = () => {
    const a = MANAGERS[myMgr.value], b = MANAGERS[foeMgr.value];
    mgrNote.replaceChildren(...[a && h('span', {}, `${a.icon} ${a.desc} `), b && h('span', { class: 'foe' }, `· En face : ${b.icon} ${b.desc}`)].filter(Boolean));
  };
  myMgr.addEventListener('change', paintMgr);
  foeMgr.addEventListener('change', paintMgr);

  // LA RIVALITÉ. Elle ne se voit qu'en un contre un, parce qu'elle se compte
  // entre deux noms. Elle s'affiche avant le coup d'envoi : le joueur doit
  // savoir qu'il entre dans une belle, pas dans un premier match.
  const rivNote = h('div', { class: 'riv-note' });
  const paintRiv = () => {
    clear(rivNote);
    const a = [...mine][0], b = [...theirs][0];
    if (Number(sizeSel.value) !== 1 || !a || !b) return;
    const noms = Object.fromEntries(roster.map((w) => [w.id, w.name]));
    const r = rivalryFor(loadRivalries(), a, b, noms);
    rivNote.append(h('div', { class: `riv ${r.meetings ? 'on' : ''}` },
      h('b', {}, r.meetings ? '📖 Leur histoire' : '📖 Première fois'),
      h('span', {}, ' ', r.note),
      r.meetings ? h('span', { class: 'muted' }, ` (+${r.heat} de chaleur au coup d’envoi${r.revenge ? `, revanche pour ${noms[r.revenge]}` : ''})`) : null));
  };

  // UNE BATAILLE ROYALE, ÇA SE JOUE À PLUSIEURS. À un contre deux, elle durait
  // treize tours : le joueur se faisait encercler et sortir avant que le match
  // ait commencé. Le ring a six places par camp ; on en remplit cinq.
  // Une bataille royale à un contre deux durait quatorze tours pour douze
  // coups, et le joueur ne gagnait jamais : encerclé, sorti, terminé. À trois
  // contre quatre, elle dure vingt tours, encaisse quarante coups et se joue
  // vraiment. Le format est donc IMPOSÉ — ce n'est pas une préférence, c'est
  // ce qui fait que la stipulation existe.
  const BATTLE_ROYAL_SIZE = 3;
  const battleRoyalFoes = (type, n) => (type === 'battle_royal' ? n + 1 : n);
  const tailleVoulue = () => (typeSel.value === 'battle_royal' ? BATTLE_ROYAL_SIZE : Number(sizeSel.value));
  const counter = h('span', { class: 'muted' }, '0 choisi');
  const foeCounter = h('span', { class: 'muted' }, '0 choisi');
  const updateCounters = () => {
    const n = tailleVoulue();
    const foes = battleRoyalFoes(typeSel.value, n);
    // Le sélecteur de format n'a pas son mot à dire en bataille royale : le
    // format EST la stipulation.
    sizeSel.disabled = typeSel.value === 'battle_royal';
    sizeSel.title = sizeSel.disabled ? `Une bataille royale se joue à ${BATTLE_ROYAL_SIZE} contre ${BATTLE_ROYAL_SIZE + 1}` : '';
    counter.textContent = `${mine.size}/${n} choisi${mine.size > 1 ? 's' : ''}`;
    counter.classList.toggle('ok', mine.size === n);
    foeCounter.textContent = `${theirs.size}/${foes} choisi${theirs.size > 1 ? 's' : ''}`;
    foeCounter.classList.toggle('ok', theirs.size === foes);
    paintRiv();
  };

  const myList = rosterPicker(roster, { picked: mine, onChange: (ids) => { mine.clear(); ids.forEach((i) => mine.add(i)); updateCounters(); } });
  const foeList = rosterPicker(roster, { picked: theirs, onChange: (ids) => { theirs.clear(); ids.forEach((i) => theirs.add(i)); updateCounters(); } });

  typeSel.addEventListener('change', () => { desc.textContent = MATCH_TYPES[typeSel.value].desc; updateCounters(); });
  sizeSel.addEventListener('change', updateCounters);
  updateCounters();
  paintMgr();

  // L'adversaire se choisit, mais on ne force personne : le bouton « au
  // hasard » reste, parce qu'un tirage est parfois exactement ce qu'on veut.
  const hasard = h('button', { class: 'btn ghost small', onclick: () => {
    const n = tailleVoulue();
    const foes = battleRoyalFoes(typeSel.value, n);
    const pool = roster.filter((w) => !mine.has(w.id)).map((w) => w.id).sort(() => Math.random() - 0.5).slice(0, foes);
    foeList.setPicked(pool);
  } }, '🎲 Adversaires au hasard');

  root.append(h('div', { class: 'setup' },
    h('h2', {}, 'Match d’exhibition'),
    h('div', { class: 'row' }, h('label', {}, 'Type ', typeSel), h('label', {}, 'Format ', sizeSel)), desc,
    h('div', { class: 'row' }, h('label', {}, 'Votre manager ', myMgr), h('label', {}, 'Manager adverse ', foeMgr)), mgrNote,
    h('h3', {}, 'Votre équipe ', counter),
    h('p', { class: 'muted hint' }, 'Appuyez sur un portrait pour lire sa fiche, une seconde fois pour l’ajouter.'),
    myList,
    h('h3', {}, 'Les adversaires ', foeCounter, ' ', hasard),
    foeList,
    rivNote,
    h('div', { class: 'row' },
      h('button', { class: 'btn ghost', onclick: () => showTitle(root, app) }, '← Retour'),
      h('button', { class: 'btn primary', onclick: () => {
        const n = Number(sizeSel.value);
        const foes = battleRoyalFoes(typeSel.value, n);
        if (mine.size !== n) return toast(`Choisissez exactement ${n} lutteur(s)`, 'warn');
        if (theirs.size !== foes) return toast(`Choisissez ${foes} adversaire(s)`, 'warn');
        app.startExhibition(typeSel.value, [...mine], [...theirs], { managers: { player: myMgr.value || null, enemy: foeMgr.value || null } });
      } }, 'Ding ding ding →'),
    ),
  ));
}
