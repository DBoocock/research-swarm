# Architecture — Multi-Provider Refactor

*Phase 1 deliverable for feat/multi-provider-refactor. Documents the design before any implementation begins.*

---

## Phase 1 Verification Results

### 1. Browser-direct Anthropic calls via @ai-sdk/anthropic

**CONFIRMED — no blocker.**

`createAnthropic({ headers: { 'anthropic-dangerous-direct-browser-access': 'true' } })` works as intended. The `createAnthropic` function's `getHeaders()` closure merges `options.headers` into every API request after the auth headers:

```typescript
// from anthropic-provider.ts (v4.0.3)
const getHeaders = () => {
  return withUserAgentSuffix(
    { 'anthropic-version': '2023-06-01', ...authHeaders, ...options.headers },
    `ai-sdk/anthropic/${VERSION}`,
  );
};
```

The header propagates to every fetch call — no extra configuration required.

### 2. Explicit prompt caching via providerOptions

**CONFIRMED — no blocker.**

`providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } }` on individual message parts correctly sends `cache_control` to the Anthropic API. Verified in `get-cache-control.ts` (v4.0.3):

```typescript
function getCacheControl(providerMetadata) {
  const anthropic = providerMetadata?.anthropic;
  // accepts both cacheControl and cache_control
  const cacheControlValue = anthropic?.cacheControl ?? anthropic?.cache_control;
  return cacheControlValue;
}
```

`convert-to-anthropic-prompt.ts` applies this to system blocks, text parts, file parts, and other content types.

**Multiple system blocks (brief + mandate pattern):** Two consecutive messages with `role: 'system'` are grouped by the SDK into a single Anthropic `system` array with two text blocks. The first carries `cache_control: { type: 'ephemeral' }`, the second does not. This exactly reproduces the existing `agentSystemBlocks(mandate)` behavior without triggering the mid-conversation-system beta.

```javascript
// These two consecutive system messages:
{ role: 'system', content: briefText, providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } } }
{ role: 'system', content: mandateText }

// Produce this Anthropic system array:
[
  { type: 'text', text: briefText, cache_control: { type: 'ephemeral' } },
  { type: 'text', text: mandateText }
]
```

**Issues #7612 and #12712 in vercel/ai** were not publicly accessible, but the SDK source shows explicit caching is fully implemented and unblocked in v4.0.3. Automatic caching and explicit caching are distinct paths; we use explicit.

### 3. Anthropic thinking mode parameter shapes

For `claude-sonnet-4-6`: both `{ type: 'enabled', budgetTokens: 4000 }` and `{ type: 'adaptive' }` work. We will use `enabled` with a 4000-token budget for a fixed, predictable cost.

For `claude-opus-4-6`: only `{ type: 'adaptive' }` is supported (Opus 4.6+ dropped `enabled`). No budget control is available; `adaptive` manages the budget internally.

### 4. DeepSeek thinking disable

The `@ai-sdk/openai` schema does not include a `thinking` field, so `providerOptions.openai.thinking` will be stripped before the request is built. The correct approach is a **custom fetch wrapper** that injects the parameter into the request body:

```javascript
function withThinkingDisabled(fetchFn = fetch) {
  return async (url, init) => {
    if (init?.body) {
      const body = JSON.parse(init.body);
      body.thinking = { type: 'disabled' };
      return fetchFn(url, { ...init, body: JSON.stringify(body) });
    }
    return fetchFn(url, init);
  };
}
```

This is passed as the `fetch` option to `createOpenAI`. The synthesis/meta variant omits the wrapper (thinking stays on by default).

**Pending live verification:** the exact DeepSeek V4 API parameter name (`thinking.type = 'disabled'` vs `enable_thinking: false` or similar) should be confirmed against DeepSeek's OpenAI-compatible API docs when implementing `src/providers/deepseek.js`. If the parameter differs from `thinking: { type: 'disabled' }`, only the wrapper function needs updating.

---

## Directory and File Structure

