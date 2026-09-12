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
      h('p', {}, h('b', {}, 'Certains mouvements n’existent pas à l’arrêt.'), ' Coude en course, épaule, genou sauté, lariat lancé : ils demandent d’avoir couru un nombre de cases ce tour-ci. Ce n’est pas un bonus, c’est un interrupteur — et tout le monde en a dans son kit de base.'),
      h('p', {}, h('b', {}, 'Les cordes sont un tremplin, pas un mur.'), ' On ne les escalade pas, on rebondit dessus : y entrer coûte 1, en repartir est gratuit. Passer par les cordes fait aller ', h('b', {}, 'plus loin'), ' qu’aller tout droit — donc plus d’élan, et le combo 💨 Course dans les cordes en prime. Le coin, lui, coûte 2 : on y ', h('b', {}, 'monte'), ', et la hauteur fait mal en plongeon.'),
      h('p', {}, h('b', {}, 'Et ça s’aggrave.'), ' Un tour sur place est un choix. Trois d’affilée, c’est un match qui s’enlise : le plancher des dégâts s’enfonce encore, ', h('b', {}, 'et la foule décroche'), ' — dans le catch, le prix d’un match statique, c’est le public. Une seule case remet le compteur à zéro.'),
    ],
  },
  {
    title: 'Ce que le coup fait à la grille',
    icon: '💥',
    body: () => [
      h('p', {}, 'Tous les mouvements ne touchent pas qu’une personne. Trois effets font du placement une question ', h('b', {}, 'défensive'), ' autant qu’offensive : rester aligné ou agglutiné coûte cher.'),
      h('table', { class: 'tut-table' },
        h('tr', {}, ['Effet', 'Ce qu’il fait', 'Exemples'].map((x) => h('th', {}, x))),
        [['➡️ Ligne', 'Le coup continue tout droit derrière la cible', 'Clothesline, Spear, Buckshot Lariat'],
         ['💥 Zone', 'Les voisins de la cible prennent une part des dégâts', 'Running Senton, Frog Splash, Suicide Dive'],
         ['↗️ Recul', 'La cible est projetée — cordes, coin, table', 'Chokeslam, Poing K.-O., Big Boot']]
          .map(([a, b2, c]) => h('tr', {}, h('td', {}, a), h('td', {}, b2), h('td', {}, c)))),
      h('p', {}, 'La zone ne fait pas le tri : ', h('b', {}, 'un partenaire collé à la cible déguste aussi'), '. La prévision de combat vous le dit avant que vous confirmiez.'),
      h('p', { class: 'muted' }, 'Le recul se combine avec le décor : projeter vers un coin, des marches ou une table fait bien plus mal que les dégâts affichés.'),
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
    title: 'Le cœur décide du tombé',
    icon: '❤️',
    body: () => [
      h('p', {}, 'À 0 PV un lutteur tombe. Ce n’est pas la fin : il se relève avec ', h('b', {}, '55 % de ses PV'), ' et un ', h('b', {}, 'cœur ❤️ en moins'), '. Un match, c’est cette boucle répétée jusqu’à ce que le cœur soit vide.'),
      h('p', {}, 'Le cœur est le ', h('b', {}, 'plafond'), ' du tombé, pas un bonus parmi d’autres. C’est la règle du catch : « il s’est dégagé du finisher ! ». Tant qu’il en reste, rien ne passe.'),
      h('table', { class: 'tut-table' },
        h('tr', {}, ['Cœur restant', 'Tombé au maximum'].map((x) => h('th', {}, x))),
        [['Plein', '15 %'], ['Trois quarts', '35 %'], ['Moitié', '55 %'], ['Un quart', '75 %'], ['Vide', '95 %']]
          .map(([a, v]) => h('tr', {}, h('td', {}, a), h('td', {}, v)))),
      h('p', {}, 'Vos deux premières couvertures sont donc des ', h('b', {}, 'faux départs'), ' — c’est voulu. Ce qui use le cœur, c’est de le remettre au sol, encore et encore. Couvrir quelqu’un ', h('b', {}, 'debout'), ' n’est pas un tombé : c’est un roll-up désespéré, plafonné à 15 %.'),
      h('p', { class: 'muted' }, 'Le cœur descend aussi à chaque kick-out. Un adversaire qui refuse de perdre se vide plus vite.'),
    ],
  },
  {
    title: 'L’arbitre a une tolérance',
    icon: '🦓',
    body: () => [
      h('p', {}, 'En catch, ce n’est presque jamais une disqualification du premier coup. L’arbitre ', h('b', {}, 'voit, avertit, compte'), ' — et il finit par en avoir assez. Sa tolérance ', h('b', {}, 'change d’un match à l’autre'), '.'),
      h('table', { class: 'tut-table' },
        h('tr', {}, ['Arbitre', 'Il remarque', 'Il pardonne'].map((x) => h('th', {}, x))),
        [['Pointilleux', 'beaucoup', '2 avertissements'], ['À l’ancienne', 'normalement', '3 avertissements'], ['Complaisant', 'peu', '5 avertissements']]
          .map(([a, o, pa]) => h('tr', {}, h('td', {}, a), h('td', {}, o), h('td', {}, pa)))),
      h('p', {}, 'Son état est affiché en haut de l’écran et dans la prévision : ', h('b', {}, 'on ne triche pas sans savoir combien il en reste'), '. Un arbitre distrait ne voit rien — et n’use donc pas sa patience.'),
      h('p', { class: 'muted' }, 'Les coups bas, les armes et le fait d’entrer dans le ring sans être légal passent tous par lui. Avec un arbitre complaisant, une carrière de tricheur est jouable.'),
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
