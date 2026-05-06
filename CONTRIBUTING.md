# Contributing to Research Swarm

Thanks for your interest. This document covers the architecture, known weak points, and how to contribute effectively.

---

## Running the project

Open `index.html` in a browser. No build step, no server, no dependencies beyond Google Fonts. You need an API key — either Anthropic or Google Gemini (free tier). See the README for how to get one and for information on free API credit programmes.

---

## Architecture in one page

**Single file by design.** Everything lives in `index.html`. This is a deliberate constraint: the tool is meant to be trivially shareable and deployable from a filesystem or GitHub Pages without any infrastructure. If you feel the urge to split it into modules, that's a signal the feature is probably too complex for this tool's scope, not that the constraint should be relaxed.

This constraint is worth revisiting as the codebase grows. The current size (~1,957 lines) is manageable, but the multi-provider API work (issue #6) may push complexity to the point where a modular source tree becomes the right call. The user-facing single-file experience can be preserved even with a multi-file source tree by introducing a lightweight build step (e.g. `esbuild` or a simple concatenation script) that bundles everything into a single `index.html` for distribution. This would be an acceptable evolution if the alternative is provider logic becoming genuinely hard to navigate in a single file. The decision should be revisited explicitly after the issue #6 merge. Until then, the single-file constraint holds.

**The brief is the primary lever.** The application is domain-agnostic. Adapting it to a new research problem means editing the brief — problem context, research context, available data — not touching the code. The agent mandates are secondary. The generation, debate, synthesis, and meta-agent machinery is fully domain-agnostic and should stay that way.

**Caching is structured around one invariant (Anthropic path only).** The combined brief (all three fields) is sent as a single cached block with every generation and debate call. The agent mandate follows as a separate uncached block. This means: editing the brief invalidates the cache for all agents simultaneously; editing one mandate does not affect others. Any change to how prompts are assembled needs to preserve this invariant or explicitly justify breaking it. Prompt caching is Anthropic-specific — do not attempt to port it to other providers.

**Model routing by call type.** Different calls use different models — see the `MODELS` constant and `modelFor()` in the source. `MODELS` is two-dimensional: `MODELS[role][provider]`. `modelFor(role)` resolves the correct string for the active provider and respects the Sonnet/Opus toggle (Anthropic only). The principle: use the cheapest model that produces adequate quality for the task. Generation and debate use the strong model (Sonnet / Gemini 2.5 Flash). Synthesis and meta-agent are configurable on Anthropic (Sonnet default, Opus available); on Gemini the toggle is greyed out. Compression and mandate generation use the cheapest available model — simple tasks where reasoning depth is not needed.

**Provider abstraction.** The tool supports multiple API providers via a clean provider abstraction layer. Gemini is the default (free within Google AI Studio quota); Anthropic remains fully available. All provider-specific logic — endpoint, auth, request format, streaming format, caching — is isolated in the `AnthropicProvider` and `GeminiProvider` objects. The unified `apiStream()` function dispatches to the active provider. Adding a third provider means: implement a provider object, add a column to `MODELS`, add `PRICING` entries, add a UI radio option. No changes elsewhere. Prompt caching is Anthropic-specific — do not port it. On Gemini, `callParallel()` runs calls sequentially with a 1,500 ms delay to respect free-tier RPM limits; on Anthropic it uses `Promise.all`.

**State lives in memory.** There is no localStorage, no server, no database. Session state is exported as JSON after every synthesis and can be re-imported. This is deliberate — explicit export/import is more transparent and reliable than implicit browser storage, and avoids false durability expectations. Do not add localStorage without a strong reason and an explicit user control to clear it.

The API key field uses a proper HTML `<form>` with `autocomplete="current-password"` so that browser password managers (Firefox, 1Password, Bitwarden etc.) can offer to save and autofill it securely. The key is never stored in JavaScript — the browser's encrypted credential vault handles this entirely. Do not replace this with localStorage.

---

## Known weak points — good places to contribute

**Overlap matrix.** The pairwise overlap score is currently computed as Jaccard similarity on words longer than 5 characters in the two mandates. This is a crude proxy. It treats mandate text as a bag of words, ignores semantic similarity, and doesn't update based on what agents actually argued about in previous rounds. A better approach might use embedding similarity, observed debate output divergence, or a small LLM call to assess conceptual overlap. Improvement is defensible on theoretical grounds without a formal evaluation framework. See issue #1.

**Synthesis compression.** After the debate round, generation outputs are compressed to ~80 words each before being passed to the synthesis agent. This reduces cost but may lose important nuance. A tractable first step is adding a user-facing toggle to disable compression entirely and compare synthesis outputs directly. See issue #2.

**Depth as word count.** The depth selector controls word count and reasoning style instruction, but doesn't vary the structural prompt or the number of directions requested. A more principled depth system might vary the temperature, the number of required directions, or the specific analytical tasks agents are asked to perform. No GitHub issue yet — open one before working on this.

**No evaluation framework.** The tool has not been systematically evaluated on any research domain. LLM-as-judge is unreliable for this task; behavioural metrics are ambiguous. Most tractable near-term approaches: structured user feedback from active researchers, and domain-expert spot-checking on a fixed reference case with a single-agent baseline comparison. See issue #3.

**Session state is not fully restored on import.** When importing a previous session, the streaming outputs from past rounds are not re-rendered (they are preserved in the exported JSON but the UI cards are not rebuilt). The session log repopulates and the accumulated research intelligence is intact, but the Generation and Debate tabs are empty. See issue #4.

**Debate pairings not updated between rounds.** Confirmed bug where meta-agent proposals are not applied at debate launch in some rounds, causing identical pairings to repeat. Intermittent — suspected interaction with mid-session agent addition. See issue #7.

**Free/low-cost version.** ✓ Resolved in v4.4.0. Google Gemini 2.5 Flash is now the default provider (free within Google AI Studio daily quota). Anthropic remains fully available. See issue #6 and CHANGELOG.

---

## What good contributions look like

- A focused change with a clear rationale. The commit message should explain *why*, not just *what*.
- Changes that preserve the single-file constraint and the brief-as-lever principle.
- If you're changing prompt structure, explain how the change interacts with caching.
- If you're adding a new agent call type, add it to the `MODELS` constant (one entry per provider) with a reasoning note.
- If you're adding UI, keep it consistent with the existing sidebar/tab/panel structure.

## What to avoid

- Splitting into multiple files without a strong architectural reason.
- Adding server-side components.
- Adding dependencies (npm packages, CDN scripts beyond Google Fonts).
- Storing API keys anywhere other than the in-memory input field.
- Prompt changes that break the cached brief block invariant silently.
- Provider-specific logic (caching, auth, request format) outside the provider abstraction layer.

---

## Suggesting changes

Open an issue before writing code for anything non-trivial. The design space here is genuinely open and a brief discussion first avoids wasted effort. For bug fixes and small improvements, a pull request with a clear description is sufficient.
