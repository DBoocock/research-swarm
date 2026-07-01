import { test, expect } from '@playwright/test';
import { setupAnthropicMock, switchToAnthropic, waitForRunComplete } from './helpers.js';

test('generation round completes and text streams into agent cards', async ({ page }) => {
  await setupAnthropicMock(page);
  await page.goto('/');
  await switchToAnthropic(page);

  // Use only 2 agents for speed — deselect all then select stochastic + nonequil
  await page.evaluate(() => {
    window.__rs.S.selectedAgents = new Set(['stochastic', 'nonequil']);
  });

  await page.click('#run-btn');
  await waitForRunComplete(page);

  // genBlocks must have entries for both selected agents
  const genKeys = await page.evaluate(() => Object.keys(window.__rs.S.genBlocks));
  expect(genKeys).toContain('stochastic');
  expect(genKeys).toContain('nonequil');

  // Each agent's initial text must be non-empty
  const texts = await page.evaluate(() => ({
    stochastic: window.__rs.S.genBlocks.stochastic?.initial?.text,
    nonequil:   window.__rs.S.genBlocks.nonequil?.initial?.text,
  }));
  expect(texts.stochastic.length).toBeGreaterThan(0);
  expect(texts.nonequil.length).toBeGreaterThan(0);

  // DOM: generation panel must contain at least 2 result cards
  const cardCount = await page.locator('#panel-gen .rcard').count();
  expect(cardCount).toBeGreaterThanOrEqual(2);

  // Research map must have at least one entry (synthesis ran)
  const mapLen = await page.evaluate(() => window.__rs.S.researchMap.length);
  expect(mapLen).toBeGreaterThan(0);
});
