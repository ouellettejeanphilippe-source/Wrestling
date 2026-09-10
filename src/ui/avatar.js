// Enrobage DOM des sprites. Le dessin vient des planches dessinées à la main
// (spritepixel.js + spriteart.js) ; la signature ne bouge pas pour le reste de l'UI.
import { h } from './dom.js';
import { spriteSvg } from './spritepixel.js';

export { spriteSvg };

export function avatarSvg(def, size = 48, opts = {}) {
  return spriteSvg(def, { view: opts.view || 'bust', size: opts.fill ? 'fill' : size, facing: opts.facing, dir: opts.dir });
}

// Vignette carrée façon carte de collection : fond de scène + sprite détouré.
export function avatar(def, size = 48, opts = {}) {
  const view = opts.view || 'bust';
  const el = h('span', {
    class: `avatar-wrap view-${view} ${opts.class || ''}`,
    style: {
      ...(opts.fill ? {} : { width: `${size}px`, height: `${view === 'full' ? Math.round(size * 1.25) : size}px` }),
      ...(opts.bg === 'none' ? {} : { '--badge-bg': opts.bg || def.color || '#3d3b52' }),
    },
    title: def.name,
  });
  if (opts.bg === 'none') el.classList.add('bare');
  el.innerHTML = spriteSvg(def, { view, size: opts.fill ? 'fill' : undefined, facing: opts.facing, dir: opts.dir });
  return el;
}
