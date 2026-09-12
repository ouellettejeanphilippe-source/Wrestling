// L'HISTOIRE DU MATCH
//
// Un match de catch n'est pas une somme de dégâts, c'est un récit : qui a pris
// l'avantage, sur quoi il l'a pris, ce qui a failli tout finir, et comment ça
// s'est terminé. Le moteur produisait des chiffres ; il manquait la phrase
// qu'on répète le lendemain.
//
// Rien n'est inventé ici. Chaque ligne est tirée des temps forts réellement
// enregistrés pendant le match (`battle.beats`), de l'état final des corps et
// des règles de la stipulation. Si le récit dit qu'on lui a bousillé la jambe,
// c'est qu'une jambe est passée hors service, au tour indiqué.
import { PARTS, wornParts, WEAR_HURT } from '../engine/wear.js';
import { MATCH_TYPES } from '../data/matchTypes.js';
import { starsText } from './script.js';

const first = (beats, kind) => beats.find((b) => b.kind === kind) || null;
const all = (beats, kind) => beats.filter((b) => b.kind === kind);
const pick = (rng, xs) => xs[Math.floor(rng * xs.length) % xs.length];
// Enchaîner une phrase à la suite d'un deux-points : seule la PREMIÈRE lettre
// descend en minuscule, sinon « Il regarde ailleurs. Profitez-en. » devient
// « il regarde ailleurs. profitez-en. »
const minuscule = (t) => (t ? t.charAt(0).toLowerCase() + t.slice(1) : '');

// LA NOTE. Ce que le public retient : de la durée, des chutes, des kick-outs à
// deux et neuf, de la variété, et une salle chaude. Un match court et sans
// near-fall plafonne, même gagné proprement.
export function rateMatch(battle) {
  const b = battle.beats || [];
  const s = battle.stats;
  const varietes = new Set(battle.units.flatMap((u) => Object.keys(u.memory.used || {}))).size;
  let n = 0.4;
  n += Math.min(1.3, battle.turn / 32);                       // la durée
  n += Math.min(1.0, all(b, 'nearfall').length * 0.3);        // les faux départs
  n += Math.min(0.7, (s.reversals || 0) * 0.2);               // les renversements
  n += Math.min(0.9, varietes / 26);                          // la variété
  // La chaleur sature à 100 dans presque tous les matchs : telle quelle, elle
  // donnait une demi-étoile gratuite à tout le monde. Ce qui distingue, c'est
  // la VITESSE à laquelle la salle s'est levée.
  n += Math.min(0.6, (battle.heat / Math.max(6, battle.turn)) * 0.2);
  if (all(b, 'broken').length) n += 0.3;                      // une histoire de corps
  if (all(b, 'manager').length) n += 0.15;                    // du monde au bord du ring
  // Une fin en queue de poisson reste une fin en queue de poisson.
  const raison = (battle.result && battle.result.reason) || '';
  if (/Limite de temps/.test(raison)) n -= 0.8;
  if (/disqualifi/.test(raison)) n -= 0.5;
  if (/compté/.test(raison)) n -= 0.4;
  return Math.max(1, Math.min(5, Math.round(n * 2) / 2));
}

