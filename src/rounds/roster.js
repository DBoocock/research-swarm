import { S, agents, pendingMandateUpdates, _onAgentSaveCallback, setOnAgentSaveCallback } from '../state.js';
import { COLOURS } from '../constants.js';
import { streamAI, briefOnlyBlock, buildCachedBlock } from '../api.js';
import { makeSectionLabel, mkBtn } from '../ui/helpers.js';
import { setStatus } from '../ui/tabs.js';
import { renderAgentList, openAgentModal } from '../ui/agents.js';
import { renderOverlapMatrix } from '../ui/panels/overlap.js';

export async function runRosterAgent() {
  const btn = document.getElementById('roster-run-btn');
  btn.disabled = true; btn.textContent = 'running roster agent...';
  const results = document.getElementById('roster-results');
  results.innerHTML = '<div style="font-size:11px;color:var(--text3);padding:10px 0;">Analysing brief and agent roster...</div>';
  const mandateSummaries = agents.map(a =>
    `NAME: ${a.name}\nID: ${a.id}\nSTATUS: ${S.agentStatuses[a.id] || 'active'}\nMANDATE (first 200 chars): ${a.mandate.slice(0, 200)}...`
  ).join('\n\n');
  const synthHistory = S.rounds.slice(-2).map(r =>
    `Round ${r.round} synthesis excerpt:\n${r.synthesis ? r.synthesis.slice(0, 400) : '(none)'}`
  ).join('\n\n');

  const prompt = `You are a roster agent for a multi-agent research swarm. Analyse the current brief, agent mandates, and recent synthesis history. Provide structured recommendations.

BRIEF (combined):
${buildCachedBlock().slice(0, 1500)}...

CURRENT AGENTS:
${mandateSummaries}

RECENT SYNTHESIS HISTORY:
${synthHistory || 'No rounds completed yet.'}

Provide recommendations in these exact formats:

NEW AGENT: [name] | [color hex from: #7ac8c8 #c87ac8 #c8a07a #7a9fc8 #a07ac8 #7ac87a #c8c87a #c87a7a #7ac8a0 #c8b97a]
MANDATE: [full mandate text, ~120 words]
REASON: [why this agent would add value]
---
(repeat for each suggested new agent, maximum 3)

STATUS CHANGE: [id] | [new_status: active|genonly|retired|promoted] | [reason]
(one per line, only if warranted)

MANDATE UPDATE: [id] | [issue] | [suggested addition or correction in ~50 words]
(one per line, only if drift detected)

OVERLAP NOTES:
For each pair of existing agents with HIGH predicted debate productivity, output:
HIGH: [id1] | [id2] | [reason in one sentence]
For pairs with LOW predicted productivity:
LOW: [id1] | [id2] | [reason in one sentence]`;

  try {
    let raw = '';
    await streamAI({
      name: 'roster-agent',
      role: 'roster',
      systemBlocks: briefOnlyBlock(),
      messages: [{ role: 'user', content: prompt }],
      signal: new AbortController().signal,
      onChunk: c => { raw += c; },
    });
    renderRosterResults(raw);
  } catch (e) {
    results.innerHTML = `<div style="color:var(--danger);font-size:12px;padding:10px 0;">Error: ${e.message}</div>`;
  }
  btn.disabled = false; btn.textContent = 'run roster agent ✦';
}

