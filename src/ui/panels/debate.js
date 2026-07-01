import { S, agents } from '../../state.js';
import { makeRoundHdr, makeDebateCard, makeSectionLabel } from '../helpers.js';

// Mirrors runDebate()'s live rendering: S.currentDebates is flat
// ({ 'id1_id2': {text, type} }) and holds only the most recent round —
// matching what a live session shows (debate panel clears and redraws
// each round, it does not accumulate history across rounds).
export function rebuildDebatePanel() {
  const panel = document.getElementById('panel-deb');
  panel.innerHTML = '';
  const keys = Object.keys(S.currentDebates);
  if (!keys.length) return;

  panel.appendChild(makeRoundHdr(`Round ${S.currentRound} — Debate`, 'done'));
  keys.forEach(key => {
    const { text, type } = S.currentDebates[key];
    const [id1, id2] = key.split('_');
    const a1 = agents.find(a => a.id === id1), a2 = agents.find(a => a.id === id2);
    const card = makeDebateCard(a1, a2, type || 'BRIDGE');
    card.querySelector('.rcard-body').textContent = text || '';
    panel.appendChild(card);
  });
}
