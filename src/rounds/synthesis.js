import { S, agents } from '../state.js';
import { MAX_TOKENS } from '../constants.js';
import { streamAI, briefOnlyBlock } from '../api.js';
import { buildMapBlock, flatGen, flatCompressed } from '../utils.js';
import { makeRoundHdr, mkBtn, makeNotice } from '../ui/helpers.js';
import { switchTab, tc, setStatus } from '../ui/tabs.js';
import { parseSynthesis } from '../parse/synthesis.js';
import { saveRound, autoExportJson, autoExportMd } from '../parse/session.js';
import { runAttribution } from './attribution.js';
import { runMeta } from './meta.js';

export async function compressGenerationOutputs() {
  const entries = Object.entries(S.genBlocks).filter(([id]) => S.agentStatuses[id] !== 'retired');
  if (!entries.length) return [];

  // ── Batch 1: Initial-block compression ──────────────────────────────────
  const needsInitial = entries.filter(([id]) => !S.compressedGen[id]);
  if (needsInitial.length) {
    const agentBlocks = needsInitial.map(([id], i) => {
      const name = agents.find(a => a.id === id)?.name || id;
      const block = S.genBlocks[id];
      return `===AGENT_${i}===\nAGENT: ${name}\n${block.initial.text}`;
    }).join('\n\n---\n\n');

    const prompt =
      `Summarise each agent's initial generation output below in approximately 80 words each, ` +
      `preserving the key technical claims and proposed methods. Begin each summary immediately ` +
      `after its ===AGENT_N=== delimiter. Your output must contain only the delimiters and summary ` +
      `text — do not add any titles, labels, or headers of your own.\n\nOutputs:\n${agentBlocks}`;

    let raw = '';
    await streamAI({
      name: 'gen-compress-init',
      role: 'compression',
      systemBlocks: briefOnlyBlock(),
      messages: [{ role: 'user', content: prompt }],
      signal: new AbortController().signal,
      maxTokensOverride: Math.max(MAX_TOKENS.compression, needsInitial.length * 200),
      onChunk: c => { raw += c; },
    });

    const parts = raw.split(/===AGENT_\d+===/);
    needsInitial.forEach(([id], i) => {
      const block = S.genBlocks[id];
      const summary = (parts[i + 1] || '').replace(/={1,3}$/, '').trim();
      const fallback = block.initial.text.slice(0, 400) + '...';
      S.compressedGen[id] = {
        initialSummary: { round: block.initial.round, summary: summary || fallback },
        extensionSummaries: [],
      };
    });
  }

  // ── Batch 2: Extension-block compression ────────────────────────────────
  const extensionBatch = entries.filter(([id]) => {
    if (!S.compressedGen[id]) return false;
    return S.genBlocks[id].extensions.length > S.compressedGen[id].extensionSummaries.length;
  });

  if (extensionBatch.length) {
    const agentBlocks = extensionBatch.map(([id], i) => {
      const name = agents.find(a => a.id === id)?.name || id;
      const blocks = S.genBlocks[id];
      const cached = S.compressedGen[id];
      const ext = blocks.extensions[cached.extensionSummaries.length];
      return `===AGENT_${i}===\nAGENT: ${name}\n${ext.text}`;
    }).join('\n\n---\n\n');

    const prompt =
      `Summarise each agent's reflection-extended directions below in approximately 60 words each, ` +
      `preserving key technical claims and new directions proposed. Begin each summary immediately ` +
      `after its ===AGENT_N=== delimiter. Your output must contain only the delimiters and summary ` +
      `text — do not add any titles, labels, or headers of your own.\n\nOutputs:\n${agentBlocks}`;

    let raw = '';
    await streamAI({
      name: 'gen-compress-ext',
      role: 'compression',
      systemBlocks: briefOnlyBlock(),
      messages: [{ role: 'user', content: prompt }],
      signal: new AbortController().signal,
      maxTokensOverride: Math.max(MAX_TOKENS.compression, extensionBatch.length * 160),
      onChunk: c => { raw += c; },
    });

    const parts = raw.split(/===AGENT_\d+===/);
    extensionBatch.forEach(([id], i) => {
      const blocks = S.genBlocks[id];
      const cached = S.compressedGen[id];
      const ext = blocks.extensions[cached.extensionSummaries.length];
      const summary = (parts[i + 1] || '').replace(/={1,3}$/, '').trim();
      const fallback = ext.text.slice(0, 400) + '...';
      cached.extensionSummaries.push({ round: ext.round, summary: summary || fallback });
    });
  }

  return entries.map(([id]) => {
    const name = agents.find(a => a.id === id)?.name || id;
    return { name, summary: flatCompressed(id) };
  });
}

