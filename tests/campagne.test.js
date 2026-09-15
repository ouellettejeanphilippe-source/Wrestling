// LA CAMPAGNE, JOUÉE DE BOUT EN BOUT
//
// Les stipulations n'avaient jamais été mesurées ; la campagne non plus. Trois
// choses en sont sorties, et ce fichier les verrouille :
//
//   · le MODE SCÉNARIOS plantait dès qu'une partie automatique y touchait —
//     « vendre » et « faire le job » n'existent que pour l'équipe du joueur,
//     donc l'IA adverse ne les voyait jamais et personne ne leur avait écrit
//     de score. Le mode n'avait donc jamais pu être mesuré ;
//   · une saison sur quatre restait BLOQUÉE, six épisodes différents se
//     rejouant six fois sans succès ;
//   · les DIRECTIVES du Network ne décrivaient plus le jeu : « gagner en huit
//     tours » était réalisée 0 fois sur 100 depuis qu'un match en dure une
//     trentaine, et « finir avec 70+ de chaleur » 100 fois sur 100.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, autoPlay } from '../src/engine/battle.js';
import { WRESTLERS_BY_ID as W, STARTER_CHOICES } from '../src/data/wrestlers.js';
import { SEASON } from '../src/data/campaign.js';
import { DIRECTIVES } from '../src/data/directives.js';
import { newGame, buildMatch, applyResult, playerBonuses, currentShow } from '../src/game/state.js';
import { exhibitionMatch } from '../src/game/state.js';

// Une saison complète, jouée par l'IA des deux côtés.
function saison(mode, seed = 1) {
  const st = newGame({ promoName: 'T', mode, starters: STARTER_CHOICES.slice(0, 3) });
  const joues = [];
  let garde = 0;
  while (!st.finished && garde++ < 20) {
    const show = currentShow(st);
    const m = show.matches[garde % show.matches.length];
    const ids = st.roster.slice(0, m.teamSize).map((r) => r.id);
    const b = createBattle({
      match: buildMatch(st, m), playerTeam: ids.map((i) => W[i]),
      playerBonuses: playerBonuses(st), seed: seed * 97 + garde,
    });
    autoPlay(b, 400);
    assert.ok(b.result, `${m.id} (${mode}) : le match doit se conclure`);
    const s = applyResult(st, b, m, ids);
    joues.push({ id: m.id, b, s });
  }
  return { st, joues };
}

test('une saison entière se joue jusqu’au bout, dans les deux modes', () => {
  for (const mode of ['kayfabe', 'scenario']) {
    const { st, joues } = saison(mode);
    assert.equal(st.finished, true, `${mode} : la saison se termine`);
    assert.equal(joues.length, SEASON.shows.length, `${mode} : un match par épisode, aucune reprise imposée`);
    assert.ok(['good', 'ok'].includes(st.ending));
    assert.ok(st.fans > 0, `${mode} : la promotion a un public`);
  }
});

test('le mode Scénarios ne fait plus planter une partie automatique', () => {
  // Le bogue exact : « vendre » et « faire le job » tombaient dans la branche
  // par défaut du score de l'IA, qui lit `tg.unit.down` — et ces deux actions
  // n'ont pas de cible. Toute partie automatique en mode Scénarios plantait.
  const st = newGame({ promoName: 'T', mode: 'scenario', starters: STARTER_CHOICES.slice(0, 3) });
  const m = SEASON.shows[0].matches[0];
  const b = createBattle({ match: buildMatch(st, m), playerTeam: [W[st.roster[0].id]], seed: 7 });
  assert.equal(b.mode, 'scenario', 'le script est bien transmis au moteur');
  assert.doesNotThrow(() => autoPlay(b, 400));
  assert.ok(b.result);
});

test('aucune directive n’est impossible ni gratuite par construction', () => {
  // On ne peut pas mesurer un taux ici (ce serait trop long), mais on peut
  // verrouiller les seuils qui avaient DÉRIVÉ avec le reste du jeu, et
  // vérifier qu'aucune ne plante sur un vrai match.
  const b = createBattle({ match: exhibitionMatch('singles', ['jean_sina'], ['gunter']), playerTeam: [W.jean_sina], seed: 3 });
  autoPlay(b, 400);
  for (const [id, d] of Object.entries(DIRECTIVES)) {
    assert.doesNotThrow(() => d.check(b), `la directive « ${id} » plante sur un vrai match`);
    assert.equal(typeof d.check(b), 'boolean', `« ${id} » doit répondre oui ou non`);
    assert.ok(d.desc && d.name, `« ${id} » doit se décrire`);
  }
  // « Vite fait » doit rester atteignable : un match dure une trentaine de
  // tours, pas huit. C'est le seuil qui était tombé à 0 % de réussite.
  assert.ok(DIRECTIVES.fast.check({ turn: 20, stats: {}, units: [], beats: [] }));
  assert.ok(!DIRECTIVES.fast.check({ turn: 40, stats: {}, units: [], beats: [] }));
  // Et « faites durer » ne doit pas être gratuite : dix tours, c'est tous les
  // matchs du jeu.
  assert.ok(!DIRECTIVES.long.check({ turn: 20, stats: {}, units: [], beats: [] }));
  assert.ok(DIRECTIVES.long.check({ turn: 45, stats: {}, units: [], beats: [] }));
  // « Foule en délire » se lit sur la MOYENNE, pas sur la chaleur finale : la
  // chaleur finit toujours haut, c'est la tenir tout le match qui coûte.
  assert.equal(DIRECTIVES.heat.check({ heat: 100, stats: { heatSum: 1200, heatTurns: 30 }, units: [], beats: [] }), false,
    'finir à 100 après un match froid ne suffit pas');
  assert.equal(DIRECTIVES.heat.check({ heat: 40, stats: { heatSum: 2400, heatTurns: 30 }, units: [], beats: [] }), true,
    'une salle tenue à 80 de moyenne, c’est une foule en délire');
});

test('les directives des épisodes existent toutes', () => {
  // Un identifiant mal orthographié dans la saison ne se voit qu'à l'écran de
  // résultat, et seulement si le joueur gagne ce match-là.
  const manquantes = [];
  for (const show of SEASON.shows) for (const m of show.matches) {
    for (const d of m.directives || []) if (!DIRECTIVES[d]) manquantes.push(`${m.id} → ${d}`);
    for (const beat of (m.script && m.script.beats) || []) if (!DIRECTIVES[beat]) manquantes.push(`${m.id} (script) → ${beat}`);
  }
  assert.deepEqual(manquantes, [], manquantes.join(', '));
});
