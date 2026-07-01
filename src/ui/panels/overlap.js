import { S, agents } from '../../state.js';
import { makeSectionLabel } from '../helpers.js';

export function updateOverlapMatrix() {
  const activeAgents = agents.filter(a => S.agentStatuses[a.id] !== 'retired');
  for (let i = 0; i < activeAgents.length; i++) {
    for (let j = i + 1; j < activeAgents.length; j++) {
      const a = activeAgents[i], b = activeAgents[j];
      const key = a.id + '_' + b.id;
      if (!S.overlapScores[key] || S.overlapScores[key].source === 'static') {
        const wa = new Set(a.mandate.toLowerCase().split(/\W+/).filter(w => w.length > 5));
        const wb = new Set(b.mandate.toLowerCase().split(/\W+/).filter(w => w.length > 5));
        const inter = [...wa].filter(w => wb.has(w)).length;
        const union = new Set([...wa, ...wb]).size;
        S.overlapScores[key] = { score: union > 0 ? inter / union : 0, source: 'static' };
      }
    }
  }
  renderOverlapMatrix();
}

export function renderOverlapMatrix() {
  const p = document.getElementById('panel-overlap');
  p.innerHTML = '';
  const active = agents.filter(a => S.agentStatuses[a.id] !== 'retired');
  if (active.length < 2) {
    p.innerHTML = '<div class="empty-state"><span class="big">Overlap matrix</span>Needs at least 2 active agents.</div>';
    return;
  }
  p.appendChild(makeSectionLabel('Pairwise overlap — colour = predicted debate productivity'));
  const n = active.length;
  const grid = document.createElement('div');
  grid.className = 'overlap-grid';
  grid.style.gridTemplateColumns = `80px repeat(${n},1fr)`;
  const corner = document.createElement('div');
  corner.className = 'og-cell mcell mhdr';
  grid.appendChild(corner);
  active.forEach(a => {
    const d = document.createElement('div');
    d.className = 'og-hdr';
    d.textContent = a.name;
    d.title = a.name;
    grid.appendChild(d);
  });
  active.forEach((a, i) => {
    const rl = document.createElement('div');
    rl.className = 'og-row-lbl';
    rl.textContent = a.name;
    rl.title = a.name;
    grid.appendChild(rl);
    active.forEach((b, j) => {
      const cell = document.createElement('div');
      cell.className = 'og-cell';
      if (i === j) {
        const d = document.createElement('div');
        d.className = 'og-score';
        d.style.cssText = 'background:var(--bg4);';
        cell.appendChild(d);
      } else {
        const key = i < j ? a.id + '_' + b.id : b.id + '_' + a.id;
        const sc = S.overlapScores[key];
        const score = sc ? sc.score : 0;
        const r = Math.round(score * 255), g = Math.round((1 - score) * 200);
        const bg = `rgba(${r},${Math.max(100, 200 - r)},${g},0.35)`;
        const d = document.createElement('div');
        d.className = 'og-score';
        d.style.background = bg;
        d.textContent = Math.round(score * 100) + '%';
        d.title = (sc?.reason || '') + ` (${sc?.source || 'static'})`;
        cell.appendChild(d);
      }
      grid.appendChild(cell);
    });
  });
  p.appendChild(grid);
  const note = document.createElement('div');
  note.style.cssText = 'font-size:10px;color:var(--text3);margin-top:6px;';
  note.textContent = 'Green = high overlap (productive debate). Red = low overlap. Source: static mandate analysis; updated by roster agent.';
  p.appendChild(note);
}
