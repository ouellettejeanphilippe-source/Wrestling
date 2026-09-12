// ---------------------------------------------------------------------------
// SERVICE WORKER — le jeu s'installe et se joue hors ligne.
//
// Tout est statique : une fois les modules en cache, il n'y a plus rien à
// aller chercher. La sauvegarde vit déjà dans localStorage, donc une saison
// commencée dans le métro se termine dans le métro.
//
// Les chemins sont RELATIFS au script : sur GitHub Pages le jeu est servi
// depuis /Wrestling/, pas depuis la racine. Un chemin absolu marcherait en
// local et mettrait l'installation en 404 en ligne.
// ---------------------------------------------------------------------------
const VERSION = 'ppw-2026-09-11';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './src/data/campaign.js',
  './src/data/classes.js',
  './src/data/combos.js',
  './src/data/directives.js',
  './src/data/gimmicks.js',
  './src/data/matchTypes.js',
  './src/data/managers.js',
  './src/data/moves.js',
  './src/data/wrestlers.js',
  './src/engine/ai.js',
  './src/engine/battle.js',
  './src/engine/grid.js',
  './src/engine/phases.js',
  './src/engine/rng.js',
  './src/engine/rules.js',
  './src/engine/units.js',
  './src/engine/util.js',
  './src/engine/wear.js',
  './src/game/rivalry.js',
  './src/game/script.js',
  './src/game/state.js',
  './src/game/story.js',
  './src/main.js',
  './src/pwa.js',
  './src/ui/avatar.js',
  './src/ui/cards.js',
  './src/ui/dom.js',
  './src/ui/hub.js',
  './src/ui/match.js',
  './src/ui/spriteart.js',
  './src/ui/spritepixel.js',
  './src/ui/title.js',
  './src/ui/tutorial.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)));
  // Pas de skipWaiting : la version en cours de partie ne doit pas se faire
  // remplacer sous les pieds du joueur. La nouvelle prend la main au prochain
  // lancement, quand plus aucun onglet ne tourne.
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Une navigation hors ligne doit retomber sur la page du jeu, pas sur
  // l'erreur du navigateur.
  if (request.mode === 'navigate') {
    e.respondWith((async () => {
      try { return await fetch(request); }
      catch { return (await caches.match('./')) || (await caches.match('./index.html')) || Response.error(); }
    })());
    return;
  }

  // Le reste : on sert le cache tout de suite et on rafraîchit derrière.
  // Démarrage instantané, et la version suivante est déjà prête au lancement
  // d'après.
  e.respondWith((async () => {
    const hit = await caches.match(request);
    const live = fetch(request).then((res) => {
      if (res && res.ok) caches.open(VERSION).then((c) => c.put(request, res.clone()));
      return res;
    }).catch(() => null);
    return hit || (await live) || Response.error();
  })());
});
