import { S, agents, genCardEls } from '../../state.js';
import { makeRoundHdr, makeResultCard } from '../helpers.js';

export function rebuildGenerationPanel() {
  const panel = document.getElementById('panel-gen');
  panel.innerHTML = '';
  Object.keys(genCardEls).forEach(k => delete genCardEls[k]);
  if (!Object.keys(S.genBlocks).length) return;

  const byFirstRound = {};
  Object.entries(S.genBlocks).forEach(([agentId, blocks]) => {
    const r = blocks.initial.round;
    (byFirstRound[r] = byFirstRound[r] || []).push(agentId);
  });
  const sortedRounds = Object.keys(byFirstRound).map(Number).sort((a, b) => a - b);
  sortedRounds.forEach((roundNum, idx) => {
    const agentIds = byFirstRound[roundNum];
    const title = idx === 0
      ? `Round ${roundNum} — Generation`
      : `Round ${roundNum} — New agent generation (${agentIds.length} agent${agentIds.length > 1 ? 's' : ''})`;
    panel.appendChild(makeRoundHdr(title, 'done'));
    agentIds.forEach(agentId => {
      const agent = agents.find(a => a.id === agentId);
      if (!agent) return;
      const card = makeResultCard(agent.name, agent.color, 'done');
      const bodyEl = card.querySelector('.rcard-body');
      const blocks = S.genBlocks[agentId];
      bodyEl.appendChild(document.createTextNode(blocks.initial.text));
      blocks.extensions.forEach(ext => {
        bodyEl.appendChild(document.createTextNode(
          `\n\n--- REFLECTION-EXTENDED DIRECTIONS (round ${ext.round}) ---\n${ext.text}`
        ));
      });
      panel.appendChild(card);
      genCardEls[agentId] = { bodyEl, hdrEl: card.querySelector('.rcard-hdr') };
    });
  });
}
