import { S, agents } from '../../state.js';
import { makeSectionLabel } from '../helpers.js';
import { tc } from '../tabs.js';

export function renderLog() {
  const p = document.getElementById('panel-log');
  p.innerHTML = '';
  if (!S.rounds.length) {
    p.innerHTML = '<div class="empty-state"><span class="big">Session log</span>Every round accumulates here and is auto-exported as JSON.</div>';
    return;
  }
  p.appendChild(makeSectionLabel(`${S.rounds.length} round${S.rounds.length > 1 ? 's' : ''} — auto-exported after each synthesis`));
  [...S.rounds].reverse().forEach(r => {
    const div = document.createElement('div');
    div.className = 'log-entry';
    const genNames = Object.entries(S.genBlocks)
      .filter(([id, blocks]) => blocks.initial.round === r.round || blocks.extensions.some(e => e.round === r.round))
      .map(([id]) => agents.find(a => a.id === id)?.name || id);
    const debCount = Object.keys(r.debates || {}).length;
    div.innerHTML = `<div class="log-entry-hdr"><span class="badge b-done">done</span><span style="font-size:12px;color:var(--text2);flex:1;margin-left:6px;">Round ${r.round} · ${r.depth} · ${new Date(r.ts).toLocaleTimeString()}</span></div>
      <div class="log-entry-body">${genNames.length} agents · ${debCount} debate outputs\n\n${r.synthesis ? r.synthesis.slice(0, 400) + '…' : '(no synthesis)'}</div>`;
    p.appendChild(div);
  });
}
