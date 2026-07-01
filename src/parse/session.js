import { S, brief, agents, costS } from '../state.js';
import { setProvider, setDepth, setSynthModel } from '../ui/settings.js';
import { renderAgentList } from '../ui/agents.js';
import { renderLog } from '../ui/panels/log.js';
import { rebuildMap } from '../ui/panels/map.js';
import { rebuildContradictions } from '../ui/panels/contradictions.js';
import { rebuildMatrix } from '../ui/panels/matrix.js';
import { renderOverlapMatrix } from '../ui/panels/overlap.js';
import { rebuildGenerationPanel } from '../ui/panels/generation.js';
import { rebuildDebatePanel } from '../ui/panels/debate.js';
import { rebuildSynthesisPanel } from '../ui/panels/synthesis.js';
import { renderPairingsPanel } from '../ui/panels/pairings.js';
import { tc, setStatus, switchTab } from '../ui/tabs.js';
import { renderCost } from '../ui/cost.js';

export function buildExportData() {
  return {
    exportTime: new Date().toISOString(),
    provider: S.provider || 'gemini',
    brief,
    reflectionsEnabled: S.reflectionsEnabled,
    depth: S.depth,
    synthesisModel: S.synthesisModel,
    currentRound: S.currentRound,
    selectedAgents: [...S.selectedAgents],
    agentMandates: Object.fromEntries(agents.map(a => [a.id, {
      name: a.name, color: a.color, mandate: a.mandate, status: S.agentStatuses[a.id] || 'active',
    }])),
    sessionCost: {
      total: costS.total, saved: costS.saved, inputTok: costS.inp,
      outputTok: costS.out, cacheReads: costS.cr, cacheWrites: costS.cw,
    },
    cumulativeCost: (S.cumulativeCostBaseline || 0) + costS.total,
    rounds: S.rounds,
    researchMap: S.researchMap,
    contradictions: S.contradictions,
    matrix: S.matrix,
    overlapScores: S.overlapScores,
    agentReflections: S.agentReflections,
    genBlocks: S.genBlocks,
    compressedGen: S.compressedGen,
  };
}

export function buildMd() {
  let out = `# ${brief.title}\n\n**${brief.subtitle}**\n\n`;
  out += `Export: ${new Date().toISOString()} | Cost: $${costS.total.toFixed(4)} | Cache savings: $${costS.saved.toFixed(4)}\n\n`;
  out += `## Brief\n\n### Problem Context\n${brief.sysCtx}\n\n### Research Context\n${brief.resCtx}\n\n### Available Data\n${brief.dataCtx}\n\n`;
  out += `## Research Map\n\n`;
  S.researchMap.forEach(r => {
    const lsNote = r.labelStatus && r.labelStatus !== 'unlabeled' ? ' — ' + r.labelStatus.replace(/_/g, ' ') : '';
    out += `- **[${r.category}]** ${r.title} *(R${r.round}, ${r.tag || 'untagged'}${lsNote})*\n`;
    if (r.summary && (r.summary.methods || r.summary.phenomenon)) {
      const mp = [];
      if (r.summary.methods)    mp.push(`methods: ${r.summary.methods}`);
      if (r.summary.phenomenon) mp.push(`phenomenon: ${r.summary.phenomenon}`);
      out += `  ${mp.join('; ')}\n`;
    }
  });
  out += `\n## Contradictions\n\n`;
  S.contradictions.forEach(c => {
    out += `- **${c.a1} vs ${c.a2}** (R${c.round})\n  ${c.claim1} — vs — ${c.claim2}\n  *Resolution: ${c.resolution}*\n\n`;
  });
  S.rounds.forEach(r => {
    out += `\n${'='.repeat(60)}\n## Round ${r.round} · ${r.depth}\n\n### Generation\n\n`;
    Object.entries(S.genBlocks).forEach(([id, blocks]) => {
      let text = '';
      if (blocks.initial.round === r.round) text += `--- INITIAL GENERATION (round ${blocks.initial.round}) ---\n${blocks.initial.text}`;
      blocks.extensions.filter(e => e.round === r.round).forEach(ext => {
        text += (text ? '\n\n' : '') + `--- REFLECTION-EXTENDED DIRECTIONS (round ${ext.round}) ---\n${ext.text}`;
      });
      if (!text) return;
      const n = agents.find(a => a.id === id)?.name || id;
      out += `#### ${n}\n${text}\n\n`;
    });
    if (Object.keys(r.debates || {}).length) {
      out += `### Debate\n\n`;
      Object.entries(r.debates || {}).forEach(([key, { text, type }]) => {
        const [id1, id2] = key.split('::');
        const n1 = agents.find(a => a.id === id1)?.name || id1;
        const n2 = agents.find(a => a.id === id2)?.name || id2;
        out += `#### ${n1} → ${n2}${type ? ' [' + type + ']' : ''}\n${text}\n\n`;
      });
    }
    out += `### Synthesis\n${r.synthesis}\n`;
  });
  return out;
}

