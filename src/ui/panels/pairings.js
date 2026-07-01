import { S, agents } from '../../state.js';
import { makeSectionLabel, makeNotice, mkBtn } from '../helpers.js';
import { tc } from '../tabs.js';
import { renderAgentList } from '../agents.js';

// Forward-declared — set by main.js to avoid circular dependency
let _runDebate;
export function setRunDebate(fn) { _runDebate = fn; }

export function renderPairingsPanel() {
  const panel = document.getElementById('panel-pair');
  panel.innerHTML = '';
  if (!S.pairingProposals.length) {
    tc('pair', 0);
    panel.innerHTML = '<div class="empty-state"><span class="big">No proposals yet</span>Run generation and synthesis first.</div>';
    return;
  }
  panel.appendChild(makeSectionLabel(`Proposed debate pairings — round ${S.currentRound + 1}`));
  panel.appendChild(makeNotice('Agents may have multiple pairings — shown as N↔ in the sidebar. Toggle pairs on/off, then launch the debate round.'));

  const wrap = document.createElement('div');
  wrap.className = 'pair-panel';
  const ph = document.createElement('div');
  ph.className = 'pair-panel-hdr';
  ph.innerHTML = `<span style="font-family:var(--serif);font-style:italic;font-size:14px;color:var(--text);flex:1">Debate pair proposals</span><span class="badge b-deb">${S.pairingProposals.filter(p => p.enabled).length} active</span>`;
  wrap.appendChild(ph);

  const list = document.createElement('div');
  list.className = 'pair-list';
  S.pairingProposals.forEach((pair, i) => {
    const a1 = agents.find(a => a.id === pair.id1), a2 = agents.find(a => a.id === pair.id2);
    const typeClass = { CONTRADICTION: 'pt-c', INTERSECTION: 'pt-i', DISRUPTION: 'pt-d', BRIDGE: 'pt-b' }[pair.type] || 'pt-b';
    const item = document.createElement('div');
    item.className = `pair-item ${pair.enabled ? 'on' : 'off'}`;
    const toggle = document.createElement('div');
    toggle.className = `ptoggle ${pair.enabled ? 'on' : ''}`;
    toggle.textContent = pair.enabled ? '✓' : '';
    toggle.addEventListener('click', () => togglePair(i));
    item.appendChild(toggle);
    const body = document.createElement('div');
    body.style.flex = '1';
    body.innerHTML = `<div class="pair-agents">
      <span class="pat" style="background:${a1?.color || '#888'}22;color:${a1?.color || '#888'}">${a1?.name || pair.id1}</span>
      <span style="color:var(--text3);font-size:11px">→</span>
      <span class="pat" style="background:${a2?.color || '#888'}22;color:${a2?.color || '#888'}">${a2?.name || pair.id2}</span>
      <span class="ptb ${typeClass}">${pair.type}</span>
    </div>
    <div class="pair-reason">${pair.reason || ''}</div>`;
    item.appendChild(body);
    list.appendChild(item);
  });
  wrap.appendChild(list);

  if (S.retirementProposals.length) {
    const rp = document.createElement('div');
    rp.className = 'rp-sec';
    rp.innerHTML = '<div class="rp-lbl">Agent status recommendations</div>';
    S.retirementProposals.forEach((rec, i) => {
      const agent = agents.find(a => a.id === rec.id);
      const actionColors = { retire: 'rpa-retire', promote: 'rpa-promote', genonly: 'rpa-genonly', activate: 'asp-active' };
      const item = document.createElement('div');
      item.className = 'rp-item';
      item.style.marginBottom = '4px';
      item.innerHTML = `<span class="rp-action ${actionColors[rec.action] || 'rpa-retire'}">${rec.action}</span>
        <span class="rp-text"><strong>${agent?.name || rec.id}</strong> — ${rec.reason}</span>`;
      const recBtn = mkBtn(rec.accepted ? 'accepted' : 'accept', `rp-btn${rec.accepted ? ' accepted' : ''}`, () => acceptRec(i));
      if (rec.accepted) recBtn.disabled = true;
      item.appendChild(recBtn);
      rp.appendChild(item);
    });
    wrap.appendChild(rp);
  }

  panel.appendChild(wrap);
  const launchBtn = document.createElement('button');
  launchBtn.className = 'launch-btn';
  launchBtn.textContent = 'launch debate round →';
  launchBtn.addEventListener('click', () => _runDebate?.());
  if (S.running) launchBtn.disabled = true;
  panel.appendChild(launchBtn);
  tc('pair', S.pairingProposals.filter(p => p.enabled).length);
}

export function togglePair(i) {
  S.pairingProposals[i].enabled = !S.pairingProposals[i].enabled;
  renderPairingsPanel();
  renderAgentList();
}

export function acceptRec(i) {
  const rec = S.retirementProposals[i];
  rec.accepted = !rec.accepted;
  if (rec.accepted) {
    S.agentStatuses[rec.id] = rec.status || 'retired';
    if ((rec.status || 'retired') === 'retired') {
      delete S.genBlocks[rec.id];
      delete S.compressedGen[rec.id];
    }
  } else {
    S.agentStatuses[rec.id] = 'active';
  }
  renderAgentList();
  renderPairingsPanel();
}
