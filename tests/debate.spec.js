import { test, expect } from '@playwright/test';
import { setupAnthropicMock, switchToAnthropic, injectGenState, sseWrap, FIXTURES } from './helpers.js';

test('debate round completes with text and type on S.currentDebates[key]', async ({ page }) => {
  await setupAnthropicMock(page);
  await page.goto('/');
  await switchToAnthropic(page);
  await injectGenState(page);

  // Inject a pairing proposal so runDebate has work to do
  await page.evaluate(() => {
    window.__rs.S.pairingProposals = [{
      id1: 'stochastic', id2: 'nonequil',
      type: 'CONTRADICTION', reason: 'Different noise vs attractor frameworks', enabled: true,
    }];
  });

  // Call runDebate directly with the active pairs
  await page.evaluate(async () => {
    const activePairs = window.__rs.S.pairingProposals.filter(p => p.enabled);
    await window.__test.runDebate(activePairs);
  });

  // The pair key uses underscore separator
  const key = 'stochastic_nonequil';
  const debate = await page.evaluate((k) => window.__rs.S.currentDebates[k], key);

  expect(debate).toBeTruthy();
  expect(typeof debate.text).toBe('string');
  expect(debate.text.length).toBeGreaterThan(0);
  expect(debate.type).toBe('CONTRADICTION');
});