function exportFilename(ext) {
  const prefix = brief.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24);
  return `${prefix}-R${S.currentRound}-${Date.now()}.${ext}`;
}

function setLastExport(fname) {
  setStatus(`Exported: ${fname} → your Downloads folder`);
}

function downloadBlob(content, mime, fname) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = fname; a.click();
  URL.revokeObjectURL(url);
}

export function exportJson() {
  try {
    const fname = exportFilename('json');
    downloadBlob(JSON.stringify(buildExportData(), null, 2), 'application/json', fname);
    setLastExport(fname);
  } catch (e) { console.warn('Export failed', e); }
}

export function exportMd() {
  try {
    const fname = exportFilename('md');
    downloadBlob(buildMd(), 'text/markdown', fname);
    setLastExport(fname);
  } catch (e) { console.warn('Export failed', e); }
}

export function autoExportJson() {
  try {
    const fname = exportFilename('json');
    downloadBlob(JSON.stringify(buildExportData(), null, 2), 'application/json', fname);
    setLastExport(fname);
  } catch (e) { console.warn('Auto JSON export failed', e); }
}

export function autoExportMd() {
  try {
    const fname = exportFilename('md');
    downloadBlob(buildMd(), 'text/markdown', fname);
    setLastExport(fname);
  } catch (e) { console.warn('Auto MD export failed', e); }
}

export function copyMdToClipboard() {
  try {
    navigator.clipboard.writeText(buildMd()).then(() => {
      setStatus('Markdown copied to clipboard — paste into any file in your project directory.');
    });
  } catch (e) { setStatus('Clipboard copy failed: ' + e.message); }
}

export function copyJsonToClipboard() {
  try {
    navigator.clipboard.writeText(JSON.stringify(buildExportData(), null, 2)).then(() => {
      setStatus('JSON copied to clipboard — paste into any file in your project directory.');
    });
  } catch (e) { setStatus('Clipboard copy failed: ' + e.message); }
}

export function saveRound(includeDebate) {
  // seqNum avoids duplicate labels when generation-synthesis and debate-synthesis
  // both call saveRound with the same S.currentRound value.
  const seqNum = S.rounds.length + 1;
  S.rounds.push({
    round: seqNum,
    ts: new Date().toISOString(),
    depth: S.depth,
    debates: { ...S.currentDebates },
    synthesis: S.currentSynthesis,
    pairingProposals: [...S.pairingProposals],
    retirementProposals: [...S.retirementProposals],
    // genBlocks and agentReflections NOT snapshotted here — captured once at
    // the top level of buildExportData() with per-entry origin rounds.
  });
  renderLog();
  tc('log', S.rounds.length);
}

