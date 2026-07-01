import { S, agents, brief, _handoverContent, _handoverTitle, setHandoverContent, setHandoverTitle } from '../state.js';
import { HANDOVER_ROLE } from '../constants.js';
import { streamAI, buildCachedBlock } from '../api.js';
import { setStatus } from '../ui/tabs.js';
import { flatCompressedUpTo, flatGen } from '../utils.js';

// Forward-declared — set by map.js via main.js to avoid circular dep
let _openHandoverModal, _updateHandoverModal;
export function setHandoverModalFns(open, update) {
  _openHandoverModal = open;
  _updateHandoverModal = update;
}

function openHandoverModal(title) {
  document.getElementById('handover-modal-title').textContent = title;
  document.getElementById('handover-output').innerHTML = '<span class="cursor"></span>';
  document.getElementById('handover-download-btn').disabled = true;
  document.getElementById('handover-modal').classList.remove('hidden');
}

function updateHandoverModal(text, done, errorMsg) {
  const el = document.getElementById('handover-output');
  if (!el) return;
  if (errorMsg) { el.innerHTML = `<span style="color:var(--danger)">Error: ${errorMsg}</span>`; return; }
  el.textContent = text || '';
  if (!done) el.innerHTML += `<span class="cursor"></span>`;
  if (done) document.getElementById('handover-download-btn').disabled = false;
}

export function buildHandoverContext(item) {
  const attributedIds = new Set((item.agents || []).map(a => a.id));
  const profileAgents = attributedIds.size
    ? agents.filter(a => attributedIds.has(a.id))
    : agents.filter(a => S.agentStatuses[a.id] !== 'retired');

  const agentProfiles = profileAgents.map(a => `${a.name} (id: ${a.id})\n${a.mandate}`).join('\n\n');
  const synthesisHistory = S.rounds.map(r => `=== SYNTHESIS: Round ${r.round} ===\n${r.synthesis || '(none)'}`).join('\n\n');

  const genAgentIds = attributedIds.size
    ? [...attributedIds]
    : Object.keys(S.genBlocks).filter(id => S.agentStatuses[id] !== 'retired');

  const compressedGen = genAgentIds.map(id => {
    const name = agents.find(a => a.id === id)?.name || id;
    const maxRound = Math.max(...(item.agents || []).filter(a => a.id === id).map(a => a.round), 1);
    const text = flatCompressedUpTo(id, maxRound) || flatGen(id);
    return `=== ${name.toUpperCase()} ===\n${text}`;
  }).join('\n\n');

  const attributedDebate = (item.debateRefs || []).map(ref => {
    const round = S.rounds.find(r => r.round === ref.round);
    const text = round?.debates?.[ref.key]?.text || '(not found in session export)';
    const [id1, id2] = ref.key.split('_');
    const n1 = agents.find(a => a.id === id1)?.name || id1;
    const n2 = agents.find(a => a.id === id2)?.name || id2;
    return `=== DEBATE: ${n1} → ${n2}, Round ${ref.round} ===\n${text}`;
  }).join('\n\n');

  const contradictions = S.contradictions.length
    ? S.contradictions.map(c =>
        `${c.a1} vs ${c.a2} (Round ${c.round})\n  ${c.claim1} — vs — ${c.claim2}\n  Resolution needed: ${c.resolution}`
      ).join('\n\n')
    : '(none recorded)';

  const mapById = Object.fromEntries(S.researchMap.map(r => [r.id, r]));
  const roots = S.researchMap.filter(r => !r.parentIds.length || !r.parentIds.some(pid => mapById[pid]));
  function renderMapEntry(r, depth) {
    const indent = '  '.repeat(depth);
    let line = `${indent}[${r.category}] ${r.title} (Round ${r.round}${r.tag ? ', ' + r.tag : ''})`;
    if (r.agents && r.agents.length) {
      const attrNames = r.agents.map(a => `${agents.find(ag => ag.id === a.id)?.name || a.id} (R${a.round})`).join(', ');
      line += ` — agents: ${attrNames}`;
    }
    const children = S.researchMap.filter(c => c.parentIds.includes(r.id));
    return [line, ...children.map(c => renderMapEntry(c, depth + 1))].join('\n');
  }
  const researchMap = roots.map(r => renderMapEntry(r, 0)).join('\n');

  return { agentProfiles, synthesisHistory, compressedGen, attributedDebate, contradictions, researchMap };
}

