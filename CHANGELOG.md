# Changelog

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
- Cached brief block: all brief fields combined into one cached block (1500–2000 tokens)
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

- Prompt caching implemented on shared system context block
- Live cost tracker in sidebar: input/output/cache-read/cache-write token counts, savings, hit rate bar, per-call log
- Cost annotation on individual result cards (per-call cost + cache indicator)
- `anthropic-beta: prompt-caching-2024-07-31` header on all calls

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