```
research-swarm/
├── index.html                   # thin shell — <script type="module" src="./src/main.js">
├── package.json
├── vite.config.js
├── .gitignore                   # add node_modules/, dist/ except dist/index.html
│
├── src/
│   ├── main.js                  # init: imports all modules, wires DOM
│   ├── constants.js             # DEPTH_DIRS, DEPTH_WORDS, MAX_TOKENS, HANDOVER_ROLE
│   │                            #   DEFAULT_AGENTS, DEF_SYS, DEF_RES, DEF_DATA, COLOURS
│   ├── state.js                 # S object, costS, genCardEls, _handoverContent/Title
│   ├── models.js                # MODELS table, modelFor(), isThinkingRole(role)
│   │                            #   isThinkingRole: true only for 'synthesis' and 'meta'
│   ├── pricing.js               # priceFor() wrapping src/generated/pricing.js
│   │
│   ├── generated/
│   │   └── pricing.js           # prebuild output — COMMITTED to repo
│   │                            #   so builds never fail if LiteLLM fetch is down
│   │
│   ├── providers/
│   │   ├── index.js             # getProvider(role) → { model, systemMsgs helper }
│   │   ├── anthropic.js         # createAnthropic factory; agentSystemBlocks(), briefOnlyBlock()
│   │   │                        #   thinking config injected via providerOptions per role
│   │   ├── gemini.js            # createGoogleGenerativeAI factory
│   │   │                        #   thinkingConfig: { thinkingBudget: 0 } in model settings
│   │   ├── deepseek.js          # createOpenAI(baseURL: api.deepseek.com/v1)
│   │   │                        #   two instances: noThinking (custom fetch) + thinking
│   │   └── openai.js            # createOpenAI factory for standard OpenAI
│   │
│   ├── api.js                   # streamAI() — unified entry point replacing apiStream()
│   │                            #   callParallel() — unchanged Anthropic primer logic
│   │                            #   addUsage() — usage accounting for all providers
│   │
│   ├── rounds/
│   │   ├── generation.js        # runGen()
│   │   ├── debate.js            # runDebate(), buildPairHistory()
│   │   ├── reflection.js        # runReflectionRound()
│   │   ├── synthesis.js         # runSynthesis(), retrySynthesis(), compressGenerationOutputs()
│   │   ├── attribution.js       # runAttribution()
│   │   ├── meta.js              # runMeta(), parseMeta()
│   │   ├── roster.js            # runRosterAgent(), renderRosterResults(), autoApplyMandate()
│   │   └── handover.js          # runHandover(), buildHandoverContext(), buildHandoverUserMsg()
│   │
│   ├── parse/
│   │   ├── synthesis.js         # parseSynthesis() — frozen, ported unchanged
│   │   └── session.js           # buildExportData(), buildMd(), saveRound()
│   │
│   └── ui/
│       ├── agents.js            # renderAgentList(), toggleAgent(), openAgentModal(), etc.
│       ├── cost.js              # renderCost()
│       ├── tabs.js              # switchTab(), lockTabs(), unlockTabs(), setStatus()
│       ├── helpers.js           # makeRoundHdr(), makeResultCard(), makeDebateCard(),
│       │                        #   makeMatrix(), makeSectionLabel(), makeNotice(), mkBtn()
│       ├── panels/
│       │   ├── generation.js    # rebuildGenerationPanel()
│       │   ├── debate.js        # rebuildDebatePanel()
│       │   ├── synthesis.js     # rebuildSynthesisPanel()
│       │   ├── map.js           # rebuildMap(), appendChildren(), setTag()
│       │   ├── pairings.js      # renderPairingsPanel(), togglePair(), acceptRec()
│       │   ├── matrix.js        # rebuildMatrix(), rebuildContradictions()
│       │   ├── overlap.js       # renderOverlapMatrix(), updateOverlapMatrix()
│       │   └── log.js           # renderLog()
│       └── modals/
│           ├── brief.js         # openBriefModal(), closeBriefModal(), saveBrief()
│           ├── agent.js         # openAgentModal(), openNewAgentModal(), saveAgent(),
│           │                    #   deleteAgent(), generateMandate()
│           ├── roster.js        # openRosterModal(), closeRosterModal()
│           └── handover.js      # openHandoverModal(), updateHandoverModal(), downloadHandover()
│
├── scripts/
│   └── update-pricing.js        # prebuild: fetch LiteLLM JSON, extract, write pricing.js
│
├── tests/
│   ├── fixtures/                # pre-recorded SSE response bodies per provider
│   │   ├── anthropic-stream.txt
│   │   ├── gemini-stream.txt
│   │   └── ...
│   ├── generation.spec.js
│   ├── debate.spec.js
│   ├── synthesis.spec.js
│   ├── regression.spec.js       # SAME AS retraction, extends_unresolved retention
│   ├── session-io.spec.js       # export/import round-trip
│   ├── reflection.spec.js       # genCardEls extension streaming
│   ├── retry.spec.js            # retrySynthesis after 3 exhausted retries
│   └── thinking-mode.spec.js    # no thinking config on non-synthesis/meta roles
│
└── dist/
    └── index.html               # build output — committed; GitHub Pages source
```

