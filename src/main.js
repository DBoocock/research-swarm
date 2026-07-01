// Entry point — imports everything and exports public functions to window
// so inline HTML event handlers (and legacy onclick="" patterns) continue to work.
// The HTML shell has no JS of its own; this module owns the entire runtime.

import { S, agents, brief, costS, genCardEls } from './state.js';
import { PROVIDERS, COLOURS } from './constants.js';
import { modelFor, MODELS } from './models.js';
import { PRICING } from './pricing.js';
import { addUsage } from './api.js';

// UI layers
import { renderAgentList, toggleAgent, selectAll, selectNone, openAgentModal, openNewAgentModal, closeAgentModal, saveAgent, deleteCurrentAgent, deleteAgent, generateMandate, buildColorGrid } from './ui/agents.js';
import { renderCost } from './ui/cost.js';
import { lockTabs, unlockTabs, switchTab, tc, setStatus } from './ui/tabs.js';
import { setProvider, setDepth, setSynthModel } from './ui/settings.js';
import { openBriefModal, closeBriefModal, saveBrief } from './ui/modals/brief.js';
import { openRosterModal, closeRosterModal } from './ui/modals/roster.js';
import { closeHandoverModal } from './ui/modals/handover.js';
import { downloadHandover } from './rounds/handover.js';
import { updateOverlapMatrix, renderOverlapMatrix } from './ui/panels/overlap.js';
import { renderPairingsPanel, setRunDebate } from './ui/panels/pairings.js';
import { rebuildMap, setRunHandover } from './ui/panels/map.js';
import { rebuildMatrix } from './ui/panels/matrix.js';
import { rebuildContradictions } from './ui/panels/contradictions.js';
import { rebuildSynthesisPanel, setRetrySynthesis } from './ui/panels/synthesis.js';
import { rebuildGenerationPanel } from './ui/panels/generation.js';
import { rebuildDebatePanel } from './ui/panels/debate.js';
import { renderLog } from './ui/panels/log.js';

// Round runners
import { runGen } from './rounds/generation.js';
import { runDebate } from './rounds/debate.js';
import { runSynthesis, retrySynthesis } from './rounds/synthesis.js';
import { runReflectionRound } from './rounds/reflection.js';
import { runRosterAgent, renderRosterResults } from './rounds/roster.js';
import { runHandover } from './rounds/handover.js';

// Session
import { importSession, exportJson, exportMd, copyMdToClipboard, copyJsonToClipboard, buildExportData } from './parse/session.js';
import { parseSynthesis } from './parse/synthesis.js';

// Wire circular-dep callbacks
setRunDebate(runDebate);
setRunHandover(runHandover);
setRetrySynthesis(retrySynthesis);

// ── API key binding ─────────────────────────────────────────
// Each provider has an input field with id="api-key-<provider>".
// On change we write into S.apiKeys so provider modules see the latest value.
function bindKeyField(provider, elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.addEventListener('input', () => { S.apiKeys[provider] = el.value.trim(); });
}
bindKeyField('anthropic', 'api-key-anthropic');
bindKeyField('gemini',    'api-key-gemini');
bindKeyField('deepseek',  'api-key-deepseek');
bindKeyField('openai',    'api-key-openai');

// ── Depth buttons ───────────────────────────────────────────
document.querySelectorAll('.depth-btn[data-depth]').forEach(btn => {
  btn.addEventListener('click', () => setDepth(btn.dataset.depth));
});

// ── Provider buttons ────────────────────────────────────────
document.querySelectorAll('.provider-btn').forEach(btn => {
  btn.addEventListener('click', () => setProvider(btn.dataset.provider));
});

// ── Synth model buttons ─────────────────────────────────────
document.getElementById('synth-sonnet-btn')?.addEventListener('click', () => setSynthModel('sonnet'));
document.getElementById('synth-opus-btn')?.addEventListener('click', () => setSynthModel('opus'));

// ── Tab bar ─────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    if (document.querySelector('.tab-bar').classList.contains('tabs-locked')) return;
    switchTab(tab.dataset.tab);
  });
});

