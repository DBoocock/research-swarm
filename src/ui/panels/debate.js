import { S, agents } from '../../state.js';
import { makeRoundHdr, makeDebateCard, makeSectionLabel } from '../helpers.js';

export function rebuildDebatePanel() {
  const panel = document.getElementById('panel-debate');
  panel.innerHTML = '';
  const roundNums = [...new Set(
    Object.values(S.debates).flatMap(pairs => Object.values(pairs)).map(d => d.round)
  )].sort((a, b) => a - b);
  if (!roundNums.length) return;

  roundNums.forEach(round => {
    panel.appendChild(makeRoundHdr(`Round ${round} — Debate`, 'done'));
    Object.entries(S.debates).forEach(([pairKey, rounds]) => {
      const debateForRound = Object.values(rounds).find(d => d.round === round);
      if (!debateForRound) return;
      const [id1, id2] = pairKey.split('::');
      const a1 = agents.find(a => a.id === id1), a2 = agents.find(a => a.id === id2);
      const card = makeDebateCard(a1, a2, debateForRound.type || 'BRIDGE');
      const body = card.querySelector('.rcard-body');
      body.textContent = debateForRound.text || '';
      panel.appendChild(card);
    });
  });
}