export function buildHandoverUserMsg(item, ctx) {
  return (
`SELECTED DIRECTION: ${item.title}
CATEGORY: ${item.category}
FIRST IDENTIFIED: Round ${item.round}
RESEARCHER TAG: ${item.tag || 'untagged'}

---

AGENT PROFILES (agents attributed to this direction):
${ctx.agentProfiles}

---

SYNTHESIS HISTORY (all rounds):
${ctx.synthesisHistory}

---

GENERATION OUTPUTS (compressed — full text in session export):
${ctx.compressedGen}

---

DEBATE OUTPUTS ATTRIBUTED TO THIS DIRECTION (full text):
${ctx.attributedDebate || '(no debates attributed — draw on synthesis history and generation outputs)'}

---

CONTRADICTION TRACKER:
${ctx.contradictions}

---

FULL RESEARCH MAP (all directions, for related-direction identification):
${ctx.researchMap}

---

Produce the handover document using these sections in this exact order. Do not add, rename, or reorder sections.

## ${item.title}

**Category:** ${item.category} | **First identified:** Round ${item.round}

### Research background
The theoretical and empirical landscape this direction sits within, as established by the swarm. Draw on convergences, tensions, and blind spots from the synthesis history. Give the researcher the intellectual context they need before beginning work — prior frameworks, known results, and the questions that remain open. Include a Mermaid diagram if it usefully represents the system structure or the relationship between competing theoretical frameworks.

### Direction proposal
A precise, self-contained statement of what this direction proposes: the research question, the theoretical claim, and the intended analytical approach. A researcher reading only this section should understand exactly what is being proposed and why it is non-trivial. State the central mathematical formulation using display equations. Include a Mermaid diagram of the model structure, data flow, or analytical pipeline where it adds clarity beyond what equations alone provide.

### Why this direction
What makes this direction scientifically promising: which tensions or contradictions from the session it addresses, which blind spots it fills, what convergence evidence supports it. Reference specific synthesis sections and debate exchanges by round number and agent name — the researcher has the full export. Explain what a successful outcome would contribute and why the question is genuinely open.

### Evidence from the session
Which agent outputs and debate exchanges substantiate this direction, and how. Attribute specifically: name the agent, characterise their contribution, state whether it came from initial generation, debate, or reflection extension, and give the round number. Point to locations in the export rather than reproducing at length.

### Required data and methods
For each dataset or method required: what it is, whether it is available from the brief's data sources or requires new collection, and any methodological prerequisites. Note where methods from multiple agents' frameworks would need to be combined, and flag non-trivial technical dependencies.

### Immediate next steps
Two or three actions the researcher can take right now — concrete enough to act on today, with minimal setup cost and high information return.

### Research programme
The full arc of work this direction represents, ordered by logical dependency.

#### Phase 1 — Groundwork
What must be established before the core work can proceed. State the deliverable: the specific result, dataset, or theoretical artifact that completes this phase and makes Phase 2 possible.

#### Phase 2 — Core contribution
The main analytical or theoretical work. What a successful outcome looks like; what a null or negative result would mean and how to interpret it. State the deliverable.

#### Phase 3 — Extension and consolidation
How the core result generalises, what adjacent questions it opens, what follow-on work becomes possible. Frame as conditional on Phase 2 outcomes. State potential publishable or shareable outputs.

### Known obstacles
Each obstacle with: a precise characterisation of the difficulty, whether a resolution was proposed in the session (cite by round and agent if so), and whether it remains open.

### Related directions
Directions from the research map that are complementary (could be combined or sequenced with this one) or in tension (address similar questions with incompatible assumptions). One or two sentences per direction.`
  );
}

export async function runHandover(id) {
  if (!S.rounds.length) {
    setStatus('Run at least one synthesis before generating a handover document.');
    return;
  }
  const item = S.researchMap.find(r => r.id === id);
  if (!item) return;

  setHandoverTitle(item.title);
  setHandoverContent('');
  openHandoverModal(item.title);
  setStatus('Generating handover document...');

  const handoverSystemBlocks = [
    { type: 'text', text: buildCachedBlock() },
    { type: 'text', text: '\n\n' + HANDOVER_ROLE },
  ];

  const ctx = buildHandoverContext(item);
  const userMsg = buildHandoverUserMsg(item, ctx);

  try {
    let result = '';
    await streamAI({
      name: `handover:${item.title.slice(0, 20)}`,
      role: 'handover',
      systemBlocks: handoverSystemBlocks,
      messages: [{ role: 'user', content: userMsg }],
      signal: new AbortController().signal,
      onChunk: chunk => {
        result += chunk;
        updateHandoverModal(result, false);
      },
    });
    setHandoverContent(result);
    updateHandoverModal(result, true);
    setStatus('Handover document ready — review and download from the modal.');
  } catch (e) {
    if (e.name === 'AbortError') return;
    updateHandoverModal(null, false, e.message);
    setStatus('Handover error: ' + e.message);
  }
}

export function downloadHandover() {
  if (!_handoverContent) return;
  const prefix = brief.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24);
  const slug   = _handoverTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  const fname  = `${prefix}-handover-${slug}.md`;
  try {
    const blob = new Blob([_handoverContent], { type: 'text/markdown' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = fname; a.click();
    URL.revokeObjectURL(url);
    setStatus(`Handover exported: ${fname} → your Downloads folder`);
  } catch (e) { setStatus('Download failed: ' + e.message); }
}
