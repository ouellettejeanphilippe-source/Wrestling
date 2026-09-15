// LES SEMAINES SANS MATCH — LE FEU DE CAMP, L'ÉVÉNEMENT ET LA BOUTIQUE
//
// Une carte à embranchements où tous les nœuds sont des matchs n'est pas une
// carte, c'est une liste. Ce qui fait la décision, c'est de pouvoir renoncer
// à un match — donc à une place au classement — pour autre chose : souffler,
// se faire une relation, ou acheter ce qui manque.
//
// Le coût est toujours le même et il est toujours visible : une semaine sans
// match, c'est une place qu'on n'a pas prise, et ça se paie le soir du titre.
import { createRng } from '../engine/rng.js';
import { WRESTLERS_BY_ID } from '../data/wrestlers.js';
import { TRAINABLE, MAX_TRAIN, rosterEntry } from './state.js';
import { cardOffer, learnCard, forgetCard, knownMoves, deckSize, DECK_MIN } from './deck.js';
import { isCard } from '../engine/hand.js';
import { MOVES } from '../data/moves.js';

// Une graine propre à chaque nœud : le même passage propose toujours la même
// chose, sinon on rechargerait la page jusqu'à tomber sur ce qu'on veut.
const grain = (state, node, sel = 0) => createRng((state.seed || 1) + node.row * 613 + node.col * 97 + sel * 31);

// ---------------------------------------------------------------- SEMAINE OFF
//
// Pas de match, donc pas de classement. En échange, les deux choses qu'on ne
// peut pas acheter : une séance d'entraînement offerte, ou le temps de
// retirer une carte du deck — c'est là qu'on resserre son jeu.
export function restOptions(state) {
  const entrainables = state.roster.filter((r) => TRAINABLE.some(([k, , step]) => r.bonus[k] / step < MAX_TRAIN));
  const taillables = state.roster.filter((r) => deckSize(r) > DECK_MIN);
  return [
    { key: 'train', icon: '🏋️', name: 'Séance offerte', desc: 'Une progression sur le lutteur de votre choix, sans payer un sou.', ok: entrainables.length > 0 },
    { key: 'trim', icon: '✂️', name: 'Travailler son jeu', desc: `Retirer un mouvement d’un deck. Moins de cartes, chacune revient plus vite (plancher : ${DECK_MIN}).`, ok: taillables.length > 0 },
    { key: 'gate', icon: '🎟️', name: 'Une date en plus', desc: 'Un house show sans enjeu : de l’argent et un peu de public, rien de plus.', ok: true },
  ];
}

export function restTrain(state, id, stat) {
  const r = state.roster.find((x) => x.id === id);
  const spec = TRAINABLE.find((t) => t[0] === stat);
  if (!r || !spec) return { ok: false, reason: 'Invalide' };
  if (r.bonus[stat] / spec[2] >= MAX_TRAIN) return { ok: false, reason: 'Maximum atteint' };
  r.bonus[stat] += spec[2];
  r.trainings += 1;
  return { ok: true, message: `+${spec[2]} ${spec[1]} pour ${(WRESTLERS_BY_ID[id] || {}).name || id}` };
}

export function restTrim(state, id, moveId) {
  const r = state.roster.find((x) => x.id === id);
  if (!r) return { ok: false, reason: 'Lutteur absent du roster' };
  const res = forgetCard(r, moveId, true);
  return res.ok ? { ok: true, message: `${(WRESTLERS_BY_ID[id] || {}).name || id} laisse tomber ${MOVES[moveId].name}` } : res;
}

// Le house show : petit, sûr, et sans effet sur le classement. C'est
// l'option « je ne veux rien risquer cette semaine ».
export const GATE_MONEY = 320, GATE_FANS = 45;
export function restGate(state) {
  state.money += GATE_MONEY;
  state.fans += GATE_FANS;
  return { ok: true, message: `Un house show tranquille : +${GATE_MONEY} $, +${GATE_FANS} fans.` };
}

export const trimmable = (entry) => [...knownMoves(entry)].filter(isCard).sort((a, b) => MOVES[a].name.localeCompare(MOVES[b].name));

