import { S, agents } from '../state.js';
import { streamAI, buildCachedBlock } from '../api.js';
import { unionBy } from '../utils.js';

export async function runAttribution(newDirections) {
  if (!newDirections.length) return;

  const activeAgents = agents.filter(a => S.agentStatuses[a.id] !== 'retired' && S.genBlocks[a.id]);
  if (!activeAgents.length) return;

  const debatePairs = Object.keys(S.currentDebates).map(key => {
    const [id1, id2] = key.split('_');
    const n1 = agents.find(a => a.id === id1)?.name || id1;
    const n2 = agents.find(a => a.id === id2)?.name || id2;
    return { key, label: `${n1} → ${n2}` };
  });

  const validAgentIds  = new Set(activeAgents.map(a => a.id));
  const validDebateKeys = new Set(debatePairs.map(p => p.key));

  const directionLines = newDirections.map((d, i) => `${i}: [${d.category}] ${d.title}`).join('\n');
  const agentLines = activeAgents.map(a => `${a.id}  (${a.name})`).join('\n');
  const debateLines = debatePairs.length
    ? debatePairs.map(p => `${p.key}  (${p.label})`).join('\n')
    : '(no debates this round)';

  const attributionPrompt =
`Classify which agents and debate exchanges made substantive contributions to each research direction.

An agent contributed substantively if the direction builds directly on their theoretical framework or a specific proposal they made.
A debate exchange is relevant if the direction emerged from or directly addresses a tension raised in that exchange.

DIRECTIONS:
${directionLines}

VALID AGENT IDs (copy exactly — do not invent or abbreviate):
${agentLines}

VALID DEBATE KEYS this round (copy exactly — do not invent):
${debateLines}

For each direction, output exactly one line in this format:
DIRECTION 0: agents=[id1,id2] debates=[key1]
DIRECTION 1: agents=[id3] debates=[]

Use an empty list [] where nothing contributed. Output only these lines — no explanation, no preamble.`;

  try {
    let raw = '';
    await streamAI({
      name: 'attribution',
      role: 'attribution',
      systemString: buildCachedBlock(),
      messages: [{ role: 'user', content: attributionPrompt }],
      signal: new AbortController().signal,
      onChunk: c => { raw += c; },
    });

    const attrRegex = /DIRECTION\s+(\d+):\s*agents=\[([^\]]*)\]\s*debates=\[([^\]]*)\]/g;
    for (const m of raw.matchAll(attrRegex)) {
      const idx = parseInt(m[1]);
      if (idx < 0 || idx >= newDirections.length) continue;
      const agentIds  = m[2].split(',').map(s => s.trim()).filter(id => id && validAgentIds.has(id));
      const debateKeys = m[3].split(',').map(s => s.trim()).filter(k => k && validDebateKeys.has(k));
      const entry = newDirections[idx];
      const newAttrs = agentIds.map(id => ({ id, round: S.currentRound }));
      entry.agents = unionBy(entry.agents, newAttrs, a => `${a.id}:${a.round}`);
      entry.debateRefs = [
        ...entry.debateRefs,
        ...debateKeys
          .filter(k => !entry.debateRefs.some(r => r.key === k && r.round === S.currentRound))
          .map(k => ({ round: S.currentRound, key: k })),
      ];
    }
  } catch (e) {
    console.warn('Attribution call failed:', e.message);
  }
}
