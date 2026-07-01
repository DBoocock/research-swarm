// Regression tests for parseSynthesis edge cases:
// 1. SAME AS retraction removes provisional entry and merges into existing map entry
// 2. Same-round EXTENDS reference yields extends_unresolved with content preserved
import { test, expect } from '@playwright/test';
import { FIXTURES } from './helpers.js';

test('SAME AS retracts provisional entry and merges into existing map entry', async ({ page }) => {
  await page.goto('/');

  // Pre-populate researchMap with an existing entry from a prior round
  await page.evaluate(() => {
    window.__rs.S.currentRound = 2;
    window.__rs.S.researchMap = [{
      id: 'R1-0',
      title: 'Grade consensus formation as Markov process',
      category: 'DEEP+TRACTABLE',
      round: 1,
      tag: null,
      agents: [],
      debateRefs: [],
      parentIds: [],
      summary: null,
      labelStatus: 'novel',
    }];
  });

  // parseSynthesis on text containing SAME AS: R1-0 — this should retract the new entry
  await page.evaluate((text) => {
    window.__test.parseSynthesis(text);
  }, FIXTURES.synthSameAs);

  const state = await page.evaluate(() => ({
    mapLen: window.__rs.S.researchMap.length,
    map:    window.__rs.S.researchMap,
  }));

  // The SAME AS entry should have been retracted — map length stays 1 (the prior entry)
  expect(state.mapLen).toBe(1);

  // The existing entry is preserved (not duplicated)
  expect(state.map[0].id).toBe('R1-0');
});

test('same-round EXTENDS reference yields extends_unresolved with content preserved', async ({ page }) => {
  await page.goto('/');

  // Clean map — no prior entries (this is round 1, so EXTENDS: R1-0 is same-round)
  await page.evaluate(() => {
    window.__rs.S.currentRound = 1;
    window.__rs.S.researchMap = [];
  });

  // Fixture: first entry is R1-0 (new), second entry EXTENDS: R1-0 (same round → unresolved)
  await page.evaluate((text) => {
    window.__test.parseSynthesis(text);
  }, FIXTURES.synthExtendsUnresolved);

  const state = await page.evaluate(() => ({
    mapLen: window.__rs.S.researchMap.length,
    map:    window.__rs.S.researchMap,
  }));

  // Both entries should be in the map (extends_unresolved is NOT retracted)
  expect(state.mapLen).toBe(2);

  // Second entry should have labelStatus 'extends_unresolved'
  const second = state.map.find(e => e.labelStatus === 'extends_unresolved');
  expect(second).toBeTruthy();
  expect(second.title.length).toBeGreaterThan(0);
  // Content (summary) must be preserved on the unresolved entry
  expect(second.summary).not.toBeNull();
});
