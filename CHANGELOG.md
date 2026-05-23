# Changelog

## v4.5.0

### Bug fixes and provider/display refactor

#### Navigation and tab locking

- Tabs are now locked (pointer-events:none, dimmed) during all running states — generation, debate, and synthesis — and unlock only after the full chain (including meta-agent) completes
- The "launch debate round →" button was permanently disabled after synthesis completed. Root cause: `renderPairingsPanel()` was called from inside `runSynthesis()` while `S.running` was still true (it only clears in `runDebate`/`runGen` after `runSynthesis` returns). Fixed by re-rendering the pairings panel at the end of `runGen`/`runDebate` after `S.running=false`
- Launch button is now visually disabled (`.launch-btn:disabled`) whenever `S.running` is true at render time

#### Synthesis display — blank panel and silent error

- The synthesis card (`syn-body`) was appended to the panel *after* `compressGenerationOutputs()` completed. A compression API error (e.g. 429 exhaustion) caused `runSynthesis()` to catch and return early — leaving panel-syn blank with a ghost "running" header and tabs unlocking with no explanation
- Fixed by moving the synthesis card creation and `panel.appendChild(sc)` to before any async work, so `syn-body` is always in the DOM and has somewhere to display errors
- All async work in `runSynthesis()` is now wrapped in a single try/catch; errors are written into `syn-body` and the badge flips to a new `.b-err` (red) state rather than failing silently
- Fixed `saveRound()` call in `runSynthesis()` which was always passing `undefined` for the `includeDebate` argument, causing `debateOutputs: {}` to be saved on all post-debate records. Now correctly passes `saveRound(includeDebate)`

#### Roster agent panel

- "Apply correction" was silently failing for some agents. Root cause: `autoApplyMandate()` was called via inline `onclick` with `encodeURIComponent(issue)` and `encodeURIComponent(suggestion)` strings embedded in HTML attributes. LLM-generated suggestion text containing parentheses, equals signs, or other characters that survive URL-encoding but confuse the HTML attribute parser caused the onclick to fail without error for those specific agents
- Fixed by introducing a module-level `pendingMandateUpdates = new Map()` keyed by integer index. The onclick now passes only a safe integer (`autoApplyMandate(0, this)`), completely bypassing the encoding issue
- "Edit manually" opened the agent editor behind the roster modal. Fixed by setting `#agent-modal { z-index: 200 }` (roster modal is z-index 100). Added `editMandateManually(idx)` which registers a `_onAgentSaveCallback` before opening the editor; after `saveAgent()` fires, the callback updates the roster card's mandate preview in place so the change is visible without closing the roster
- Mandate preview text in the roster card now updates immediately after "apply correction" succeeds (was showing stale text despite the mandate being correctly updated in memory)
- Success status element (`mandate-apply-status`) is now shown after apply completes — `display:none` was never cleared in the success branch

#### Provider display

- Gemini radio button label: "Gemini free tier" → "Gemini"
- Synthesis model section (Sonnet/Opus toggle) is now hidden entirely when Gemini is selected — was previously disabled but still visible, implying it might do something. Section appears only when Anthropic is selected
- `setProvider()` called on init so the correct UI state applies on first load (synthesis model section correctly hidden for the Gemini default)
- Updated Gemini key hint text and initial status message to remove "free" references; updated to reflect pay-as-you-go billing as the recommended setup

#### Provider/caching refactor — Gemini parallelisation

