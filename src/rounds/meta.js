import { S, agents } from '../state.js';
import { streamAI } from '../api.js';
import { setStatus } from '../ui/tabs.js';
import { renderAgentList } from '../ui/agents.js';
import { renderPairingsPanel } from '../ui/panels/pairings.js';
import { updateOverlapMatrix } from '../ui/panels/overlap.js';

export async function runMeta(synthesisText) {
  const active = agents.filter(a => S.agentStatuses[a.id] !== 'retired' && S.genBlocks[a.id]);
  if (active.length < 2) {
    S.pairingProposals = [];
    S.retirementProposals = [];
    renderPairingsPanel();
    return;
  }
  const agentList = active.map(a => `- ${a.name} (id: ${a.id}, status: ${S.agentStatuses[a.id] || 'active'})`).join('\n');

  let reflectionContext = '';
  if (S.reflectionsEnabled && Object.keys(S.agentReflections).length) {
    const lines = [];
    Object.entries(S.agentReflections).forEach(([agentId, ref]) => {
      const agentName = agents.find(a => a.id === agentId)?.name || agentId;
      const learning = (ref.learning || '').trim();
      const history = ref.history || {};
      const partnerIdsWithRebuttals = Object.entries(history)
        .filter(([, entries]) => entries.some(e => e.rebuttal && e.round === S.currentRound))
        .map(([pid]) => agents.find(a => a.id === pid)?.name || pid);
      const hasRebuttals = partnerIdsWithRebuttals.length > 0;
      if (learning) {
        const learningSnippet = learning.length > 200 ? learning.slice(0, 200) + '…' : learning;
        lines.push(`- ${agentName} — new directions this round: "${learningSnippet}"${hasRebuttals ? '; rebuttal available from: ' + partnerIdsWithRebuttals.join(', ') : ''}`);
      }
    });
    if (lines.length) {
      reflectionContext = `\nWhat agents learned this round (use to judge whether new theoretical territory remains):\n${lines.join('\n')}\n`;
    }
  }

  const metaPrompt = `You are a meta-agent directing a research swarm. Synthesis:

${synthesisText}

Active agents:
${agentList}
${reflectionContext}
Propose debate pairings. IMPORTANT: agents may have MULTIPLE pairings — assign as many as are genuinely productive. There is no one-partner limit. Pairing decisions should be driven by whether new theoretical territory remains to explore, not by pending rebuttals.

For each pair (exact format):
PAIR: [id1] | [id2] | [type] | [one-sentence justification]
Types: CONTRADICTION (incompatible claims), INTERSECTION (unexplored overlap), DISRUPTION (break premature consensus), BRIDGE (connect tractable to deep)

For agent status changes (exact format):
RETIRE: [id] | [reason]
PROMOTE: [id] | [reason]
GENONLY: [id] | [reason] — contributes to generation but excluded from debate pairings
ACTIVATE: [id] | [reason] — restore a genonly or promoted agent to full active status

Propose 4-8 pairs total. Be direct; only change status if genuinely warranted.`;

  try {
    const result = await streamAI({
      name: 'meta-agent',
      role: 'meta',
      systemString: 'You are a research director making editorial decisions about theoretical perspectives. Be direct and opinionated.',
      messages: [{ role: 'user', content: metaPrompt }],
      signal: new AbortController().signal,
      onChunk: () => {},
    });
    parseMeta(result);
    updateOverlapMatrix();
    setStatus('Ready. Review pairings in Next Round tab, then run debate round.');
  } catch (e) {
    setStatus('Meta-agent error: ' + e.message);
  }
}

export function parseMeta(text) {
  const pairs = [];
  for (const m of text.matchAll(/PAIR:\s*([^\|]+)\|\s*([^\|]+)\|\s*([^\|]+)\|\s*([^\n]+)/g)) {
    const id1 = m[1].trim(), id2 = m[2].trim();
    if (agents.find(a => a.id === id1) && agents.find(a => a.id === id2) && id1 !== id2) {
      pairs.push({ id1, id2, type: m[3].trim().toUpperCase(), reason: m[4].trim(), enabled: true });
    }
  }
  const seenPairs = new Set();
  S.pairingProposals = pairs.filter(p => {
    const k = p.id1 + '|' + p.id2;
    if (seenPairs.has(k)) return false;
    seenPairs.add(k); return true;
  });
  const recs = [];
  const statusMap = { RETIRE: 'retired', PROMOTE: 'promoted', GENONLY: 'genonly', ACTIVATE: 'active' };
  for (const [kw, status] of Object.entries(statusMap)) {
    for (const m of text.matchAll(new RegExp(`${kw}:\\s*([^|]+)\\|\\s*([^\\n]+)`, 'g'))) {
      const id = m[1].trim();
      if (agents.find(a => a.id === id)) {
        recs.push({ id, action: kw.toLowerCase(), status, reason: m[2].trim(), accepted: false });
      }
    }
  }
  S.retirementProposals = recs;
  renderPairingsPanel();
  renderAgentList();
}