export function renderRosterResults(raw) {
  const results = document.getElementById('roster-results');
  results.innerHTML = '';

  const newAgentMatches = [...raw.matchAll(/NEW AGENT:\s*([^\|]+)\|([^\n]+)\nMANDATE:\s*([^\n]+(?:\n(?!REASON:|NEW AGENT:|STATUS|MANDATE|OVERLAP|HIGH:|LOW:|---)[^\n]*)*)\nREASON:\s*([^\n]+)/g)];
  if (newAgentMatches.length) {
    const lbl = document.createElement('div'); lbl.className = 'sec-label'; lbl.textContent = 'Suggested new agents'; results.appendChild(lbl);
    newAgentMatches.forEach(m => {
      const name = m[1].trim(), colorHint = m[2].trim(), mandate = m[3].trim(), reason = m[4].trim();
      const usedColors = new Set(agents.map(a => a.color));
      const color = COLOURS.find(c => colorHint.includes(c.slice(1))) || COLOURS.find(c => !usedColors.has(c)) || COLOURS[0];
      const div = document.createElement('div'); div.className = 'roster-suggestion';
      div.innerHTML = `<div class="rs-hdr">
        <span class="agent-dot" style="background:${color}"></span>
        <span class="rs-name">${name}</span>
      </div>
      <div class="rs-mandate-preview" style="font-size:11px;color:var(--text3);line-height:1.5;margin:4px 0;">${mandate.slice(0, 180)}...</div>
      <div style="font-size:11px;color:var(--accent3);margin-bottom:6px;font-style:italic;">${reason}</div>
      <div class="rs-actions"></div>`;
      const actions = div.querySelector('.rs-actions');
      const addBtn = mkBtn('add agent', 'mbtn mbtn-p', () => addRosterAgentDirect(name, color, mandate, addBtn), 'font-size:10px;padding:4px 10px;');
      const editBtn = mkBtn('add & edit', 'mbtn mbtn-s', () => addRosterAgentEditDirect(name, color, mandate), 'font-size:10px;padding:4px 10px;');
      actions.appendChild(addBtn); actions.appendChild(editBtn);
      results.appendChild(div);
    });
  }

  const statusLines = [...raw.matchAll(/STATUS CHANGE:\s*([^\|]+)\|\s*([^\|]+)\|\s*([^\n]+)/g)];
  if (statusLines.length) {
    const lbl = document.createElement('div'); lbl.className = 'sec-label'; lbl.style.marginTop = '10px'; lbl.textContent = 'Status change recommendations'; results.appendChild(lbl);
    statusLines.forEach(m => {
      const id = m[1].trim(), newStatus = m[2].trim(), reason = m[3].trim();
      const agent = agents.find(a => a.id === id); if (!agent) return;
      const div = document.createElement('div'); div.className = 'rp-item'; div.style.marginBottom = '4px';
      div.innerHTML = `<span class="rp-action" style="background:var(--bg4);color:var(--text2)">${newStatus}</span>
        <span class="rp-text"><strong>${agent.name}</strong> — ${reason}</span>`;
      div.appendChild(mkBtn('apply', 'rp-btn', () => applyStatusChange(id, newStatus, div.querySelector('.rp-btn'))));
      results.appendChild(div);
    });
  }

  const mandateUpdates = [...raw.matchAll(/MANDATE UPDATE:\s*([^\|]+)\|\s*([^\|]+)\|\s*([^\n]+)/g)];
  if (mandateUpdates.length) {
    const lbl = document.createElement('div'); lbl.className = 'sec-label'; lbl.style.marginTop = '10px'; lbl.textContent = 'Mandate drift corrections'; results.appendChild(lbl);
    pendingMandateUpdates.clear();
    mandateUpdates.forEach((m, idx) => {
      const id = m[1].trim(), issue = m[2].trim(), suggestion = m[3].trim();
      const agent = agents.find(a => a.id === id); if (!agent) return;
      pendingMandateUpdates.set(idx, { id, issue, suggestion });
      const div = document.createElement('div'); div.style.cssText = 'background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:8px 10px;margin-bottom:4px;';
      const previewId = `mandate-preview-${idx}`;
      div.innerHTML = `<div style="font-size:11px;color:var(--text2);margin-bottom:3px;"><strong>${agent.name}</strong>: ${issue}</div>
        <div class="rs-mandate-preview" id="${previewId}" style="font-size:11px;color:var(--text3);font-style:italic;margin-bottom:6px;">${suggestion}</div>
        <div class="mandate-btn-row" style="display:flex;gap:6px;"></div>
        <div class="mandate-apply-status" style="font-size:10px;color:var(--text3);margin-top:5px;display:none;"></div>`;
      const btnRow = div.querySelector('.mandate-btn-row');
      const applyBtn = mkBtn('✦ apply correction', 'mbtn mbtn-p', () => autoApplyMandate(idx, applyBtn), 'font-size:10px;padding:4px 10px;');
      const editBtn = mkBtn('edit manually', 'sm-btn', () => editMandateManually(idx));
      btnRow.appendChild(applyBtn); btnRow.appendChild(editBtn);
      results.appendChild(div);
    });
  }

  const highPairs = [...raw.matchAll(/HIGH:\s*([^\|]+)\|\s*([^\|]+)\|\s*([^\n]+)/g)];
  const lowPairs  = [...raw.matchAll(/LOW:\s*([^\|]+)\|\s*([^\|]+)\|\s*([^\n]+)/g)];
  highPairs.forEach(m => { const k = m[1].trim() + '_' + m[2].trim(); S.overlapScores[k] = { score: .8, reason: m[3].trim(), source: 'roster' }; });
  lowPairs.forEach(m  => { const k = m[1].trim() + '_' + m[2].trim(); S.overlapScores[k] = { score: .2, reason: m[3].trim(), source: 'roster' }; });
  if (highPairs.length || lowPairs.length) renderOverlapMatrix();

  if (!results.children.length) {
    results.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:10px 0;">No recommendations generated. The roster may already be well-configured.</div>';
  }
}

