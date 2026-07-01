// Session export/import round-trip: S.currentRound and debates {text,type} survive.
import { test, expect } from '@playwright/test';

const EXPORT_DATA = {
  exportTime: new Date().toISOString(),
  provider: 'anthropic',
  brief: {
    title: 'Test Session',
    subtitle: 'Round-trip test',
    sysCtx: 'System context',
    resCtx: 'Research context',
    dataCtx: 'Data context',
  },
  reflectionsEnabled: true,
  depth: 'brief',
  synthesisModel: 'sonnet',
  currentRound: 3,
  selectedAgents: ['stochastic', 'nonequil'],
  agentMandates: {
    stochastic: { name: 'Stochastic process modeler', color: '#7ac8c8', mandate: 'Stochastic test', status: 'active' },
    nonequil:   { name: 'Non-equilibrium physics', color: '#c87ac8', mandate: 'Non-eq test', status: 'active' },
  },
  sessionCost: { total: 0.05, saved: 0.01, inputTok: 5000, outputTok: 500, cacheReads: 200, cacheWrites: 400 },
  cumulativeCost: 0.12,
  rounds: [
    {
      round: 1,
      ts: '2026-06-01T10:00:00.000Z',
      depth: 'brief',
      debates: {
        'stochastic_nonequil': { text: 'Debate on noise vs attractors.', type: 'CONTRADICTION' },
      },
      synthesis: 'Grade dynamics exhibit bifurcations at threshold grades.',
      pairingProposals: [],
      retirementProposals: [],
    },
    {
      round: 2,
      ts: '2026-06-02T10:00:00.000Z',
      depth: 'brief',
      debates: {
        'stochastic_bayesian': { text: 'Complementary probabilistic frameworks.', type: 'INTERSECTION' },
      },
      synthesis: 'Information-theoretic constraints on grade precision emerge.',
      pairingProposals: [{ id1: 'stochastic', id2: 'nonequil', type: 'BRIDGE', reason: 'test', enabled: true }],
      retirementProposals: [],
    },
  ],
  researchMap: [
    {
      id: 'R1-0',
      title: 'Markov chain grade consensus',
      category: 'DEEP+TRACTABLE',
      round: 1,
      tag: 'primary',
      agents: [{ id: 'stochastic', round: 1 }],
      debateRefs: [{ round: 1, key: 'stochastic_nonequil' }],
      parentIds: [],
      summary: { methods: 'Markov chain', phenomenon: 'grade drift' },
      labelStatus: 'novel',
    },
  ],
  contradictions: [
    { a1: 'Stochastic process modeler', a2: 'Non-equilibrium physics', claim1: 'noise-dominated', claim2: 'thermodynamic', resolution: 'empirical comparison', round: 1 },
  ],
  matrix: { dt: ['Markov chain grade consensus'], db: [], st: [], sb: [] },
  overlapScores: { 'stochastic_nonequil': { score: 0.8, reason: 'Complementary', source: 'roster' } },
  agentReflections: {},
  genBlocks: {
    stochastic: { initial: { round: 1, text: 'Markov chain directions.' }, extensions: [{ round: 2, text: 'Extended with thermodynamic analogy.' }] },
  },
  compressedGen: {},
};

test('JSON export round-trips through import with currentRound and debate structure preserved', async ({ page }) => {
  await page.goto('/');

  // Import the session via the file input
  const json = JSON.stringify(EXPORT_DATA);
  await page.setInputFiles('#import-file', {
    name: 'test-export.json',
    mimeType: 'application/json',
    buffer: Buffer.from(json),
  });

  // Wait for import to complete (status message updates)
  await page.waitForFunction(() =>
    document.getElementById('status-bar')?.textContent?.includes('imported') ||
    window.__rs.S.currentRound === 3
  , { timeout: 5000 });

  // Verify currentRound survived
  const currentRound = await page.evaluate(() => window.__rs.S.currentRound);
  expect(currentRound).toBe(3);

  // Verify last round's debates structure: key uses _ separator, has text and type
  const debates = await page.evaluate(() => {
    const lastRound = window.__rs.S.rounds[window.__rs.S.rounds.length - 1];
    return lastRound?.debates ?? null;
  });
  expect(debates).not.toBeNull();
  expect(debates['stochastic_bayesian']).toMatchObject({
    text: 'Complementary probabilistic frameworks.',
    type: 'INTERSECTION',
  });

  // Verify researchMap entry survived with agents array in {id, round} format
  const mapEntry = await page.evaluate(() => window.__rs.S.researchMap[0]);
  expect(mapEntry.id).toBe('R1-0');
  expect(mapEntry.agents[0]).toMatchObject({ id: 'stochastic', round: 1 });

  // Verify S.currentDebates is populated from the last round's debates
  const currentDebates = await page.evaluate(() => window.__rs.S.currentDebates);
  expect(Object.keys(currentDebates)).toContain('stochastic_bayesian');

  // Verify round count
  const roundCount = await page.evaluate(() => window.__rs.S.rounds.length);
  expect(roundCount).toBe(2);

  // --- DOM-level assertions ---
  // State restoring correctly is not the same as the UI rendering it —
  // rebuildDebatePanel()/rebuildSynthesisPanel() previously threw (wrong
  // element ID, wrong field name) or silently no-op'd (hardcoded null),
  // leaving these panels empty despite S being fully correct. Assert on
  // the actual rendered panels, not just internal state.
  await expect(page.locator('#panel-deb')).toContainText('Complementary probabilistic frameworks.');
  await expect(page.locator('#panel-syn')).toContainText('Information-theoretic constraints on grade precision emerge.');

  // Provider button must reflect the imported provider, not just S.provider —
  // setDepth() previously stripped 'active' from provider/synth buttons too
  // (shared .depth-btn class, no data-depth attribute to distinguish them).
  await expect(page.locator('.provider-btn[data-provider="anthropic"]')).toHaveClass(/active/);
});

test('Next Round panel shows retirement recommendations when there are no pairing proposals', async ({ page }) => {
  await page.goto('/');

  // renderPairingsPanel() previously gated its entire body on
  // S.pairingProposals.length, so a round with only status-change
  // recommendations (no pairings) fell through to the "No proposals yet"
  // empty state — even though S.retirementProposals was fully populated.
  const data = JSON.parse(JSON.stringify(EXPORT_DATA));
  data.rounds[data.rounds.length - 1].pairingProposals = [];
  data.rounds[data.rounds.length - 1].retirementProposals = [
    { id: 'stochastic', action: 'retire', reason: 'Test retirement reason', status: 'retired', accepted: false },
  ];

  await page.setInputFiles('#import-file', {
    name: 'test-export-retirement-only.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(data)),
  });

  await page.waitForFunction(() => window.__rs.S.currentRound === 3, { timeout: 5000 });

  const pairingProposals = await page.evaluate(() => window.__rs.S.pairingProposals);
  expect(pairingProposals).toEqual([]);

  await expect(page.locator('#panel-pair')).not.toContainText('No proposals yet');
  await expect(page.locator('#panel-pair')).toContainText('Test retirement reason');
});
