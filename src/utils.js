import { S, agents } from './state.js';

export function unionBy(a, b, keyFn) {
  const seen = new Set(a.map(keyFn));
  return [...a, ...b.filter(item => {
    const k = keyFn(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  })];
}

export function buildMapBlock(entries, { includeAgents = false } = {}) {
  return entries.map(r => {
    let line = `${r.id}: [${r.category}] ${r.title}`;
    if (r.summary && (r.summary.methods || r.summary.phenomenon)) {
      const parts = [];
      if (r.summary.methods)    parts.push(`methods: ${r.summary.methods}`);
      if (r.summary.phenomenon) parts.push(`phenomenon: ${r.summary.phenomenon}`);
      line += `\n     SUMMARY: ${parts.join('; ')}`;
    }
    if (includeAgents && r.agents.length) {
      const agentIds = [...new Set(r.agents.map(a => a.id))];
      line += `\n     agents: ${agentIds.join(', ')}`;
    }
    return line;
  }).join('\n');
}

export function flatGen(agentId) {
  const blocks = S.genBlocks[agentId];
  if (!blocks) return '';
  let out = `--- INITIAL GENERATION (round ${blocks.initial.round}) ---\n${blocks.initial.text}`;
  blocks.extensions.forEach(ext => {
    out += `\n\n--- REFLECTION-EXTENDED DIRECTIONS (round ${ext.round}) ---\n${ext.text}`;
  });
  return out;
}

export function flatCompressed(agentId) {
  const c = S.compressedGen[agentId];
  if (!c) return '';
  let out = `--- INITIAL GENERATION (round ${c.initialSummary.round}) ---\n${c.initialSummary.summary}`;
  c.extensionSummaries.forEach(ext => {
    out += `\n\n--- REFLECTION-EXTENDED DIRECTIONS (round ${ext.round}) ---\n${ext.summary}`;
  });
  return out;
}

// Returns compressed generation for agentId, capped at maxRound.
// Fallback to flatGen (all rounds, no cap) when compression hasn't run yet.
export function flatCompressedUpTo(agentId, maxRound) {
  const c = S.compressedGen[agentId];
  if (!c) return flatGen(agentId);
  let out = `--- INITIAL GENERATION (round ${c.initialSummary.round}) ---\n${c.initialSummary.summary}`;
  c.extensionSummaries
    .filter(ext => ext.round <= maxRound)
    .forEach(ext => {
      out += `\n\n--- REFLECTION-EXTENDED DIRECTIONS (round ${ext.round}) ---\n${ext.summary}`;
    });
  return out;
}

// Finds an agent's name from the global agents array
export function agentName(id) {
  return agents.find(a => a.id === id)?.name || id;
}
