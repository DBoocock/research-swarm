// Retry test: synthesis exhausting 3 SDK retries surfaces the retry button.
// Clicking retry succeeds without re-running generation/debate.
import { test, expect } from '@playwright/test';
import { switchToAnthropic, injectGenState, sseWrap, FIXTURES, inferRole } from './helpers.js';

test('retry button appears after synthesis failure and succeeds on click', async ({ page }) => {
  const routeState = { failSynthesis: true };

  // Route mock: fail synthesis, succeed everything else
  await page.route('**/api.anthropic.com/**', async route => {
    const body = route.request().postDataJSON();
    const role = inferRole(body);

    if (role === 'synthesis' && routeState.failSynthesis) {
      // Return 500 so the AI SDK retries (maxRetries: 3 means 4 total attempts)
      await route.fulfill({ status: 500, contentType: 'text/plain', body: 'Server error' });
      return;
    }
    // All other roles (generation, attribution, meta) succeed
    const body_resp =
      role === 'attribution' ? sseWrap(FIXTURES.attribution) :
      role === 'meta'        ? sseWrap(FIXTURES.meta)        :
                               sseWrap(FIXTURES.generation);
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache' },
      body: body_resp,
    });
  });

  await page.goto('/');
  await switchToAnthropic(page);
  await injectGenState(page);

  // Inject existing researchMap entry so attribution has something to work with on retry
  await page.evaluate(() => {
    window.__rs.S.researchMap = [];
    window.__rs.S.currentRound = 1;
  });

  // Call runSynthesis directly; it will fail (500 × 4 attempts)
  const synthPromise = page.evaluate(async () => {
    try {
      await window.__test.runSynthesis(false);
    } catch { /* expected */ }
  });

  await synthPromise;

  // Retry button must appear in the synthesis body
  const retryBtn = page.locator('#panel-syn .sm-btn').filter({ hasText: 'retry synthesis' });
  await expect(retryBtn).toBeVisible({ timeout: 10000 });

  // S._pendingSynthesisArgs must still be set (not cleared on failure)
  const pendingArgs = await page.evaluate(() => window.__rs.S._pendingSynthesisArgs);
  expect(pendingArgs).not.toBeNull();
  expect(pendingArgs.includeDebate).toBe(false);

  // Switch mock to success for synthesis
  routeState.failSynthesis = false;

  // Override to return synthesis fixture on success
  await page.route('**/api.anthropic.com/**', async route => {
    const body = route.request().postDataJSON();
    const role = inferRole(body);
    const fixture =
      role === 'synthesis'   ? sseWrap(FIXTURES.synthNew)    :
      role === 'attribution' ? sseWrap(FIXTURES.attribution) :
      role === 'meta'        ? sseWrap(FIXTURES.meta)        :
                               sseWrap(FIXTURES.generation);
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache' },
      body: fixture,
    });
  });

  // Click the retry button — must succeed
  await retryBtn.click();

  // Wait for synthesis to fully settle — _pendingSynthesisArgs is cleared last,
  // after attribution and the meta-agent call both resolve, so it's the only
  // reliable "done" signal (researchMap fills in earlier, mid-flight).
  await page.waitForFunction(() => window.__rs.S._pendingSynthesisArgs === null, { timeout: 15000 });

  const mapLen = await page.evaluate(() => window.__rs.S.researchMap.length);
  expect(mapLen).toBeGreaterThan(0);

  // _pendingSynthesisArgs cleared on success
  const clearedArgs = await page.evaluate(() => window.__rs.S._pendingSynthesisArgs);
  expect(clearedArgs).toBeNull();
});

test('launching another debate round is blocked while a synthesis failure is unresolved', async ({ page }) => {
  await page.route('**/api.anthropic.com/**', async route => {
    const body = route.request().postDataJSON();
    const role = inferRole(body);
    if (role === 'synthesis') {
      await route.fulfill({ status: 500, contentType: 'text/plain', body: 'Server error' });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache' },
      body: sseWrap(FIXTURES.generation),
    });
  });

  await page.goto('/');
  await switchToAnthropic(page);
  await injectGenState(page);
  await page.evaluate(() => {
    window.__rs.S.researchMap = [];
    window.__rs.S.currentRound = 1;
    // Stale pairing proposal left over from the last successful meta-agent
    // run — this is what a second debate round would incorrectly launch
    // against if the failed synthesis in between weren't blocking it.
    window.__rs.S.pairingProposals = [
      { id1: 'stochastic', id2: 'nonequil', type: 'BRIDGE', reason: 'test', enabled: true },
    ];
  });

  await page.evaluate(async () => {
    try { await window.__test.runSynthesis(false); } catch { /* expected */ }
  });

  await expect(page.locator('#panel-syn .sm-btn').filter({ hasText: 'retry synthesis' })).toBeVisible({ timeout: 10000 });

  const launchBtn = page.locator('#panel-pair .launch-btn');
  await expect(launchBtn).toBeDisabled();
  await expect(page.locator('#panel-pair')).toContainText('resolve it');

  // Defense in depth: runDebate() itself must refuse even if something
  // else tried to call it directly, not just the disabled button.
  const roundBefore = await page.evaluate(() => window.__rs.S.currentRound);
  await page.evaluate(async () => { await window.__test.runDebate(); });
  const roundAfter = await page.evaluate(() => window.__rs.S.currentRound);
  expect(roundAfter).toBe(roundBefore);
});