export async function runSynthesis(includeDebate) {
  S._pendingSynthesisArgs = { includeDebate };
  const panel = document.getElementById('panel-syn');
  panel.innerHTML = '';
  const hdr = makeRoundHdr('Synthesis', 'running');
  panel.appendChild(hdr);
  switchTab('syn');

  S.currentSynthesis = '';
  const sc = document.createElement('div');
  sc.className = 'synth-card';
  sc.innerHTML = `<div class="synth-hdr"><span class="synth-title">Synthesis arbitration</span><span class="badge b-run">running</span></div><div class="rcard-body" id="syn-body"><span class="cursor"></span></div>`;
  panel.appendChild(sc);

  let allOutputs = '';

  try {
    if (includeDebate) {
      setStatus('Compressing generation outputs for synthesis...');
      const genSummaries = await compressGenerationOutputs();
      genSummaries.forEach(({ name, summary }) => {
        allOutputs += `\n\n=== ${name.toUpperCase()} (generation summary) ===\n${summary}`;
      });
      Object.entries(S.currentDebates).forEach(([key, { text }]) => {
        const [id1, id2] = key.split('_');
        const n1 = agents.find(a => a.id === id1)?.name || id1;
        const n2 = agents.find(a => a.id === id2)?.name || id2;
        allOutputs += `\n\n=== DEBATE: ${n1.toUpperCase()} → ${n2.toUpperCase()} ===\n${text}`;
      });
    } else {
      Object.entries(S.genBlocks)
        .filter(([id]) => S.agentStatuses[id] !== 'retired')
        .forEach(([id]) => {
          const agent = agents.find(a => a.id === id);
          allOutputs += `\n\n=== ${agent ? agent.name.toUpperCase() : id} ===\n${flatGen(id)}`;
        });
    }

    const directionsSection = S.researchMap.length === 0
      ? `RESEARCH DIRECTIONS:
List 4-6 directions. Each title must be under 20 words. Classify each direction using two axes:
  DEEP = theoretically fundamental or novel; SHALLOW = incremental or applied.
  TRACTABLE = feasible with available data and methods now; BLOCKED = requires unavailable data or an unresolved theoretical prerequisite.
Category must be one of: DEEP+TRACTABLE, DEEP+BLOCKED, SHALLOW+TRACTABLE, SHALLOW+BLOCKED. Use this format:

  [DEEP+TRACTABLE] Title
  SUMMARY: methods=<method(s) or model(s) used, in a few words — list more than one if the direction genuinely combines them>; phenomenon=<specific phenomenon being explained, in a few words>
  [DEEP+BLOCKED] Title
  [SHALLOW+TRACTABLE] Title
  [SHALLOW+BLOCKED] Title

Include one SUMMARY line immediately after every direction's title line, in the same methods=...; phenomenon=... format.`
      : `EXISTING RESEARCH MAP — directions already identified across prior rounds:
${buildMapBlock(S.researchMap)}

RESEARCH DIRECTIONS:
List 4-6 directions. Each title must be under 20 words. Classify each direction using two axes:
  DEEP = theoretically fundamental or novel; SHALLOW = incremental or applied.
  TRACTABLE = feasible with available data and methods now; BLOCKED = requires unavailable data or an unresolved theoretical prerequisite.
Category must be one of: DEEP+TRACTABLE, DEEP+BLOCKED, SHALLOW+TRACTABLE, SHALLOW+BLOCKED. Use this format:

  [DEEP+TRACTABLE] Title
  SUMMARY: methods=<method(s) or model(s) used, in a few words — list more than one if the direction genuinely combines them>; phenomenon=<specific phenomenon being explained, in a few words>
  [DEEP+BLOCKED] Title
  [SHALLOW+TRACTABLE] Title
  [SHALLOW+BLOCKED] Title

Include one SUMMARY line immediately after every direction's title line, in the same methods=...; phenomenon=... format.

After SUMMARY, classify this direction's relationship to the existing map above with exactly one of the following on the next line:
  EXTENDS: RN-n    — builds on, narrows, or adds a genuinely new method/scope to an existing direction. RN-n is the exact ID shown at the start of a line above — copy it exactly, e.g. R3-2 — not an integer, not a title.
  SAME AS: RN-n    — substantively the same research question and method as an existing direction, even if the title or phrasing is different. RN-n is the existing entry's ID.
  NEW DIRECTION    — this direction is new this round and does not extend or duplicate anything in the existing map above.

The label line must contain only the label — no explanation, justification, or additional text. Labels are machine-parsed.

If in doubt between SAME AS and EXTENDS: EXTENDS adds a genuinely new method, scope, or phenomenon; SAME AS addresses the same question by the same method, even if the title or phrasing differs.

This is round R${S.currentRound}. The existing map above contains only directions from rounds R1 through R${S.currentRound - 1}. EXTENDS and SAME AS must reference an ID from that map — IDs beginning with R${S.currentRound} do not exist yet and cannot be referenced. If a direction has no parent in the existing map, write NEW DIRECTION; that is the correct label, not EXTENDS to another direction you are proposing in this round.`;

    const synthPrompt = `You have received outputs from a multi-agent theoretical research swarm. All outputs:\n${allOutputs}

Write a concise synthesis using these exact sections. Keep strictly to the word limits — do not pad.

${directionsSection}

CONVERGENCES (60 words max): 2-3 mechanisms multiple agents independently converge on. One sentence each.

TENSIONS (80 words max): 2-3 productive tensions. State each as a precise incompatible claim pair in one sentence.

MOST TRACTABLE FIRST STEP (50 words max): One specific analysis, one dataset, one method.

BLIND SPOTS (40 words max): 1-2 phenomena not addressed. One sentence each.

CONTRADICTIONS (one per line, exact format):
AGENT1 vs AGENT2: [claim A in ≤15 words] | [claim B in ≤15 words] | Resolution needed: [method in ≤15 words]
(2-3 contradictions)`;

    setStatus('Running synthesis...');
    const synthMaxTok = (includeDebate && S.reflectionsEnabled) ? 2500 : MAX_TOKENS.synthesis;
    const result = await streamAI({
      name: 'synthesis',
      role: 'synthesis',
      systemBlocks: briefOnlyBlock(),
      messages: [{ role: 'user', content: synthPrompt }],
      signal: new AbortController().signal,
      maxTokensOverride: synthMaxTok,
      onChunk: chunk => {
        S.currentSynthesis += chunk;
        const el = document.getElementById('syn-body');
        if (el) el.innerHTML = S.currentSynthesis + '<span class="cursor"></span>';
      },
    });
    S.currentSynthesis = result;
    const el = document.getElementById('syn-body');
    if (el) el.innerHTML = result;
    const badge = sc.querySelector('.badge');
    badge.className = 'badge b-done'; badge.textContent = 'done';
    const s = hdr.querySelector('#rh-s');
    if (s) { s.className = 'round-status rs-done'; s.textContent = 'done'; }
    tc('syn', 1);
    setStatus('Synthesis complete. Running meta-agent...');
    const { newEntries, reusedEntries } = parseSynthesis(result);
    const attributionOk = await runAttribution([...newEntries, ...reusedEntries]);
    if (!attributionOk) {
      panel.appendChild(makeNotice('Attribution call failed this round — new research map entries have no agent/debate attribution. Synthesis itself succeeded; this does not block the session.'));
    }
    await runMeta(result);
    saveRound(includeDebate);
    S._pendingSynthesisArgs = null;
    autoExportJson();
    autoExportMd();
  } catch (e) {
    if (e.name === 'AbortError') return;
    const synBody = document.getElementById('syn-body');
    if (synBody) {
      synBody.innerHTML = '';
      const errMsg = document.createElement('span');
      errMsg.style.color = 'var(--danger)';
      errMsg.textContent = `Synthesis error: ${e.message}`;
      synBody.appendChild(errMsg);
      synBody.appendChild(mkBtn('retry synthesis →', 'sm-btn', retrySynthesis, 'display:block;margin-top:10px;'));
    }
    const badge = sc.querySelector('.badge');
    if (badge) { badge.className = 'badge b-err'; badge.textContent = 'error'; }
    const s = hdr.querySelector('#rh-s');
    if (s) { s.className = 'round-status rs-error'; s.textContent = 'error'; }
    setStatus('Synthesis error: ' + e.message + ' — click "retry synthesis" in the synthesis panel to try again.');
  }
}

export async function retrySynthesis() {
  if (S.running || !S._pendingSynthesisArgs) return;
  S.running = true;
  document.querySelector('.tab-bar').classList.add('tabs-locked');
  document.getElementById('run-btn').disabled = true;
  await runSynthesis(S._pendingSynthesisArgs.includeDebate);
  S.running = false;
  document.querySelector('.tab-bar').classList.remove('tabs-locked');
  document.getElementById('run-btn').disabled = false;
  const { renderPairingsPanel } = await import('../ui/panels/pairings.js');
  renderPairingsPanel();
}