---

## Build Tooling

**Choice: Vite with `vite-plugin-singlefile`.**

Rationale: Vite provides fast HMR for development iteration and handles the ES module source tree naturally. `vite-plugin-singlefile` inlines all JS, CSS, and assets into a single `dist/index.html` compatible with GitHub Pages and direct file sharing — the user-facing experience is identical to the current single-file design.

The alternative (esbuild + shell script) is faster to run but requires manual HTML template wiring, asset inlining, and font handling. `vite-plugin-singlefile` handles all of this in ~3 lines of config.

**package.json scripts:**

```json
{
  "scripts": {
    "prebuild": "node scripts/update-pricing.js",
    "build": "vite build",
    "dev": "vite",
    "test": "playwright test"
  }
}
```

**vite.config.js:**

```javascript
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    outDir: 'dist',
    assetsInlineLimit: Infinity,
  },
});
```

The Google Fonts import in `<head>` remains as a CDN link (not inlined) — it is a cross-origin font load and does not affect the page's self-containedness for offline use.

---

## Provider Configuration

### Anthropic

```javascript
// src/providers/anthropic.js
const anthropic = createAnthropic({
  apiKey: () => S.apiKeys.anthropic,  // lazy — read at call time
  headers: { 'anthropic-dangerous-direct-browser-access': 'true' },
});

// System block builders — same contract as current agentSystemBlocks/briefOnlyBlock
function agentSystemMsgs(mandate) {
  return [
    { role: 'system', content: buildCachedBlock(),
      providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } } },
    { role: 'system', content: '\n\nYOUR SPECIALIST MANDATE:\n' + mandate },
  ];
}

function briefSystemMsg() {
  return [
    { role: 'system', content: buildCachedBlock(),
      providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } } },
  ];
}
```

Thinking config is passed per-call via `providerOptions` in `streamAI()` based on `isThinkingRole(role)`:
- Synthesis on Sonnet 4.6: `{ anthropic: { thinking: { type: 'enabled', budgetTokens: 4000 } } }`
- Synthesis on Opus 4.6: `{ anthropic: { thinking: { type: 'adaptive' } } }`
- All other roles: `{ anthropic: { thinking: { type: 'disabled' } } }`

### Gemini

```javascript
// src/providers/gemini.js
const gemini = createGoogleGenerativeAI({
  apiKey: () => S.apiKeys.gemini,
});
// Thinking disabled via model-level setting in getModel():
// gemini('gemini-2.5-flash', { thinkingConfig: { thinkingBudget: 0 } })
```

Gemini auto-caching is not used (see CONTRIBUTING.md §Known weak points). All Gemini calls fire in true parallel — no primer. The `callParallel()` function already handles this distinction.

### DeepSeek V4

```javascript
// src/providers/deepseek.js
function withThinkingDisabled(fetchFn = fetch) {
  return (url, init) => {
    const body = JSON.parse(init?.body ?? '{}');
    body.thinking = { type: 'disabled' };   // ← verify param name against DeepSeek docs
    return fetchFn(url, { ...init, body: JSON.stringify(body) });
  };
}

// Used for all non-thinking roles
const deepseekNoThink = createOpenAI({
  baseURL: 'https://api.deepseek.com/v1',
  apiKey: () => S.apiKeys.deepseek,
  fetch: withThinkingDisabled(),
});

// Used for synthesis/meta roles
const deepseekThink = createOpenAI({
  baseURL: 'https://api.deepseek.com/v1',
  apiKey: () => S.apiKeys.deepseek,
});
```

### OpenAI

```javascript
// src/providers/openai.js
const openai = createOpenAI({
  apiKey: () => S.apiKeys.openai,
});
// o3 (premium toggle) uses standard reasoning_effort; other OpenAI models have no thinking.
```

---

## MODELS Table and Thinking-Mode Rule

