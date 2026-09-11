// Mesure un sprite au lieu de l'estimer.
//
// « Ça manque de contraste » n'est pas actionnable. « Les cheveux couvrent
// 0,38 de luminosité quand la référence en couvre 0,85 » l'est. Ce script
// donne les trois chiffres qui ont servi à corriger les vraies fautes de ce
// projet : nombre de couleurs, étendue de luminosité par matière, et plus
// longue arête restée droite.
//
//   node .claude/skills/pixel-art/scripts/measure.mjs           tout le roster
//   node .claude/skills/pixel-art/scripts/measure.mjs gunter    un lutteur
import { WRESTLERS, WRESTLERS_BY_ID } from '../../../../src/data/wrestlers.js';
import { spriteSvg, palette } from '../../../../src/ui/spritepixel.js';
import * as ART from '../../../../src/ui/spriteart.js';

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const colorsOf = (def) => [...new Set(
  [...spriteSvg(def, { size: 64 }).matchAll(/fill="(#[0-9a-f]{6})"/g)].map((m) => m[1]),
)];

// Les caractères de palette par matière, pour mesurer l'amplitude de chacune
// séparément — c'est là que se joue le contraste, pas dans le total.
const FAMILIES = { peau: '12345', cheveux: 'hHG', tenue: 'aAB', accent: 'nN', bottes: 'bVW' };

// La plus longue suite de lignes où le bord gauche ne bouge pas. Au-delà de
// trois ou quatre, une jambe lit comme un tuyau.
//
// La mesure ne vaut que pour une figure DEBOUT : chez une figure couchée, le
// bord gauche n'est pas la silhouette, c'est le sommet du crâne. Tordre un
// dessin pour satisfaire une mesure inadaptée serait prendre l'outil pour la
// fin — la planche au sol est donc exclue.
function straightRun(rows) {
  let max = 0, prev = null, run = 0;
  for (const r of rows) {
    const a = r.search(/[^.]/);
    if (a < 0) { prev = null; run = 0; continue; }
    if (a === prev) run++; else { prev = a; run = 1; }
    if (run > max) max = run;
  }
  return max;
}

const arg = process.argv[2];
const cast = arg ? [WRESTLERS_BY_ID[arg]].filter(Boolean) : WRESTLERS;
if (!cast.length) { console.error(`lutteur inconnu : ${arg}`); process.exit(1); }

console.log('\nÉTENDUE DE LUMINOSITÉ PAR SPRITE');
console.log('(une étendue globale large ne dit rien ; c\'est par matière que ça compte)\n');
let worst = null;
for (const def of cast) {
  const cols = colorsOf(def).map((c) => [c, lum(c)]).sort((a, b) => a[1] - b[1]);
  const span = cols.at(-1)[1] - cols[0][1];
  console.log(`${def.id.padEnd(20)} ${String(cols.length).padStart(2)} couleurs  étendue ${span.toFixed(3)}`);
  if (!worst || span < worst[1]) worst = [def.id, span];
}
if (cast.length > 1) console.log(`\nplus faible étendue : ${worst[0]} (${worst[1].toFixed(3)})`);

if (cast.length === 1) {
  console.log('\nÉTENDUE PAR MATIÈRE');
  console.log('(la caractéristique signature doit avoir la plus large amplitude —');
  console.log(' les cheveux de Crono couvrent 0,85 quand sa peau n\'en couvre que 0,20)\n');
  const P = palette(cast[0]);
  for (const [name, chars] of Object.entries(FAMILIES)) {
    const vals = [...chars].map((c) => P[c]).filter(Boolean).map(lum).sort((a, b) => a - b);
    if (!vals.length) continue;
    const span = vals.at(-1) - vals[0];
    const bar = '█'.repeat(Math.round(span * 30));
    console.log(`  ${name.padEnd(9)} ${span.toFixed(3)}  ${bar}`);
  }
}

console.log('\nARÊTES DROITES DES PLANCHES');
console.log('(au-delà de quatre lignes, la silhouette lit comme un tuyau)\n');
for (const [name, rows] of Object.entries(ART)) {
  if (!Array.isArray(rows) || typeof rows[0] !== 'string') continue;
  if (name === 'BASE_DOWN') continue;                    // figure couchée, voir plus haut
  const n = straightRun(rows);
  console.log(`  ${name.padEnd(18)} ${n}${n > 4 ? '   ← à casser' : ''}`);
}
console.log();
