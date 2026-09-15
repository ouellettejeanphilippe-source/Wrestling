// LE SON — SYNTHÉTISÉ, PAS TÉLÉCHARGÉ
//
// Le jeu n'avait pas un seul son. Pour du catch — la cloche, la foule, le
// claquement d'un corps sur le tapis — c'est le manque qui s'entend le plus.
//
// Tout est fabriqué au vol avec Web Audio : pas un octet de plus à télécharger,
// rien à mettre dans le service worker, et ça marche hors ligne comme le reste.
// Un fichier .mp3 de foule ferait mieux — mais il pèserait plus lourd que tout
// le jeu réuni, et le jeu tient dans un cache de PWA.
//
// RÈGLE : aucune fonction d'ici ne doit jamais faire planter un match. Un
// navigateur sans Web Audio, un contexte refusé, un onglet en arrière-plan —
// tout est avalé. Le son est un bonus, jamais une dépendance.

const KEY = 'ppw-sound';
let ctx = null;
let master = null;
let crowdGain = null;
let crowdSrc = null;

export const soundOn = () => {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
};
export function setSound(on) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* stockage indisponible */ }
  if (master) master.gain.value = on ? 0.9 : 0;
  if (!on) stopCrowd();
}

// Le contexte ne peut naître que d'un geste de l'utilisateur : les navigateurs
// refusent l'audio non sollicité. On le crée donc paresseusement, au premier
// son demandé après un clic.
function audio() {
  if (!soundOn()) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  } catch { return null; }
}

// Une enveloppe courte : attaque immédiate, décroissance exponentielle. C'est
// ce qui fait la différence entre « un bip » et « un coup ».
function env(gain, t, vol, duree) {
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duree);
}

function ton({ freq = 440, type = 'sine', vol = 0.2, duree = 0.2, glide = 0, delai = 0 } = {}) {
  const c = audio(); if (!c) return;
  try {
    const t = c.currentTime + delai;
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * glide), t + duree);
    env(g, t, vol, duree);
    osc.connect(g); g.connect(master);
    osc.start(t); osc.stop(t + duree + 0.05);
  } catch { /* le son n'empêche jamais de jouer */ }
}

// Du bruit blanc filtré : c'est la brique de tout ce qui « claque » — un corps
// sur le tapis, une chaise, une table qui explose.
function bruit({ vol = 0.25, duree = 0.25, freq = 1200, q = 0.7, type = 'lowpass', delai = 0 } = {}) {
  const c = audio(); if (!c) return;
  try {
    const t = c.currentTime + delai;
    const n = Math.floor(c.sampleRate * duree);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const filtre = c.createBiquadFilter(); filtre.type = type; filtre.frequency.value = freq; filtre.Q.value = q;
    const g = c.createGain(); env(g, t, vol, duree);
    src.connect(filtre); filtre.connect(g); g.connect(master);
    src.start(t); src.stop(t + duree + 0.05);
  } catch { /* idem */ }
}

