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