```javascript
// src/models.js
const MODELS = {
  //                  anthropic                    gemini                         deepseek              openai
  generation:  { anthropic:'claude-sonnet-4-6',   gemini:'gemini-2.5-flash',      deepseek:'deepseek-v4-flash',  openai:'gpt-4.1'      },
  debate:      { anthropic:'claude-sonnet-4-6',   gemini:'gemini-2.5-flash',      deepseek:'deepseek-v4-flash',  openai:'gpt-4.1'      },
  reflection:  { anthropic:'claude-sonnet-4-6',   gemini:'gemini-2.5-flash',      deepseek:'deepseek-v4-flash',  openai:'gpt-4.1'      },
  genextension:{ anthropic:'claude-sonnet-4-6',   gemini:'gemini-2.5-flash',      deepseek:'deepseek-v4-flash',  openai:'gpt-4.1'      },
  synthesis:   { anthropic:'claude-sonnet-4-6',   gemini:'gemini-2.5-flash',      deepseek:'deepseek-v4-flash',  openai:'gpt-4.1'      },
  meta:        { anthropic:'claude-sonnet-4-6',   gemini:'gemini-2.5-flash',      deepseek:'deepseek-v4-flash',  openai:'gpt-4.1'      },
  roster:      { anthropic:'claude-sonnet-4-6',   gemini:'gemini-2.5-flash',      deepseek:'deepseek-v4-flash',  openai:'gpt-4.1'      },
  handover:    { anthropic:'claude-sonnet-4-6',   gemini:'gemini-2.5-flash',      deepseek:'deepseek-v4-flash',  openai:'gpt-4.1'      },
  attribution: { anthropic:'claude-haiku-4-5-20251001', gemini:'gemini-2.5-flash-lite-preview-06-17', deepseek:'deepseek-v4-flash', openai:'gpt-4.1-mini' },
  compression: { anthropic:'claude-haiku-4-5-20251001', gemini:'gemini-2.5-flash-lite-preview-06-17', deepseek:'deepseek-v4-flash', openai:'gpt-4.1-mini' },
  mandate:     { anthropic:'claude-haiku-4-5-20251001', gemini:'gemini-2.5-flash-lite-preview-06-17', deepseek:'deepseek-v4-flash', openai:'gpt-4.1-mini' },
};

// Thinking-mode rule (METHODOLOGY.md §7.1):
// Thinking is permitted only for calls that (a) do not generate agent-attributed,
// persona-specific content and (b) do not touch agent mandates.
// This includes synthesis and meta; excludes everything else.
function isThinkingRole(role) {
  return role === 'synthesis' || role === 'meta';
}
```

The Opus/premium toggle applies per provider:
- Anthropic: `synthesis`, `meta`, `roster`, `handover` → Opus 4.6 when toggle is on
- Gemini: no toggle (model section hidden in UI for Gemini)
- DeepSeek: `synthesis`, `meta`, `roster`, `handover` → `deepseek-v4-pro` when toggle is on
- OpenAI: `synthesis`, `meta`, `roster`, `handover` → `o3` when toggle is on

---

## streamText / streamAI Mapping

The existing `apiStream()` is replaced by `streamAI()` in `src/api.js`. The interface stays identical to existing call sites:

```javascript
// src/api.js
async function streamAI({ name, role, messages, onChunk, signal, maxTokensOverride }) {
  const { model, providerOptions } = getModelForRole(role);
  const result = streamText({
    model,
    messages,
    maxTokens: maxTokensOverride ?? MAX_TOKENS[role] ?? 1200,
    maxRetries: 3,
    abortSignal: signal,
    providerOptions,
    onChunk: ({ chunk }) => {
      if (chunk.type === 'text-delta') onChunk?.(chunk.textDelta);
    },
  });

  let text = '';
  for await (const chunk of result.textStream) {
    text += chunk;
  }

  const usage = await result.usage;
  addUsage(name, usage, modelFor(role));
  return text;
}
```

`callParallel()` is unchanged in contract: on Anthropic, fns[0] runs alone first (primer), then fns[1..n] in parallel; on all other providers, all functions fire in parallel immediately.

---

## Build-Time Pricing Pipeline

`scripts/update-pricing.js` runs as a `prebuild` step:

1. Fetch `https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json`
2. Extract the 10 model entries listed in the spec
3. Write `src/generated/pricing.js` with only the fields needed: `input_cost_per_token`, `output_cost_per_token`, `cache_creation_input_token_cost`, `cache_read_input_token_cost`, `supports_prompt_caching`
4. Warn loudly (`console.error`) on any missing model; do not throw (build must succeed with stale data)
5. Commit the generated file so `npm run build` works offline

