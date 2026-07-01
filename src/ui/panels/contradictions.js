import { S } from '../../state.js';
import { makeSectionLabel } from '../helpers.js';

export function rebuildContradictions() {
  const p = document.getElementById('panel-contra');
  p.innerHTML = '';
  if (!S.contradictions.length) {
    p.innerHTML = '<div class="empty-state"><span class="big">Contradiction tracker</span>Incompatible claims appear here after synthesis.</div>';
    return;
  }
  p.appendChild(makeSectionLabel('Incompatible claims — accumulates across rounds'));
  S.contradictions.forEach(c => {
    const div = document.createElement('div');
    div.className = 'contra-item';
    div.innerHTML = `<div class="contra-agents"><span style="font-size:11px;color:var(--text2)">${c.a1}</span><span class="contra-vs">vs</span><span style="font-size:11px;color:var(--text2)">${c.a2}</span><span style="font-size:9px;color:var(--text3);margin-left:3px">R${c.round}</span></div>
      <div class="contra-text">${c.claim1}${c.claim2 ? ' — vs — ' + c.claim2 : ''}</div>
      ${c.resolution ? `<div class="contra-res">Resolution: ${c.resolution}</div>` : ''}`;
    p.appendChild(div);
  });
}
