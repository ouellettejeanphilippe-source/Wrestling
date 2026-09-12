// Tutoriel et guide de stratégie. Présente des options, jamais une seule bonne façon de jouer.
import { h, clear } from './dom.js';
import { PHASES } from '../engine/phases.js';
import { COMBOS } from '../data/combos.js';
import { MOVE_TIERS } from '../data/moves.js';
import { MANAGER_LIST } from '../data/managers.js';
import { HAND_SIZE } from '../engine/hand.js';

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
    title: 'Deux jauges opposées',
    icon: '😮‍💨',
    body: () => [
      h('p', {}, 'Le ', h('b', {}, 'momentum ⚡'), ' monte et ouvre des portes. Le ', h('b', {}, 'souffle 😮‍💨'), ' descend et les referme. Un match se joue entre les deux.'),
      h('table', { class: 'tut-table' },
        h('tr', {}, ['', 'Momentum ⚡', 'Souffle 😮‍💨'].map((x) => h('th', {}, x))),
        [['Sens', 'monte quand vous frappez', 'descend quand vous frappez'],
         ['Rôle', 'ouvre les paliers', 'les referme sous 25'],
         ['Coût d’un coup', 'signature et finisher', 'de 4 à 22 selon le palier'],
         ['Se refait', 'en frappant, en provoquant', '+5 par tour, +14 si vous avez soufflé']]
          .map(([a, m, st]) => h('tr', {}, h('td', {}, a), h('td', {}, m), h('td', {}, st)))),
      h('p', {}, 'À bout de souffle : ', h('b', {}, '−25 % de dégâts, −10 de précision, et plus de signature ni de finisher'), '. C’est la prise de repos du catch — on ne peut pas enchaîner les gros coups, il faut reprendre son air. Et l’adversaire voit votre jauge.'),
      h('p', { class: 'muted' }, 'Attendre et provoquer font souffler. Courir coûte un point par case.'),
    ],
  },
  {
    title: 'Le renversement',
    icon: '🔄',
    body: () => [
      h('p', {}, h('b', {}, '« Il l’a renversé ! »'), ' Un gros mouvement lancé sur un adversaire encore frais peut se retourner contre son auteur : l’attaque échoue, et c’est ', h('b', {}, 'vous'), ' qui encaissez.'),
      h('table', { class: 'tut-table' },
        h('tr', {}, ['Palier', 'Risque de base'].map((x) => h('th', {}, x))),
        [['Base', '2 %'], ['Classe', '5 %'], ['Spécialité', '7 %'], ['Signature', '11 %'], ['Finisher', '15 %']]
          .map(([a, v]) => h('tr', {}, h('td', {}, a), h('td', {}, v)))),
      h('p', {}, 'Trois choses le rendent probable, et ce sont trois décisions : la ', h('b', {}, 'vitesse et la technique'), ' du défenseur ; le ', h('b', {}, 'souffle'), ' — frapper sans appui se paie ; et la ', h('b', {}, 'taille du mouvement'), ', parce qu’un gros coup est lent.'),
      h('p', {}, 'Une cible ', h('b', {}, 'au sol ou étourdie'), ' ne renverse rien. C’est pour ça qu’on étourdit AVANT de lancer son finisher.'),
      h('p', { class: 'muted' }, 'Le risque est affiché dans la prévision de combat. Lancer son finisher trop tôt est un pari, pas une formalité.'),
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
    title: 'Vous ne choisissez pas, vous piochez',
    icon: '🃏',
    body: () => [
      h('p', {}, 'Un lutteur connaît une vingtaine de mouvements, mais il n’en a que ', h('b', {}, `${HAND_SIZE} en main`), ' à chaque tour. On ne choisit plus « le meilleur coup » — on joue ce qu’on a, et c’est ce qui force à s’adapter.'),
      h('table', { class: 'tut-table' },
        h('tr', {}, ['Ce qui se pioche', 'Ce qui ne se pioche jamais'].map((x) => h('th', {}, x))),
        h('tr', {},
          h('td', {}, 'Tout le reste : mouvements de classe, de spécialité, de course, des cordes, d’usure.'),
          h('td', {}, h('b', {}, 'Les fondamentaux'), ' — coup de poing, prise, Irish Whip, provoquer — sont toujours là. Et la ', h('b', {}, 'signature'), ' et le ', h('b', {}, 'finisher'), ' ne se tirent pas au sort : c’est le momentum qui les ouvre.'))),
      h('p', {}, h('b', {}, 'Ce que vous ne jouez pas, vous le gardez.'), ' C’est la règle qui compte : tenir son Lariat lancé pendant trois tours en cherchant ses quatre cases de course, c’est du catch. Une main rebattue à chaque tour, ce serait du hasard.'),
      h('p', {}, 'Les cartes, le déplacement et l’histoire sont ', h('b', {}, 'la même affaire'), ' : une carte qui réclame de la course EST la raison de traverser le ring, et le coup qui en sort EST le moment qu’on racontera à la fin. Survolez une carte : les cases qui la débloquent ', h('b', {}, 's’allument sur le plateau'), '.'),
      h('p', { class: 'muted' }, 'Rien qui passe ? ', h('b', {}, '🔄 Jeter la main et repiocher'), ' : ça coûte le tour, mais ça rend du souffle comme une provocation. Le talon se reconstitue tout seul avec la défausse — on ne tombe jamais à court de son propre répertoire.'),
    ],
  },
  {
    title: 'Choisissez un membre, et tenez-vous-y',
    icon: '🦴',
    body: () => [
      h('p', {}, 'C’est la seule stratégie ', h('b', {}, 'longue'), ' du jeu, et celle qui transforme un match de trente tours en histoire : ', h('b', {}, 'travaillez une partie du corps'), '. Chaque coup marque la tête, les bras, les côtes ou la jambe. Deux seuils : ', h('b', {}, 'touchée'), ' à 45, ', h('b', {}, 'hors service'), ' à 85.'),
      h('table', { class: 'tut-table' },
        h('tr', {}, ['Membre', 'Touchée', 'Hors service'].map((x) => h('th', {}, x))),
        [['🦵 Jambe', '-2 AGI', '-4 AGI, -1 MOV, plus aucun mouvement aérien ni escalade, et il ne se relève plus qu’à 38 %'],
         ['💪 Bras', '-2 FOR', '-4 FOR, les prises accrochent mal, plus de renversement'],
         ['🫁 Côtes', '-1 DEF, souffle ×0,6', '-3 DEF, souffle ×0,3 : il ne reprend plus son air'],
         ['🤕 Tête', '-1 TEC, -1 DEF', '-3 TEC, -2 DEF, et il se fait compter plus facilement']]
          .map((r) => h('tr', {}, r.map((c) => h('td', {}, c))))),
      h('p', {}, h('b', {}, 'Le paiement, c’est la soumission.'), ' Une clé de jambe sur une jambe fraîche ne fait rien. La même après dix tours de travail finit le match — la chance d’abandon dépend d’abord de l’usure du membre visé, ensuite des PV, et le cœur ❤️ la plafonne comme pour le tombé.'),
      h('p', { class: 'muted' }, 'Un coup qui ', h('b', {}, 'vise'), ' le membre l’use quatre fois plus qu’un coup qui l’atteint au passage. Tout le monde a « Coup dans le genou » et « Clé de poignet » dans son kit de base : ce n’est pas réservé aux spécialistes. La prévision affiche toujours le membre visé et son état avant/après.'),
    ],
  },
  {
    title: 'Quelqu’un au bord du ring',
    icon: '🎩',
    body: () => [
      h('p', {}, 'Un manager n’est pas un lutteur de plus : c’est une ', h('b', {}, 'menace permanente qui ne se joue que deux fois'), '. Son intervention coûte le tour de votre lutteur — elle ne s’ajoute pas à votre action, elle la remplace.'),
      h('div', { class: 'tut-plans' }, MANAGER_LIST.map((m) => h('div', { class: 'tut-plan' },
        h('b', {}, `${m.icon} ${m.name}`), h('p', {}, m.desc)))),
      h('p', {}, 'Deux d’entre eux sont ', h('b', {}, 'illégaux'), ' : l’arbitre peut les voir, et ils usent la même tolérance que vos propres coups bas. Rien n’interdit d’envoyer Bobby occuper l’arbitre d’abord.'),
      h('p', { class: 'muted' }, 'Personne n’intervient avant le tour 4 : au son de la cloche, l’arbitre regarde les deux lutteurs et il n’y a encore rien à sauver.'),
    ],
  },
  {
    title: 'Ils se souviennent',
    icon: '📖',
    body: () => [
      h('p', {}, 'En exhibition un contre un, le résultat est ', h('b', {}, 'gardé'), '. La prochaine fois que ces deux-là se croisent, le jeu le sait — et le match ne commence pas pareil.'),
      h('table', { class: 'tut-table' },
        h('tr', {}, ['Ce que change une rivalité', 'Effet'].map((x) => h('th', {}, x))),
        [['La salle connaît l’histoire', 'jusqu’à +28 de chaleur au coup d’envoi'],
         ['Celui qui a perdu la dernière', '+20 momentum et une rancune qui pèse sur ses coups'],
         ['La fiche', 'le score, la série en cours, et la manchette du dernier match']]
          .map((r) => h('tr', {}, r.map((c) => h('td', {}, c))))),
      h('p', {}, 'À la fin de chaque match, le jeu écrit son ', h('b', {}, 'histoire'), ' : le contexte, le membre sur lequel tout s’est joué, le moment où ça a failli basculer, et la fin. Plus une note sur cinq étoiles. Rien n’est inventé — tout vient de ce qui s’est réellement passé sur le plateau.'),
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