- `agentSystemBlocks()` and `briefOnlyBlock()` now only attach `cache_control: {type:'ephemeral'}` when `S.provider === 'anthropic'`. Previously the field was always present and relied on `GeminiProvider` silently stripping it during message conversion — an implicit coupling. Now explicitly provider-gated at the source
- `callParallel()` refactored: Anthropic is the special case (runs `fns[0]` alone to write the cache, then `Promise.all` for the rest); Gemini and all future providers get plain `Promise.all` — true parallel execution with no inter-call delays
- Removed `GEMINI_INTER_CALL_DELAY_MS`, `GEMINI_POST_BATCH_DELAY_MS`, and `geminiDelay()` entirely. Billing-enabled Gemini accounts have 1,000 RPM; the delays were only necessary for the 10 RPM free tier
- `runGen` and `runDebate` call sites simplified to `callParallel(allAgents.map(...))` — no primer extraction, no `slice(1)`, identical code for both providers. Provider-specific execution strategy is fully encapsulated in `callParallel()`
- Removed all provider-branching status messages ("writing cache / sequentially / pausing for rate limit")
- Removed dead `rpd-warn` HTML element and associated `renderCost()` logic (free-tier RPD warning, never triggered on billing-enabled accounts)
- Updated stale comments in `apiStream`, `GeminiProvider`, and `runGen` that described the old sequential/stripping/primer-in-place approach

Verified against session exports across multiple rounds including mid-session agent addition and promotion flows, on both Gemini and Anthropic providers.

---

## v4.4.4

### Flash Lite for cheap tasks; corrected Gemini billing documentation; cost display

#### Gemini model routing

- `compression` and `mandate` roles now use `gemini-2.5-flash-lite` on the Gemini path, matching the Anthropic pattern of using the cheaper model (Haiku) for simple summarisation and constrained rewriting tasks
- Flash Lite pricing added to `PRICING` constant: $0.10/$0.40 per million tokens (vs Flash at $0.30/$2.50)
- Estimated saving: ~10–15% per session; largest sessions save ~$0.05. Modest but correct in principle
- Model label in per-call log now distinguishes `fls` (Flash 2.5) from `flt` (Flash Lite)

#### Cost display

- Dollar cost display restored on Gemini path — charges are real on the paid tier and should be visible
- "Session usage" / "API calls" display reverted to standard "Session cost" / "$X.XXXX"
- Per-call log now always shows dollar cost regardless of provider
- Cache savings row shows "n/a (no caching)" on Gemini; RPD warning removed (not relevant for billing-enabled accounts)

#### README corrections

- Removed incorrect claim that "most users will pay nothing" and implied free monthly credit on pay-as-you-go tier — there is no free monthly credit; billing is pay-as-you-go from the first token
- Added actual session cost estimates by roster size and depth
- Billing setup section rewritten to accurately describe the trade-off
- Top-level callout corrected
- Pricing table updated with Flash Lite row
- Model routing table updated to show Flash Lite for compression and mandate on Gemini

---

## v4.4.3

### Bug fixes — duplicate pair proposals and stale proposal persistence

Two bugs identified from a 10-round session export.

#### Bug 1 — Duplicate pair proposals within the same round

The meta-agent occasionally proposes the same directed pair (A→B) multiple times with different debate types (e.g. CONTRADICTION and BRIDGE). `parseMeta()` inserted every matched `PAIR:` line without deduplication, so both appeared in `S.pairingProposals`. This caused the same pair to run as multiple separate debate calls in a single round, and inflated the pair count shown to the user. Visible in the session data as e.g. `bayesian_network` appearing 4 times in R6's proposals.

Fix: `parseMeta()` now deduplicates by `(id1, id2)` key, keeping the first occurrence of each directed pair. Different debate types for the same pair are silently dropped after the first.

#### Bug 2 — Stale pairing and retirement proposals persisting when all agents are retired

When `runMeta()` exits early because fewer than two active agents remain (the `active.length < 2` guard), it previously returned without updating `S.pairingProposals` or `S.retirementProposals`. The previous round's proposals were left in place with their full state, including `accepted: true` on retirement entries. This caused two symptoms:

1. **Debate re-ran retired-agent pairs.** `runDebate()` reads directly from `S.pairingProposals` — with stale proposals still present, it ran the same debate again between already-retired agents.
2. **Retirement proposals reappeared.** `saveRound()` captures `S.retirementProposals` at save time — the stale accepted proposals were captured each round, making it appear the user needed to re-accept them.