LiteLLM key mapping:
```
claude-sonnet-4-6 → 'claude-sonnet-4-6'
claude-haiku-4-5-20251001 → 'claude-haiku-4-5-20251001'
claude-opus-4-6 → 'claude-opus-4-6'
gemini-2.5-flash → 'gemini/gemini-2.5-flash'
gemini-2.5-flash-lite → 'gemini/gemini-2.5-flash-lite-preview-06-17'
deepseek-v4-flash → 'deepseek/deepseek-v4-flash'
deepseek-v4-pro → 'deepseek/deepseek-v4-pro'
gpt-4.1 → 'gpt-4.1'
gpt-4.1-mini → 'gpt-4.1-mini'
o3 → 'o3'
```

Edge case: `cache_creation_input_token_cost: 0.0` for DeepSeek means **free** cache creation (not missing caching support). The `supports_prompt_caching: true` field is the authoritative signal.

---

## Playwright Test Strategy

Tests run against the built `dist/index.html` (served by `playwright`'s `webServer`). All AI SDK calls are intercepted at the network level using `page.route()` — no real API calls in tests.

**Fixture format:** pre-recorded Vercel AI SDK streaming responses (SSE for Anthropic/OpenAI, SSE for Gemini) stored in `tests/fixtures/`. Each fixture is a complete streaming response body for a specific role (generation, debate, synthesis, etc.).

**Route interception pattern:**
```javascript
// anthropic endpoint
await page.route('**/api.anthropic.com/v1/messages', async route => {
  const body = route.request().postDataJSON();
  const role = inferRole(body);  // e.g. from model + system content
  const fixture = loadFixture(role);
  await route.fulfill({ body: fixture, headers: { 'content-type': 'text/event-stream' } });
});
```

**Test list (maps to Phase 3 spec):**

| File | Tests |
|---|---|
| `generation.spec.js` | Generation round completes; text streams into all agent cards |
| `debate.spec.js` | Debate round completes; pair output appears with correct type on `S.currentDebates[key]` |
| `synthesis.spec.js` | Synthesis produces ≥1 research map entry via the SUMMARY/EXTENDS/SAME AS format |
| `regression.spec.js` | SAME AS retraction merges entry; same-round self-reference yields `extends_unresolved`/`same_as_unresolved` with content preserved |
| `session-io.spec.js` | JSON export round-trips through import including `S.currentRound` and debates `{text,type}` structure |
| `reflection.spec.js` | Reflection-extended directions appear via `genCardEls`, both live and after import reconstruction |
| `retry.spec.js` | Synthesis call exhausting 3 automatic retries surfaces retry button; clicking succeeds without re-running debate or reflection |
| `thinking-mode.spec.js` | No role outside synthesis/meta receives thinking configuration on any provider, including DeepSeek explicit disable |

**Synthesis fixture design:** The regression tests require fixtures that produce specific parser-exercising outputs (a `SAME AS: R1-0` label for the retraction test; a `EXTENDS: R1-0` referencing a same-round entry for the `extends_unresolved` test). These are hand-authored SSE fixtures, not recorded from live API calls.

---

## Notes on retrySynthesis

`retrySynthesis()` and `S._pendingSynthesisArgs` are preserved unchanged. The AI SDK's `maxRetries: 3` replaces the old Gemini-specific 429/503 linear-backoff loop (removed). When all 3 SDK retries are exhausted and `streamText()` still throws, the error propagates to `runSynthesis()`'s catch block, which injects the retry button exactly as before. `retrySynthesis()` calls `runSynthesis(S._pendingSynthesisArgs.includeDebate)` — no changes to this path.

---

## CONTRIBUTING.md and METHODOLOGY.md Targets (Phase 4)

CONTRIBUTING.md "Architecture in one page" section:
- Replace "Single file by design" with the new source structure + Vite build description
- Replace `AnthropicProvider`/`GeminiProvider`/`apiStream()` description with Vercel AI SDK as provider layer
- Remove the blanket "no new dependencies" line
- Keep all other architectural invariants (caching boundary, closed-set validation, prefer-data-over-text, etc.) unchanged
- Add entry to Known weak points for the multi-provider refactor (vX.Y.Z)

METHODOLOGY.md:
- §7.1: Add short paragraph stating the thinking-mode rule and its rationale (agent-attributed content / mandate stability)
- §10.2: Add one line noting the same-round residual (tracked in #21) was deliberately left unaddressed by this refactor