export function importSession(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.brief) {
        Object.assign(brief, data.brief);
        document.getElementById('brief-banner-title').innerHTML    = brief.title.replace('\n', '<br>');
        document.getElementById('brief-banner-subtitle').textContent = brief.subtitle;
        document.title = brief.title;
      }
      if (data.provider) setProvider(data.provider);
      if (data.depth)    setDepth(data.depth);
      if (data.synthesisModel) setSynthModel(data.synthesisModel);
      if (data.agentMandates) {
        Object.entries(data.agentMandates).forEach(([id, saved]) => {
          const existing = agents.find(a => a.id === id);
          if (existing) {
            existing.name = saved.name; existing.color = saved.color; existing.mandate = saved.mandate;
            if (saved.status) S.agentStatuses[id] = saved.status;
          } else {
            agents.push({ id, name: saved.name, color: saved.color, mandate: saved.mandate });
            S.agentStatuses[id] = saved.status || 'active';
          }
        });
      }
      S.selectedAgents    = new Set(data.selectedAgents || []);
      if (data.rounds)         S.rounds        = [...data.rounds];
      if (data.researchMap) {
        S.researchMap = [...data.researchMap];
        S.researchMap.forEach((r, i) => {
          if (r.agents && r.agents.length && typeof r.agents[0] === 'string') {
            r.agents = r.agents.map(id => ({ id, round: r.round }));
          }
          r.agents      = r.agents      || [];
          r.id          = r.id          ?? `imported-${i}`;
          r.parentIds   = r.parentIds   || [];
          r.summary     = r.summary     || null;
          r.labelStatus = r.labelStatus || 'unlabeled';
        });
      }
      if (data.contradictions) S.contradictions   = [...data.contradictions];
      if (data.matrix)         S.matrix           = { ...data.matrix };
      if (data.overlapScores)  S.overlapScores    = { ...data.overlapScores };
      if (data.agentReflections) S.agentReflections = { ...data.agentReflections };
      if (data.genBlocks)      S.genBlocks        = JSON.parse(JSON.stringify(data.genBlocks));
      if (data.compressedGen)  S.compressedGen    = JSON.parse(JSON.stringify(data.compressedGen));
      if (typeof data.reflectionsEnabled === 'boolean') {
        S.reflectionsEnabled = data.reflectionsEnabled;
        const tog = document.getElementById('reflection-toggle');
        if (tog) tog.checked = S.reflectionsEnabled;
      }
      S.currentRound = data.currentRound;
      const lastRound = data.rounds && data.rounds.length ? data.rounds[data.rounds.length - 1] : null;
      S.pairingProposals     = lastRound ? [...(lastRound.pairingProposals || [])] : [];
      S.retirementProposals  = lastRound ? [...(lastRound.retirementProposals || [])] : [];
      S.currentDebates       = lastRound ? { ...lastRound.debates } : {};
      S.cumulativeCostBaseline = data.cumulativeCost || 0;
      Object.assign(costS, { inp: 0, out: 0, cr: 0, cw: 0, total: 0, saved: 0, calls: [] });
      renderCost();
      // Rebuild all panels
      renderAgentList();
      renderLog();
      rebuildMap();
      rebuildContradictions();
      rebuildMatrix();
      renderOverlapMatrix();
      rebuildGenerationPanel();
      rebuildDebatePanel();
      rebuildSynthesisPanel(null);
      renderPairingsPanel();
      tc('log', S.rounds.length);
      tc('map', S.researchMap.length);
      tc('contra', S.contradictions.length || '!');
      const genRounds    = Object.values(S.genBlocks).map(b => b.initial.round);
      const lastGenRound = genRounds.length ? Math.max(...genRounds) : 0;
      tc('gen', genRounds.filter(r => r === lastGenRound).length);
      tc('deb', lastRound ? Object.keys(lastRound.debates || {}).length : 0);
      tc('syn', S.rounds.length ? 1 : 0);
      setStatus(`Session imported: ${S.rounds.length} round${S.rounds.length !== 1 ? 's' : ''} restored. API key required to continue.`);
      switchTab('log');
    } catch (err) {
      setStatus('Import failed: ' + err.message);
      console.error('Import error', err);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}
