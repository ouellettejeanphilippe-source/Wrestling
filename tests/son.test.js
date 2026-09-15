import test from 'node:test';
import assert from 'node:assert/strict';

// Un faux Web Audio, pour vérifier que les sons PARTENT vraiment. Sans ça, on
// branche des appels qui ne produisent rien et personne ne s'en aperçoit —
// c'est exactement le piège qu'un « ça a l'air branché » ne détecte pas.
function stubAudio() {
  const compte = { osc: 0, buffers: 0, gains: 0, ctx: 0, demarres: 0 };
  const param = () => ({
    value: 0,
    setValueAtTime() { return this; },
    exponentialRampToValueAtTime() { return this; },
    linearRampToValueAtTime() { return this; },
    setTargetAtTime() { return this; },
    cancelScheduledValues() { return this; },
  });
  class Ctx {
    constructor() { this.currentTime = 0; this.sampleRate = 44100; this.state = 'running'; this.destination = {}; compte.ctx++; }
    createGain() { compte.gains++; return { gain: param(), connect() {}, disconnect() {} }; }
    createOscillator() { compte.osc++; return { type: '', frequency: param(), connect() {}, start() { compte.demarres++; }, stop() {}, disconnect() {} }; }
    createBufferSource() { compte.buffers++; return { buffer: null, loop: false, connect() {}, start() { compte.demarres++; }, stop() {}, disconnect() {} }; }
    createBuffer(ch, n) { return { getChannelData: () => new Float32Array(n) }; }
    createBiquadFilter() { return { type: '', frequency: param(), Q: param(), connect() {}, disconnect() {} }; }
    resume() { return Promise.resolve(); }
  }
  const store = new Map();
  globalThis.window = { AudioContext: Ctx };
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  return compte;
}

test('chaque son de la banque produit vraiment quelque chose', async () => {
  const compte = stubAudio();
  const { SFX, play } = await import('../src/ui/sound.js');
  const noms = Object.keys(SFX);
  assert.ok(noms.length >= 10, 'il faut de quoi couvrir un match');
  for (const nom of noms) {
    const avant = compte.demarres;
    play(nom);
    assert.ok(compte.demarres > avant, `« ${nom} » ne produit aucun son`);
  }
  // Un nom inconnu ne doit pas planter : le son n'est jamais une dépendance.
  assert.doesNotThrow(() => play('nexistepas'));
});

test('la foule tourne, suit la chaleur et se coupe', async () => {
  const compte = stubAudio();
  const { startCrowd, setCrowd, crowdPop, stopCrowd } = await import('../src/ui/sound.js?crowd');
  const avant = compte.buffers;
  startCrowd();
  assert.equal(compte.buffers, avant + 1, 'la nappe de foule doit démarrer');
  startCrowd();
  assert.equal(compte.buffers, avant + 1, 'et une seule fois');
  assert.doesNotThrow(() => { setCrowd(0); setCrowd(100); setCrowd(undefined); crowdPop(1); });
  stopCrowd();
  startCrowd();
  assert.equal(compte.buffers, avant + 2, 'après coupure, elle peut repartir');
});

test('le son coupé ne joue rien, et le choix est retenu', async () => {
  const compte = stubAudio();
  const { play, setSound, soundOn } = await import('../src/ui/sound.js?mute');
  assert.equal(soundOn(), true, 'le son est actif par défaut');
  setSound(false);
  assert.equal(soundOn(), false);
  assert.equal(globalThis.localStorage.getItem('ppw-sound'), 'off', 'le choix survit au rechargement');
  const avant = compte.demarres;
  play('bell'); play('hit'); play('finisher');
  assert.equal(compte.demarres, avant, 'rien ne doit sortir quand le son est coupé');
  setSound(true);
  play('bell');
  assert.ok(compte.demarres > avant, 'et tout revient quand on le remet');
});

test('sans Web Audio, le jeu continue', async () => {
  stubAudio();
  globalThis.window = {};                       // navigateur sans AudioContext
  const { play, startCrowd, setCrowd, crowdPop, stopCrowd } = await import('../src/ui/sound.js?nowebaudio');
  assert.doesNotThrow(() => { play('bell'); play('slam'); startCrowd(); setCrowd(50); crowdPop(); stopCrowd(); });
});

test('sans localStorage, le son marche quand même', async () => {
  stubAudio();
  globalThis.localStorage = { getItem() { throw new Error('bloqué'); }, setItem() { throw new Error('bloqué'); } };
  const { soundOn, setSound, play } = await import('../src/ui/sound.js?nostorage');
  assert.equal(soundOn(), true, 'on suppose le son actif plutôt que de planter');
  assert.doesNotThrow(() => { setSound(false); play('bell'); });
});
