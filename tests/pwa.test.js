// Le service worker précache une liste écrite dans le fichier. Rien n'oblige
// cette liste à suivre le dépôt : ajouter un module et oublier la ligne
// donne un jeu qui marche en ligne et casse hors ligne, sans erreur visible.
// Ce test est ce qui force la synchronisation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const sw = readFileSync(join(root, 'sw.js'), 'utf8');
const listed = new Set([...sw.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]));

const walk = (dir) => readdirSync(join(root, dir)).flatMap((f) => {
  const rel = `${dir}/${f}`;
  return statSync(join(root, rel)).isDirectory() ? walk(rel) : [rel];
});

test('le service worker précache tous les modules du jeu', () => {
  const missing = walk('src').filter((f) => f.endsWith('.js') && !listed.has(f));
  assert.deepEqual(missing, [], `absents de sw.js : ${missing.join(', ')}`);
});

test('le service worker précache la coquille et les icônes', () => {
  for (const f of ['index.html', 'styles.css', 'manifest.webmanifest',
    'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png']) {
    assert.ok(listed.has(f), `${f} absent de sw.js`);
  }
});

test('le manifeste reste relatif : le jeu est servi depuis un sous-dossier', () => {
  const m = JSON.parse(readFileSync(join(root, 'manifest.webmanifest'), 'utf8'));
  for (const [k, v] of [['start_url', m.start_url], ['scope', m.scope]]) {
    assert.ok(!String(v).startsWith('/'), `${k} ne doit pas être absolu (${v})`);
  }
  for (const i of m.icons) assert.ok(!i.src.startsWith('/'), `icône absolue : ${i.src}`);
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'), 'il faut une icône maskable');
  assert.ok(m.icons.some((i) => i.sizes === '512x512'), 'il faut une icône 512');
});

test('rien ne précache un chemin absolu', () => {
  assert.equal(/'\/[^']*'/.test(sw.split('ASSETS')[1].split(']')[0]), false);
});
