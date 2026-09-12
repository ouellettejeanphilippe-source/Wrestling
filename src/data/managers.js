// LES MANAGERS — quelqu'un au bord du ring
//
// Un manager n'est pas un lutteur de plus : c'est une MENACE PERMANENTE qui ne
// se joue que deux fois. Le savoir change la façon de lutter — on ne laisse
// pas traîner son dos près du tablier quand Jimmy Lacravate a encore son
// mégaphone, et on ne triche pas avant que Bobby ait distrait l'arbitre.
//
// Chacun a UNE chose qu'il sait faire, et elle coûte le tour du lutteur : le
// manager ne donne pas un tour gratuit, il transforme celui qu'on a.
//
//   ability   ce qu'il fait (résolu dans le moteur)
//   uses      nombre d'interventions pour tout le match
//   illegal   l'arbitre peut le voir et avertir — la tolérance s'applique
//   needsEdge la cible doit être au bord du ring (cordes ou coin) : le manager
//             agit depuis le tablier, il n'entre pas au milieu du tapis
export const MANAGERS = {
  paul_lourdeur: {
    id: 'paul_lourdeur', name: 'Paul Lourdeur', nick: 'Le porte-parole', icon: '🎩',
    ability: 'promo', uses: 2, illegal: false, needsEdge: false,
    label: '🎩 Laisser parler Paul',
    desc: 'Il prend le micro et présente votre lutteur comme le meilleur de la planète. +40 momentum, +25 souffle, la salle s’embrase.',
    bio: 'Costume trois-pièces, voix de velours, et un client qui n’a jamais eu à se présenter lui-même.',
  },
  jimmy_lacravate: {
    id: 'jimmy_lacravate', name: 'Jimmy Lacravate', nick: 'Le mégaphone', icon: '📣',
    ability: 'cheap_shot', uses: 2, illegal: true, needsEdge: true,
    label: '📣 Mégaphone dans le dos',
    desc: 'Depuis le tablier, un coup de mégaphone sur un adversaire acculé aux cordes. 14 dégâts, étourdi. Illégal : l’arbitre peut le voir.',
    bio: 'Veste à pois, mégaphone jamais rangé. Il crie pendant les matchs des autres, aussi.',
  },
  bobby_cerveau: {
    id: 'bobby_cerveau', name: 'Bobby le Cerveau', nick: 'Le cerveau', icon: '🧠',
    ability: 'distract', uses: 2, illegal: false, needsEdge: false,
    label: '🧠 Occuper l’arbitre',
    desc: 'Il monte sur le tablier et engage une discussion passionnante avec l’arbitre. Trois tours sans rien voir : tout devient légal.',
    bio: 'Il n’a jamais lutté. Il a fait perdre plus de matchs que n’importe quel lutteur.',
  },
  sherri_sensationnelle: {
    id: 'sherri_sensationnelle', name: 'Sherri la Sensationnelle', nick: 'La tenancière', icon: '💅',
    ability: 'rope_hold', uses: 2, illegal: true, needsEdge: true,
    label: '💅 Tenir la cheville',
    desc: 'Elle attrape la cheville d’un adversaire au bord du ring et ne lâche plus. L’arrache d’une case, l’étourdit, et lui bousille la jambe (+22 d’usure). Illégal.',
    bio: 'Chante l’hymne d’entrée de son client. Faux, mais fort.',
  },
  docteur_kayfabe: {
    id: 'docteur_kayfabe', name: 'Docteur Von Kayfabe', nick: 'Les sels', icon: '🩺',
    ability: 'smelling_salts', uses: 2, illegal: false, needsEdge: false,
    label: '🩺 Les sels',
    desc: 'Une fiole sous le nez et votre lutteur repart. Rend 18 % des PV, refait le souffle à bloc et efface l’étourdissement.',
    bio: 'Diplôme encadré, université introuvable. Ça marche quand même.',
  },
};

export const MANAGER_LIST = Object.values(MANAGERS);
export const MANAGER_IDS = Object.keys(MANAGERS);
