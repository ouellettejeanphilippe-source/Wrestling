// Portraits « bonhomme » générés en SVG à partir d'une description (look) par lutteur.
// Aucune image externe : chaque portrait est un petit SVG composé de couches.
import { h } from './dom.js';

const SKIN = { light: '#f1c9a5', tan: '#d9a074', brown: '#a8703f', dark: '#6b4423', pale: '#f6e3d3' };

export function avatarSvg(def, size = 48, opts = {}) {
  const L = def.look || {};
  const f = new Set(L.features || []);
  const skin = SKIN[L.skin || 'light'] || L.skin;
  const hair = L.hair || '#3b2a1a';
  const attire = L.attire || def.color || '#555';
  const accent = L.accent || '#fff';
  const bg = opts.bg || def.color || '#333';
  const p = [];
  const add = (s) => p.push(s);

  // fond
  add(`<circle cx="32" cy="32" r="31" fill="${bg}" stroke="${opts.stroke || '#ffffff55'}" stroke-width="2"/>`);
  // torse
  const big = f.has('big');
  add(`<path d="M${big ? 8 : 12} 64 C ${big ? 8 : 12} 48, ${big ? 18 : 22} 44, 32 44 C ${big ? 46 : 42} 44, ${big ? 56 : 52} 48, ${big ? 56 : 52} 64 Z" fill="${attire}"/>`);
  if (f.has('singlet')) add(`<path d="M26 44 L24 64 L30 64 L30 46 Z M38 44 L40 64 L34 64 L34 46 Z" fill="${accent}" opacity="0.9"/>`);
  if (f.has('vest')) add(`<path d="M22 46 L22 64 L28 64 L30 48 Z M42 46 L42 64 L36 64 L34 48 Z" fill="#111"/>`);
  if (f.has('jacket')) add(`<path d="M12 64 L14 50 L26 46 L30 64 Z M52 64 L50 50 L38 46 L34 64 Z" fill="${accent}"/>`);
  if (f.has('suit')) add(`<path d="M26 46 L32 60 L38 46 Z" fill="#fff"/><path d="M30 46 L32 58 L34 46 Z" fill="#a00"/>`);
  if (f.has('shirt')) add(`<rect x="22" y="48" width="20" height="16" fill="${accent}" opacity="0.85"/>`);
  if (f.has('chops')) add(`<path d="M26 48 L30 56 M30 47 L34 55 M34 48 L38 56" stroke="#e53935" stroke-width="2" stroke-linecap="round"/>`);
  if (f.has('chain')) add(`<path d="M24 46 Q32 58 40 46" stroke="#ffd54f" stroke-width="2.5" fill="none"/>`);
  if (f.has('tattoo_arms')) add(`<path d="M14 54 q4 -3 8 0 M42 54 q4 -3 8 0" stroke="#2b4a2b" stroke-width="2.5" fill="none"/>`);
  if (f.has('scarf')) add(`<path d="M22 46 Q32 54 42 46 L42 52 Q32 60 22 52 Z" fill="${accent}"/>`);
  if (f.has('choker')) add(`<rect x="27" y="42" width="10" height="3" fill="#111"/>`);
  if (f.has('lantern')) add(`<rect x="8" y="48" width="8" height="10" rx="2" fill="#ffb300" stroke="#5d4037" stroke-width="1.5"/>`);
  if (f.has('belt')) add(`<rect x="20" y="58" width="24" height="6" rx="2" fill="#ffd54f" stroke="#7a5200"/>`);
  // cou
  add(`<rect x="28" y="38" width="8" height="8" fill="${skin}"/>`);
  // cheveux arrière
  if (f.has('long_hair')) add(`<path d="M18 26 C 16 40, 18 46, 22 46 L42 46 C 46 46, 48 40, 46 26 Z" fill="${hair}"/>`);
  if (f.has('curly_hair')) add(`<circle cx="18" cy="24" r="6" fill="${hair}"/><circle cx="46" cy="24" r="6" fill="${hair}"/><circle cx="20" cy="34" r="5" fill="${hair}"/><circle cx="44" cy="34" r="5" fill="${hair}"/>`);
  // tête
  add(`<ellipse cx="32" cy="27" rx="13" ry="14" fill="${skin}"/>`);
  // peinture / masque
  if (f.has('paint_half')) add(`<path d="M32 13 A13 14 0 0 1 32 41 Z" fill="#111"/><path d="M34 20 l3 3 M34 26 l4 -1" stroke="#fff" stroke-width="1.5"/>`);
  if (f.has('paint_full')) add(`<ellipse cx="32" cy="27" rx="13" ry="14" fill="#f5f5f5"/><path d="M24 20 l5 5 M24 25 l5 -5 M35 20 l5 5 M35 25 l5 -5" stroke="#111" stroke-width="2"/><path d="M27 34 q5 3 10 0" stroke="#111" stroke-width="2" fill="none"/>`);
  if (f.has('paint_evil')) add(`<ellipse cx="32" cy="27" rx="13" ry="14" fill="#f5f5f5"/><ellipse cx="26" cy="24" rx="4" ry="5" fill="#111"/><ellipse cx="38" cy="24" rx="4" ry="5" fill="#111"/><path d="M26 34 h12" stroke="#111" stroke-width="3"/>`);
  if (f.has('mask')) add(`<ellipse cx="32" cy="27" rx="13" ry="14" fill="${accent}"/><path d="M22 25 h8 M34 25 h8" stroke="${hair}" stroke-width="1"/><ellipse cx="26" cy="25" rx="3.5" ry="3" fill="${skin}"/><ellipse cx="38" cy="25" rx="3.5" ry="3" fill="${skin}"/><ellipse cx="32" cy="35" rx="4" ry="3" fill="${skin}"/><path d="M32 14 L36 27 L28 27 Z" fill="${hair}"/>`);
  if (f.has('fiend_mask')) add(`<ellipse cx="32" cy="27" rx="13" ry="14" fill="#c62828"/><path d="M22 30 q10 12 20 0" fill="#f5f5f5"/><path d="M24 30 v6 M28 31 v7 M32 31 v8 M36 31 v7 M40 30 v6" stroke="#111" stroke-width="1.2"/><circle cx="26" cy="23" r="3" fill="#111"/><circle cx="38" cy="23" r="3" fill="#111"/>`);
  // yeux
  const eyeY = 26;
  if (!f.has('sunglasses') && !f.has('paint_evil') && !f.has('fiend_mask')) {
    add(`<circle cx="27" cy="${eyeY}" r="1.6" fill="#222"/><circle cx="37" cy="${eyeY}" r="1.6" fill="#222"/>`);
    if (f.has('eyebrow')) add(`<path d="M23 21 l7 1" stroke="#222" stroke-width="1.8"/><path d="M34 19 l7 3" stroke="#222" stroke-width="1.8"/>`);
    else add(`<path d="M24 22 l6 0 M34 22 l6 0" stroke="#222" stroke-width="1.4"/>`);
  }
  if (f.has('sunglasses')) add(`<rect x="22" y="23" width="9" height="6" rx="2" fill="#111"/><rect x="33" y="23" width="9" height="6" rx="2" fill="#111"/><path d="M31 25 h2" stroke="#111" stroke-width="1.5"/>`);
  if (f.has('goggles')) add(`<rect x="21" y="22" width="22" height="7" rx="3" fill="#0288d1" opacity="0.8"/>`);
  // bouche / pilosité
  if (f.has('beard_big')) add(`<path d="M20 30 C 22 46, 42 46, 44 30 C 40 36, 24 36, 20 30 Z" fill="${hair}"/>`);
  else if (f.has('beard')) add(`<path d="M22 31 C 24 42, 40 42, 42 31 C 38 36, 26 36, 22 31 Z" fill="${hair}"/>`);
  else if (f.has('goatee')) add(`<path d="M29 35 h6 v5 h-6 Z" fill="${hair}"/>`);
  else if (f.has('stubble')) add(`<path d="M23 31 C 25 39, 39 39, 41 31" fill="none" stroke="${hair}" stroke-width="2.5" opacity="0.45"/>`);
  if (f.has('mustache')) add(`<path d="M25 32 q7 -3 14 0 q-7 4 -14 0 Z" fill="${hair}"/>`);
  if (!f.has('beard_big') && !f.has('paint_full') && !f.has('paint_evil') && !f.has('fiend_mask')) add(`<path d="M28 34 q4 2 8 0" stroke="#7a3b2e" stroke-width="1.4" fill="none"/>`);
  if (f.has('lip_ring')) add(`<circle cx="30" cy="35" r="1.2" fill="none" stroke="#ccc"/>`);
  // cheveux avant / coiffe
  if (f.has('short_hair')) add(`<path d="M19 26 C 18 12, 46 12, 45 26 C 42 18, 22 18, 19 26 Z" fill="${hair}"/>`);
  if (f.has('long_hair')) add(`<path d="M19 28 C 18 12, 46 12, 45 28 C 42 18, 22 18, 19 28 Z" fill="${hair}"/>`);
  if (f.has('messy_hair')) add(`<path d="M19 26 L 22 14 L 27 18 L 31 11 L 36 18 L 41 13 L 45 26 C 42 19, 22 19, 19 26 Z" fill="${hair}"/>`);
  if (f.has('curly_hair')) add(`<path d="M19 26 C 18 10, 46 10, 45 26 C 42 17, 22 17, 19 26 Z" fill="${hair}"/><circle cx="24" cy="16" r="4" fill="${hair}"/><circle cx="40" cy="16" r="4" fill="${hair}"/><circle cx="32" cy="13" r="4" fill="${hair}"/>`);
  if (f.has('mohawk')) add(`<path d="M29 24 L 29 8 L 35 8 L 35 24 Z" fill="${hair}"/>`);
  if (f.has('horseshoe')) add(`<path d="M19 24 C 19 34, 21 40, 22 40 L 22 30 Z M45 24 C 45 34, 43 40, 42 40 L 42 30 Z" fill="${hair}"/>`);
  if (f.has('half_shaved')) add(`<path d="M32 26 C 32 12, 46 12, 45 26 C 42 18, 34 18, 32 26 Z" fill="${hair}"/>`);
  if (f.has('bald')) add(`<ellipse cx="32" cy="18" rx="6" ry="2" fill="#ffffff44"/>`);
  if (f.has('cap')) add(`<path d="M18 24 C 18 12, 46 12, 46 24 Z" fill="${accent}"/><rect x="16" y="22" width="34" height="4" rx="2" fill="${accent}"/>`);
  if (f.has('bandana')) add(`<path d="M19 24 C 18 12, 46 12, 45 24 Z" fill="${accent}"/><path d="M18 23 h28 v4 h-28 Z" fill="${accent}"/><path d="M44 24 l8 6 l-6 0 Z" fill="${accent}"/>`);
  if (f.has('cowboy_hat')) add(`<ellipse cx="32" cy="20" rx="19" ry="4" fill="${accent}"/><path d="M22 20 C 22 8, 42 8, 42 20 Z" fill="${accent}"/>`);
  if (f.has('hat')) add(`<ellipse cx="32" cy="16" rx="17" ry="3" fill="#111"/><rect x="22" y="4" width="20" height="13" rx="2" fill="#111"/>`);
  if (f.has('hood')) add(`<path d="M16 34 C 12 10, 52 10, 48 34 C 46 20, 18 20, 16 34 Z" fill="${accent}"/>`);
  if (f.has('tiara')) add(`<path d="M24 16 l4 -5 l4 5 l4 -5 l4 5" fill="none" stroke="#ffd54f" stroke-width="2"/>`);
  if (f.has('crown')) add(`<path d="M22 16 l3 -7 l4 5 l3 -7 l3 7 l4 -5 l3 7 Z" fill="#ffd54f"/>`);
  if (f.has('headband')) add(`<rect x="19" y="18" width="26" height="4" fill="${accent}"/>`);
  if (f.has('wristbands')) add(`<rect x="12" y="58" width="8" height="5" fill="${accent}"/><rect x="44" y="58" width="8" height="5" fill="${accent}"/>`);
  // objets
  if (f.has('beer')) add(`<rect x="46" y="46" width="7" height="12" rx="1.5" fill="#bdbdbd"/><rect x="46" y="49" width="7" height="4" fill="#1565c0"/>`);
  if (f.has('bat')) add(`<path d="M10 62 L 22 44" stroke="#111" stroke-width="4" stroke-linecap="round"/>`);
  if (f.has('skateboard')) add(`<rect x="6" y="52" width="14" height="4" rx="2" fill="#111" transform="rotate(-30 13 54)"/>`);
  if (f.has('bottle')) add(`<rect x="45" y="46" width="7" height="14" rx="3" fill="#00bcd4"/>`);
  if (f.has('teeth_jar')) add(`<rect x="44" y="48" width="10" height="11" rx="2" fill="#e0f7fa" opacity="0.9"/><path d="M46 54 h6" stroke="#fff" stroke-width="2"/>`);
  if (f.has('ring')) add(`<circle cx="50" cy="56" r="2.5" fill="#fff" stroke="#ffd54f"/>`);
  if (f.has('x_hands')) add(`<path d="M10 54 l6 6 M16 54 l-6 6 M48 54 l6 6 M54 54 l-6 6" stroke="#111" stroke-width="2"/>`);
  if (f.has('bandage')) add(`<rect x="12" y="52" width="8" height="8" fill="#eee" transform="rotate(-20 16 56)"/>`);
  if (f.has('gloves')) add(`<rect x="12" y="58" width="9" height="6" fill="#111"/><rect x="43" y="58" width="9" height="6" fill="#111"/>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" class="avatar">${p.join('')}</svg>`;
}

export function avatar(def, size = 48, opts = {}) {
  const el = h('span', { class: `avatar-wrap ${opts.class || ''}`, style: opts.fill ? {} : { width: `${size}px`, height: `${size}px` }, title: def.name });
  el.innerHTML = avatarSvg(def, opts.fill ? '100%' : size, opts);
  return el;
}