export function matchStory(battle, opts = {}) {
  const b = battle.beats || [];
  const rules = MATCH_TYPES[battle.match.type] || {};
  const res = battle.result || {};
  const gagnant = battle.units.find((u) => u.team === res.winner && !u.eliminated);
  const perdant = battle.units.find((u) => u.eliminated) || battle.units.find((u) => u.team !== res.winner);
  const rng = (battle.seed || 1) % 997 / 997;
  const acts = [];

  // ---- Acte I : l'entrée en matière
  const ouverture = [];
  ouverture.push(`${rules.icon || '🔔'} ${rules.name || 'Match'} — ${battle.turn} tours.`);
  if (opts.rivalry && opts.rivalry.meetings > 0) ouverture.push(opts.rivalry.note);
  const mgrs = ['player', 'enemy'].map((t) => battle.managers && battle.managers[t]).filter(Boolean);
  if (mgrs.length) ouverture.push(`${mgrs.map((m) => `${m.icon} ${m.name}`).join(' et ')} au bord du ring dès le coup d’envoi.`);
  if (battle.rules.dq && battle.ref) ouverture.push(`Arbitre ${battle.ref.name} : ${minuscule(battle.ref.trait)}`);
  acts.push({ icon: '🔔', title: 'Le contexte', text: ouverture.join(' ') });

  // ---- Acte II : le corps du match — sur quoi s'est joué l'avantage
  const casses = all(b, 'broken');
  const corps = [];
  if (casses.length) {
    const c = casses[0];
    corps.push(`${c.by ? `${c.by} a trouvé ` : 'On a trouvé '}${c.short === 'jambe' ? 'la jambe' : c.short === 'bras' ? 'le bras' : c.short === 'côtes' ? 'les côtes' : 'la tête'} de ${c.who} et n’a plus lâché : ${c.icon} hors service au tour ${c.turn}.`);
    if (c.part === 'legs') corps.push('Plus un seul mouvement aérien, plus d’escalade, et un homme qui ne se relève plus qu’à moitié.');
    if (c.part === 'torso') corps.push('À partir de là, il n’a plus jamais repris son souffle.');
    if (c.part === 'arms') corps.push('Une prise qui n’accroche plus, et plus rien à renverser.');
    if (c.part === 'head') corps.push('Les épaules au tapis pesaient soudain beaucoup plus lourd.');
    if (casses.length > 1) corps.push(`Et ce n’était pas le seul membre à lâcher ce soir (${casses.length} au total).`);
  } else {
    // On relit les CORPS, pas seulement les temps forts : si un membre est
    // hors service à l'arrivée, le récit ne peut pas dire le contraire, même
    // si le moment du basculement n'a pas été enregistré.
    const uses = battle.units.flatMap((u) => wornParts(u).filter((w) => w.n >= WEAR_HURT).map((w) => ({ ...w, qui: u.name })));
    const pire = uses.sort((x, y) => y.n - x.n)[0];
    const membre = pire && (pire.short === 'côtes' ? 'les côtes' : `la ${pire.short}`);
    corps.push(!pire
      ? 'Un match propre, disputé debout : personne n’a réussi à s’installer sur une partie du corps de l’autre.'
      : pire.level >= 2
        ? `${pire.qui} finit le match avec ${membre} hors service.`
        : `Personne n’a été mis hors service, mais ${pire.qui} a fini le match avec ${membre} en compote.`);
  }
  acts.push({ icon: '🦴', title: 'Le travail', text: corps.join(' ') });

  // ---- Acte III : le moment où ça a failli basculer
  const nf = all(b, 'nearfall').sort((x, y) => y.count - x.count)[0];
  const rev = first(b, 'reverse');
  const fin = first(b, 'finisher');
  const mgr = first(b, 'manager');
  const tournants = [];
  if (nf && nf.count === 2.9) tournants.push(`Tour ${nf.turn} : ${nf.by} couvre, la salle compte — UN, DEUX, TR… et ${nf.who} sort l’épaule à deux et neuf.`);
  else if (nf) tournants.push(`Tour ${nf.turn} : premier vrai tombé, ${nf.who} se dégage.`);
  if (rev) tournants.push(`${rev.who} a retourné ${rev.move} contre ${rev.on} au tour ${rev.turn} — personne ne l’a vu venir.`);
  if (mgr) tournants.push(`${mgr.icon} ${mgr.who} s’en est mêlé au tour ${mgr.turn}${mgr.on ? `, aux dépens de ${mgr.on}` : ''}.`);
  // Ce que le PASSIF du lutteur a changé. Un gimmick qui sauve une chute ou
  // annule un finisher n'est pas une note de bas de page, c'est le moment.
  const gim = first(b, 'gimmick');
  if (gim) {
    tournants.push(gim.kind === 'save'
      ? `Et au tour ${gim.turn}, ${gim.who} a refusé de tomber : « ${gim.gimmick} », la salle debout.`
      : `Au tour ${gim.turn}, ${gim.who} a renvoyé ${gim.move} de ${gim.on} — « ${gim.gimmick} », évidemment.`);
  }
  // La préparation fait partie du coup : traverser le ring, monter au coin,
  // rebondir dans les cordes. C'est là que le déplacement devient du récit.
  const spot = all(b, 'course').sort((x, y) => (y.travel || 0) - (x.travel || 0))[0];
  if (spot) {
    const d = { coin: `du haut du coin`, cordes: `depuis les cordes`, rebond: `au rebond des cordes` }[spot.depuis]
      || `après ${spot.travel} cases de course`;
    tournants.push(`${spot.who} a placé ${spot.move} ${d} sur ${spot.on} au tour ${spot.turn}.`);
  }
  if (fin && !nf) tournants.push(`${fin.who} a placé ${fin.move} au tour ${fin.turn}.`);
  const dq = all(b, 'warning');
  if (dq.length) tournants.push(`L’arbitre a averti ${dq[dq.length - 1].who} ${dq.length > 1 ? `${dq.length} fois` : 'une fois'} — la corde était tendue.`);
  if (!tournants.length) tournants.push(pick(rng, [
    'Aucun faux départ, aucun renversement : de l’usure et rien d’autre.',
    'Un match sans accroc, ce qui n’est pas forcément un compliment.',
  ]));
  acts.push({ icon: '🔥', title: 'Le tournant', text: tournants.join(' ') });

  // ---- Acte IV : la fin
  const nom = gagnant ? gagnant.name : 'personne';
  const restes = gagnant ? `${'❤️'.repeat(gagnant.grit) || 'plus un cœur'}` : '';
  const finale = [res.reason || 'Le match s’est arrêté.'];
  if (gagnant && perdant) {
    const chutes = all(b, 'down').filter((d) => d.uid === (gagnant.uid)).length;
    if (chutes >= 2) finale.push(`${nom} est passé ${chutes} fois par le tapis avant de gagner.`);
    else if (chutes === 0) finale.push(`${nom} n’est pas allé au sol une seule fois.`);
  }
  if (gagnant) finale.push(`Il repart avec ${restes} et ${Math.round((gagnant.hp / gagnant.maxHp) * 100)} % de sa résistance.`);
  acts.push({ icon: '🏁', title: 'La fin', text: finale.join(' ') });

  const stars = rateMatch(battle);
  return { headline: headline(battle, { gagnant, perdant, casses, nf, res, stars }), acts, stars, starsText: starsText(stars) };
}

