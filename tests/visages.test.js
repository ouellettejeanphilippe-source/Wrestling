// LES VISAGES DE RÉFÉRENCE
//
// Le roster parodie de vrais lutteurs. Pour les reconnaître, l'application peut
// télécharger leur photo SUR L'APPAREIL — jamais dans le dépôt. Ces tests
// verrouillent trois choses : on ne garde que ce qui est sous licence libre,
// on garde l'auteur et la licence, et aucune photo n'entre dans le dépôt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { extraireVisages, texte, CACHE_NAME } from '../src/ui/visages.js';
import { REFERENCES } from '../src/data/references.js';
import { WRESTLERS_BY_ID } from '../src/data/wrestlers.js';

const racine = new URL('..', import.meta.url).pathname;

// Une réponse de Wikipédia et une de Commons, réduites à ce qu'elles ont de
// pertinent : une image libre (Commons), une image « usage loyal » (Wikipédia
// seulement), une page sans image, et une redirection.
const pages = {
  query: {
    normalized: [{ from: 'Rey Mysterio', to: 'Rey Mysterio' }],
    redirects: [{ from: 'Stone Cold Steve Austin', to: 'Steve Austin' }],
    pages: {
      1: { title: 'John Cena', thumbnail: { source: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/John_Cena.jpg/360px-John_Cena.jpg' }, original: { source: 'https://upload.wikimedia.org/wikipedia/commons/2/2e/John_Cena.jpg' }, pageimage: 'John_Cena.jpg' },
      2: { title: 'Steve Austin', thumbnail: { source: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Austin.jpg/360px-Austin.jpg' }, original: { source: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Austin.jpg' }, pageimage: 'Austin.jpg' },
      3: { title: 'Darby Allin', thumbnail: { source: 'https://upload.wikimedia.org/wikipedia/en/thumb/x/xy/Darby.jpg/360px-Darby.jpg' }, original: { source: 'https://upload.wikimedia.org/wikipedia/en/x/xy/Darby.jpg' }, pageimage: 'Darby.jpg' },
      4: { title: 'Orange Cassidy' },
    },
  },
};
const licences = {
  query: {
    normalized: [{ from: 'File:John Cena.jpg', to: 'File:John Cena.jpg' }],
    pages: {
      10: { title: 'File:John Cena.jpg', imageinfo: [{ extmetadata: { LicenseShortName: { value: 'CC BY-SA 2.0' }, Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:X">Gage Skidmore</a>' } } }] },
      11: { title: 'File:Austin.jpg', imageinfo: [{ extmetadata: { LicenseShortName: { value: 'Non-free fair use' }, Artist: { value: 'Quelqu’un' } } }] },
    },
  },
};
const refs = { jean_sina: 'John Cena', pierre_frette: 'Stone Cold Steve Austin', derby_allin: 'Darby Allin', clementine_cassidy: 'Orange Cassidy', cody_roads: 'Cody Rhodes' };

test('on ne garde que ce qui est sous licence libre, avec son auteur', () => {
  const v = extraireVisages(pages, licences, refs);
  assert.deepEqual(Object.keys(v), ['jean_sina'], 'une seule image est libre ET documentée');
  assert.equal(v.jean_sina.licence, 'CC BY-SA 2.0');
  assert.equal(v.jean_sina.auteur, 'Gage Skidmore', 'le HTML des métadonnées est réduit au nom');
  assert.match(v.jean_sina.page, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:John_Cena\.jpg$/, 'et on renvoie vers la page de l’image');
  assert.ok(v.jean_sina.src.startsWith('https://upload.wikimedia.org/'));
});

test('refusées : usage loyal (hors Commons), licence non libre, page sans image, page absente', () => {
  const v = extraireVisages(pages, licences, refs);
  assert.ok(!v.derby_allin, 'une image téléversée sur Wikipédia même n’est pas réutilisable');
  assert.ok(!v.pierre_frette, 'une licence « non libre » est refusée, même sur Commons');
  assert.ok(!v.clementine_cassidy, 'pas d’image : rien');
  assert.ok(!v.cody_roads, 'page absente : rien');
});

test('une réponse vide ou limitée ne plante pas, et ne donne rien', () => {
  assert.deepEqual(extraireVisages(null, null, refs), {});
  assert.deepEqual(extraireVisages({ query: {} }, { query: {} }, refs), {});
});

test('le HTML des métadonnées devient du texte', () => {
  assert.equal(texte('<a href="x">Gage&nbsp;Skidmore</a> &amp; <i>Cie</i>'), 'Gage Skidmore & Cie');
  assert.equal(texte(undefined), '');
});

test('chaque référence correspond à un vrai lutteur du roster', () => {
  for (const id of Object.keys(REFERENCES)) assert.ok(WRESTLERS_BY_ID[id], `${id} n’existe pas dans le roster`);
  for (const id of Object.keys(WRESTLERS_BY_ID)) {
    if (WRESTLERS_BY_ID[id].npc) continue;
    assert.ok(REFERENCES[id], `${id} n’a pas de référence : un lutteur parodié de plus sans visage ?`);
  }
});

test('GARDE-FOU : aucune photo dans le dépôt, et le dossier local est ignoré', () => {
  // Les photos de vrais lutteurs se téléchargent sur l'appareil, jamais dans
  // git ni sur GitHub Pages. Seules les icônes de l'application sont des images.
  const interdit = new Set(['.jpg', '.jpeg', '.webp', '.gif', '.avif', '.heic']);
  const trouvees = [];
  const marcher = (dir) => {
    for (const f of readdirSync(join(racine, dir))) {
      if (['node_modules', '.git', 'local'].includes(f)) continue;
      const rel = dir ? `${dir}/${f}` : f;
      if (statSync(join(racine, rel)).isDirectory()) { marcher(rel); continue; }
      const ext = extname(f).toLowerCase();
      if (interdit.has(ext) || (ext === '.png' && !rel.startsWith('icons/'))) trouvees.push(rel);
    }
  };
  marcher('');
  assert.deepEqual(trouvees, [], `des images dans le dépôt : ${trouvees.join(', ')}`);
  assert.match(readFileSync(join(racine, '.gitignore'), 'utf8'), /^local\/$/m, '`local/` doit rester dans .gitignore');
});

test('le service worker ne purge pas le cache des visages', () => {
  const sw = readFileSync(join(racine, 'sw.js'), 'utf8');
  assert.ok(sw.includes(`'${CACHE_NAME}'`), 'le service worker nomme le cache des visages et le garde');
});