// ------------------------------------------------------------------ COULISSES
//
// Des angles écrits, avec deux portes chacune et un vrai arbitrage derrière.
// Aucun n'est gratuit : chaque option donne quelque chose et coûte quelque
// chose, même quand le texte fait semblant que non.
export const EVENTS = [
  {
    id: 'promo', icon: '🎤', title: 'La promo de trop',
    text: 'Votre lutteur attrape le micro sans qu’on le lui demande et enterre le champion pendant six minutes. La salle adore. Le champion regarde.',
    choices: [
      { label: 'Le laisser finir', hint: '+120 fans, et le champion s’en souviendra', apply: (st) => { st.fans += 120; st.heelHeat = (st.heelHeat || 0) + 1; return 'La salle est debout. Quelque part, quelqu’un prend des notes.'; } },
      { label: 'Couper la musique', hint: '+250 $ : le Network paie les gens sages', apply: (st) => { st.money += 250; return 'Le Network apprécie. La salle, moins.'; } },
    ],
  },
  {
    id: 'blesse', icon: '🩹', title: 'Un pépin au genou',
    text: 'Un de vos lutteurs boite depuis le dernier show. Le médecin de la fédération hausse les épaules : « ça tient, ou ça ne tient pas ».',
    choices: [
      { label: 'Le faire soigner correctement', hint: '−300 $, il revient entier', apply: (st) => { st.money = Math.max(0, st.money - 300); return 'Trois jours de repos et un bon kiné. Il sera là.'; } },
      { label: 'Serrer les dents', hint: 'gratuit, mais on ne promet rien', apply: (st) => { st.fans += 60; return 'Il travaillera. La salle aime les durs — jusqu’au jour où ça lâche.'; } },
    ],
  },
  {
    id: 'agent', icon: '📞', title: 'Un vétéran au téléphone',
    text: 'Un nom que tout le monde connaît cherche des dates. Il est cher, il est vieux, et il attire du monde.',
    choices: [
      { label: 'Le signer', hint: '−500 $, +200 fans', apply: (st) => { if (st.money < 500) return 'Il raccroche en apprenant votre budget.'; st.money -= 500; st.fans += 200; return 'Il signe. Les billets partent mieux.'; } },
      { label: 'Décliner poliment', hint: '+150 $ économisés ailleurs', apply: (st) => { st.money += 150; return 'Vous gardez l’argent pour le ring.'; } },
    ],
  },
  {
    id: 'rival', icon: '🔥', title: 'Ça dégénère au parking',
    text: 'Une altercation, deux témoins, une vidéo. Le Network appelle avant même que vous ayez rangé la camionnette.',
    choices: [
      { label: 'Vendre l’histoire', hint: '+180 fans, +1 place au classement', apply: (st) => { st.fans += 180; st.rank = (st.rank ?? 6) - 1; return 'On en parle partout. Vous montez d’une place.'; } },
      { label: 'Étouffer l’affaire', hint: '+400 $ du Network, rien d’autre', apply: (st) => { st.money += 400; return 'Personne n’en saura rien. Le chèque arrive vendredi.'; } },
    ],
  },
  {
    id: 'salle', icon: '🏟️', title: 'Une salle plus grande',
    text: 'Le gymnase du lycée voisin se libère. Le double de places — et le double de sièges vides si personne ne vient.',
    choices: [
      { label: 'Réserver', hint: '−350 $, +250 fans si ça prend', apply: (st) => { if (st.money < 350) return 'Le concierge veut un acompte que vous n’avez pas.'; st.money -= 350; st.fans += 250; return 'La salle est pleine aux trois quarts. C’est déjà énorme.'; } },
      { label: 'Rester au bingo', hint: '+100 $ et aucune surprise', apply: (st) => { st.money += 100; return 'On connaît la salle, on connaît le buffet. Ça ira.'; } },
    ],
  },
];

export const eventFor = (state, node) => EVENTS[Math.floor(grain(state, node).next() * EVENTS.length)];

export function applyEvent(state, node, index) {
  const ev = eventFor(state, node);
  const choix = ev.choices[index];
  if (!choix) return { ok: false, reason: 'Choix inconnu' };
  const message = choix.apply(state);
  state.fans = Math.max(0, state.fans);
  return { ok: true, message, event: ev };
}

// ------------------------------------------------------------ BUREAU DU BOOKER
//
// On y achète ce que l'argent peut acheter. Les prix sont fixes et affichés :
// une boutique dont on ne peut pas prévoir le contenu ne se planifie pas, et
// planifier est justement ce qu'une carte doit permettre.
export const SHOP_PRICES = { card: 400, train: 200, fans: 300, agent: 0 };

export function shopStock(state, node) {
  const rng = grain(state, node, 1);
  const lutteur = state.roster[Math.floor(rng.next() * state.roster.length)] || state.roster[0];
  const cartes = lutteur ? cardOffer(state, lutteur.id, node.row + 1).slice(0, 2) : [];
  const libre = state.freeAgents[Math.floor(rng.next() * Math.max(1, state.freeAgents.length))];
  return {
    lutteur: lutteur ? lutteur.id : null,
    cartes,
    agent: libre || null,
    agentPrix: libre ? Math.round((WRESTLERS_BY_ID[libre] || { salary: 600 }).salary * 0.8) : 0,
  };
}

export function buyCard(state, wrestlerId, moveId) {
  if (state.money < SHOP_PRICES.card) return { ok: false, reason: 'Pas assez d’argent' };
  const res = learnCard(state, wrestlerId, moveId);
  if (!res.ok) return res;
  state.money -= SHOP_PRICES.card;
  return { ok: true, message: `${(WRESTLERS_BY_ID[wrestlerId] || {}).name || wrestlerId} apprend ${MOVES[moveId].name}.` };
}

export function buyTrain(state, id, stat) {
  if (state.money < SHOP_PRICES.train) return { ok: false, reason: 'Pas assez d’argent' };
  const res = restTrain(state, id, stat);
  if (!res.ok) return res;
  state.money -= SHOP_PRICES.train;
  return res;
}

export const SHOP_FANS = 160;
export function buyAds(state) {
  if (state.money < SHOP_PRICES.fans) return { ok: false, reason: 'Pas assez d’argent' };
  state.money -= SHOP_PRICES.fans;
  state.fans += SHOP_FANS;
  return { ok: true, message: `Affiches, radio locale, et un panneau sur la nationale : +${SHOP_FANS} fans.` };
}

export function buyAgent(state, id, prix) {
  const def = WRESTLERS_BY_ID[id];
  if (!def) return { ok: false, reason: 'Lutteur inconnu' };
  if (state.roster.some((r) => r.id === id)) return { ok: false, reason: 'Déjà dans le roster' };
  if (state.money < prix) return { ok: false, reason: 'Pas assez d’argent' };
  state.money -= prix;
  state.roster.push(rosterEntry(id));
  state.freeAgents = state.freeAgents.filter((f) => f !== id);
  return { ok: true, message: `${def.name} signe (−${prix} $).` };
}