// LA MANCHETTE — la phrase qu'on retient. Elle nomme ce qui a VRAIMENT décidé
// le match, pas simplement qui a gagné.
function headline(battle, { gagnant, perdant, casses, nf, res, stars }) {
  const g = gagnant ? gagnant.name : 'Personne';
  const p = perdant ? perdant.name : 'l’autre';
  if (/disqualifi/.test(res.reason || '')) return `${p} perd la tête et perd le match`;
  if (/Limite de temps/.test(res.reason || '')) return `${g} et ${p} vont au bout du temps réglementaire`;
  if (/abandonn/.test(res.reason || '')) {
    const c = casses[0];
    return c ? `${g} démonte ${c.short === 'côtes' ? 'les côtes' : `la ${c.short}`} de ${p} et le fait taper` : `${g} fait abandonner ${p}`;
  }
  if (/ne pouvait plus continuer|arrêté le match/.test(res.reason || '')) return `L’arbitre arrête le massacre : ${g} bat ${p}`;
  if (/compté/.test(res.reason || '')) return `${p} ne revient jamais dans le ring`;
  if (stars >= 4.5) return `${g} bat ${p} au terme d’un match qu’on reverra`;
  if (nf && nf.count === 2.9) return `${g} bat ${p} — mais il a fallu deux et neuf`;
  if (casses.length) return `${g} choisit ${casses[0].short === 'côtes' ? 'les côtes' : `la ${casses[0].short}`} de ${p}, et ça suffit`;
  return `${g} bat ${p}`;
}
