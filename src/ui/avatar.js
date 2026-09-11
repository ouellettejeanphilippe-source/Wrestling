// Enrobage DOM des sprites. Le dessin vient des planches dessinées à la main
// (spritepixel.js + spriteart.js) ; la signature ne bouge pas pour le reste de l'UI.
import { h } from './dom.js';
import { spriteSvg, idleOf, idleFrameCount } from './spritepixel.js';

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
  // Animé, le sprite porte sa classe de mouvement. Quand son repos a des
  // images dessinées, on les empile toutes et le CSS les fait défiler : chaque
  // SVG s'affiche pendant sa tranche du cycle, décalée par son retard. Le JS
  // ne bat pas la mesure — un setInterval par pion dérive et coûte cher quand
  // le plateau en porte dix.
  if (opts.anim && !opts.pose) {
    const idle = idleOf(def);
    const n = idleFrameCount(def);
    el.classList.add('anim', `idle-${idle}`);
    if (n > 1) {
      el.classList.add('multi', `frames-${n}`);
      el.innerHTML = Array.from({ length: n }, (_, i) => draw(i)).join('');
      [...el.children].forEach((svg, i) => {
        svg.style.animationDelay = `calc(var(--idle-t) * ${i} / ${n})`;
      });
    } else {
      el.innerHTML = draw(0);
    }
  } else {
    el.innerHTML = draw(0);
  }
  return el;
}
