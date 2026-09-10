// Point d'entrée : navigation entre les écrans.
import { showTitle } from './ui/title.js';
import { showHub, showSeasonEnd } from './ui/hub.js';
import { mountMatch } from './ui/match.js';
import { createBattle } from './engine/battle.js';
import { WRESTLERS_BY_ID } from './data/wrestlers.js';
import { newGame, load, save, clearSave, buildMatch, applyResult, playerBonuses, exhibitionMatch } from './game/state.js';

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
  startExhibition(type, playerIds, enemyIds) {
    const match = exhibitionMatch(type, playerIds, enemyIds);
    const battle = createBattle({ match, playerTeam: playerIds.map((id) => WRESTLERS_BY_ID[id]), seed: Date.now() % 1000000 });
    window.__battle = battle;
    mountMatch(root, { battle, matchDef: match, onFinish: () => null, onContinue: () => app.toTitle(), onQuit: () => app.toTitle() });
  },
};
window.__app = app;
app.toTitle();
