import { S } from '../../state.js';
import { makeRoundHdr, mkBtn } from '../helpers.js';

// Forward-declared — set by main.js to avoid circular dependency
let _retrySynthesis;
export function setRetrySynthesis(fn) { _retrySynthesis = fn; }

// Builds the complete error-state UI for an unresolved synthesis failure:
// error message + retry button, wired to the same retrySynthesis() used
// live. Used both by runSynthesis()'s catch block (the live failure) and by
// rebuildSynthesisPanel() when reconstructing an imported session that has
// an unresolved failure — one rendering, not two copies of the same thing.
export function renderSynthesisFailure(panel, message) {
  panel.innerHTML = '';
  panel.appendChild(makeRoundHdr('Synthesis', 'error'));
  const sc = document.createElement('div');
  sc.className = 'synth-card';
  sc.innerHTML = `<div class="synth-hdr"><span class="synth-title">Synthesis arbitration</span><span class="badge b-err">error</span></div><div class="rcard-body" id="syn-body"></div>`;
  const body = sc.querySelector('#syn-body');
  const errMsg = document.createElement('span');
  errMsg.style.color = 'var(--danger)';
  errMsg.textContent = `Synthesis error: ${message}`;
  body.appendChild(errMsg);
  body.appendChild(mkBtn('retry synthesis →', 'sm-btn', () => _retrySynthesis?.(), 'display:block;margin-top:10px;'));
  panel.appendChild(sc);
}

// Mirrors runSynthesis()'s live .synth-card rendering so an imported
// session's last synthesis is indistinguishable from a live one. An
// unresolved failure (S._pendingSynthesisArgs set) takes priority over
// showing stale prior-round text, matching what the live panel shows —
// runSynthesis() clears the panel at the start of every attempt, so a
// failure mid-attempt leaves only the error state visible, never the last
// successful round's card underneath it.
export function rebuildSynthesisPanel(rawText) {
  const panel = document.getElementById('panel-syn');
  if (S._pendingSynthesisArgs) {
    renderSynthesisFailure(panel, S.lastSynthesisError || 'unknown error');
    return;
  }
  panel.innerHTML = '';
  if (!rawText) return;
  const sc = document.createElement('div');
  sc.className = 'synth-card';
  sc.innerHTML = `<div class="synth-hdr"><span class="synth-title">Synthesis arbitration</span><span class="badge b-done">done</span></div><div class="rcard-body" id="syn-body"></div>`;
  sc.querySelector('#syn-body').textContent = rawText;
  panel.appendChild(sc);
}
