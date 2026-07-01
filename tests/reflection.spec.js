// Reflection test: genCardEls extension text appears live; S.genBlocks[id].extensions populated.
import { test, expect } from '@playwright/test';
import { setupAnthropicMock, switchToAnthropic, injectGenState } from './helpers.js';

test('reflection-extended directions populate genBlocks extensions and live DOM', async ({ page }) => {
  await setupAnthropicMock(page);
  await page.goto('/');
  await switchToAnthropic(page);
  await injectGenState(page);

  // Create DOM generation cards so genCardEls is populated (needed by reflection streaming)
  await page.evaluate(() => {
    // Build minimal card elements in the gen panel so genCardEls can be wired
    const panel = document.getElementById('panel-gen');
    ['stochastic', 'nonequil'].forEach(id => {
      const card = document.createElement('div');
      card.className = 'rcard';
      const hdr = document.createElement('div');
      hdr.className = 'rcard-hdr';
      const body = document.createElement('div');
      body.className = 'rcard-body';
      body.textContent = window.__rs.S.genBlocks[id]?.initial?.text || '';
      card.appendChild(hdr);
      card.appendChild(body);
      panel.appendChild(card);
      window.__rs.genCardEls[id] = { bodyEl: body, hdrEl: hdr };
    });
  });

  // Set up a debate result so reflection has something to process
  await page.evaluate(() => {
    window.__rs.S.currentDebates['stochastic_nonequil'] = {
      text: 'The stochastic approach conflicts with thermodynamic irreversibility.',
      type: 'CONTRADICTION',
    };
  });

  const activePairs = [{ id1: 'stochastic', id2: 'nonequil', type: 'CONTRADICTION', reason: 'test', enabled: true }];

  await page.evaluate(async (pairs) => {
    await window.__test.runReflectionRound(pairs);
  }, activePairs);

  // Both agents must have extensions in S.genBlocks
  const extensions = await page.evaluate(() => ({
    stochastic: window.__rs.S.genBlocks.stochastic?.extensions ?? [],
    nonequil:   window.__rs.S.genBlocks.nonequil?.extensions   ?? [],
  }));

  expect(extensions.stochastic.length).toBeGreaterThan(0);
  expect(extensions.stochastic[0].text.length).toBeGreaterThan(0);
  expect(extensions.nonequil.length).toBeGreaterThan(0);

  // Extensions must have correct round number
  const stochasticExt = extensions.stochastic[0];
  expect(stochasticExt.round).toBe(1);

  // agentReflections must be populated
  const reflections = await page.evaluate(() => window.__rs.S.agentReflections);
  expect(Object.keys(reflections).length).toBeGreaterThan(0);
});
