import { S } from './state.js';

export const MODELS = {
  //               anthropic                         gemini                               deepseek             openai
  generation:   { anthropic:'claude-sonnet-4-6',    gemini:'gemini-2.5-flash',            deepseek:'deepseek-v4-flash', openai:'gpt-4.1'      },
  debate:       { anthropic:'claude-sonnet-4-6',    gemini:'gemini-2.5-flash',            deepseek:'deepseek-v4-flash', openai:'gpt-4.1'      },
  reflection:   { anthropic:'claude-sonnet-4-6',    gemini:'gemini-2.5-flash',            deepseek:'deepseek-v4-flash', openai:'gpt-4.1'      },
  genextension: { anthropic:'claude-sonnet-4-6',    gemini:'gemini-2.5-flash',            deepseek:'deepseek-v4-flash', openai:'gpt-4.1'      },
  synthesis:    { anthropic:'claude-sonnet-4-6',    gemini:'gemini-2.5-flash',            deepseek:'deepseek-v4-flash', openai:'gpt-4.1'      },
  meta:         { anthropic:'claude-sonnet-4-6',    gemini:'gemini-2.5-flash',            deepseek:'deepseek-v4-flash', openai:'gpt-4.1'      },
  roster:       { anthropic:'claude-sonnet-4-6',    gemini:'gemini-2.5-flash',            deepseek:'deepseek-v4-flash', openai:'gpt-4.1'      },
  handover:     { anthropic:'claude-sonnet-4-6',    gemini:'gemini-2.5-flash',            deepseek:'deepseek-v4-flash', openai:'gpt-4.1'      },
  attribution:  { anthropic:'claude-haiku-4-5-20251001', gemini:'gemini-2.5-flash-lite', deepseek:'deepseek-v4-flash', openai:'gpt-4.1-mini' },
  compression:  { anthropic:'claude-haiku-4-5-20251001', gemini:'gemini-2.5-flash-lite', deepseek:'deepseek-v4-flash', openai:'gpt-4.1-mini' },
  mandate:      { anthropic:'claude-haiku-4-5-20251001', gemini:'gemini-2.5-flash-lite', deepseek:'deepseek-v4-flash', openai:'gpt-4.1-mini' },
};

const SYNTHESIS_TIER = new Set(['synthesis', 'meta', 'roster', 'handover']);

export function modelFor(role) {
  const p = S.provider || 'gemini';
  const row = MODELS[role] || MODELS.generation;
  if (SYNTHESIS_TIER.has(role) && S.synthesisModel === 'opus') {
    if (p === 'anthropic') return 'claude-opus-4-8';
    if (p === 'deepseek')  return 'deepseek-v4-pro';
    if (p === 'openai')    return 'o3';
  }
  return row[p] || row.anthropic;
}

// Thinking is permitted only for synthesis and meta:
// these roles (a) do not generate agent-attributed persona-specific content
// and (b) do not touch agent mandates (see METHODOLOGY.md §7.1).
export function isThinkingRole(role) {
  return role === 'synthesis' || role === 'meta';
}

// Provider-level caching support
export function supportsCaching() {
  return (S.provider || 'gemini') === 'anthropic';
}
