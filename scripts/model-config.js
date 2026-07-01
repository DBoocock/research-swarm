// Shared model/pricing configuration used by scripts/update-pricing.js and
// scripts/check-model-deprecation.js. Kept in one place so the two scripts
// can't drift apart on which models are configured or what "soon to be
// deprecated" means — the exact class of bug this project keeps finding
// (see tests/pricing-keys.spec.js for the analogous src/ case).

// Models we price. `id` must be the EXACT string modelFor() in src/models.js
// can return — used as the PRICING storage key, so priceFor() finds it with
// a plain object lookup. `litellmKey` is the key used to look the model up
// in LiteLLM's catalog — usually the same as `id`, except where LiteLLM
// carries multiple hosting-route entries for the same model with different
// litellm_provider tags (e.g. Gemini: bare keys are Vertex AI-routed,
// `gemini/`-prefixed keys are the direct API route). This app calls Gemini
// via @ai-sdk/google's direct API client, so the fetch must use the
// `gemini/`-prefixed route even though the stored/looked-up key stays bare
// to match modelFor()'s output. Verified 2026-07: Anthropic, DeepSeek, and
// OpenAI's bare keys already report the correct direct-API litellm_provider
// tag, so no override is needed for them.
export const MODELS_TO_PRICE = [
  { id: 'claude-sonnet-4-6' },
  { id: 'claude-opus-4-8' },
  { id: 'claude-haiku-4-5-20251001' },
  { id: 'gemini-2.5-flash',      litellmKey: 'gemini/gemini-2.5-flash' },
  { id: 'gemini-2.5-flash-lite', litellmKey: 'gemini/gemini-2.5-flash-lite' },
  { id: 'deepseek-v4-flash' },
  { id: 'deepseek-v4-pro' },
  { id: 'gpt-4.1' },
  { id: 'gpt-4.1-mini' },
  { id: 'o3' },
].map(m => ({ litellmKey: m.id, ...m }));

// Fallback pricing (per-million-token, in USD) used when LiteLLM is unreachable
export const FALLBACK = {
  'claude-sonnet-4-6':          { inp: 3.00, out: 15.00, cw: 3.75, cr: 0.30 },
  'claude-opus-4-8':            { inp: 5.00, out: 25.00, cw: 6.25, cr: 0.50 },
  'claude-haiku-4-5-20251001':  { inp: 1.00, out: 5.00, cw: 1.25, cr: 0.10 },
  'gemini-2.5-flash':           { inp: 0.30, out: 2.50, cw: 0, cr: 0.03 },
  'gemini-2.5-flash-lite':      { inp: 0.10, out: 0.40, cw: 0, cr: 0.01 },
  'deepseek-v4-flash':          { inp: 0.14, out: 0.28, cw: 0, cr: 0.0028 },
  'deepseek-v4-pro':            { inp: 0.435, out: 0.87, cw: 0, cr: 0.003625 },
  'gpt-4.1':                    { inp: 2.00, out: 8.00, cw: 0, cr: 0.50 },
  'gpt-4.1-mini':               { inp: 0.40, out: 1.60, cw: 0, cr: 0.10 },
  'o3':                         { inp: 2.00, out: 8.00, cw: 0, cr: 0.50 },
};

export async function fetchLiteLLMData() {
  const url = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// A deprecation_date within this many days (including already past) is
// flagged. LiteLLM deprecation notices have historically given months of
// lead time (the model this project actually hit had a deprecation_date
// ~7 months before it was noticed failing in production), so 60 days is a
// deliberately early warning, not a last-minute one.
export const DEPRECATION_WARNING_DAYS = 60;

// Returns findings for any configured model whose LiteLLM entry has a
// deprecation_date within DEPRECATION_WARNING_DAYS (past or future).
export function findDeprecations(data, now = new Date()) {
  const findings = [];
  for (const { id, litellmKey } of MODELS_TO_PRICE) {
    const entry = data[litellmKey];
    if (!entry?.deprecation_date) continue;
    const depDate = new Date(entry.deprecation_date);
    const daysUntil = Math.round((depDate - now) / (1000 * 60 * 60 * 24));
    if (daysUntil <= DEPRECATION_WARNING_DAYS) {
      findings.push({ id, litellmKey, deprecationDate: entry.deprecation_date, daysUntil, source: entry.source });
    }
  }
  return findings;
}