This is the same root mechanism as the loop fixed in v4.4.2, but triggered by the early-exit path in `runMeta` rather than by retired agents remaining in `S.currentGen`.

Fix: when `runMeta` exits early due to insufficient active agents, both `S.pairingProposals` and `S.retirementProposals` are now cleared and `renderPairingsPanel()` is called to reflect the empty state in the UI.

---

## v4.4.2

### Bug fixes — retired agent ghost outputs and pairing loop

Two related bugs identified from a 20-round session export.

#### Bug 1 — Pairing loop: meta-agent reproposing identical pairs indefinitely

From round 17 onward in the test session, the meta-agent produced word-for-word identical pairing and retirement proposals every round. Root cause: when the user accepts a retirement proposal, `S.agentStatuses[id]` is set to `'retired'`, but the agent's generation output remains in `S.currentGen`. Both `compressGenerationOutputs()` and the post-generation synthesis path iterate over `S.currentGen` without filtering by status — so retired agents' outputs continued feeding synthesis and the meta-agent prompt every round. The meta-agent correctly identified the agents as problematic and re-proposed their retirement, but accepting it again had no effect since the output was still present.

Fixes:
- `acceptRec()`: when a retirement proposal is accepted, `delete S.currentGen[rec.id]` removes the retired agent's output immediately. This is the root fix — the agent is now cleanly absent from all subsequent synthesis and meta-agent inputs
- `compressGenerationOutputs()`: added `.filter(([id])=>S.agentStatuses[id]!=='retired')` as a second-line defence
- `runSynthesis()` post-generation path: same filter applied to the `Object.entries(S.currentGen)` iteration

#### Bug 2 — Retired agents feeding synthesis and meta-agent

Same root cause as above. Agents retired in round N were visible to the synthesis agent and meta-agent in all subsequent rounds, producing synthesis sections attributing output to retired agents and causing the meta-agent to reason about agents it believed it had already removed.

#### Session data observations (not bugs, but noted)

- All generation outputs were identical across all 20 rounds. This is the intended behaviour of "smart generation" (outputs are only regenerated for newly added agents), but makes the limitation of issue #5 (reflection rounds) more apparent at scale. The meta-agent was reasoning about static R1 outputs for 20 rounds
- `nonequil` was retired after R1 but remained in generation outputs every round — now fixed by the filter above
- The three mid-session agents (Geospatial, Linguistics, Psychometrics) each produced the same output every round from their addition onward — again by design, but underscores issue #5

---

## v4.4.1

### Gemini free-tier fixes — rate limiting, output truncation, cost display

Four bugs identified from first real-world test run on the Gemini free tier.

#### Bug 1 — Output truncation (mid-sentence cutoff)

Gemini 2.5 Flash has "thinking" enabled by default. Thinking tokens are consumed from the same `maxOutputTokens` budget as output text — with our `maxOutputTokens=1200` for generation, thinking was using 500–800 tokens, leaving only 400–700 tokens for actual output. This caused agents to cut off mid-sentence.

Fix: `thinkingConfig:{thinkingBudget:0}` added to all Gemini `generationConfig` requests. This disables thinking entirely. For structured research proposals, thinking adds latency and token cost but no quality benefit relative to the budget constraint.

#### Bug 2 — Rate limit (429) errors and RPD exhaustion

The free tier allows 10 RPM and (on restricted accounts) only 20 RPD. A 10-agent generation round makes ~13 API calls (10 generation + 1 compression + 1 synthesis + 1 meta). The original 1500ms inter-call delay was insufficient: 10 agents at 1500ms delay can complete in under 60 seconds, then the three post-generation calls fire immediately, creating a burst that exceeds 10 RPM. Three subsequent runs then exhausted the 20 RPD entirely.

