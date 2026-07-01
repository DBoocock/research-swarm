// Regression test: addUsage()'s "saved via caching" figure previously only
// computed a non-zero counterfactual for Anthropic (S.provider === 'anthropic'
// gate). Gemini's implicit caching reports real cache-read tokens via
// usage.inputTokenDetails.cacheReadTokens (traced through @ai-sdk/google and
// the ai SDK core), so it was silently under-reporting savings that were
// already being correctly applied to the actual cost total.
import { test, expect } from '@playwright/test';

test('costS.saved reflects cache-read savings regardless of provider', async ({ page }) => {
  await page.goto('/');

  const result = await page.evaluate(() => {
    const { addUsage, PRICING } = window.__test;
    const before = { ...window.__rs.costS };

    const i = 8000, o = 600, cr = 5000;
    // Simulate a Gemini generation call with a real cache hit — provider is
    // left at its default ('gemini'); addUsage() must not need an Anthropic
    // provider to credit the saving.
    addUsage('test-gemini-call', {
      input_tokens: i,
      output_tokens: o,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: cr,
    }, 'gemini-2.5-flash');

    const after = { ...window.__rs.costS };
    const P = PRICING['gemini-2.5-flash'];
    const expectedCost    = (i * P.inp + o * P.out + cr * P.cr) / 1e6;
    const expectedNoCache = ((i + cr) * P.inp + o * P.out) / 1e6;

    return {
      totalDelta: after.total - before.total,
      savedDelta: after.saved - before.saved,
      expectedCost,
      expectedSaved: expectedNoCache - expectedCost,
    };
  });

  expect(result.totalDelta).toBeCloseTo(result.expectedCost, 6);
  expect(result.savedDelta).toBeCloseTo(result.expectedSaved, 6);
  expect(result.savedDelta).toBeGreaterThan(0);
});
