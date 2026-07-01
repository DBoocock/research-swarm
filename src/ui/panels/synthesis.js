import { S } from '../../state.js';
import { makeRoundHdr, makeSectionLabel, mkBtn } from '../helpers.js';

// Forward-declared — set by main.js to avoid circular dependency
let _retrySynthesis;
export function setRetrySynthesis(fn) { _retrySynthesis = fn; }

export function rebuildSynthesisPanel(rawText) {
  const panel = document.getElementById('panel-synth');
  panel.innerHTML = '';
  if (!rawText && !S._pendingSynthesisArgs) return;
  const hdr = makeRoundHdr('Synthesis', S._pendingSynthesisArgs ? 'running' : 'done');
  panel.appendChild(hdr);
  if (S._pendingSynthesisArgs) {
    const btn = mkBtn('↺ Retry synthesis', 'btn-accent', () => _retrySynthesis?.());
    btn.style.marginBottom = '8px';
    panel.appendChild(btn);
  }
  if (rawText) {
    const pre = document.createElement('pre');
    pre.className = 'synth-raw';
    pre.textContent = rawText;
    panel.appendChild(pre);
  }
}