// ── Reflection toggle ───────────────────────────────────────
const refTog = document.getElementById('reflection-toggle');
if (refTog) {
  refTog.addEventListener('change', () => { S.reflectionsEnabled = refTog.checked; });
  refTog.checked = S.reflectionsEnabled;
}

// ── DeepSeek reasoning toggle ────────────────────────────────
const dsThinkTog = document.getElementById('deepseek-thinking-toggle');
if (dsThinkTog) {
  dsThinkTog.addEventListener('change', () => { S.deepseekThinking = dsThinkTog.checked; });
  dsThinkTog.checked = S.deepseekThinking;
}

// ── Import file input ───────────────────────────────────────
document.getElementById('import-file')?.addEventListener('change', importSession);
document.getElementById('import-trigger-btn')?.addEventListener('click', () => document.getElementById('import-file')?.click());

// ── Run button ──────────────────────────────────────────────
document.getElementById('run-btn')?.addEventListener('click', runGen);

// ── Brief banner click → open modal ────────────────────────
document.getElementById('brief-banner')?.addEventListener('click', openBriefModal);

// ── Export / copy buttons ────────────────────────────────────
document.getElementById('export-json-btn')?.addEventListener('click', exportJson);
document.getElementById('export-md-btn')?.addEventListener('click', exportMd);
document.getElementById('copy-md-btn')?.addEventListener('click', copyMdToClipboard);
document.getElementById('copy-json-btn')?.addEventListener('click', copyJsonToClipboard);

// ── Modal close/save buttons ─────────────────────────────────
document.getElementById('brief-close-btn')?.addEventListener('click', closeBriefModal);
document.getElementById('brief-cancel-btn')?.addEventListener('click', closeBriefModal);
document.getElementById('brief-save-btn')?.addEventListener('click', saveBrief);
document.getElementById('agent-close-btn')?.addEventListener('click', closeAgentModal);
document.getElementById('agent-cancel-btn')?.addEventListener('click', closeAgentModal);
document.getElementById('agent-save-btn')?.addEventListener('click', saveAgent);
document.getElementById('delete-agent-btn')?.addEventListener('click', deleteCurrentAgent);
document.getElementById('generate-mandate-btn')?.addEventListener('click', generateMandate);
document.getElementById('new-agent-btn')?.addEventListener('click', openNewAgentModal);
document.getElementById('select-all-btn')?.addEventListener('click', selectAll);
document.getElementById('select-none-btn')?.addEventListener('click', selectNone);
document.getElementById('roster-btn')?.addEventListener('click', openRosterModal);
document.getElementById('roster-close-btn')?.addEventListener('click', closeRosterModal);
document.getElementById('roster-close-footer-btn')?.addEventListener('click', closeRosterModal);
document.getElementById('roster-run-btn')?.addEventListener('click', runRosterAgent);
document.getElementById('handover-close-btn')?.addEventListener('click', closeHandoverModal);
document.getElementById('handover-close-footer-btn')?.addEventListener('click', closeHandoverModal);
document.getElementById('handover-download-btn')?.addEventListener('click', downloadHandover);

// Close modals on backdrop click (clicking outside modal box)
document.querySelectorAll('.modal-bg').forEach(el => {
  el.addEventListener('click', e => {
    if (e.target === el) el.classList.add('hidden');
  });
});

// ── Init ────────────────────────────────────────────────────
setProvider(S.provider || 'gemini');
setSynthModel(S.synthesisModel || 'sonnet');
setDepth(S.depth || 'standard');
renderAgentList();
renderCost();
updateOverlapMatrix();

// Update brief banner
document.getElementById('brief-banner-title').textContent = brief.title;
document.getElementById('brief-banner-subtitle').textContent = brief.subtitle;
document.title = brief.title;

// ── Test hooks (benign in production) ──────────────────────
window.__rs   = { S, agents, brief, costS, genCardEls };
window.__test = { runGen, runDebate, runSynthesis, runReflectionRound, parseSynthesis, buildExportData, modelFor, MODELS, PRICING, addUsage };
