// Point d'entrée : navigation entre les écrans.
import { showTitle } from './ui/title.js';
import { showHub, showSeasonEnd } from './ui/hub.js';
import { mountMatch } from './ui/match.js';
import { createBattle } from './engine/battle.js';
import { WRESTLERS_BY_ID } from './data/wrestlers.js';
import { newGame, load, save, clearSave, buildMatch, applyResult, playerBonuses, exhibitionMatch } from './game/state.js';
import { setupPwa } from './pwa.js';
import { loadRivalries, saveRivalries, rivalryFor, recordMatch } from './game/rivalry.js';
import { matchStory } from './game/story.js';

const root = document.getElementById('app');
const app = {
  state: null,
  toTitle() { showTitle(root, app); },
  toHub() { if (!app.state) return app.toTitle(); if (app.state.finished) showSeasonEnd(root, app); else showHub(root, app); },
  startCampaign(setup) { app.state = newGame(setup); save(app.state); app.toHub(); },
  continueCampaign() { app.state = load(); if (!app.state) return app.toTitle(); app.toHub(); },
  abandonCampaign() { clearSave(); app.state = null; app.toTitle(); },
  saveNow() { if (app.state) save(app.state); },
  bookMatch(matchDef, teamIds) {
    const match = buildMatch(app.state, matchDef);
    const playerTeam = teamIds.map((id) => WRESTLERS_BY_ID[id]);
    const battle = createBattle({ match, playerTeam, playerBonuses: playerBonuses(app.state), seed: Date.now() % 1000000 });
    window.__battle = battle;
    mountMatch(root, {
      battle, matchDef,
      onFinish: (b) => { const s = applyResult(app.state, b, matchDef, teamIds); save(app.state); return s; },
      onContinue: () => app.toHub(),
      onQuit: () => { battle.result = { winner: 'enemy', reason: 'Match abandonné.', turns: battle.turn }; const s = applyResult(app.state, battle, matchDef, teamIds); save(app.state); app.toHub(); void s; },
    });
  },
  startExhibition(type, playerIds, enemyIds, opts = {}) {
    // La rivalité ne se compte qu'entre deux noms : en un contre un. Au-delà,
    // « qui mène 2-1 » ne veut plus rien dire, et un match d'équipe n'est pas
    // une histoire entre deux personnes.
    const duel = playerIds.length === 1 && enemyIds.length === 1;
    const noms = Object.fromEntries([...playerIds, ...enemyIds].map((id) => [id, WRESTLERS_BY_ID[id].name]));
    const rivalry = duel ? rivalryFor(loadRivalries(), playerIds[0], enemyIds[0], noms) : null;
    const match = exhibitionMatch(type, playerIds, enemyIds, { managers: opts.managers, rivalry });
    const battle = createBattle({ match, playerTeam: playerIds.map((id) => WRESTLERS_BY_ID[id]), seed: Date.now() % 1000000 });
    window.__battle = battle;
    mountMatch(root, {
      battle,
      matchDef: match,
      // Le résultat d'une exhibition n'était nulle part. Il alimente désormais
      // la fiche des deux lutteurs : c'est ce qui fait qu'une deuxième
      // rencontre n'est pas une première.
      onFinish: (b) => {
        if (!duel || !b.result) return null;
        const story = matchStory(b, { rivalry });
        const vainqueur = b.result.winner === 'player' ? playerIds[0] : enemyIds[0];
        const db = loadRivalries();
        recordMatch(db, { a: playerIds[0], b: enemyIds[0], winnerId: vainqueur, turns: b.turn, stars: story.stars, headline: story.headline, finish: b.stats.lastElimReason });
        saveRivalries(db);
        return null;
      },
      onContinue: () => app.toTitle(),
      onQuit: () => app.toTitle(),
    });
  },
};
window.__app = app;
setupPwa();
app.toTitle();
