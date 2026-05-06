# Changelog

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
