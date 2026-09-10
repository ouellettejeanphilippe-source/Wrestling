// ---------------------------------------------------------------------------
// SPRITES PIXEL — plateau « émission de télé » façon tokusatsu de fin de soirée.
// Chaque lutteur est dessiné pixel par pixel sur une grille 32×40 à partir de sa
// description (look). Aucune image externe : tout est du SVG à arêtes franches.
// Deux cadrages sur le même dessin : 'full' (corps entier, pion du plateau) et
// 'bust' (buste, portraits et vignettes).
// ---------------------------------------------------------------------------

export const SPRITE_W = 32;
export const SPRITE_H = 40;
const VIEWBOX = { full: `0 0 ${SPRITE_W} ${SPRITE_H}`, bust: '6 2 20 20' };

const SKIN = { light: '#f0c191', tan: '#d59a68', brown: '#a86b3c', dark: '#7a4a26', pale: '#f6ded0' };
const INK = '#140f1e';       // contour, toujours le même : c'est la signature du style
const WHITE = '#f7f3ef';

// -- petites couleurs dérivées ------------------------------------------------
function mix(hex, target, amount) {
  const c = parse(hex), t = parse(target);
  const v = c.map((n, i) => Math.round(n + (t[i] - n) * amount));
  return `#${v.map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}
function parse(hex) {
  let s = String(hex || '#888').replace('#', '');
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) || 0);
}
const dark = (hex, a = 0.35) => mix(hex, '#000000', a);
const light = (hex, a = 0.3) => mix(hex, '#ffffff', a);

// Rampe de quatre tons par matière. La lumière vient d'en haut à gauche :
// « hi » sur les faces éclairées, « sh » sur les faces tournées à droite,
// « deep » dans les creux (aisselles, sous la mâchoire, plis).
function ramp(hex) {
  return {
    hi: mix(light(hex, 0.34), hex, 0.15),
    base: hex,
    sh: mix(hex, '#2a1c3a', 0.3),
    deep: mix(hex, '#170f24', 0.55),
  };
}

// -- moteur de dessin ---------------------------------------------------------
function canvas() {
  const outline = [], fill = [];
  const rect = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
  return {
    outline, fill,
    // o:true => silhouette (on épaissit d'un pixel derrière, en encre)
    px(x, y, w, h, c, o) {
      if (w <= 0 || h <= 0 || !c) return;
      if (o) outline.push(rect(x - 1, y - 1, w + 2, h + 2, INK));
      fill.push(rect(x, y, w, h, c));
    },
    // volume d'un bloc : liseré clair à gauche, ombre à droite, creux en bas
    shade(x, y, w, h, r, opts = {}) {
      const l = opts.light === false ? 0 : opts.light || 1;
      const sh = opts.shade === false ? 0 : opts.shade || 1;
      if (l) this.px(x, y, l, h, r.hi);
      if (sh) this.px(x + w - sh, y, sh, h, r.sh);
      if (opts.top) this.px(x, y, w, opts.top, r.hi);
      if (opts.bottom) this.px(x, y + h - opts.bottom, w, opts.bottom, r.deep);
    },
    raw(s) { fill.push(s); },
    rawBack(s) { outline.push(s); },
    toString() { return outline.join('') + fill.join(''); },
  };
}

// ---------------------------------------------------------------------------
export function spriteSvg(def, opts = {}) {
  const view = opts.view === 'bust' ? 'bust' : 'full';
  const L = def.look || {};
  const f = new Set(L.features || []);
  const skin = SKIN[L.skin] || L.skin || SKIN.light;
  const skinDark = dark(skin, 0.22);
  const hair = L.hair || '#3b2a1a';
  const attire = L.attire || def.color || '#5a5a6e';
  const accent = L.accent || light(attire, 0.55);
  const boots = dark(attire, 0.5);

  const c = canvas();
  const R = { skin: ramp(skin), attire: ramp(attire), accent: ramp(accent), hair: ramp(hair), boots: ramp(boots) };
  const big = f.has('big') || def.weight === 'super';
  const heavy = big || def.weight === 'heavy';
  const tw = big ? 18 : heavy ? 16 : 14;          // largeur du torse
  const tx = 16 - Math.floor(tw / 2);
  const armX = [tx - 4, tx + tw];                  // bras gauche / droit

  // ---- jambes & bottes ------------------------------------------------------
  c.px(11, 30, 4, 4, skin, true);
  c.px(17, 30, 4, 4, skin, true);
  c.px(11, 33, 3, 3, skin, true);                   // mollets
  c.px(18, 33, 3, 3, skin, true);
  c.shade(11, 30, 4, 6, R.skin);                    // cuisse gauche : éclairée à gauche
  c.shade(17, 30, 4, 6, R.skin, { light: 0 });      // cuisse droite : dans l'ombre du corps
  c.px(14, 30, 1, 5, R.skin.deep);                  // entrejambe
  c.px(17, 30, 1, 5, R.skin.deep);
  c.px(12, 34, 2, 1, R.skin.sh); c.px(18, 34, 2, 1, R.skin.sh);   // pli du genou
  c.px(10, 35, 5, 5, boots, true);
  c.px(17, 35, 5, 5, boots, true);
  c.shade(10, 35, 5, 5, R.boots, { top: 1 });
  c.shade(17, 35, 5, 5, R.boots, { top: 1, light: 0 });
  c.px(10, 39, 5, 1, R.boots.deep); c.px(17, 39, 5, 1, R.boots.deep);   // semelle

  // ---- bas / short ----------------------------------------------------------
  c.px(tx + 1, 26, tw - 2, 6, attire, true);
  c.shade(tx + 1, 26, tw - 2, 6, R.attire, { top: 1, bottom: 1 });
  c.px(tx + 2, 31, 3, 1, R.attire.sh); c.px(tx + tw - 5, 31, 3, 1, R.attire.sh);   // ourlet
  if (f.has('singlet')) { c.px(tx + 2, 27, 2, 4, accent); c.px(tx + tw - 4, 27, 2, 4, accent); }

  // ---- torse : épaules larges, taille rentrée (silhouette de catcheur) ------
  const torso = f.has('shirt') || f.has('suit') || f.has('jacket') ? accent : skin;
  const wx = tx + 1, ww = tw - 2;                   // taille, un pixel plus étroite de chaque côté
  c.px(tx, 17, tw, 7, torso, true);                 // épaules + poitrine
  c.px(wx, 23, ww, 4, torso, true);                 // taille
  const RT = ramp(torso);
  c.shade(tx, 17, tw, 7, RT, { top: 1 });           // lumière sur les trapèzes, ombre à droite
  c.shade(wx, 23, ww, 4, RT, { bottom: 1 });
  c.px(tx + 1, 22, tw - 2, 1, RT.sh);               // ligne sous les pectoraux
  if (torso === skin) {                             // pectoraux / abdos
    c.px(tx + 2, 19, Math.floor(tw / 2) - 3, 2, RT.hi);
    c.px(tx + Math.ceil(tw / 2) + 1, 19, Math.floor(tw / 2) - 3, 1, RT.hi);
    c.px(15, 21, 2, 5, RT.sh);                      // sillon central
    c.px(13, 23, 1, 1, RT.sh); c.px(18, 23, 1, 1, RT.sh);
    c.px(wx + 1, 24, 1, 2, RT.sh); c.px(wx + ww - 2, 24, 1, 2, RT.sh);
    c.px(tx + 1, 18, 1, 2, RT.hi);                  // éclat sur l'épaule gauche
  }
  c.px(tx, 23, 1, 1, RT.deep); c.px(tx + tw - 1, 23, 1, 1, RT.deep);   // creux des aisselles
  if (f.has('singlet')) {
    c.px(tx + 2, 17, 3, 6, attire); c.px(wx + 1, 23, 3, 4, attire);
    c.px(tx + tw - 5, 17, 3, 6, attire); c.px(wx + ww - 4, 23, 3, 4, attire);
    c.px(tx + 2, 17, 1, 6, R.attire.hi); c.px(tx + tw - 3, 17, 1, 6, R.attire.sh);
  }
  if (f.has('vest')) { c.px(tx, 17, 3, 6, '#191723'); c.px(wx, 23, 3, 4, '#191723'); c.px(tx + tw - 3, 17, 3, 6, '#191723'); c.px(wx + ww - 3, 23, 3, 4, '#191723'); }
  if (f.has('jacket')) { c.px(tx, 17, 3, 6, dark(accent, 0.35)); c.px(wx, 23, 3, 4, dark(accent, 0.35)); c.px(tx + tw - 3, 17, 3, 6, dark(accent, 0.35)); c.px(wx + ww - 3, 23, 3, 4, dark(accent, 0.35)); }
  if (f.has('suit')) { c.px(15, 17, 2, 6, WHITE); c.px(15, 18, 2, 4, '#c1272d'); }
  if (f.has('chops')) { c.px(tx + 3, 18, 1, 4, '#e3403a'); c.px(tx + 6, 19, 1, 4, '#e3403a'); c.px(tx + 9, 18, 1, 4, '#e3403a'); }
  if (f.has('chain')) { c.px(14, 18, 4, 1, '#ffd34d'); c.px(13, 19, 1, 1, '#ffd34d'); c.px(18, 19, 1, 1, '#ffd34d'); }
  if (f.has('scarf')) { c.px(tx + 2, 16, tw - 4, 2, accent, true); c.px(tx + tw - 4, 18, 2, 4, accent); }
  if (f.has('choker')) c.px(13, 16, 6, 1, '#191723');
  if (f.has('belt')) { c.px(wx - 1, 25, ww + 2, 3, '#ffd34d', true); c.px(14, 25, 4, 3, '#f2a03c'); }
  if (f.has('bandage')) c.px(tx + 1, 22, 4, 2, '#efe6d8');

  // ---- bras -----------------------------------------------------------------
  for (const [i, ax] of armX.entries()) {
    c.px(ax, 17, 4, 4, skin, true);                 // épaule / biceps
    c.px(ax + (i ? 0 : 1), 21, 3, 5, skin, true);   // avant-bras
    c.px(ax + (i ? 0 : 1), 26, 3, 3, skin, true);   // main
    // le bras gauche prend la lumière, le droit reste dans l'ombre du torse
    c.shade(ax, 17, 4, 4, R.skin, i ? { light: 0, shade: 1 } : { light: 1, shade: 1 });
    c.shade(ax + (i ? 0 : 1), 21, 3, 5, R.skin, i ? { light: 0 } : {});
    c.px(ax + (i ? 0 : 1), 26, 3, 1, R.skin.sh);    // poignet
    c.px(ax + (i ? 2 : 1), 20, 1, 1, R.skin.sh);    // pli du coude
    if (f.has('tattoo_arms')) { c.px(ax + 1, 20, 2, 1, '#2f4f3a'); c.px(ax + 1, 22, 2, 1, '#2f4f3a'); }
    if (f.has('wristbands')) c.px(ax, 25, 4, 2, accent);
    if (f.has('gloves')) c.px(ax, 25, 4, 4, '#191723');
    if (f.has('x_hands')) { c.px(ax, 27, 4, 1, '#191723'); c.px(ax + 1, 26, 2, 3, '#191723'); }
  }

  // ---- accessoires tenus ----------------------------------------------------
  if (f.has('beer')) { c.px(armX[1] + 4, 25, 4, 6, '#c9ccd6', true); c.px(armX[1] + 4, 27, 4, 2, '#2f6fbe'); }
  if (f.has('bottle')) { c.px(armX[1] + 4, 24, 3, 7, '#39b7c4', true); c.px(armX[1] + 4, 23, 3, 1, '#efe6d8'); }
  if (f.has('teeth_jar')) { c.px(armX[1] + 4, 25, 5, 6, '#cfeef0', true); c.px(armX[1] + 5, 27, 3, 1, WHITE); }
  if (f.has('bat')) { c.px(armX[0] - 3, 20, 2, 10, '#8a5a2b', true); c.px(armX[0] - 3, 20, 2, 3, '#a97240'); }
  if (f.has('lantern')) { c.px(armX[0] - 5, 25, 5, 6, '#f2a03c', true); c.px(armX[0] - 4, 26, 3, 4, '#ffe28a'); }
  if (f.has('skateboard')) { c.px(armX[0] - 5, 22, 3, 11, '#191723', true); c.px(armX[0] - 5, 24, 3, 1, accent); }
  if (f.has('ring')) c.px(armX[1] + 1, 28, 1, 1, '#ffd34d');

  // ---- cou & tête -----------------------------------------------------------
  c.px(14, 15, 4, 3, skin, true);
  c.px(14, 15, 4, 2, R.skin.deep);                  // le cou reste dans l'ombre du menton
  // crâne en trois bandes : les coins tombent, ça arrondit la silhouette
  c.px(12, 4, 8, 1, skin, true);
  c.px(11, 5, 10, 10, skin, true);
  c.px(12, 15, 8, 1, skin, true);
  c.px(10, 8, 1, 4, skin, true);                    // oreilles
  c.px(21, 8, 1, 4, skin, true);
  c.px(11, 5, 1, 9, R.skin.hi);                     // joue éclairée
  c.px(20, 5, 1, 10, R.skin.sh);                    // côté dans l'ombre
  c.px(19, 11, 1, 4, R.skin.sh);                    // creux de la joue droite
  c.px(12, 4, 6, 1, R.skin.hi);                     // haut du crâne
  c.px(13, 14, 6, 1, R.skin.sh);                    // sous la mâchoire
  c.px(10, 8, 1, 4, R.skin.sh); c.px(21, 8, 1, 4, R.skin.sh);

  // ---- peintures & masques (recouvrent le visage) ---------------------------
  const painted = f.has('paint_full') || f.has('paint_evil') || f.has('fiend_mask') || f.has('mask');
  if (f.has('paint_half')) { c.px(16, 5, 5, 11, '#191723'); c.px(17, 8, 3, 1, WHITE); c.px(17, 11, 3, 1, WHITE); }
  if (f.has('paint_full')) { c.px(11, 5, 10, 11, WHITE); c.px(12, 8, 3, 1, INK); c.px(17, 8, 3, 1, INK); c.px(13, 9, 1, 2, INK); c.px(18, 9, 1, 2, INK); c.px(13, 13, 6, 1, INK); }
  if (f.has('paint_evil')) { c.px(11, 5, 10, 11, WHITE); c.px(12, 8, 3, 3, INK); c.px(17, 8, 3, 3, INK); c.px(12, 13, 8, 2, INK); }
  if (f.has('fiend_mask')) { c.px(11, 5, 10, 11, '#a5232b'); c.px(12, 12, 8, 3, WHITE); for (let i = 0; i < 4; i++) c.px(13 + i * 2, 12, 1, 3, INK); c.px(12, 8, 3, 2, INK); c.px(17, 8, 3, 2, INK); }
  if (f.has('mask')) {
    c.px(11, 5, 10, 11, accent, true);
    c.px(11, 5, 10, 2, dark(accent, 0.3));
    c.px(12, 9, 3, 2, WHITE); c.px(17, 9, 3, 2, WHITE);   // yeux du masque
    c.px(13, 9, 1, 2, INK); c.px(18, 9, 1, 2, INK);
    c.px(14, 13, 4, 2, skin);                              // bouche ouverte
    c.px(15, 4, 2, 3, hair);                               // plume / crête
  }

  // ---- visage ---------------------------------------------------------------
  if (!painted) {
    if (f.has('sunglasses')) { c.px(11, 8, 10, 3, '#191723'); c.px(12, 9, 2, 1, '#3d3b52'); }
    else if (f.has('goggles')) { c.px(11, 8, 10, 3, '#2f8fd0', true); c.px(12, 9, 3, 1, light('#2f8fd0', 0.6)); }
    else {
      c.px(12, 8, 8, 1, R.skin.sh);                        // ombre portée de l'arcade
      c.px(12, 9, 3, 2, WHITE); c.px(17, 9, 3, 2, WHITE);   // blanc de l'œil
      c.px(13, 9, 2, 2, INK); c.px(17, 9, 2, 2, INK);       // pupilles
      c.px(13, 9, 1, 1, mix(INK, WHITE, 0.45));             // éclat
      if (f.has('eyebrow')) { c.px(12, 7, 3, 1, hair); c.px(17, 6, 3, 2, hair); }
      else { c.px(12, 7, 3, 1, hair); c.px(17, 7, 3, 1, hair); }
    }
    c.px(15, 11, 2, 1, R.skin.sh); c.px(17, 11, 1, 1, R.skin.deep);   // nez et son ombre
    c.px(14, 13, 4, 1, R.skin.deep);                       // bouche
    c.px(14, 12, 4, 1, R.skin.hi);                         // lèvre supérieure éclairée
  } else if (f.has('paint_evil') || f.has('paint_full')) {
    if (f.has('sunglasses')) c.px(11, 8, 10, 3, '#191723');
  }

  // ---- pilosité -------------------------------------------------------------
  if (f.has('beard_big')) { c.px(10, 11, 12, 6, hair, true); c.px(10, 11, 5, 1, R.hair.hi); c.px(19, 11, 3, 6, R.hair.sh); c.px(14, 12, 4, 2, dark(skin, 0.45)); }
  else if (f.has('beard')) { c.px(11, 12, 10, 4, hair, true); c.px(11, 12, 4, 1, R.hair.hi); c.px(19, 12, 2, 4, R.hair.sh); c.px(14, 13, 4, 1, dark(skin, 0.45)); }
  else if (f.has('goatee')) c.px(14, 13, 4, 4, hair, true);
  else if (f.has('stubble')) { c.px(11, 13, 10, 3, hair.length ? mix(hair, skin, 0.55) : skinDark); c.px(14, 13, 4, 1, dark(skin, 0.45)); }
  if (f.has('mustache')) c.px(13, 12, 6, 1, hair);
  if (f.has('lip_ring')) c.px(14, 14, 1, 1, '#c9ccd6');

  // ---- cheveux --------------------------------------------------------------
  if (f.has('long_hair')) {
    c.px(10, 4, 12, 4, hair, true); c.px(9, 6, 2, 10, hair, true); c.px(21, 6, 2, 10, hair, true);
    c.px(11, 4, 4, 1, R.hair.hi); c.px(19, 4, 3, 4, R.hair.sh); c.px(21, 8, 2, 8, R.hair.sh); c.px(9, 6, 1, 9, R.hair.hi);
  }
  if (f.has('short_hair')) {
    c.px(11, 3, 10, 3, hair, true); c.px(10, 5, 1, 3, hair); c.px(21, 5, 1, 3, hair);
    c.px(12, 3, 4, 1, R.hair.hi); c.px(19, 3, 2, 3, R.hair.sh);
  }
  if (f.has('messy_hair')) { c.px(11, 3, 10, 3, hair, true); c.px(11, 1, 2, 2, hair, true); c.px(15, 0, 2, 3, hair, true); c.px(19, 1, 2, 2, hair, true); }
  if (f.has('curly_hair')) { c.px(11, 2, 10, 4, hair, true); c.px(9, 4, 3, 3, hair, true); c.px(20, 4, 3, 3, hair, true); c.px(13, 0, 6, 2, hair, true); }
  if (f.has('mohawk')) { c.px(14, 0, 4, 6, hair, true); c.px(15, 0, 2, 2, light(hair, 0.4)); }
  if (f.has('horseshoe')) { c.px(10, 5, 2, 8, hair, true); c.px(20, 5, 2, 8, hair, true); }
  if (f.has('half_shaved')) { c.px(16, 3, 6, 4, hair, true); c.px(21, 6, 2, 8, hair, true); }
  if (f.has('bald')) { c.px(13, 5, 4, 1, R.skin.hi); c.px(14, 4, 2, 1, WHITE); }

  // ---- couvre-chefs ---------------------------------------------------------
  if (f.has('cap')) { c.px(11, 2, 10, 4, accent, true); c.px(11, 5, 12, 2, accent, true); c.px(11, 2, 10, 1, light(accent, 0.35)); }
  if (f.has('bandana')) { c.px(10, 3, 12, 4, accent, true); c.px(21, 6, 3, 5, accent, true); c.px(12, 4, 3, 1, light(accent, 0.4)); }
  if (f.has('cowboy_hat')) { c.px(7, 5, 18, 2, accent, true); c.px(12, 1, 8, 4, accent, true); c.px(12, 4, 8, 1, dark(accent, 0.35)); }
  if (f.has('hat')) { c.px(8, 5, 16, 2, '#191723', true); c.px(12, 0, 8, 5, '#191723', true); c.px(12, 3, 8, 1, '#3d3b52'); }
  if (f.has('hood')) { c.px(9, 2, 14, 5, accent, true); c.px(9, 5, 2, 11, accent, true); c.px(21, 5, 2, 11, accent, true); }
  if (f.has('headband')) { c.px(10, 6, 12, 2, accent, true); }
  if (f.has('tiara')) { c.px(12, 2, 8, 2, '#ffd34d', true); c.px(15, 0, 2, 2, '#ffd34d', true); }
  if (f.has('crown')) { c.px(11, 2, 10, 3, '#ffd34d', true); c.px(11, 0, 2, 2, '#ffd34d'); c.px(15, 0, 2, 2, '#ffd34d'); c.px(19, 0, 2, 2, '#ffd34d'); }

  const size = opts.size;
  const dim = size === undefined ? '' : size === 'fill' ? 'width="100%" height="100%"' : `width="${size}" height="${size * (view === 'full' ? SPRITE_H / SPRITE_W : 1)}"`;
  const flip = opts.facing === -1 ? ` transform="translate(${SPRITE_W} 0) scale(-1 1)"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX[view]}" ${dim} shape-rendering="crispEdges" class="sprite sprite-${view}" preserveAspectRatio="xMidYMax meet"><g${flip}>${c}</g></svg>`;
}

// Vignette carrée (portraits de cartes, barre d'équipe) : buste + fond de scène.
export function spriteBadgeSvg(def, opts = {}) {
  const bg = opts.bg || def.color || '#3d3b52';
  const inner = spriteSvg(def, { ...opts, view: 'bust', size: undefined });
  return `<span class="sprite-badge" style="--badge-bg:${bg}">${inner}</span>`;
}
