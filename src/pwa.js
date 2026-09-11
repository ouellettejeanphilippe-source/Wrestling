// Installation et mode hors ligne.
//
// Le service worker n'est pas enregistré au premier rendu mais au `load` :
// pendant le démarrage, son installation se battrait avec le chargement des
// modules du jeu pour la même bande passante.
const SW = './sw.js';

// Le navigateur ne propose pas l'installation tout seul : il émet un
// événement et attend qu'on lui donne un geste utilisateur. On garde donc la
// proposition sous le coude jusqu'à ce qu'un bouton la réclame.
//
// L'abonnement passe par un événement sur `window` plutôt que par une liste
// de rappels : l'événement peut arriver AVANT que l'écran titre existe, et un
// abonné qui se désabonne lui-même pendant son premier appel synchrone
// touchait sa propre variable avant son initialisation.
let pending = null;
export const EVENT = 'ppw:installable';
export const canInstall = () => !!pending;
const notify = () => window.dispatchEvent(new CustomEvent(EVENT));

// Rend `true` si le joueur a accepté. L'événement ne sert qu'une fois : une
// fois consommé, il faut attendre que le navigateur en émette un autre.
export async function promptInstall() {
  if (!pending) return false;
  const e = pending;
  pending = null;
  notify();
  e.prompt();
  const { outcome } = await e.userChoice;
  return outcome === 'accepted';
}

// iOS n'a pas d'événement d'installation : elle passe par le menu de partage,
// et rien depuis la page ne peut la déclencher. Un bouton y mentirait — on dit
// quoi faire à la place.
export const needsIosHint = () => /iPad|iPhone|iPod/.test(navigator.userAgent)
  && /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS/.test(navigator.userAgent);

// Déjà installé : lancé depuis l'icône, il n'y a plus rien à proposer.
export const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches
  || window.navigator.standalone === true;

export function setupPwa() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();                       // sinon Chrome affiche sa propre barre
    pending = e;
    notify();
  });
  window.addEventListener('appinstalled', () => { pending = null; notify(); });

  if (!('serviceWorker' in navigator)) return;
  // file:// n'a pas de service worker, et l'enregistrement y jette une
  // exception qui remonterait jusqu'à la console du joueur.
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(SW).catch(() => {});
  });
}