Fixes:
- **Inter-call delay increased**: `GEMINI_INTER_CALL_DELAY_MS` raised from 1,500ms to 6,000ms (6s between each agent call → safe ~10 RPM)
- **Post-batch delay added**: new `geminiDelay()` helper inserts a 6s pause (`GEMINI_POST_BATCH_DELAY_MS`) before compression, synthesis, and meta calls, which previously fired with no delay immediately after the last agent
- **429 retry with backoff**: Gemini provider now retries on 429 up to 3 times with 15s / 30s waits, with status bar updates. If quota is fully exhausted (RPD), the error message now explicitly says so and suggests waiting until midnight Pacific Time or switching to Anthropic
- **RPD warning**: cost panel now shows a warning when ≥15 API calls have been made in the session, alerting the user that the 20 RPD limit is approaching

#### Bug 3 — Cost display showing dollar amounts on Gemini

The cost tracker was displaying a small dollar amount on the Gemini path (Gemini pricing × token counts). This is technically correct but misleading — what matters on the free tier is request count (RPD), not dollar cost.

Fixes:
- Cost panel title changes to "Session usage" on Gemini; total display shows "N calls" rather than "$0.00xx"
- "Saved via caching" row shows "n/a" on Gemini (no caching on this path)
- Cache hit rate shows "n/a (no caching)"
- Model label in per-call log now shows "gem" for Gemini calls (was "snt" — same fallback as Sonnet)
- Dollar amounts still accumulated internally for accurate cost reporting if provider is switched mid-session

#### Session timing impact

With 6s inter-call delays, a 10-agent generation round now takes approximately 90–120s (depending on model response time). This is slower than before but reliably stays within the free-tier rate limit. A full round (generation + debate + synthesis + meta) at 10 agents takes roughly 4–6 minutes on the Gemini free path.

**Note**: the RPD limit (20 requests/day on restricted accounts) remains the binding constraint for multi-round sessions at 10 agents. Each full round (gen + debate + synth + meta) uses ~26 API calls. Users planning extended sessions should either use the Anthropic path or enable billing on their Google AI Studio account (which raises RPD substantially).

---

## v4.4.0

### Multi-provider API support — Gemini 2.5 Flash (issue #6)

The application now supports two API providers selectable from the sidebar. Google Gemini is the default, allowing zero-cost use within Google AI Studio's free-tier daily quota.

#### Provider abstraction layer

- **`PROVIDERS` registry**: declarative provider metadata (`gemini`, `anthropic`) used by both the UI and the JS logic
- **`MODELS` constant restructured**: now two-dimensional — `MODELS[role][provider]` — resolving to the correct model string for each role/provider combination
- **`modelFor(role)`**: replaces `resolveModel(role)`. Provider-aware resolver; the Sonnet/Opus synthesis toggle now only applies on the Anthropic path and is silently ignored on Gemini
- **`AnthropicProvider`**: existing streaming logic extracted verbatim; prompt caching (`cache_control` blocks) fully preserved on this path
- **`GeminiProvider`**: new implementation — converts Anthropic-style `messages` + `system` to Gemini `contents` + `system_instruction` format; separate SSE stream parser for Gemini's `candidates[0].content.parts[0].text` chunk shape; accumulates `usageMetadata` from final chunk; no caching (Gemini caching has different mechanics — not ported in this version)
- **`apiStream(args)`**: now a thin dispatcher to the active provider. Signature unchanged — all callsites unaffected
- **`callParallel(fns)`**: new helper wrapping agent parallelism. On Anthropic: `Promise.all` (exploits warm cache). On Gemini: sequential with 1,500 ms inter-call delay (respects free-tier 10 RPM limit for 2.5 Flash). Used in `runGen()` and `runDebate()`
- **`PRICING`**: Gemini 2.5 Flash entry added (`$0.30/$2.50` per million in/out). Cost display shows "free tier" sublabel when Gemini is active

