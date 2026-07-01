import { streamText } from 'ai';
import { S, brief, costS } from './state.js';
import { modelFor, isThinkingRole } from './models.js';
import { priceFor } from './pricing.js';
import { getModel, getCallProviderOptions } from './providers/index.js';
import { MAX_TOKENS, DEEPSEEK_REASONING_HEADROOM } from './constants.js';
import { renderCost } from './ui/cost.js';

// ── Brief block builders ────────────────────────────────────────────────────

export function buildCachedBlock() {
  return brief.sysCtx + '\n\n' + brief.resCtx + '\n\n' + brief.dataCtx;
}

// Returns an array of system-block descriptors used by streamAI().
// cache_control is always set on the brief block; streamAI() converts it to
// an Anthropic providerOption only on the Anthropic path — safe to pass on all paths.
export function agentSystemBlocks(mandate) {
  return [
    { type: 'text', text: buildCachedBlock(), cache_control: { type: 'ephemeral' } },
    { type: 'text', text: '\n\nYOUR SPECIALIST MANDATE:\n' + mandate },
  ];
}

export function briefOnlyBlock() {
  return [
    { type: 'text', text: buildCachedBlock(), cache_control: { type: 'ephemeral' } },
  ];
}

// ── Build AI SDK v7 `instructions` value from system blocks ───────────────
// AI SDK v7 removed role:'system' from messages[]; system content
// must be passed via the `instructions` parameter instead.
// cache_control applied ONLY on Anthropic path — never sent to other providers.

function buildInstructions(systemBlocks, systemString) {
  const isAnthropic = (S.provider || 'gemini') === 'anthropic';

  if (systemBlocks) {
    const sysMessages = systemBlocks.map(block => {
      const msg = { role: 'system', content: block.text };
      if (isAnthropic && block.cache_control) {
        msg.providerOptions = { anthropic: { cacheControl: block.cache_control } };
      }
      return msg;
    });
    // Single block can be passed as-is; SDK accepts string | SystemMsg | SystemMsg[]
    return sysMessages.length === 1 ? sysMessages[0] : sysMessages;
  }

  if (systemString) {
    return systemString;
  }

  return undefined;
}

// ── Usage accounting ────────────────────────────────────────────────────────

export function addUsage(name, u, model) {
  const i  = u.input_tokens                    || 0;
  const o  = u.output_tokens                   || 0;
  const cw = u.cache_creation_input_tokens     || 0;
  const cr = u.cache_read_input_tokens         || 0;
  const P  = priceFor(model);

  costS.inp += i; costS.out += o; costS.cw += cw; costS.cr += cr;
  // P.* are $ per million tokens (see src/generated/pricing.js) — divide by 1e6 for $.
  const c = (i*P.inp + o*P.out + cw*P.cw + cr*P.cr) / 1e6;
  // "Saved" compares actual cost to the no-caching counterfactual: cache reads
  // and writes billed as plain input tokens instead. Provider-agnostic — for
  // providers with no caching (cw and cr always 0) this collapses to wc === c,
  // so saved is naturally 0 without needing a per-provider branch.
  const wc = ((i + cr)*P.inp + o*P.out + cw*P.inp) / 1e6;
  costS.total += c;
  costS.saved += Math.max(0, wc - c);
  costS.callCount = (costS.callCount || 0) + 1;

  const mlbl =
    model?.includes('haiku')       ? 'hku' :
    model?.includes('opus')        ? 'ops' :
    model?.includes('flash-lite')  ? 'flt' :
    model?.includes('gemini')      ? 'fls' :
    model?.includes('mini')        ? 'mini':
    model?.includes('o3')          ? 'o3'  :
    model?.includes('deepseek')    ? 'ds'  : 'snt';

  costS.calls.unshift({ name: name.slice(0, 22), cost: c, hit: cr > 0, cr, mlbl });
  renderCost();
}

// ── Extract AI SDK usage into addUsage() shape ─────────────────────────────

async function extractUsage(result) {
  const usage = await result.usage;
  const inp    = usage.inputTokenDetails?.noCacheTokens ?? usage.inputTokens  ?? 0;
  const cw     = usage.inputTokenDetails?.cacheWriteTokens ?? 0;
  const cr     = usage.inputTokenDetails?.cacheReadTokens  ?? 0;
  const out    = usage.outputTokens ?? 0;
  return { input_tokens: inp, output_tokens: out, cache_creation_input_tokens: cw, cache_read_input_tokens: cr };
}

// ── Unified API entry point ─────────────────────────────────────────────────
// Same external signature as the former apiStream().
// Replaces raw fetch-based providers with Vercel AI SDK streamText().

export async function streamAI({ name, role, systemBlocks, systemString, messages, onChunk, signal, maxTokensOverride }) {
  const model          = getModel(role);
  const providerOptions = getCallProviderOptions(role);
  const instructions   = buildInstructions(systemBlocks, systemString);

  const reasoningHeadroom =
    (S.provider === 'deepseek' && S.deepseekThinking && isThinkingRole(role))
      ? DEEPSEEK_REASONING_HEADROOM : 0;

  const result = streamText({
    model,
    ...(instructions !== undefined ? { instructions } : {}),
    messages,
    maxOutputTokens: (maxTokensOverride ?? MAX_TOKENS[role] ?? 1200) + reasoningHeadroom,
    maxRetries: 3,
    abortSignal: signal,
    ...(providerOptions ? { providerOptions } : {}),
  });

  let text = '';
  for await (const chunk of result.textStream) {
    text += chunk;
    onChunk?.(chunk);
  }

  const usage = await extractUsage(result);
  addUsage(name, usage, modelFor(role));
  return text;
}

// Backward-compat alias so any callers still using the old name work.
export const apiStream = streamAI;

// ── Parallel helper ─────────────────────────────────────────────────────────
// On Anthropic: run fns[0] alone first (writes the prompt cache),
// then fns[1..N] in true parallel (all read from warm cache).
// All other providers: fire everything in parallel immediately.
export async function callParallel(fns) {
  if (!fns.length) return [];
  if ((S.provider || 'gemini') === 'anthropic') {
    const first = await fns[0]();
    const rest  = await Promise.all(fns.slice(1).map(f => f()));
    return [first, ...rest];
  }
  return Promise.all(fns.map(f => f()));
}
