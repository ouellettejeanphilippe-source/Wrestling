// Enrobage DOM des sprites. Le dessin vient des planches dessinées à la main
// (spritepixel.js + spriteart.js) ; la signature ne bouge pas pour le reste de l'UI.
import { h } from './dom.js';
import { spriteSvg, idleOf, idleHasFrames } from './spritepixel.js';

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
  const draw = (frame) => spriteSvg(def, {
    view, size: opts.fill ? 'fill' : undefined, facing: opts.facing, dir: opts.dir, pose: opts.pose, frame,
  });
  // Animé, le sprite porte sa classe de mouvement, et une seconde image
  // empilée par-dessus quand son repos en demande une : les deux alternent en
  // CSS, sans que le JS ait à battre la mesure.
  if (opts.anim && !opts.pose) {
    const idle = idleOf(def);
    el.classList.add('anim', `idle-${idle}`);
    el.innerHTML = idleHasFrames(def) ? `${draw(0)}${draw(1)}` : draw(0);
  } else {
    el.innerHTML = draw(0);
  }
  return el;
}
