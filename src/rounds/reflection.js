import { S, agents, genCardEls, costS } from '../state.js';
import { streamAI, callParallel, agentSystemBlocks } from '../api.js';
import { switchTab, setStatus } from '../ui/tabs.js';
import { flatGen } from '../utils.js';

export async function runReflectionRound(activePairs) {
  const debatingAgentIds = new Set();
  activePairs.forEach(p => {
    if (S.agentStatuses[p.id1] !== 'retired') debatingAgentIds.add(p.id1);
    if (S.agentStatuses[p.id2] !== 'retired') debatingAgentIds.add(p.id2);
  });
  const debatingAgents = agents.filter(a => debatingAgentIds.has(a.id) && S.genBlocks[a.id]);
  if (!debatingAgents.length) return;

  setStatus(`Reflection — ${debatingAgents.length} agent${debatingAgents.length > 1 ? 's' : ''} processing debate outputs...`);
  switchTab('gen');

  const makeAgentReflection = agent => {
    const agentId = agent.id;
    const critiquesGenerated = [];
    const critiquesReceived  = [];
    activePairs.forEach(p => {
      const key = p.id1 + '_' + p.id2;
      const debateText = S.currentDebates[key]?.text;
      if (!debateText) return;
      const partnerName = agentId === p.id1
        ? agents.find(a => a.id === p.id2)?.name || p.id2
        : agents.find(a => a.id === p.id1)?.name || p.id1;
      if (p.id1 === agentId) {
        critiquesGenerated.push({ partnerId: p.id2, partnerName, debateText });
      } else if (p.id2 === agentId) {
        critiquesReceived.push({ partnerId: p.id1, partnerName, debateText });
      }
    });

    if (!critiquesGenerated.length && !critiquesReceived.length) return Promise.resolve();

    let reflectionSection = '';
    if (critiquesReceived.length) {
      reflectionSection += 'CRITIQUES YOU RECEIVED THIS ROUND:\n';
      critiquesReceived.forEach(({ partnerName, debateText }) => {
        reflectionSection += `\nFrom ${partnerName}:\n---\n${debateText}\n---\n`;
      });
    }
    if (critiquesGenerated.length) {
      reflectionSection += '\nCRITIQUES YOU GENERATED THIS ROUND:\n';
      critiquesGenerated.forEach(({ partnerName, debateText }) => {
        reflectionSection += `\nTo ${partnerName}:\n---\n${debateText}\n---\n`;
      });
    }

    const rebuttalInstructions = critiquesReceived.length
      ? critiquesReceived.map(({ partnerName }) =>
          `REBUTTAL TO ${partnerName}: [your substantive rebuttal in 2-4 sentences — what you concede, what you contest, and why]`
        ).join('\n')
      : '';

    const reflectionPrompt = `You have just completed a debate round. Review all your debate exchanges below and reflect on what you have learned.\n\n${reflectionSection}\n\nProvide structured reflection using these exact section labels:\n\n${rebuttalInstructions ? rebuttalInstructions + '\n\n' : ''}FOR EACH CRITIQUE YOU GENERATED: Did studying the partner\'s framework reveal anything that advances your own directions? (One paragraph per partner, labelled "CRITIQUE TO [name]:")\n\nACROSS ALL EXCHANGES: Are there new or deepened research directions unlocked by the combination of insights from this round?`;

    return streamAI({
      name: `reflect:${agent.name.slice(0, 14)}`,
      role: 'reflection',
      systemBlocks: agentSystemBlocks(agent.mandate),
      messages: [{ role: 'user', content: reflectionPrompt }],
      signal: new AbortController().signal,
      onChunk: () => {},
    }).then(reflectionOutput => {
      if (!S.agentReflections[agentId]) {
        S.agentReflections[agentId] = { history: {}, learning: '' };
      }
      const extractedRebuttals = {};
      critiquesReceived.forEach(({ partnerId, partnerName }) => {
        const escaped = partnerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`REBUTTAL TO ${escaped}:\\s*([\\s\\S]*?)(?=REBUTTAL TO |FOR EACH CRITIQUE|ACROSS ALL|$)`, 'i');
        const m = reflectionOutput.match(regex);
        extractedRebuttals[partnerId] = m ? m[1].trim().slice(0, 600) : '';
      });

      critiquesGenerated.forEach(({ partnerId, debateText }) => {
        if (!S.agentReflections[agentId].history[partnerId])
          S.agentReflections[agentId].history[partnerId] = [];
        S.agentReflections[agentId].history[partnerId].push({
          round: S.currentRound, critique: debateText, rebuttal: null,
        });
      });
      critiquesReceived.forEach(({ partnerId }) => {
        if (!S.agentReflections[agentId].history[partnerId])
          S.agentReflections[agentId].history[partnerId] = [];
        S.agentReflections[agentId].history[partnerId].push({
          round: S.currentRound, critique: null, rebuttal: extractedRebuttals[partnerId] || '',
        });
      });

      const acrossMatch = reflectionOutput.match(/ACROSS ALL EXCHANGES[:\s]*([^]*?)$/i);
      S.agentReflections[agentId].learning = acrossMatch ? acrossMatch[1].trim() : reflectionOutput.slice(-400);

      // ── Call 2: Generation extension ──────────────────────
      const genExtPrompt = `You have just reflected on your debate exchanges this round. Based on what you learned, extend your research directions.\n\nYOUR RESEARCH OUTPUT (all rounds, chronological — later sections are more recent):\n---\n${flatGen(agentId) || '(none)'}\n---\n\nYOUR REFLECTION:\n---\n${reflectionOutput}\n---\n\nAppend new or deepened research directions that were not in your prior output. Remain largely within your disciplinary framework, or at least draw heavily on your disciplinary framework if the direction is genuinely interdisciplinary. Be specific and technically rigorous. Begin your response directly with your new directions.`;

      const els = genCardEls[agentId];
      const extBodyEl = els?.bodyEl;
      let extensionAccumulated = '';
      let extensionTextNode = null;
      let extCursorEl = null;
      if (extBodyEl) {
        extBodyEl.appendChild(document.createTextNode(`\n\n--- REFLECTION-EXTENDED DIRECTIONS (round ${S.currentRound}) ---\n`));
        extensionTextNode = document.createTextNode('');
        extBodyEl.appendChild(extensionTextNode);
        extCursorEl = document.createElement('span');
        extCursorEl.className = 'cursor';
        extBodyEl.appendChild(extCursorEl);
      }

      return streamAI({
        name: `genext:${agent.name.slice(0, 14)}`,
        role: 'genextension',
        systemBlocks: agentSystemBlocks(agent.mandate),
        messages: [{ role: 'user', content: genExtPrompt }],
        signal: new AbortController().signal,
        onChunk: chunk => {
          extensionAccumulated += chunk;
          if (extensionTextNode) extensionTextNode.textContent = extensionAccumulated;
        },
      }).then(extensionOutput => {
        const text = extensionOutput.trim();
        if (!S.genBlocks[agentId]) {
          S.genBlocks[agentId] = { initial: { round: S.currentRound, text: '' }, extensions: [] };
        }
        S.genBlocks[agentId].extensions.push({ round: S.currentRound, text });
        if (extensionTextNode) extensionTextNode.textContent = text;
        if (extCursorEl) extCursorEl.remove();
        const last = costS.calls[0];
        if (last && els) {
          const costSpan = els.hdrEl.querySelector('.rcard-cost');
          if (costSpan) {
            const prev = parseFloat(costSpan.textContent.slice(1)) || 0;
            costSpan.textContent = '$' + (prev + last.cost).toFixed(4);
          }
          if (last.hit && !els.hdrEl.querySelector('.rcard-cache')) {
            const s = document.createElement('span'); s.className = 'rcard-cache'; s.textContent = '⚡';
            els.hdrEl.appendChild(s);
          }
        }
      });
    });
  };

  await callParallel(debatingAgents.map(a => () => makeAgentReflection(a)));
}
