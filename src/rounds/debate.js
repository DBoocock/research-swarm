import { S, agents } from '../state.js';
import { DEPTH_WORDS } from '../constants.js';
import { streamAI, callParallel, agentSystemBlocks } from '../api.js';
import { makeRoundHdr, makeDebateCard } from '../ui/helpers.js';
import { lockTabs, unlockTabs, switchTab, tc, setStatus } from '../ui/tabs.js';
import { renderPairingsPanel } from '../ui/panels/pairings.js';
import { flatGen } from '../utils.js';
import { runReflectionRound } from './reflection.js';
import { runSynthesis } from './synthesis.js';

function buildPairHistory(criticId, partnerId, partnerName) {
  const criticHistory  = S.agentReflections[criticId]?.history?.[partnerId]  || [];
  const partnerHistory = S.agentReflections[partnerId]?.history?.[criticId]   || [];
  const rounds = new Map();
  criticHistory.forEach(e => { if (e.critique != null) rounds.set(e.round, { critique: e.critique, rebuttal: null }); });
  partnerHistory.forEach(e => { if (e.rebuttal != null && rounds.has(e.round)) rounds.get(e.round).rebuttal = e.rebuttal; });
  if (!rounds.size) return '';
  const sorted = [...rounds.entries()].sort((a, b) => a[0] - b[0]);
  let out = `Prior exchange history with ${partnerName} (chronological):\n`;
  sorted.forEach(([round, { critique, rebuttal }]) => {
    out += `\n[Round ${round} — your critique]\n${critique}\n`;
    if (rebuttal) out += `[Round ${round} — ${partnerName}'s rebuttal]\n${rebuttal}\n`;
  });
  return out + '\n';
}