// ------------------------------------------------------------------ LA BANQUE
//
// Chaque son dit ce qui vient de se passer, et ils doivent se distinguer les
// yeux fermés : un coup qui rate ne ressemble pas à un coup qui touche, et un
// finisher ne ressemble à rien d'autre.
export const SFX = {
  // La cloche : deux partiels inharmoniques, c'est ce qui fait « métal ».
  bell() { ton({ freq: 880, type: 'sine', vol: 0.3, duree: 1.4 }); ton({ freq: 1320, type: 'sine', vol: 0.16, duree: 1.1 }); ton({ freq: 2490, type: 'sine', vol: 0.06, duree: 0.7 }); },
  hit() { bruit({ vol: 0.3, duree: 0.14, freq: 900 }); ton({ freq: 150, type: 'square', vol: 0.12, duree: 0.1, glide: 0.4 }); },
  bigHit() { bruit({ vol: 0.42, duree: 0.3, freq: 600 }); ton({ freq: 90, type: 'sine', vol: 0.3, duree: 0.35, glide: 0.35 }); },
  miss() { ton({ freq: 520, type: 'triangle', vol: 0.09, duree: 0.13, glide: 0.55 }); },
  // Un corps qui tombe : du grave, du bruit, et le tapis qui résonne.
  slam() { bruit({ vol: 0.5, duree: 0.34, freq: 420 }); ton({ freq: 70, type: 'sine', vol: 0.34, duree: 0.45, glide: 0.4 }); },
  // Le finisher : une montée, puis l'impact. C'est le seul son qui s'annonce.
  finisher() {
    ton({ freq: 220, type: 'sawtooth', vol: 0.12, duree: 0.34, glide: 2.6 });
    bruit({ vol: 0.5, duree: 0.4, freq: 500, delai: 0.3 });
    ton({ freq: 80, type: 'sine', vol: 0.36, duree: 0.5, glide: 0.35, delai: 0.3 });
  },
  // Le compte de l'arbitre : trois claquements de main sur le tapis.
  count(n = 1) { bruit({ vol: 0.3, duree: 0.1, freq: 1500, delai: 0 }); ton({ freq: 300 + n * 60, type: 'square', vol: 0.07, duree: 0.08 }); },
  kickout() { bruit({ vol: 0.34, duree: 0.2, freq: 1800, type: 'highpass' }); ton({ freq: 400, type: 'sawtooth', vol: 0.12, duree: 0.22, glide: 2 }); },
  table() { bruit({ vol: 0.55, duree: 0.6, freq: 2600, type: 'highpass' }); bruit({ vol: 0.4, duree: 0.45, freq: 500, delai: 0.02 }); },
  win() { [523, 659, 784, 1047].forEach((f, i) => ton({ freq: f, type: 'triangle', vol: 0.18, duree: 0.42, delai: i * 0.09 })); },
  lose() { [392, 349, 294, 220].forEach((f, i) => ton({ freq: f, type: 'triangle', vol: 0.16, duree: 0.5, delai: i * 0.13 })); },
  ui() { ton({ freq: 660, type: 'sine', vol: 0.06, duree: 0.06 }); },
  card() { bruit({ vol: 0.12, duree: 0.09, freq: 3200, type: 'highpass' }); },
};

export function play(name, ...args) {
  const f = SFX[name];
  if (typeof f === 'function') { try { f(...args); } catch { /* jamais bloquant */ } }
}

// ------------------------------------------------------------------- LA FOULE
//
// Une nappe de bruit filtré, dont le volume suit la chaleur de la salle. Ce
// n'est pas un effet sonore, c'est une JAUGE QU'ON ENTEND : depuis que la
// chaleur retombe vraiment, on peut sentir la salle se refroidir sans quitter
// le plateau des yeux.
export function startCrowd() {
  const c = audio(); if (!c || crowdSrc) return;
  try {
    const n = Math.floor(c.sampleRate * 2);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    // Du bruit rose approché : plus chaud à l'oreille que du bruit blanc, et
    // c'est ce qui fait « salle » plutôt que « souffle ».
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.0990460;
      b1 = 0.96300 * b1 + w * 0.2965164;
      b2 = 0.57000 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12;
    }
    crowdSrc = c.createBufferSource();
    crowdSrc.buffer = buf; crowdSrc.loop = true;
    const filtre = c.createBiquadFilter(); filtre.type = 'bandpass'; filtre.frequency.value = 700; filtre.Q.value = 0.6;
    crowdGain = c.createGain(); crowdGain.gain.value = 0;
    crowdSrc.connect(filtre); filtre.connect(crowdGain); crowdGain.connect(master);
    crowdSrc.start();
  } catch { crowdSrc = null; }
}

// `heat` va de 0 à 100. La montée est volontairement lente (une salle ne se
// lève pas en un tour) et le plancher n'est jamais le silence complet : il y a
// toujours du monde dans la salle, comme dans le moteur.
export function setCrowd(heat) {
  if (!crowdGain || !ctx) return;
  try {
    const cible = 0.02 + Math.max(0, Math.min(100, heat || 0)) / 100 * 0.22;
    crowdGain.gain.setTargetAtTime(cible, ctx.currentTime, 0.7);
  } catch { /* ignore */ }
}

// Un pic : la salle réagit à quelque chose. Elle retombe toute seule ensuite.
export function crowdPop(force = 1) {
  if (!crowdGain || !ctx) return;
  try {
    const t = ctx.currentTime;
    const actuel = crowdGain.gain.value;
    crowdGain.gain.cancelScheduledValues(t);
    crowdGain.gain.setValueAtTime(actuel, t);
    crowdGain.gain.linearRampToValueAtTime(Math.min(0.45, actuel + 0.18 * force), t + 0.12);
    crowdGain.gain.setTargetAtTime(actuel, t + 0.2, 0.9);
  } catch { /* ignore */ }
}

export function stopCrowd() {
  try { if (crowdSrc) { crowdSrc.stop(); crowdSrc.disconnect(); } } catch { /* ignore */ }
  crowdSrc = null; crowdGain = null;
}
