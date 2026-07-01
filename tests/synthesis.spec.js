import { test, expect } from '@playwright/test';
import { setupAnthropicMock, switchToAnthropic, injectGenState } from './helpers.js';

test('synthesis produces ≥1 research map entry via direction format', async ({ page }) => {
  await setupAnthropicMock(page);
  await page.goto('/');
  await switchToAnthropic(page);
  await injectGenState(page);

  // Reset map so we get clean new entries
  await page.evaluate(() => {
    window.__rs.S.researchMap = [];
    window.__rs.S.currentRound = 1;
  });

  await page.evaluate(async () => {
    await window.__test.runSynthesis(false);
  });

  const mapLen = await page.evaluate(() => window.__rs.S.researchMap.length);
  expect(mapLen).toBeGreaterThanOrEqual(1);

  // Each entry must have the required fields
  const entry = await page.evaluate(() => window.__rs.S.researchMap[0]);
  expect(entry.id).toMatch(/^R\d+-\d+$/);
  expect(entry.title).toBeTruthy();
  expect(['DEEP+TRACTABLE', 'DEEP+BLOCKED', 'SHALLOW+TRACTABLE', 'SHALLOW+BLOCKED']).toContain(entry.category);
  expect(entry.round).toBe(1);

  // Matrix must be populated (parseSynthesis fills it)
  const matrix = await page.evaluate(() => window.__rs.S.matrix);
  const allEntries = [...matrix.dt, ...matrix.db, ...matrix.st, ...matrix.sb];
  expect(allEntries.length).toBeGreaterThanOrEqual(1);
});