export async function runDebate() {
  if (S.running) return;
  const activePairs = S.pairingProposals.filter(p => p.enabled);
  if (!activePairs.length) { setStatus('No pairs enabled.'); return; }
  S.running = true; lockTabs(); S.currentDebates = {};
  S.currentRound++;
  document.getElementById('run-btn').disabled = true;
  const panel = document.getElementById('panel-deb');
  panel.innerHTML = '';
  const hdr = makeRoundHdr(`Round ${S.currentRound} — Debate`, 'running');
  panel.appendChild(hdr);
  switchTab('deb');

  const agentPartners = {};
  activePairs.forEach(p => {
    if (!agentPartners[p.id1]) agentPartners[p.id1] = [];
    agentPartners[p.id1].push({ id: p.id2, type: p.type, reason: p.reason });
  });

  const words = DEPTH_WORDS[S.depth];
  const pairBodyEls = {};
  activePairs.forEach(pair => {
    const key = pair.id1 + '_' + pair.id2;
    S.currentDebates[key] = { text: '', type: pair.type };
    const a1 = agents.find(a => a.id === pair.id1), a2 = agents.find(a => a.id === pair.id2);
    const card = makeDebateCard(a1, a2, pair.type);
    panel.appendChild(card);
    pairBodyEls[key] = card.querySelector('.rcard-body');
    pairBodyEls[key].innerHTML = '<span class="cursor"></span>';
  });

  try {
    const debateEntries = Object.entries(agentPartners);
    const makeDebateCall = ([id1, partners]) => {
      const a1 = agents.find(a => a.id === id1);
      if (!a1) return Promise.resolve();
      const isBatched = partners.length > 1;
      const delimiters = partners.map(p => {
        const a2 = agents.find(a => a.id === p.id);
        return `RESPONSE TO ${a2?.name || p.id}:`;
      });
      let userMsg;
      if (isBatched) {
        userMsg = `You have ${partners.length} debate partners this round. For each, write a focused response of approximately ${words} words in the section provided. Do not add any headers or labels of your own.\n\n`;
        partners.forEach((p, i) => {
          const a2 = agents.find(a => a.id === p.id);
          const out2 = flatGen(p.id) || '(no output)';
          userMsg += `PARTNER ${i + 1} — ${a2?.name || p.id} [${p.type}]:\n${buildPairHistory(id1, p.id, a2?.name || p.id)}---\n${out2}\n---\n\n`;
        });
        userMsg += delimiters.map(d => `${d} [your ${words}-word response here]`).join('\n\n');
        userMsg += '\n\nChallenge assumptions, identify incompatible predictions, or show how combining frameworks yields something neither could produce alone. Be direct and technically specific.';
      } else {
        const p = partners[0];
        const a2 = agents.find(a => a.id === p.id);
        const out2 = flatGen(p.id) || '(no output)';
        userMsg = `You have read the output of ${a2?.name || p.id} (below). Write a focused debate response (~${words} words): challenge assumptions, identify incompatible predictions, or show how combining both frameworks yields something neither could produce alone.\n\n${buildPairHistory(id1, p.id, a2?.name || p.id)}${a2?.name || p.id} wrote:\n---\n${out2}\n---\n\nBe direct, technically specific, and honest about where your own framework has limits.`;
      }
      let streaming = '';
      return streamAI({
        name: `${a1.name.slice(0, 12)} (${partners.length}↔)`,
        role: 'debate',
        systemBlocks: agentSystemBlocks(a1.mandate),
        messages: [{ role: 'user', content: userMsg }],
        signal: new AbortController().signal,
        onChunk: chunk => {
          streaming += chunk;
          if (isBatched) {
            partners.forEach((p, i) => {
              const key = id1 + '_' + p.id;
              const start = streaming.indexOf(delimiters[i]);
              const rawEnd = i + 1 < delimiters.length ? streaming.indexOf(delimiters[i + 1]) : streaming.length;
              const end = rawEnd === -1 ? streaming.length : rawEnd;
              const slice = start !== -1 ? streaming.slice(start + delimiters[i].length, end).trim() : '';
              if (pairBodyEls[key]) pairBodyEls[key].innerHTML = slice + '<span class="cursor"></span>';
            });
          } else {
            const key = id1 + '_' + partners[0].id;
            if (pairBodyEls[key]) pairBodyEls[key].innerHTML = streaming + '<span class="cursor"></span>';
          }
        },
      }).then(result => {
        if (isBatched) {
          partners.forEach((p, i) => {
            const start = result.indexOf(delimiters[i]);
            const rawEnd = i + 1 < delimiters.length ? result.indexOf(delimiters[i + 1]) : result.length;
            const end = rawEnd === -1 ? result.length : rawEnd;
            const chunk = start !== -1 ? result.slice(start + delimiters[i].length, end).trim() : result;
            S.currentDebates[id1 + '_' + p.id].text = chunk;
            if (pairBodyEls[id1 + '_' + p.id]) pairBodyEls[id1 + '_' + p.id].innerHTML = chunk;
          });
        } else {
          const key = id1 + '_' + partners[0].id;
          S.currentDebates[key].text = result;
          if (pairBodyEls[key]) pairBodyEls[key].innerHTML = result;
        }
      });
    };

    setStatus(`Debate — ${debateEntries.length} pair${debateEntries.length > 1 ? 's' : ''} running...`);
    await callParallel(debateEntries.map(e => () => makeDebateCall(e)));
    const s = hdr.querySelector('#rh-s');
    if (s) { s.className = 'round-status rs-done'; s.textContent = 'done'; }
    tc('deb', activePairs.length);
    if (S.reflectionsEnabled) {
      setStatus('Debate complete. Running reflection round...');
      await runReflectionRound(activePairs);
    }
    setStatus('Debate complete. Running synthesis...');
    await runSynthesis(true);
  } catch (e) {
    if (e.name !== 'AbortError') setStatus('Debate error: ' + e.message);
  }
  S.running = false; unlockTabs();
  document.getElementById('run-btn').disabled = false;
  renderPairingsPanel();
}
