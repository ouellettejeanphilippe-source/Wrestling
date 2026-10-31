// LES VISAGES DE RÉFÉRENCE — téléchargés sur l'appareil, jamais dans le dépôt
//
// Pour reconnaître qui est qui pendant qu'on construit le jeu, l'application
// va chercher la photo de chaque lutteur parodié, SUR DEMANDE (réglage de
// l'écran titre, éteint par défaut) :
//
//   · l'API publique de Wikipédia donne l'image de chaque page, en un seul appel ;
//   · seules celles qui sont sur Wikimedia Commons sont gardées — elles sont
//     sous licence libre ; une image téléversée sur Wikipédia même relève de
//     l'usage loyal et ne se réutilise pas ;
//   · l'auteur et la licence sont lus (un second appel) et AFFICHÉS avec la
//     photo, puisque la plupart exigent l'attribution ;
//   · les images sont mises en cache sur l'appareil (Cache Storage), donc
//     elles se voient aussi hors ligne, et s'effacent en éteignant le réglage.
//
// Rien de tout ça ne passe par le dépôt ni par le site : c'est le navigateur
// de chaque appareil qui va chercher ce qu'il affiche. Un test interdit
// d'ailleurs toute photo dans le dépôt. Les personnages originaux de la v1
// remplaceront ce roster, et ce module avec lui.
import { REFERENCES } from '../data/references.js';

const KEY_ON = 'ppw-visages';
const KEY_DATA = 'ppw-visages-v1';
export const CACHE_NAME = 'ppw-visages';     // le service worker ne doit PAS le purger
const TTL = 30 * 24 * 3600 * 1000;

const lire = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const ecrire = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* mode privé */ } };

export const visagesOn = () => lire(KEY_ON) === '1';
let items = {};          // id → { titre, src, auteur, licence, page }
let blobs = {};          // id → URL locale (depuis le cache de l'appareil)

// Du HTML de métadonnées (« <a href=…>Gage Skidmore</a> ») au texte.
export const texte = (html) => String(html || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, '’').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