export function addRosterAgentDirect(name, color, mandate, btn) {
  const id = 'agent_' + Date.now();
  agents.push({ id, name, color, mandate });
  S.agentStatuses[id] = 'active'; S.selectedAgents.add(id);
  renderAgentList();
  btn.textContent = 'added ✓'; btn.disabled = true;
}

export function addRosterAgentEditDirect(name, color, mandate) {
  const id = 'agent_' + Date.now();
  agents.push({ id, name, color, mandate });
  S.agentStatuses[id] = 'active'; S.selectedAgents.add(id);
  renderAgentList();
  openAgentModal(id);
}

export function applyStatusChange(id, newStatus, btn) {
  const statusMap = { active: 'active', genonly: 'genonly', retired: 'retired', promoted: 'promoted' };
  S.agentStatuses[id] = statusMap[newStatus] || 'active';
  renderAgentList();
  btn.textContent = 'applied ✓'; btn.disabled = true;
}

export function editMandateManually(idx) {
  const entry = pendingMandateUpdates.get(idx);
  if (!entry) return;
  const { id } = entry;
  setOnAgentSaveCallback(() => {
    const agent = agents.find(a => a.id === id);
    if (!agent) return;
    const previewEl = document.getElementById(`mandate-preview-${idx}`);
    if (previewEl) {
      previewEl.textContent = agent.mandate.slice(0, 180) + '...';
      previewEl.style.fontStyle = 'normal';
      previewEl.style.color = 'var(--text2)';
    }
  });
  openAgentModal(id);
}

export async function autoApplyMandate(idx, btn) {
  const entry = pendingMandateUpdates.get(idx);
  if (!entry) { setStatus('Mandate update entry not found — re-run roster agent.'); return; }
  const { id, issue, suggestion } = entry;
  const agent = agents.find(a => a.id === id);
  if (!agent) { setStatus('Agent not found: ' + id); return; }
  btn.disabled = true; btn.textContent = 'rewriting...';
  const statusEl = btn.closest('div').querySelector('.mandate-apply-status');
  if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = 'Calling Haiku to rewrite mandate...'; }

  const prompt = `You are rewriting a specialist agent mandate to correct a specific issue identified by a roster agent. Keep the mandate concise (120-150 words) and preserve the agent's core disciplinary perspective.

CURRENT MANDATE:
${agent.mandate}

ISSUE IDENTIFIED:
${issue}

SUGGESTED CORRECTION:
${suggestion}

Write only the revised mandate text. Do not include any preamble, explanation, or commentary. The revised mandate should be approximately the same length as the original.`;

  try {
    let result = '';
    await streamAI({
      name: `mandate-apply:${agent.name.slice(0, 15)}`,
      role: 'mandate',
      systemString: 'You are a research architect rewriting agent mandates. Be concise and preserve the agent\'s disciplinary identity.',
      messages: [{ role: 'user', content: prompt }],
      onChunk: chunk => { result += chunk; },
    });
    agent.mandate = result.trim();
    btn.textContent = 'applied ✓';
    const previewEl = document.getElementById(`mandate-preview-${idx}`);
    if (previewEl) { previewEl.textContent = result.trim().slice(0, 180) + '...'; previewEl.style.fontStyle = 'normal'; previewEl.style.color = 'var(--text2)'; }
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.textContent = `✓ Mandate updated (${result.trim().split(/\s+/).length} words). Review in agent editor if needed.`;
      statusEl.style.color = 'var(--success)';
    }
    setStatus(`Mandate for ${agent.name} updated by roster agent correction.`);
    renderAgentList();
  } catch (e) {
    btn.disabled = false; btn.textContent = '✦ apply correction';
    if (statusEl) { statusEl.textContent = 'Error: ' + e.message; statusEl.style.color = 'var(--danger)'; }
  }
}
