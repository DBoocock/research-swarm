// Shared Playwright test helpers.
// All tests run against the built dist/index.html served by vite preview.
// API calls are intercepted at the network level — no real API keys needed.

/** Build a minimal Anthropic SSE response wrapping the given text. */
export function sseWrap(text, inputTokens = 100, outputTokens = 10) {
  return [
    'event: message_start',
    `data: {"type":"message_start","message":{"id":"msg_test","type":"message","role":"assistant","model":"claude-sonnet-4-6","content":[],"stop_reason":null,"usage":{"input_tokens":${inputTokens},"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}}`,
    '',
    'event: content_block_start',
    'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
    '',
    'event: content_block_delta',
    `data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":${JSON.stringify(text)}}}`,
    '',
    'event: content_block_stop',
    'data: {"type":"content_block_stop","index":0}',
    '',
    'event: message_delta',
    `data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":${outputTokens}}}`,
    '',
    'event: message_stop',
    'data: {"type":"message_stop"}',
    '',
  ].join('\n');
}

/** Infer the call role from the Anthropic request body. */
export function inferRole(body) {
  const systemParts = Array.isArray(body.system)
    ? body.system.map(b => b.text || '').join(' ')
    : (typeof body.system === 'string' ? body.system : '');
  const userContent = body.messages?.[0]?.content ?? '';
  const userText = Array.isArray(userContent)
    ? userContent.map(b => b.text || '').join(' ')
    : String(userContent);

  if (systemParts.includes('YOUR SPECIALIST MANDATE') && userText.includes('rebuttal'))
    return 'debate';
  if (systemParts.includes('YOUR SPECIALIST MANDATE') && userText.includes('CRITIQUES YOU'))
    return 'reflection';
  if (systemParts.includes('YOUR SPECIALIST MANDATE') && userText.includes('reflect on your debate'))
    return 'genext';
  if (systemParts.includes('YOUR SPECIALIST MANDATE'))
    return 'generation';
  if (userText.includes('Summarise each agent'))
    return 'compression';
  if (userText.includes('RESEARCH DIRECTIONS'))
    return 'synthesis';
  if (userText.includes('Classify which agents'))
    return 'attribution';
  if (userText.includes('Propose debate pairings'))
    return 'meta';
  return 'unknown';
}

// ── Fixture texts ────────────────────────────────────────────────────────────

export const FIXTURES = {
  generation: `Grade consensus dynamics present multiple research directions.

Direction 1: Markov chain models of grade consensus formation
Using transition probability matrices to model grade proposal sequences, I can characterize convergence rates to consensus equilibria and the role of selection bias.

Direction 2: Noise-driven grade drift under anchoring pressure
Treating individual grade proposals as noisy observations of latent difficulty, the ensemble dynamics follow Langevin equations where the consensus acts as a slowly-drifting potential well.`,

  debate: `The stochastic framework captures short-run grade variance well, but underestimates the role of deterministic attractors in long-run grade stability.

CRITICAL POINT 1: Grade distributions are not merely noise — they reflect genuine attractor structure in the dynamical phase space.

CRITICAL POINT 2: The Markov model's stationary distribution should be derivable from the ODE system's invariant measure, suggesting a deeper unity.

RECOMMENDATION: A hybrid stochastic-ODE framework would unify both perspectives.`,

  reflection: `REBUTTAL TO Stochastic process modeler: The stochastic framework captures individual variance well. I concede that short-term dynamics are noisy. However, the deterministic attractor structure better explains long-run grade stability.

FOR EACH CRITIQUE YOU GENERATED: Critique to Stochastic: Studying the stochastic framework revealed that my ODE model needs noise terms near bifurcation points.

ACROSS ALL EXCHANGES: New direction: combining stochastic noise with dynamical attractors to model phase transitions in grading norm evolution across regional communities.`,

  genext: `Extending from reflection insights: a hybrid stochastic-dynamical model where consensus formation is modeled as noisy gradient descent on a slowly-evolving energy landscape. This unifies the Markov chain transition structure with the ODE attractor framework.`,

  compression: `===AGENT_0===
Stochastic agent proposes Markov chain models of grade consensus formation and noise-driven drift under anchoring pressure. Key focus: selection bias effects on convergence rates.

===AGENT_1===
Non-equilibrium physics agent models grade dynamics through information geometry, applying stochastic thermodynamics to quantify irreversible information loss under consensus anchoring.`,

  attribution: `DIRECTION 0: agents=[stochastic] debates=[]
DIRECTION 1: agents=[nonequil] debates=[]`,

  meta: `PAIR: stochastic | nonequil | CONTRADICTION | Stochastic noise vs thermodynamic irreversibility as primary mechanism
PAIR: stochastic | bayesian | INTERSECTION | Both model grade proposals as noisy observations of latent difficulty
PAIR: nonequil | dynamo | BRIDGE | Connect thermodynamic free energy with dynamical attractor landscape`,

  synthNew: `[DEEP+TRACTABLE] Grade consensus formation as Markov process
SUMMARY: methods=Markov chain analysis; phenomenon=grade consensus drift
NEW DIRECTION

[DEEP+BLOCKED] Thermodynamic irreversibility of grade anchoring
SUMMARY: methods=stochastic thermodynamics; phenomenon=information loss under herding
NEW DIRECTION

CONVERGENCES: Both agents independently identify consensus formation as the primary mechanism driving grade dynamics. Social herding effects are prominent in both frameworks.

TENSIONS: Stochastic vs thermodynamic: the stochastic model treats noise as the fundamental driver while the thermodynamic model treats information loss as primary.

MOST TRACTABLE FIRST STEP: Analyze Mountain Project grade proposal sequences for Markov chain transition probabilities.

BLIND SPOTS: Individual climber cognitive biases (anchoring magnitude) are not independently modeled.

CONTRADICTIONS
Stochastic process modeler vs Non-equilibrium physics: grade drift is noise-dominated | grade drift reflects irreversible information compression | Resolution needed: longitudinal empirical comparison`,

  synthSameAs: `[DEEP+TRACTABLE] Markov chain grade dynamics
SUMMARY: methods=Markov chain analysis; phenomenon=grade consensus
SAME AS: R1-0`,

  synthExtendsUnresolved: `[DEEP+TRACTABLE] Grade consensus via Markov chains
SUMMARY: methods=Markov chain analysis; phenomenon=grade drift
NEW DIRECTION

[DEEP+TRACTABLE] Noisy Markov chains with anchoring bias
SUMMARY: methods=Markov chain with bias term; phenomenon=anchored grade consensus
EXTENDS: R1-0`,
};

