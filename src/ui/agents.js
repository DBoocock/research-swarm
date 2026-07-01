import { S, agents, _onAgentSaveCallback, setOnAgentSaveCallback } from '../state.js';
import { COLOURS } from '../constants.js';
import { mkBtn } from './helpers.js';
import { streamAI } from '../api.js';
import { buildCachedBlock } from '../api.js';

export function renderAgentList() {
  const list = document.getElementById('agent-list');
  list.innerHTML = '';
  const debateCounts = {};
  S.pairingProposals.filter(p => p.enabled).forEach(p => {
    debateCounts[p.id1] = (debateCounts[p.id1] || 0) + 1;
    debateCounts[p.id2] = (debateCounts[p.id2] || 0) + 1;
  });
  agents.forEach(agent => {
    const status = S.agentStatuses[agent.id] || 'active';
    const sel = S.selectedAgents.has(agent.id);
    const dc = debateCounts[agent.id] || 0;
    const div = document.createElement('div');
    div.className = `agent-item ${sel ? 'selected' : ''} ${status}`;
    div.onclick = e => { if (!e.target.closest('.agent-actions')) toggleAgent(agent.id); };
    const statusPill = {
      active:   '<span class="agent-status-pill asp-active">on</span>',
      retired:  '<span class="agent-status-pill asp-retired">retired</span>',
      genonly:  '<span class="agent-status-pill asp-genonly">gen only</span>',
      promoted: '<span class="agent-status-pill asp-promoted">promoted</span>',
    }[status] || '';
    div.innerHTML = `<span class="agent-dot" style="background:${agent.color}"></span>
      <span class="agent-name-text">${agent.name}</span>
      ${sel ? statusPill : ''}
      ${dc > 0 ? `<span class="agent-debate-count">${dc}↔</span>` : ''}
      <div class="agent-actions"></div>`;
    const actions = div.querySelector('.agent-actions');
    actions.appendChild(mkBtn('edit', 'agent-action-btn', () => openAgentModal(agent.id)));
    actions.appendChild(mkBtn('×', 'agent-action-btn del', e => { e.stopPropagation(); deleteAgent(agent.id, e); }));
    list.appendChild(div);
  });
}

export function toggleAgent(id) {
  S.selectedAgents.has(id) ? S.selectedAgents.delete(id) : S.selectedAgents.add(id);
  renderAgentList();
}

export function selectAll()  { agents.forEach(a => S.selectedAgents.add(a.id)); renderAgentList(); }
export function selectNone() { S.selectedAgents.clear(); renderAgentList(); }

export function buildColorGrid(selectedColor) {
  const grid = document.getElementById('color-grid');
  grid.innerHTML = '';
  COLOURS.forEach(c => {
    const used = agents.some(a => a.color === c && a.id !== S.editingAgentId);
    const sw = document.createElement('div');
    sw.className = 'color-swatch' + (c === selectedColor ? ' selected' : '');
    sw.style.background = c;
    sw.style.opacity = used ? '.4' : '1';
    sw.title = c + (used ? ' (in use)' : '');
    sw.onclick = () => {
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
    };
    grid.appendChild(sw);
  });
}

export function openAgentModal(id) {
  S.editingAgentId = id;
  const agent = agents.find(a => a.id === id);
  document.getElementById('agent-modal-title').textContent = 'Edit agent: ' + agent.name;
  document.getElementById('edit-agent-name').value = agent.name;
  document.getElementById('edit-agent-mandate').value = agent.mandate;
  document.getElementById('delete-agent-btn').style.display = '';
  buildColorGrid(agent.color);
  document.getElementById('agent-modal').classList.remove('hidden');
}

export function openNewAgentModal() {
  S.editingAgentId = null;
  document.getElementById('agent-modal-title').textContent = 'New agent';
  document.getElementById('edit-agent-name').value = '';
  document.getElementById('edit-agent-mandate').value = '';
  document.getElementById('delete-agent-btn').style.display = 'none';
  const usedColors = new Set(agents.map(a => a.color));
  const free = COLOURS.find(c => !usedColors.has(c)) || COLOURS[Math.floor(Math.random() * COLOURS.length)];
  buildColorGrid(free);
  document.getElementById('agent-modal').classList.remove('hidden');
}

export function closeAgentModal() {
  document.getElementById('agent-modal').classList.add('hidden');
  S.editingAgentId = null;
  setOnAgentSaveCallback(null);
}

export function saveAgent() {
  const name   = document.getElementById('edit-agent-name').value.trim();
  const mandate = document.getElementById('edit-agent-mandate').value.trim();
  const color  = document.querySelector('.color-swatch.selected')?.style.background || COLOURS[0];
  if (!name) { alert('Agent name required.'); return; }
  if (S.editingAgentId) {
    const agent = agents.find(a => a.id === S.editingAgentId);
    agent.name = name; agent.mandate = mandate; agent.color = color;
  } else {
    const id = 'agent_' + Date.now();
    agents.push({ id, name, color, mandate });
    S.agentStatuses[id] = 'active';
    S.selectedAgents.add(id);
  }
  renderAgentList();
  const cb = _onAgentSaveCallback;
  setOnAgentSaveCallback(null);
  closeAgentModal();
  if (cb) cb();
}

export function deleteCurrentAgent() {
  if (!S.editingAgentId) return;
  deleteAgent(S.editingAgentId, null);
  closeAgentModal();
}

export function deleteAgent(id, e) {
  if (e) e.stopPropagation();
  if (!confirm('Delete this agent? Their historical outputs will be preserved in the session log.')) return;
  const idx = agents.findIndex(a => a.id === id);
  if (idx !== -1) agents.splice(idx, 1);
  S.selectedAgents.delete(id);
  delete S.agentStatuses[id];
  delete S.genBlocks[id];
  delete S.compressedGen[id];
  renderAgentList();
}

export async function generateMandate() {
  const name = document.getElementById('edit-agent-name').value.trim();
  if (!name) { alert('Enter an agent name first.'); return; }
  const btn = document.querySelector('[onclick="generateMandate()"]');
  btn.textContent = 'generating...'; btn.disabled = true;
  const existingMandates = agents.map(a => `${a.name}: ${a.mandate.slice(0, 120)}...`).join('\n');
  const prompt = `Given the following research swarm brief and existing agent roster, write a specialist mandate for a new agent named "${name}".

BRIEF:
${buildCachedBlock()}

EXISTING AGENTS (for context — the new agent should have a distinct, complementary perspective):
${existingMandates}

Write only the mandate text for "${name}" — approximately 120 words, technically specific, identifying the key frameworks and concepts this agent would bring. Do not include any preamble.`;
  try {
    let result = '';
    const ta = document.getElementById('edit-agent-mandate');
    ta.value = '';
    await streamAI({
      name: 'mandate-gen',
      role: 'mandate',
      systemString: 'You are a research architect designing specialist agent mandates for a multi-agent research swarm.',
      messages: [{ role: 'user', content: prompt }],
      onChunk: chunk => { result += chunk; ta.value = result; },
    });
  } catch (e) { alert('Error: ' + e.message); }
  btn.textContent = '✦ generate from brief'; btn.disabled = false;
}
