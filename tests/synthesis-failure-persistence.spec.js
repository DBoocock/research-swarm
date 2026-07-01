// Regression test: a failed, unresolved synthesis must survive an
// export/import round-trip with enough state to actually retry it — not
// just enough to view what happened. Before this fix, only rounds that
// completed successfully were persisted (saveRound() only runs on the
// success path), so a failed synthesis's debate content, pending-retry
// state, and error message all vanished on export — reimporting looked
// like a clean, successful session with no way to finish the failed step.
import { test, expect } from '@playwright/test';
import { setupAnthropicMock, switchToAnthropic, injectGenState, sseWrap, FIXTURES, inferRole } from './helpers.js';

test('a failed synthesis survives export/import and can be retried in the reimported session', async ({ page }) => {
  const routeState = { failSynthesis: true };
  await page.route('**/api.anthropic.com/**', async route => {
    const body = route.request().postDataJSON();
    const role = inferRole(body);
    if (role === 'synthesis' && routeState.failSynthesis) {
      await route.fulfill({ status: 500, contentType: 'text/plain', body: 'Server error' });
      return;
    }
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

  await page.goto('/');
  await switchToAnthropic(page);
  await injectGenState(page);
  await page.evaluate(() => {
    window.__rs.S.researchMap = [];
    window.__rs.S.currentRound = 2;
    // The debate content this failed synthesis attempt was working from —
    // this is what saveRound()-only-on-success would otherwise discard.
    window.__rs.S.currentDebates = {
      stochastic_nonequil: { text: 'Debate on noise vs attractors.', type: 'CONTRADICTION' },
    };
    // Stale pairing proposal from the last successful meta-agent run — this
    // is what the Next Round tab's launch button must stay disabled against.
    window.__rs.S.pairingProposals = [
      { id1: 'stochastic', id2: 'nonequil', type: 'BRIDGE', reason: 'test', enabled: true },
    ];
  });

  await page.evaluate(async () => {
    try { await window.__test.runSynthesis(true); } catch { /* expected */ }
  });

  await expect(page.locator('#panel-syn .sm-btn').filter({ hasText: 'retry synthesis' })).toBeVisible({ timeout: 10000 });

  const exportedJson = await page.evaluate(() => JSON.stringify(window.__test.buildExportData()));
  const exported = JSON.parse(exportedJson);
  expect(exported.pendingSynthesisArgs).toEqual({ includeDebate: true });
  expect(exported.lastSynthesisError).toBeTruthy();
  expect(exported.currentDebates.stochastic_nonequil).toMatchObject({
    text: 'Debate on noise vs attractors.', type: 'CONTRADICTION',
  });

  // Fresh session, then import the failed state.
  await page.goto('/');
  await page.setInputFiles('#import-file', {
    name: 'failed-session.json',
    mimeType: 'application/json',
    buffer: Buffer.from(exportedJson),
  });
  await page.waitForFunction(() => window.__rs.S._pendingSynthesisArgs !== null, { timeout: 5000 });
  await page.click('[data-tab="syn"]'); // importSession() always switches to the Log tab

  // The reimported session shows the same unresolved failure, not a blank
  // or falsely-successful one.
  await expect(page.locator('#panel-syn')).toContainText('Synthesis error');
  await expect(page.locator('#panel-syn .sm-btn').filter({ hasText: 'retry synthesis' })).toBeVisible();
  const restoredDebates = await page.evaluate(() => window.__rs.S.currentDebates);
  expect(restoredDebates.stochastic_nonequil).toMatchObject({
    text: 'Debate on noise vs attractors.', type: 'CONTRADICTION',
  });

  // Reusing the existing guard (already tested in retry.spec.js) — proceeding
  // past an unresolved failure is still blocked after reimport, not just live.
  await expect(page.locator('#panel-pair .launch-btn')).toBeDisabled();

  // Retry from the reimported session — needs the key re-entered (never
  // persisted) and the mock switched to succeed.
  await switchToAnthropic(page);
  routeState.failSynthesis = false;

  await page.locator('#panel-syn .sm-btn').filter({ hasText: 'retry synthesis' }).click();
  await page.waitForFunction(() => window.__rs.S._pendingSynthesisArgs === null, { timeout: 15000 });

  const mapLen = await page.evaluate(() => window.__rs.S.researchMap.length);
  expect(mapLen).toBeGreaterThan(0);
});
