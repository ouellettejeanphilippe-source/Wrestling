// Tutoriel et guide de stratégie. Présente des options, jamais une seule bonne façon de jouer.
import { h, clear } from './dom.js';
import { PHASES } from '../engine/phases.js';
import { COMBOS } from '../data/combos.js';
import { MOVE_TIERS } from '../data/moves.js';

const SEEN_KEY = 'ppw-tutorial-seen';
export const tutorialSeen = () => { try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; } };
export const markTutorialSeen = () => { try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ } };

const PAGES = [
  {
    title: 'Un match, trois actes',
    icon: '🎬',
    body: () => [
      h('p', {}, 'Le plateau se joue comme un Fire Emblem : chaque lutteur se déplace une fois, puis agit une fois. Mais un match de lutte n’est pas une bataille, c’est un spectacle. Il se raconte en trois actes, et le jeu suit ce rythme tout seul.'),
      h('div', { class: 'tut-phases' }, Object.values(PHASES).map((p) => h('div', { class: `tut-phase ${p.key}` },
        h('b', {}, `${p.icon} ${p.name}`), h('span', { class: 'tut-tag' }, p.tag), h('p', {}, p.desc)))),
      h('p', { class: 'muted' }, 'La phase est affichée en haut de l’écran pendant le match. Elle change selon le tour, la chaleur de la foule et l’usure des corps, pas selon un minuteur.'),
    ],
  },
  {
    title: 'Le momentum ouvre vos options',
    icon: '⚡',
    body: () => [
      h('p', {}, 'Chaque lutteur a une jauge de momentum de 0 à 100. Elle monte quand vous frappez, quand vous encaissez, quand vous provoquez, et elle ouvre des paliers de mouvements de plus en plus forts.'),
      h('table', { class: 'tut-table' },
        h('tr', {}, ['Palier', 'Ouvert à', 'Coût'].map((x) => h('th', {}, x))),
        [['Base : coup de poing, prise, Irish Whip, provoquer', 'base'], ['Mouvements de classe', 'class'], ['Mouvements de spécialité', 'specialty'], ['Signature', 'signature'], ['Finisher', 'finisher']]
          .map(([label, key]) => h('tr', {}, h('td', {}, label), h('td', {}, MOVE_TIERS[key].unlock ? `⚡ ${MOVE_TIERS[key].unlock}` : '—'), h('td', {}, MOVE_TIERS[key].cost ? `-${MOVE_TIERS[key].cost}` : 'gratuit')))),
      h('p', {}, 'Les paliers donnent l’', h('b', {}, 'accès'), ' ; seuls le signature et le finisher ', h('b', {}, 'consomment'), ' la jauge. Provoquer est toujours gratuit et rapporte 30 : c’est un vrai choix tactique quand vous êtes à 80.'),
    ],
  },
  {
    title: 'Ne restez pas planté',
    icon: '🏃',
    body: () => [
      h('p', {}, 'Le déplacement et l’attaque ne sont pas deux choses séparées : ', h('b', {}, 'le coup que vous portez vaut ce que vaut la course qui le précède'), '. Un lutteur immobile qui frappe son voisin n’a aucun poids.'),
      h('table', { class: 'tut-table' },
        h('tr', {}, ['Distance parcourue avant de frapper', 'Dégâts'].map((x) => h('th', {}, x))),
        [['Aucune — vous n’avez pas bougé', '−15 %'], ['1 case', '−5 %'], ['2 cases', '+5 %'],
         ['3 cases', '+15 %'], ['4 cases ou plus', '+25 %']]
          .map(([d, v]) => h('tr', {}, h('td', {}, d), h('td', {}, v)))),
      h('p', {}, 'Ça vaut pour les frappes, les aériens, les prises et les armes — pas pour les soumissions, qui s’appliquent au sol, ni pour les provocations.'),
      h('p', {}, 'Se replacer rapporte aussi un peu de momentum, et ', h('b', {}, 'le chemin compte autant que la destination'), ' : passer dans les cordes en courant, ou arriver dans le dos plutôt que de face, déclenche ses propres combos.'),
      h('p', { class: 'muted' }, 'Même au corps à corps il reste presque toujours une case voisine où se replacer : le malus se contourne, mais il interdit de ne jamais bouger.'),
    ],
  },
  {
    title: 'Les combos récompensent la mise en place',
    icon: '🔗',
    body: () => [
      h('p', {}, 'Frapper au hasard fonctionne mal. Certains enchaînements se déclenchent tout seuls quand les conditions sont réunies, et ajoutent dégâts, momentum et chaleur. Ils sont annoncés dans le journal du match.'),
      h('div', { class: 'tut-combos' }, COMBOS.map((c) => h('div', { class: 'tut-combo' },
        h('b', {}, `${c.icon} ${c.name}`), h('span', { class: 'tut-hint' }, c.hint), h('p', {}, c.desc)))),
      h('p', { class: 'muted' }, 'Aucun de ces combos n’est obligatoire. Ils décrivent simplement ce que le jeu récompense : varier ses coups, préparer ses gros mouvements, et utiliser le décor.'),
    ],
  },
  {
    title: 'Plusieurs façons de gagner',
    icon: '🏆',
    body: () => [
      h('p', {}, 'Presque aucun match ne se gagne d’une seule manière. Pendant le match, le panneau ', h('b', {}, '« Comment gagner »'), ' liste en permanence les routes ouvertes et leur état.'),
      h('ul', { class: 'tut-routes' },
        h('li', {}, h('b', {}, '🤝 Tombé'), ' — mettez l’adversaire au sol puis couvrez. Il peut se dégager, mais chaque kick-out lui coûte un cœur.'),
        h('li', {}, h('b', {}, '🛑 Arrêt de l’arbitre'), ' — un adversaire sans cœur qui retombe ne se relève plus. L’usure est une stratégie complète.'),
        h('li', {}, h('b', {}, '🔗 Soumission'), ' — seulement sur un adversaire déjà usé, et jamais près des cordes quand il y a un arbitre.'),
        h('li', {}, h('b', {}, '⏱️ Compte à l’extérieur'), ' — laissez-le dehors et tenez-le à distance.'),
        h('li', {}, h('b', {}, '🚨 Disqualification'), ' — les armes et les coups bas sont illégaux… si l’arbitre regarde.'),
        h('li', {}, h('b', {}, '👑 Par-dessus la corde, 🪜 échelle, 🧗 cage, ⏳ survie'), ' — selon le type de match.'),
      ),
      h('p', { class: 'muted' }, 'Un lutteur lent et costaud gagnera plus souvent par usure et par arrêt de l’arbitre ; un voltigeur ira chercher un plongeon et un tombé rapide ; un technicien visera la soumission. Aucune de ces routes n’est la bonne : elles dépendent de votre roster et du match.'),
    ],
  },
  {
    title: 'Trois approches parmi d’autres',
    icon: '🧭',
    body: () => [
      h('p', {}, 'Voici trois manières de traverser les trois actes. Elles ne sont ni exhaustives ni exclusives : mélangez-les selon vos lutteurs et le type de match.'),
      h('div', { class: 'tut-plans' },
        h('div', { class: 'tut-plan' }, h('b', {}, '💪 Le rouleau compresseur'),
          h('p', {}, 'Ouverture : chops et prises pour empiler les marques. Milieu : Irish Whip dans les marches ou une table, contrôle du centre. Fin : finisher puis tombé, ou arrêt de l’arbitre si son cœur est vide.')),
        h('div', { class: 'tut-plan' }, h('b', {}, '🦅 Le voltigeur'),
          h('p', {}, 'Ouverture : provoquez et gardez vos distances, la jauge monte vite. Milieu : montez dans un coin dès que la cible s’approche. Fin : plongeon depuis le coin, la foule explose, puis couvrez.')),
        h('div', { class: 'tut-plan' }, h('b', {}, '🧠 Le technicien'),
          h('p', {}, 'Ouverture : alternez frappe et prise pour l’enchaînement. Milieu : soumissions à répétition loin des cordes, son cœur s’use. Fin : une dernière clé, ou un finisher si la jauge est pleine.')),
      ),
      h('p', {}, 'Deux réflexes utiles quel que soit le plan : ', h('b', {}, 'variez vos familles de coups'), ' (frappe, prise, aérien) et ', h('b', {}, 'regardez la phase'), ' avant de dépenser un finisher.'),
    ],
  },
];

