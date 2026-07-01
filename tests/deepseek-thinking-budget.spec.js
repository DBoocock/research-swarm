// DeepSeek reasoning-mode budget tests (issue #31):
// - Toggle off (default): thinking role gets no extra token headroom, thinking not enabled.
// - Toggle on: thinking role gets the reasoning headroom added to max_tokens, thinking left enabled.
// - Synthesis output missing required sections fails the round instead of silently succeeding.
import { test, expect } from '@playwright/test';
import { sseWrap, FIXTURES, inferRole } from './helpers.js';

function deepseekSSE(content) {
  return [
    `data: {"id":"chatcmpl-test","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}`,
    `data: {"id":"chatcmpl-test","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":${JSON.stringify(content)}},"finish_reason":null}]}`,
    `data: {"id":"chatcmpl-test","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":100,"completion_tokens":5,"total_tokens":105}}`,
    'data: [DONE]',
    '',
  ].join('\n');
}

test('DeepSeek reasoning toggle off: synthesis call gets no reasoning headroom', async ({ page }) => {
  let synthBody = null;

  await page.route('**/api.deepseek.com/**', async route => {
    const body = route.request().postDataJSON();
    if (inferRole(body) === 'synthesis') synthBody = body;
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache' },
      body: deepseekSSE(FIXTURES.synthNew),
    });
  });

  await page.goto('/');
  await page.click('[data-provider="deepseek"]');
  await page.fill('#api-key-deepseek', 'sk-deepseek-test123');

  await page.evaluate(() => {
    window.__rs.S.selectedAgents = new Set(['stochastic']);
    window.__rs.S.genBlocks['stochastic'] = { initial: { round: 1, text: 'gen text' }, extensions: [] };
    window.__rs.S.currentRound = 1;
  });

  await page.evaluate(async () => { await window.__test.runSynthesis(false); });

  expect(synthBody).not.toBeNull();
  const maxTok = synthBody.max_tokens ?? synthBody.max_completion_tokens;
  expect(maxTok).toBe(1500); // MAX_TOKENS.synthesis, no headroom added
  expect(synthBody.thinking?.type ?? 'disabled').toBe('disabled');
});

test('DeepSeek reasoning toggle on: synthesis call gets the reasoning headroom and thinking left enabled', async ({ page }) => {
  let synthBody = null;

  await page.route('**/api.deepseek.com/**', async route => {
    const body = route.request().postDataJSON();
    if (inferRole(body) === 'synthesis') synthBody = body;
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache' },
      body: deepseekSSE(FIXTURES.synthNew),
    });
  });

  await page.goto('/');
  await page.click('[data-provider="deepseek"]');
  await page.fill('#api-key-deepseek', 'sk-deepseek-test123');
  await page.check('#deepseek-thinking-toggle');

  await page.evaluate(() => {
    window.__rs.S.selectedAgents = new Set(['stochastic']);
    window.__rs.S.genBlocks['stochastic'] = { initial: { round: 1, text: 'gen text' }, extensions: [] };
    window.__rs.S.currentRound = 1;
  });

  expect(await page.evaluate(() => window.__rs.S.deepseekThinking)).toBe(true);

  await page.evaluate(async () => { await window.__test.runSynthesis(false); });

  expect(synthBody).not.toBeNull();
  const maxTok = synthBody.max_tokens ?? synthBody.max_completion_tokens;
  expect(maxTok).toBe(1500 + 8000); // MAX_TOKENS.synthesis + DEEPSEEK_REASONING_HEADROOM
  // Reasoning left on: no thinking:disabled override injected for this call
  expect(synthBody.thinking).toBeUndefined();
});

test('synthesis missing required sections fails the round instead of silently saving it', async ({ page }) => {
  await page.route('**/api.anthropic.com/**', async route => {
    const body = route.request().postDataJSON();
    const role = inferRole(body);
    const fixture =
      role === 'synthesis'   ? sseWrap('RESEARCH DIRECTIONS:\n\n[DEEP+TRACTABLE] Truncated direction title') :
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
  await page.click('[data-provider="anthropic"]');
  await page.fill('#api-key-anthropic', 'sk-ant-test123');

  await page.evaluate(() => {
    window.__rs.S.selectedAgents = new Set(['stochastic']);
    window.__rs.S.genBlocks['stochastic'] = { initial: { round: 1, text: 'gen text' }, extensions: [] };
    window.__rs.S.researchMap = [];
    window.__rs.S.currentRound = 1;
  });

  await page.evaluate(async () => {
    try { await window.__test.runSynthesis(false); } catch { /* expected */ }
  });

  const retryBtn = page.locator('#panel-syn .sm-btn').filter({ hasText: 'retry synthesis' });
  await expect(retryBtn).toBeVisible({ timeout: 10000 });

  const [pendingArgs, lastError, roundsLen] = await page.evaluate(() => [
    window.__rs.S._pendingSynthesisArgs,
    window.__rs.S.lastSynthesisError,
    window.__rs.S.rounds.length,
  ]);
  expect(pendingArgs).not.toBeNull();
  expect(lastError).not.toBeNull();
  expect(roundsLen).toBe(0);
});
