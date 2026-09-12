// LES IMPORTS QUI N'EXISTENT PAS
//
// Le jeu n'a pas d'étape de compilation : `import { machin } from './truc.js'`
// avec une faute de frappe ne casse rien au chargement — le symbole vaut
// simplement `undefined`, et ça explose plus tard, dans une fonction d'affichage
// qu'on n'a peut-être pas ouverte ce jour-là. C'est exactement le genre de bogue
// qu'un test doit attraper et pas un navigateur.
//
// On relit donc chaque fichier source, on extrait ses imports nommés, et on
// vérifie que chaque nom est bien exporté par le module visé.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..', 'src');

function sources(dir = ROOT) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? sources(p) : p.endsWith('.js') ? [p] : [];
  });
}

// `import { a, b as c } from './x.js'` — on ignore les imports par défaut, les
// `import * as`, et les chemins non relatifs (il n'y en a pas, mais autant être
// explicite).
const NAMED = /import\s*\{([^}]*)\}\s*from\s*['"](\.[^'"]+)['"]/g;

test('tout ce qui est importé existe vraiment', async () => {
  const fichiers = sources();
  assert.ok(fichiers.length > 15, 'on relit bien tout le dossier src');
  const manquants = [];
  for (const f of fichiers) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(NAMED)) {
      const cible = resolve(dirname(f), m[2]);
      const mod = await import(pathToFileURL(cible).href);
      for (const brut of m[1].split(',')) {
        const nom = brut.trim().split(/\s+as\s+/)[0].trim();
        if (!nom) continue;
        if (!(nom in mod)) manquants.push(`${relative(ROOT, f)} importe « ${nom} » de ${m[2]}, qui ne l’exporte pas`);
      }
    }
  }
  assert.deepEqual(manquants, [], manquants.join('\n'));
});

test('aucun module de src n’est oublié dans le précache du service worker', () => {
  // Doublon volontaire avec pwa.test.js sur l'intention, mais pas sur la
  // méthode : celui-ci part des fichiers réels, l'autre de la liste.
  const sw = readFileSync(resolve(import.meta.dirname, '..', 'sw.js'), 'utf8');
  const absents = sources()
    .map((f) => 'src/' + relative(ROOT, f).split(/[\\/]/).join('/'))
    .filter((p) => !sw.includes(p));
  assert.deepEqual(absents, [], `absents de sw.js : ${absents.join(', ')}`);
});