// ── Route interceptor ────────────────────────────────────────────────────────

/**
 * Set up a single Anthropic route interceptor for all tests.
 * fixtureMap: { generation, compression, synthesis, attribution, meta, debate, reflection, genext, default }
 * Each value is either a string (SSE body) or a function(body) => string.
 * routeState.failSynthesis = true will return 500 for synthesis calls.
 */
export async function setupAnthropicMock(page, fixtureMap = {}, routeState = {}) {
  const defaults = {
    generation:   sseWrap(FIXTURES.generation),
    debate:       sseWrap(FIXTURES.debate),
    reflection:   sseWrap(FIXTURES.reflection),
    genext:       sseWrap(FIXTURES.genext),
    compression:  sseWrap(FIXTURES.compression),
    attribution:  sseWrap(FIXTURES.attribution),
    meta:         sseWrap(FIXTURES.meta),
    synthNew:     sseWrap(FIXTURES.synthNew),
    synthSameAs:  sseWrap(FIXTURES.synthSameAs),
    default:      sseWrap('ok'),
  };
  const map = { ...defaults, ...fixtureMap };

  await page.route('**/api.anthropic.com/**', async route => {
    const body = route.request().postDataJSON();
    const role = inferRole(body);

    if (role === 'synthesis' && routeState.failSynthesis) {
      await route.fulfill({ status: 500, contentType: 'text/plain', body: 'Internal Server Error' });
      return;
    }

    const synthKey = fixtureMap.synthesis ? 'synthesis' : 'synthNew';
    const fixture =
      role === 'generation'   ? map.generation  :
      role === 'debate'       ? map.debate      :
      role === 'reflection'   ? map.reflection  :
      role === 'genext'       ? map.genext      :
      role === 'compression'  ? map.compression :
      role === 'synthesis'    ? (map[synthKey] || map.synthNew) :
      role === 'attribution'  ? map.attribution :
      role === 'meta'         ? map.meta        :
      map.default;

    await route.fulfill({
      status: 200,
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache',
      },
      body: typeof fixture === 'function' ? fixture(body) : fixture,
    });
  });
}

/** Switch the app to Anthropic provider and set a fake API key. */
export async function switchToAnthropic(page) {
  await page.click('[data-provider="anthropic"]');
  await page.fill('#api-key-anthropic', 'sk-ant-test123456789');
}

/** Wait until the run button is re-enabled (flow complete). */
export async function waitForRunComplete(page, timeout = 20000) {
  await page.waitForSelector('#run-btn:not([disabled])', { timeout });
}

/**
 * Inject minimal genBlocks state for 2 agents (stochastic, nonequil).
 * Sets S.currentRound = 1 and populates S.genBlocks.
 */
export async function injectGenState(page) {
  await page.evaluate(() => {
    window.__rs.S.currentRound = 1;
    window.__rs.S.genBlocks['stochastic'] = {
      initial: { round: 1, text: 'Markov chain grade dynamics: transition matrices and convergence.' },
      extensions: [],
    };
    window.__rs.S.genBlocks['nonequil'] = {
      initial: { round: 1, text: 'Non-equilibrium physics: stochastic thermodynamics of grade anchoring.' },
      extensions: [],
    };
    window.__rs.S.agentStatuses['stochastic'] = 'active';
    window.__rs.S.agentStatuses['nonequil']   = 'active';
  });
}
