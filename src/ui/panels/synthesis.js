import { S } from '../../state.js';
import { makeRoundHdr, makeSectionLabel, mkBtn } from '../helpers.js';

// Forward-declared — set by main.js to avoid circular dependency
let _retrySynthesis;
export function setRetrySynthesis(fn) { _retrySynthesis = fn; }

// Mirrors runSynthesis()'s live .synth-card rendering so an imported
// session's last synthesis is indistinguishable from a live one.
export function rebuildSynthesisPanel(rawText) {
  const panel = document.getElementById('panel-syn');
  panel.innerHTML = '';
  if (!rawText && !S._pendingSynthesisArgs) return;
  if (S._pendingSynthesisArgs) {
    const hdr = makeRoundHdr('Synthesis', 'running');
    panel.appendChild(hdr);
    const btn = mkBtn('↺ Retry synthesis', 'btn-accent', () => _retrySynthesis?.());
    btn.style.marginBottom = '8px';
    panel.appendChild(btn);
  }
  if (rawText) {
    const sc = document.createElement('div');
    sc.className = 'synth-card';
    sc.innerHTML = `<div class="synth-hdr"><span class="synth-title">Synthesis arbitration</span><span class="badge b-done">done</span></div><div class="rcard-body" id="syn-body"></div>`;
    sc.querySelector('#syn-body').textContent = rawText;
    panel.appendChild(sc);
  }
}
