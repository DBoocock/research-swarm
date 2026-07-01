import { S, costS } from '../state.js';

export function renderCost() {
  const isGemini = (S.provider || 'gemini') === 'gemini';
  document.getElementById('cost-total').textContent = '$' + costS.total.toFixed(4);

  const baseline = S.cumulativeCostBaseline || 0;
  const threadRow = document.getElementById('cost-thread-row');
  if (baseline > 0) {
    document.getElementById('cost-thread-total').textContent = '$' + (baseline + costS.total).toFixed(4);
    if (threadRow) threadRow.style.display = '';
  } else {
    if (threadRow) threadRow.style.display = 'none';
  }

  document.getElementById('ci').textContent  = costS.inp.toLocaleString();
  document.getElementById('co').textContent  = costS.out.toLocaleString();
  document.getElementById('ccr').textContent = costS.cr.toLocaleString();
  document.getElementById('ccw').textContent = costS.cw.toLocaleString();

  const supportsCaching = S.provider === 'anthropic';
  document.getElementById('cs').textContent = supportsCaching
    ? '$' + costS.saved.toFixed(4)
    : 'n/a (no caching)';

  const tot = costS.inp + costS.cr + costS.cw;
  const pct = (supportsCaching && tot > 0) ? Math.round(costS.cr / tot * 100) : 0;
  document.getElementById('cpct').textContent = supportsCaching ? pct + '%' : 'n/a';
  document.getElementById('cbar').style.width = pct + '%';

  document.getElementById('call-log').innerHTML = costS.calls.slice(0, 8).map(c =>
    `<div class="cli"><span class="cli-name">${c.name}</span><span style="font-size:9px;color:var(--text3);margin-left:3px">${c.mlbl || ''}</span><span class="cli-cost">$${c.cost.toFixed(4)}</span>${c.hit ? `<span class="cli-cache">⚡${c.cr.toLocaleString()}</span>` : ''}</div>`
  ).join('');
}
