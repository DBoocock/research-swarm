// Regression test for the pricing-key drift bug: modelFor() and PRICING
// (src/generated/pricing.js) are two independently-maintained sources of
// model ID strings. priceFor() silently falls back to Sonnet's rate on any
// miss, so drift between them (e.g. a provider prefix mismatch, or a typo'd
// version number) previously went undetected and silently mis-billed every
// affected call. This asserts every model modelFor() can actually return,
// across every provider and both synthesis-tier settings, has an exact
// PRICING entry.
import { test, expect } from '@playwright/test';

test('every model modelFor() can return has an exact PRICING entry', async ({ page }) => {
  await page.goto('/');

  const missing = await page.evaluate(() => {
    const { modelFor, MODELS, PRICING } = window.__test;
    const providers = ['anthropic', 'gemini', 'deepseek', 'openai'];
    const roles = Object.keys(MODELS);
    const synthesisTierRoles = ['synthesis', 'meta', 'roster', 'handover'];
    const missing = [];

    for (const provider of providers) {
      window.__rs.S.provider = provider;
      for (const role of roles) {
        const synthesisModels = synthesisTierRoles.includes(role) ? ['sonnet', 'opus'] : ['sonnet'];
        for (const synthesisModel of synthesisModels) {
          window.__rs.S.synthesisModel = synthesisModel;
          const model = modelFor(role);
          if (!PRICING[model]) missing.push(`${provider}/${role}/${synthesisModel} -> "${model}"`);
        }
      }
    }
    return missing;
  });

  expect(missing).toEqual([]);
});

// Cheaper, complementary check: validates the MODELS table itself, not
// modelFor()'s output. modelFor() falls back to row.anthropic when
// row[provider] is falsy, which would mask a blank/typo'd entry for a
// non-Anthropic provider (PRICING would still resolve via the Anthropic
// fallback, so the test above wouldn't catch it) — this checks the source
// table directly instead.
test('every MODELS[role][provider] entry is a non-empty string', async ({ page }) => {
  await page.goto('/');

  const invalid = await page.evaluate(() => {
    const { MODELS } = window.__test;
    const providers = ['anthropic', 'gemini', 'deepseek', 'openai'];
    const invalid = [];
    for (const role of Object.keys(MODELS)) {
      for (const provider of providers) {
        const model = MODELS[role][provider];
        if (typeof model !== 'string' || !model.trim()) {
          invalid.push(`${role}/${provider} -> ${JSON.stringify(model)}`);
        }
      }
    }
    return invalid;
  });

  expect(invalid).toEqual([]);
});
