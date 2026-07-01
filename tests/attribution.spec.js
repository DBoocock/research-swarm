// Regression test: runAttribution() has its own try/catch and silently
// swallows failures via console.warn (see synthesis.js's attributionOk
// notice) — a test that only checks "didn't throw" would pass even if
// attribution never actually attributed anything, which is exactly what
// happened in a live Gemini session (every researchMap entry across two
// full test sessions had empty agents/debateRefs, with zero visible error,
// because the underlying model was silently failing on every call). This
// asserts the real, populated values.
import { test, expect } from '@playwright/test';
import { setupAnthropicMock, switchToAnthropic, injectGenState, sseWrap } from './helpers.js';

test('attribution populates real agents and debateRefs, not just "didn\'t throw"', async ({ page }) => {
  await setupAnthropicMock(page, {
    attribution: sseWrap('DIRECTION 0: agents=[stochastic,nonequil] debates=[stochastic_nonequil]'),
  });
  await page.goto('/');
  await switchToAnthropic(page);
  await injectGenState(page);

  await page.evaluate(() => {
    window.__rs.S.researchMap = [];
    window.__rs.S.currentRound = 1;
    window.__rs.S.currentDebates = {
      stochastic_nonequil: { text: 'Debate on noise vs attractors.', type: 'CONTRADICTION' },
    };
  });

  await page.evaluate(async () => {
    await window.__test.runSynthesis(true);
  });

  const entry = await page.evaluate(() => window.__rs.S.researchMap[0]);
  expect(entry.agents.length).toBeGreaterThan(0);
  expect(entry.agents.map(a => a.id)).toEqual(expect.arrayContaining(['stochastic', 'nonequil']));
  expect(entry.debateRefs.length).toBeGreaterThan(0);
  expect(entry.debateRefs[0].key).toBe('stochastic_nonequil');
});