export function showTutorial(root, { onClose, startPage = 0 } = {}) {
  let page = startPage;
  const overlay = h('div', { class: 'overlay tut-overlay' });
  const box = h('div', { class: 'tut' });
  overlay.append(box);
  const render = () => {
    clear(box);
    const p = PAGES[page];
    box.append(
      h('div', { class: 'tut-head' }, h('h2', {}, `${p.icon} ${p.title}`), h('span', { class: 'muted' }, `${page + 1} / ${PAGES.length}`)),
      h('div', { class: 'tut-body' }, p.body()),
      h('div', { class: 'tut-nav' },
        h('button', { class: 'btn ghost', disabled: page === 0, onclick: () => { page--; render(); } }, '← Précédent'),
        h('div', { class: 'tut-dots' }, PAGES.map((_, i) => h('span', { class: `dot ${i === page ? 'on' : ''}`, onclick: () => { page = i; render(); } }))),
        page < PAGES.length - 1
          ? h('button', { class: 'btn primary', onclick: () => { page++; render(); } }, 'Suivant →')
          : h('button', { class: 'btn primary', onclick: close }, 'C’est parti !'),
      ),
      h('button', { class: 'tut-close', onclick: close, title: 'Fermer' }, '✖'),
    );
  };
  function close() { markTutorialSeen(); overlay.remove(); if (onClose) onClose(); }
  render();
  root.append(overlay);
  return overlay;
}
