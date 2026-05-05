# Changelog

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