#### State changes

- `S.provider`: `'anthropic' | 'gemini'` — persisted in export JSON
- `S.apiKeys`: `{anthropic: string, gemini: string}` — **never exported**; populated live from sidebar inputs

#### Sidebar UI

- Provider selector replaces the single Anthropic key field: radio buttons (Gemini default, Anthropic option)
- Per-provider key fields shown/hidden on selection
- Synthesis model (Sonnet/Opus) toggle greys out with "Anthropic only" label when Gemini is selected
- Cost sublabel reads "this session (free tier)" on Gemini path

#### Model strings

- Gemini: `gemini-2.5-flash` (stable alias — no snapshot suffix, unlike Haiku)
- Anthropic: unchanged

#### Design principles preserved

- Single file — no new dependencies
- Prompt caching logic remains entirely within `AnthropicProvider`; Gemini path never touches it
- Cheap-model-for-cheap-tasks: on Gemini, all roles use `gemini-2.5-flash` (no Lite/Flash distinction needed for this use case)
- Adding a third provider: implement a provider object, add a column to `MODELS`, add `PRICING` entries, add a radio option — no changes elsewhere

---

## v4.3.1

### Documentation and minor bug fixes

- **`index.html`**: Fixed stale model string in `priceFor()` fallback — the key `'claude-sonnet-4-20250514'` no longer existed in the `PRICING` object, so the fallback would silently return `undefined` for any unrecognised model. Corrected to `'claude-sonnet-4-6'`.
- **`README.md`**: Updated two stale `claude-sonnet-4-20250514` model string references (Getting started requirements; AI disclosure section) to `claude-sonnet-4-6`.
- **`README.md`**: Corrected Haiku 4.5 pricing in the model pricing table: input $0.80 → $1.00, output $4.00 → $5.00, cache write $1.00 → $1.25, cache read $0.08 → $0.10 per million tokens.
- **`README.md`**: Updated model labels in pricing table from "Sonnet 4" / "Opus 4" to "Sonnet 4.6" / "Opus 4.6".
- **`README.md`**: Corrected Haiku cost ratio claim from "~4× cheaper than Sonnet" to "~3× cheaper" (Haiku input is $1/MTok vs Sonnet's $3/MTok).
- **`README.md`**: Removed localStorage from Contributing suggestions and replaced with a note clarifying it is explicitly out of scope per the design principles in CONTRIBUTING.md.

---

## v4.3.0

### Tighter synthesis output (~60% token reduction)
- Synthesis prompt now has explicit per-section word limits: CONVERGENCES 60w, TENSIONS 80w, MOST TRACTABLE FIRST STEP 50w, BLIND SPOTS 40w, RESEARCH DIRECTIONS as short titles only (no explanation), CONTRADICTIONS with each field capped at 15 words
- `synthesis max_tokens`: 4,000 → 1,200 (matches constrained prompt; previous limit was set to avoid truncation before the prompt was tightened)
- `meta max_tokens`: 2,000 → 1,500
- `mandate max_tokens`: 800 → 600
- Expected synthesis output reduction: ~2,900 tokens → ~600–800 tokens per call

### Smart generation — do not re-run agents with existing outputs
- `runGen()` now checks which agents already have generation outputs
- First round: runs all selected agents as before
- Subsequent rounds: runs only agents with no existing output (i.e. newly added agents)
- Existing `currentGen` outputs are preserved between rounds, not overwritten
- If all agents already have outputs, redirects user to the debate tab
- Round header and status bar distinguish new-agent runs from full generation rounds
- This makes the intended workflow (generate once, debate multiple times) the default behaviour rather than requiring a separate UI mode

### Auto-apply mandate corrections from roster agent
- Roster agent "Mandate drift corrections" section now has two buttons per correction:
  - **✦ apply correction**: calls Haiku to rewrite the mandate incorporating the correction, preserving the agent's disciplinary identity and keeping it ~120–150 words. Status message shows word count and prompts review.
  - **edit manually**: opens the agent editor as before
- Uses Haiku at `mandate` role (600 token limit) — appropriate for constrained rewriting

### Documentation
- `HANDOVER.md` added: comprehensive technical handover for future developers covering architecture, caching details, model routing, state object, parsing quirks, cost structure, design principles, open issues, and recommended next steps
- `reflection-round-issue.md` added: GitHub issue template for the reflection round feature — post at github.com/DBoocock/research-swarm/issues/new and then delete from the repository (content belongs in the issue tracker, not the codebase)

---

## v4.2.1

### Bug fixes (identified from session JSON analysis)
- **Round numbering**: all rounds were saved as `round: 1`. `saveRound()` used `S.currentRound` which stays at 1 because `runSynthesis()` is called after both generation and debate without incrementing the counter. Fixed: use `S.rounds.length + 1` as the sequence number — each saved record now gets a unique incrementing label.
- **Contradictions not parsed**: synthesis model outputs bold markdown format `**AGENT vs. AGENT:**` but the regex expected plain `AGENT vs AGENT:`. Updated regex handles optional bold asterisks, optional period after "vs", and case-insensitive matching. Verified against 3-round session: correctly extracts all 9 contradictions.
- **Research map titles prefixed with `** `**: model outputs `[DEEP+TRACTABLE] ** Title` — the title stripping regex only removed digits and bullets, not asterisks. Fixed strip pattern in both research map and matrix title extraction.

---

## v4.2.0 — Prompt caching confirmed working

### Caching fix — root cause and resolution
Prompt caching was silently failing across all previous versions, returning `cache_creation_input_tokens: 0` on every call with no error. The root cause: **Claude Sonnet 4.6 requires a minimum of 2,048 tokens in the cached prefix** — not 1,024 as documented for older models. The combined brief was ~1,956 tokens, just below the threshold. The API silently skips caching when the minimum is not met, which made the failure invisible.

Two additional issues were also present and corrected:
- The `anthropic-beta: prompt-caching-2024-07-31` header (from the original 2024 public beta) was included unnecessarily. Prompt caching is now Generally Available and requires no beta header — the old header was silently ignored.
- All generation agents were firing in parallel, so no call could read a cache entry written by another call in the same batch. Fixed with a primer-then-parallel pattern: agent[0] runs first to write the cache, then agents[1–N] run in parallel hitting the warm cache.

### Brief expansion
The default research context (`DEF_RES`) was expanded with additional substantive content to push the combined brief to ~2,300 tokens (251-token margin above the 2,048 minimum). Added: grade gap proportionality across ability levels, additional benchmark route decompositions (Biographie 9a+, Mange Ta Soupe 8c), rest quality system detail, boulder/route asymmetry framing, historical drift and within-region temporal inconsistency, five explicit open research questions. This content improves agent output quality independently of the caching fix.

### Verified cache performance
Confirmed in production on Sonnet 4.6:
- Primer call: `cache_creation_input_tokens: 2249` — brief written to cache
- Subsequent calls: `cache_read_input_tokens: 2249` — cache hit, 10× cheaper per token
- Full-price `input_tokens` per call dropped from ~2,249 to ~221 (mandate + user message only)
- Estimated saving on 10-agent generation round: ~79% reduction on brief input tokens

### Other fixes in this release
- Synthesis `max_tokens` raised from 1,200 to 4,000 — was truncating mid-response with 10 agents at detailed depth
- Roster agent raised to 3,000; meta-agent raised to 2,000
- Compression and mandate generation reduced to 600 and 800 respectively (simpler tasks)
- Export filenames now include brief title prefix and round number for easier file management
- Clipboard copy buttons added alongside download buttons (⎘ md, ⎘ json)
- Import session button added — restores full session state from a previously exported JSON
- Auto-export now produces both JSON and Markdown after every synthesis
- Correct model strings: `claude-sonnet-4-20250514` → `claude-sonnet-4-6`; `claude-opus-4-20250514` → `claude-opus-4-6`
- Browser password manager support for API key (HTML form with `autocomplete="current-password"`)

---

## v4.1.0

### Model selection
- **Sonnet/Opus toggle** in sidebar for synthesis, meta-agent, and roster agent calls. Opus applies where reasoning quality most affects session value; generation and debate remain on Sonnet regardless
- **Haiku for compression and mandate generation** — generation output compression and mandate drafting switched from Sonnet to Haiku (simple tasks, ~4× cheaper, no quality impact)
- **Per-model accurate cost tracking** — cost tracker uses correct pricing per model (Sonnet / Opus / Haiku) rather than assuming Sonnet throughout
- **Model indicator in call log** — each call log entry shows a three-letter model label (snt / ops / hku)

### Depth instructions
- Depth settings now include explicit reasoning style guidance alongside word count: brief prioritises tractability, detailed asks for key unknowns and implications, exhaustive requires sketched equations and anticipation of objections

---

## v4.0.0 — Initial release

### New features
- **Editable brief**: title, subtitle, problem context, research context, and data description all editable via the sidebar header modal
- **Agent CRUD**: create, edit, and delete agents at any time; historical outputs from deleted agents preserved in session log
- **Roster agent**: analyses brief and all mandates to suggest new agents, status changes, mandate drift corrections, and overlap assessments
- **Multiple pairings per agent**: an agent may be assigned multiple debate partners in the same round; debates are batched into a single API call per responding agent
- **Three-level agent status**: active, gen-only (generation only), retired — plus promoted flag
- **Overlap matrix**: pairwise agent overlap estimated from mandate similarity; updated by roster agent; displayed as colour-coded grid
- **Two-stage synthesis compression**: generation outputs compressed to ~80 words each before post-debate synthesis, keeping synthesis input size bounded across rounds
- **Mandate generation**: one-click API call to draft a mandate from the current brief and agent name
- **Cumulative research map and contradiction tracker**: accumulate across all rounds; deduplicated automatically
- **Auto-export JSON**: full session state exported as JSON after every synthesis
- **Markdown export**: human-readable session export via manual button
- **Session log tab**: all round outputs with timestamps accumulate in-session

### Token optimisations
- Debate batching: N partners for one agent → 1 API call instead of N
- Generation compression: single batched compression call before post-debate synthesis
- Cached brief block: all brief fields combined into one cached block (~2,300 tokens for default climbing brief)
- Mandate as separate uncached block: editing one mandate does not invalidate shared cache

---

## v3.0.0

- Five-field brief editor (problem context, research context, data description, title, subtitle)
- Brief editor accessible from tab bar (moved to sidebar header in v4)
- Cumulative research map and contradiction tracker (first version)
- Auto-export JSON after each synthesis
- Two export formats: JSON and Markdown
- Session log tab
- Updated default agent mandates with Darth Grader framework, ability distribution, elite pioneer dynamic, coveted grade thresholds

---

## v2.0.0

- Prompt caching first attempted on shared system context block (note: did not work correctly until v4.2.0 — see v4.2.0 for root cause analysis)
- Live cost tracker in sidebar: input/output/cache-read/cache-write token counts, savings, hit rate bar, per-call log
- Cost annotation on individual result cards (per-call cost + cache indicator)

---

## v1.0.0

- 10-agent parallel generation round
- Structured debate round with configurable pairings (one partner per agent)
- Synthesis arbitration agent
- Meta-agent pairing proposals with CONTRADICTION / INTERSECTION / DISRUPTION / BRIDGE typing
- Retire / promote recommendations
- Research map with four tag states
- Contradiction tracker
- Depth / tractability matrix
- Session export (plain text)
- Agent toggle on/off
- Depth selector (brief / detailed / exhaustive)