// PURE : de la réponse « pageimages » de Wikipédia et de la réponse « imageinfo »
// de Commons aux visages utilisables. Séparée de tout réseau pour se tester.
export function extraireVisages(pages, licences, references = REFERENCES) {
  const q = (pages && pages.query) || {};
  const suivre = (titre) => {
    let t = titre;
    for (const n of q.normalized || []) if (n.from === t) t = n.to;
    for (const r of q.redirects || []) if (r.from === t) t = r.to;
    return t;
  };
  const parTitre = Object.fromEntries(Object.values(q.pages || {}).map((p) => [p.title, p]));
  const lq = (licences && licences.query) || {};
  const metaDe = (fichier) => {
    let t = `File:${fichier}`;
    for (const n of lq.normalized || []) if (n.from === t) t = n.to;
    const p = Object.values(lq.pages || {}).find((x) => x.title === t);
    return p && p.imageinfo && p.imageinfo[0] && p.imageinfo[0].extmetadata;
  };
  const out = {};
  for (const [id, titre] of Object.entries(references)) {
    const p = parTitre[suivre(titre)];
    if (!p || !p.thumbnail || !p.original || !p.pageimage) continue;
    if (!/\/wikipedia\/commons\//.test(p.original.source)) continue;           // pas libre
    const fichier = p.pageimage.replace(/_/g, ' ');
    const m = metaDe(fichier);
    const licence = m && m.LicenseShortName ? texte(m.LicenseShortName.value) : '';
    if (!licence || /non[- ]free|fair use|copyrighted/i.test(licence)) continue;
    out[id] = {
      titre: titre.replace(/ \(.*\)/, ''),
      src: p.thumbnail.source,
      auteur: m.Artist ? texte(m.Artist.value) || 'auteur inconnu' : 'auteur inconnu',
      licence,
      page: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fichier.replace(/ /g, '_'))}`,
    };
  }
  return out;
}

const appel = async (base, params) => {
  const u = new URL(`${base}/w/api.php`);
  for (const [k, v] of Object.entries({ format: 'json', origin: '*', ...params })) u.searchParams.set(k, v);
  const r = await fetch(u);
  if (!r.ok) throw new Error(`Wikimedia a répondu ${r.status}`);
  const j = await r.json();
  if (!j || !j.query) throw new Error('Wikimedia limite les requêtes : réessayez dans quelques minutes');
  return j;
};

// Va chercher les visages (deux appels groupés, puis une image chacun), les
// met en cache sur l'appareil, et renvoie combien ont été trouvés.
export async function chargerVisages() {
  const titres = Object.values(REFERENCES);
  const pages = await appel('https://en.wikipedia.org', { action: 'query', prop: 'pageimages', piprop: 'original|name|thumbnail', pithumbsize: '360', redirects: '1', titles: titres.join('|') });
  // Un premier tri sur les pages pour ne demander que les fichiers de Commons.
  const preselection = extraireVisagesSansLicence(pages);
  const fichiers = Object.values(preselection).map((f) => `File:${f}`);
  const licences = fichiers.length ? await appel('https://commons.wikimedia.org', { action: 'query', prop: 'imageinfo', iiprop: 'extmetadata', titles: fichiers.join('|') }) : null;
  const trouves = extraireVisages(pages, licences);
  if ('caches' in self) {
    const cache = await caches.open(CACHE_NAME);
    for (const v of Object.values(trouves)) {
      try { const r = await fetch(v.src, { mode: 'cors' }); if (r.ok) await cache.put(v.src, r); } catch { /* on gardera l'adresse distante */ }
    }
  }
  ecrire(KEY_DATA, JSON.stringify({ t: Date.now(), items: trouves }));
  items = trouves;
  await ouvrirCache();
  return Object.keys(trouves).length;
}
// Les fichiers (de Commons) à interroger : même lecture que `extraireVisages`,
// avant de connaître les licences.
function extraireVisagesSansLicence(pages) {
  const q = (pages && pages.query) || {};
  const suivre = (titre) => {
    let t = titre;
    for (const n of q.normalized || []) if (n.from === t) t = n.to;
    for (const r of q.redirects || []) if (r.from === t) t = r.to;
    return t;
  };
  const parTitre = Object.fromEntries(Object.values(q.pages || {}).map((p) => [p.title, p]));
  const out = {};
  for (const [id, titre] of Object.entries(REFERENCES)) {
    const p = parTitre[suivre(titre)];
    if (p && p.original && p.pageimage && /\/wikipedia\/commons\//.test(p.original.source)) out[id] = p.pageimage.replace(/_/g, ' ');
  }
  return out;
}

async function ouvrirCache() {
  for (const u of Object.values(blobs)) { try { URL.revokeObjectURL(u); } catch { /* rien */ } }
  blobs = {};
  if (!('caches' in self)) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    for (const [id, v] of Object.entries(items)) {
      const r = await cache.match(v.src);
      if (r) blobs[id] = URL.createObjectURL(await r.blob());
    }
  } catch { /* on retombe sur les adresses distantes */ }
}

// Au démarrage : relire ce qui est déjà sur l'appareil, sans réseau.
export async function initVisages() {
  if (!visagesOn()) return;
  try {
    const d = JSON.parse(lire(KEY_DATA) || 'null');
    if (d && d.items && Date.now() - d.t < TTL) { items = d.items; await ouvrirCache(); }
  } catch { /* données illisibles : on les ignore */ }
}

export async function activerVisages() {
  const n = await chargerVisages();
  ecrire(KEY_ON, '1');
  return n;
}
// Éteindre efface tout ce qui était sur l'appareil.
export async function desactiverVisages() {
  ecrire(KEY_ON, null); ecrire(KEY_DATA, null);
  items = {};
  for (const u of Object.values(blobs)) { try { URL.revokeObjectURL(u); } catch { /* rien */ } }
  blobs = {};
  if ('caches' in self) { try { await caches.delete(CACHE_NAME); } catch { /* rien */ } }
}

// Ce que la fiche d'un lutteur affiche : null quand le réglage est éteint ou
// qu'aucune image libre n'existe pour lui.
export function visageDe(id) {
  if (!visagesOn()) return null;
  const v = items[id];
  return v ? { ...v, url: blobs[id] || v.src } : null;
}
