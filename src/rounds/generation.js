import { S, agents, genCardEls, costS } from '../state.js';
import { DEPTH_DIRS } from '../constants.js';
import { streamAI, callParallel, agentSystemBlocks } from '../api.js';
import { makeRoundHdr, makeResultCard } from '../ui/helpers.js';
import { lockTabs, unlockTabs, switchTab, tc, setStatus } from '../ui/tabs.js';
import { renderPairingsPanel } from '../ui/panels/pairings.js';
import { runSynthesis } from './synthesis.js';

export async function runGen() {
  if (S.running) return;
  const activeAgents  = agents.filter(a => S.selectedAgents.has(a.id) && S.agentStatuses[a.id] !== 'retired' && S.agentStatuses[a.id] !== 'genonly');
  const genOnlyAgents = agents.filter(a => S.selectedAgents.has(a.id) && S.agentStatuses[a.id] === 'genonly');
  const allCandidates = [...activeAgents, ...genOnlyAgents];
  if (!allCandidates.length) { setStatus('Select at least one agent.'); return; }

  // Validate API key
  const p = S.provider || 'gemini';
  const keyEl = document.getElementById('api-key-' + p);
  if (!keyEl || !keyEl.value.trim()) { setStatus(`Enter your ${p} API key first.`); return; }

  const isFirstRound = S.currentRound === 0;
  const allGenAgents = isFirstRound ? allCandidates : allCandidates.filter(a => !S.genBlocks[a.id]);
  if (!allGenAgents.length) {
    setStatus('All agents already have generation outputs. Launch debate from the Next Round tab.');
    return;
  }

  S.running = true; lockTabs();
  if (isFirstRound) S.currentRound++;
  if (isFirstRound) {
    S.genBlocks = {}; S.compressedGen = {}; S.currentDebates = {}; S.agentReflections = {};
    Object.keys(genCardEls).forEach(k => delete genCardEls[k]);
  }
  document.getElementById('run-btn').disabled = true;

  const panel = document.getElementById('panel-gen');
  if (isFirstRound) panel.innerHTML = '';
  const hdr = makeRoundHdr(
    isFirstRound
      ? `Round ${S.currentRound} — Generation`
      : `Round ${S.currentRound} — New agent generation (${allGenAgents.length} agent${allGenAgents.length > 1 ? 's' : ''})`,
    'running'
  );
  panel.appendChild(hdr);
  switchTab('gen');
  setStatus(isFirstRound
    ? `Round ${S.currentRound} — ${allGenAgents.length} agents in parallel...`
    : `Generating ${allGenAgents.length} new agent${allGenAgents.length > 1 ? 's' : ''} — existing outputs preserved...`);

  const cards = {}, bodyEls = {};
  allGenAgents.forEach(agent => {
    S.genBlocks[agent.id] = { initial: { round: S.currentRound, text: '' }, extensions: [] };
    const card = makeResultCard(agent.name, agent.color, 'running');
    panel.appendChild(card);
    cards[agent.id] = card;
    bodyEls[agent.id] = card.querySelector('.rcard-body');
    genCardEls[agent.id] = { bodyEl: bodyEls[agent.id], hdrEl: card.querySelector('.rcard-hdr') };
    bodyEls[agent.id].innerHTML = '<span class="cursor"></span>';
  });

  try {
    const makeAgentCall = agent =>
      streamAI({
        name: agent.name.slice(0, 22),
        role: 'generation',
        systemBlocks: agentSystemBlocks(agent.mandate),
        messages: [{ role: 'user', content: DEPTH_DIRS[S.depth] }],
        signal: new AbortController().signal,
        onChunk: chunk => {
          S.genBlocks[agent.id].initial.text += chunk;
          bodyEls[agent.id].innerHTML = S.genBlocks[agent.id].initial.text + '<span class="cursor"></span>';
        },
      }).then(result => {
        S.genBlocks[agent.id].initial.text = result;
        bodyEls[agent.id].innerHTML = result;
        const badge = cards[agent.id].querySelector('.badge');
        if (badge) { badge.className = 'badge b-done'; badge.textContent = 'done'; }
        const last = costS.calls[0];
        if (last) {
          const h = cards[agent.id].querySelector('.rcard-hdr');
          if (last.hit) { const s = document.createElement('span'); s.className = 'rcard-cache'; s.textContent = '⚡'; h.appendChild(s); }
          const s = document.createElement('span'); s.className = 'rcard-cost'; s.textContent = '$' + last.cost.toFixed(4); h.appendChild(s);
        }
      });

    setStatus(`Round ${S.currentRound} — ${allGenAgents.length} agent${allGenAgents.length > 1 ? 's' : ''} running...`);
    await callParallel(allGenAgents.map(a => () => makeAgentCall(a)));
    hdr.querySelector('#rh-s').className = 'round-status rs-done';
    hdr.querySelector('#rh-s').textContent = 'done';
    tc('gen', allGenAgents.length);
    setStatus('Generation complete. Running synthesis...');
    await runSynthesis(false);
  } catch (e) {
    if (e.name !== 'AbortError') {
      setStatus('Error: ' + e.message);
      const s = hdr.querySelector('#rh-s');
      if (s) { s.className = 'round-status rs-error'; s.textContent = 'error'; }
    }
  }
  S.running = false; unlockTabs();
  document.getElementById('run-btn').disabled = false;
  renderPairingsPanel();
}
