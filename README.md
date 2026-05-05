# Research Swarm

A multi-agent AI framework for prototyping theoretical research directions. Specialist agents with distinct disciplinary mandates work in parallel to generate, debate, and synthesise research angles on complex systems — with full control over the research brief, agent roster, debate pairings, and cost.

Originally built to study the dynamics of community rock climb difficulty grading systems, but fully generalisable to any research domain by editing the brief and agent mandates.

---

## Contents

- [How it works](#how-it-works)
- [Getting started](#getting-started)
- [Interface overview](#interface-overview)
- [The research brief](#the-research-brief)
- [Agent management](#agent-management)
- [Running a session](#running-a-session)
- [Debate round](#debate-round)
- [Synthesis and meta-agent](#synthesis-and-meta-agent)
- [Roster agent](#roster-agent)
- [Research map and contradiction tracker](#research-map-and-contradiction-tracker)
- [Overlap matrix](#overlap-matrix)
- [Cost tracking and prompt caching](#cost-tracking-and-prompt-caching)
- [Saving and exporting](#saving-and-exporting)
- [Adapting to a new research domain](#adapting-to-a-new-research-domain)
- [Token optimisation details](#token-optimisation-details)
- [Architecture](#architecture)
- [Default agent roster](#default-agent-roster)
- [AI disclosure](#ai-disclosure)
- [Licence](#licence)

---

## How it works

The swarm operates in two rounds per iteration, followed by automated synthesis and meta-agent analysis.

**Generation round**: All selected agents receive the shared research brief plus their individual specialist mandate. They run in parallel, each independently proposing 2–3 theoretical research directions from their disciplinary perspective.

**Debate round**: The meta-agent assigns debate pairings — agents are assigned one or more partners whose generation output they read and respond to. Multiple pairings per agent are allowed and encouraged. Debates are batched: an agent with three partners makes one API call rather than three, with responses labelled per partner.

**Synthesis**: An arbitration agent reads all generation and debate outputs and produces a structured synthesis: convergences (directions multiple agents agree on), tensions (genuine theoretical disagreements), the single most tractable first empirical step, blind spots, a tagged list of research directions by depth and tractability, and a contradiction log.

**Meta-agent**: After synthesis, a meta-agent proposes debate pairings for the next round (with typed justifications: CONTRADICTION, INTERSECTION, DISRUPTION, or BRIDGE) and recommends agent status changes (active, generation-only, retired, promoted). You review and accept or reject each recommendation before the next round launches.

This cycle repeats. Research directions, contradictions, and matrix entries accumulate across rounds and are preserved in the session log.

---

## Getting started

### Requirements

- A modern web browser (Chrome, Firefox, Safari, Edge)
- An Anthropic API key with access to `claude-sonnet-4-20250514`
- No server, build step, or internet connection beyond the Anthropic API

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/DBoocock/research-swarm.git
   cd research-swarm
   ```

2. Open `index.html` directly in your browser:
   ```bash
   open index.html          # macOS
   xdg-open index.html      # Linux
   start index.html         # Windows
   ```
   Or drag the file into your browser window.

3. Enter your Anthropic API key in the sidebar (the key field at the top, below the swarm title).

That is all that is required. There is no npm install, no server to run, and no environment variables to configure.

### Getting an API key

1. Go to [console.anthropic.com](https://console.anthropic.com) and create an account
2. Navigate to **API Keys** and create a new key
3. Add a payment method and a small credit balance — a full session of multiple rounds costs between $0.10 and $0.50 depending on depth and number of agents
4. Paste the key into the sidebar API key field — it is never stored, transmitted anywhere other than directly to the Anthropic API, or logged

> **Note**: The Anthropic API is billed separately from a Claude.ai Pro subscription. The API key field is required — the tool will not work without it.

---

## Interface overview

The interface is divided into a **sidebar** (always visible) and a **main panel** with tabs.

### Sidebar

| Section | Purpose |
|---|---|
| **Swarm title** (clickable) | Opens the brief editor modal |
| **API key** | Your Anthropic API key |
| **Session cost** | Live cost tracker with cache hit rate |
| **Agents** | Agent list with status, edit, and delete controls |
| **Depth** | Brief / Detailed / Exhaustive output length |
| **Run button** | Launches the generation round |
| **Status bar** | Current operation status |

### Main tabs

| Tab | Contents |
|---|---|
| **Generation** | Agent outputs from the current generation round |
| **Debate** | Debate outputs from the current debate round |
| **Synthesis** | Synthesis arbitration output |
| **Next Round** | Meta-agent pairing proposals and status recommendations |
| **Research Map** | Tagged research directions accumulated across all rounds |
| **Contradictions** | Incompatible claims extracted across all rounds |
| **Matrix** | Depth / tractability 2×2 matrix from latest synthesis |
| **Overlap** | Pairwise agent overlap matrix |
| **Log** | Full session log with all round outputs |

---

## The research brief

Click the swarm title in the sidebar (or the ✎ icon that appears on hover) to open the brief editor. This is the most important configuration step when adapting the swarm to a new research domain.

The brief has five editable fields:

### Title
The name of the swarm. Appears in the sidebar header and in exported files.

### Subtitle
A one-line description of the research domain.

### Problem context
The core system description — what you are studying, how it works, what the key dynamics are. This is sent to every agent as the foundation of their reasoning. Be specific about the mechanisms, feedback loops, and structural features of the system. Typical length: 300–600 words.

### Research context
Additional domain knowledge: prior work, specific frameworks or models that already exist, empirical observations, named phenomena, and any theoretical tools that agents should be aware of. Typical length: 300–600 words.

### Available data
What data you have realistic access to, what fields it contains, and how it was or can be obtained. Describe only data that is genuinely available for your research — the synthesis agent uses this to judge which directions are tractable, and listing inaccessible data obscures rather than informs that judgement. If you are specifically interested in brainstorming data collection strategies, you can note that as an explicit goal in the problem context instead. Typical length: 80–150 words.

> **Caching note**: All three content fields (problem context, research context, available data) are combined into a single cached block sent with every generation and debate call. Editing any of them invalidates the cache and triggers a fresh cache write on the next run — you will see a "cache invalidated" notice in the tab bar. The title and subtitle are not part of the cached block.

---

## Agent management

### Selecting agents

Click any agent in the sidebar list to toggle it on (selected) or off (deselected) for the next generation round. Selected agents are highlighted. The **all** and **none** buttons toggle the full roster.

### Agent status

Each agent has one of four statuses:

| Status | Behaviour |
|---|---|
| **Active** | Participates in both generation and debate rounds |
| **Gen only** | Participates in generation but excluded from debate pairings |
| **Promoted** | Active status with visual highlight — signals the meta-agent considers this agent underutilised |
| **Retired** | Excluded from all rounds; historical outputs preserved in the session log |

Statuses are set by accepting meta-agent or roster agent recommendations in the Next Round tab.

### Editing a mandate

Hover over any agent to reveal the **edit** button. The mandate editor shows the current mandate text and a **✦ generate from brief** button that calls the API to draft a mandate based on the agent's name and the current brief, using existing mandates as anti-examples to ensure distinct perspectives.

Editing a mandate does **not** invalidate the shared cache — mandates are sent as a second uncached block after the cached brief.

### Creating a new agent

Click **+ new** in the agents section header. Fill in:
- **Name**: the agent's specialist identity
- **Colour**: choose from the palette (used colours shown at reduced opacity)
- **Mandate**: write manually or use **✦ generate from brief**

### Deleting an agent

Hover over an agent and click **×**. Deletion requires confirmation. Historical outputs from deleted agents are preserved in the session log.

### Duplicating an agent

To create an agent with overlapping expertise (for productive debate tension), create a new agent with a related name, then use **✦ generate from brief** with a name that signals the overlap (e.g. "Bayesian / stochastic process" to bridge two existing agents). Edit the generated mandate to tune the degree of overlap.

---

## Running a session

### Recommended workflow

1. **Configure the brief** — click the title to open the brief editor. For a new domain, replace all five fields. For the default climbing grading domain, the brief is pre-populated.

2. **Select agents** — start with all agents selected for the first generation round. You can deselect agents that seem less relevant after reading the roster agent's recommendations.

3. **Choose depth** — `brief` (~180 words per agent) for rapid exploration, `detailed` (~320 words) for standard sessions, `exhaustive` (~500 words) for deep dives into specific directions.

4. **Run generation** — click **run generation round →**. All selected active and gen-only agents run in parallel. Outputs stream in simultaneously.

5. **Review synthesis** — the synthesis tab auto-populates after generation completes. Read the CONVERGENCES, TENSIONS, BLIND SPOTS, and MOST TRACTABLE FIRST STEP sections.

6. **Review Next Round tab** — the meta-agent proposes debate pairings. Toggle pairs on/off, accept any status change recommendations, then click **launch debate round →**.

7. **Review post-debate synthesis** — a second synthesis runs after the debate, this time with compressed generation summaries and full debate outputs.

8. **Repeat** — pairings rotate each round based on meta-agent analysis of what tensions remain unresolved.

### Depth guidance

| Depth | Words/agent | Best for |
|---|---|---|
| Brief | ~180 | First pass, 10+ agents, rapid domain mapping |
| Detailed | ~320 | Standard sessions, 5–10 agents |
| Exhaustive | ~500 | Drilling into specific directions with 3–6 agents |

---

## Debate round

The debate round is structured around pairings proposed by the meta-agent. Each pairing has a type:

| Type | Meaning |
|---|---|
| **CONTRADICTION** | The two agents made directly incompatible claims in generation — debate to resolve |
| **INTERSECTION** | Their frameworks have unexplored overlap — debate to synthesise |
| **DISRUPTION** | One agent's output challenges a premature consensus in the other's — debate to stress-test |
| **BRIDGE** | One agent's approach is theoretically deep but empirically blocked; the other may offer tractable entry points |

### Multiple pairings per agent

An agent may be assigned multiple debate partners in the same round. This is encouraged — in an academic seminar, a participant responds to multiple interlocutors, not just one. Multiple debate assignments are shown as **N↔** in the agent list.

When an agent has multiple partners, their debates are batched into a single API call: the agent receives all partner outputs in one message and responds to each in a labelled section. This reduces API calls proportionally to the number of multi-partner agents.

### Debate direction

Debate pairings are directional: the agent listed first (id1) reads and responds to the agent listed second (id2). This means agent A debating B and agent B debating A are distinct pairings with distinct outputs. For maximum tension, assign both directions.

---

## Synthesis and meta-agent

### Synthesis structure

The synthesis agent produces output in six structured sections:

- **CONVERGENCES**: 2–3 mechanisms or themes multiple agents independently converged on
- **TENSIONS**: 2–3 productive disagreements with precisely stated incompatible claims
- **MOST TRACTABLE FIRST STEP**: a single specific analysis to run given the available data
- **BLIND SPOTS**: 1–2 important phenomena no agent adequately addressed
- **RESEARCH DIRECTIONS**: 4–6 directions tagged as `[DEEP+TRACTABLE]`, `[DEEP+BLOCKED]`, `[SHALLOW+TRACTABLE]`, or `[SHALLOW+BLOCKED]`
- **CONTRADICTIONS**: 2–3 incompatible claim pairs in structured format for the contradiction tracker

### Two-stage synthesis compression

For post-debate synthesis (which would otherwise include both generation outputs and debate outputs, growing unboundedly), generation outputs are first compressed to ~80 words each in a single batched API call. Only the debate outputs are passed at full length. This keeps synthesis input size bounded across rounds.

### Meta-agent

After synthesis, the meta-agent proposes pairings for the next round and agent status changes. All proposals appear in the **Next Round** tab and require your approval before taking effect. You can toggle individual pairs on/off and accept or reject each status change recommendation independently.

---

## Roster agent

Click **roster ✦** in the agents section header to open the roster agent. This is a higher-level agent that analyses the brief and all current mandates together to make structural recommendations about the roster itself.

The roster agent produces:

- **New agent suggestions**: up to 3 suggested agents with draft mandates, colour suggestions, and justifications. Each can be added immediately or opened for editing first.
- **Status change recommendations**: agents to retire, promote, move to gen-only, or reactivate.
- **Mandate drift corrections**: cases where a mandate has become inconsistent with the current brief or with other mandates, with suggested corrections.
- **Overlap notes**: pairs with high or low predicted debate productivity, which update the overlap matrix.

The roster agent is best run before starting a new session, after significantly editing the brief, or after several rounds when the roster may need restructuring. It is intentionally distinct from the meta-agent: the meta-agent reacts to what agents actually produced, while the roster agent reasons prospectively about mandate design.

---

## Research map and contradiction tracker

### Research map

Every synthesis extracts research directions tagged with their depth/tractability category. These accumulate across all rounds in the **Research Map** tab — duplicate directions are deduplicated automatically.

Each direction can be tagged:

| Tag | Meaning |
|---|---|
| **pursue** | High priority — tractable and theoretically interesting |
| **revisit** | Worth returning to in a later session |
| **needs data** | Theoretically strong but blocked by data access |
| **blocked** | Theoretically interesting but currently intractable |

Tags persist within the session and are included in JSON and markdown exports.

### Contradiction tracker

The contradiction tracker accumulates pairs of incompatible claims extracted by the synthesis agent across all rounds. Each entry shows the two agents in conflict, their incompatible claims, and what empirical evidence or theoretical argument would resolve the contradiction.

Contradictions are among the most valuable outputs of the swarm — they identify the exact points where a new theoretical contribution or empirical test would be most impactful.

---

## Overlap matrix

The **Overlap** tab shows a pairwise matrix of all active agents with a score estimating how productive a debate between each pair would be.

Scores are computed in two ways:

- **Static** (available immediately): Jaccard coefficient on words longer than 5 characters in the two mandates. Higher overlap = more shared concepts = more productive debate.
- **Roster agent** (available after running the roster agent): qualitative assessment of debate productivity based on actual mandate content, overriding the static score for assessed pairs.

The matrix is colour-coded: green = high overlap (productive debate), red = low overlap. Hover over any cell to see the reason and source.

Use the overlap matrix to inform manual pairing decisions or to evaluate whether the meta-agent's proposals cover the highest-value pairs.

---

## Cost tracking and prompt caching

### Live cost display

The sidebar shows live session cost broken down by:
- Input tokens (billed at $3.00/M)
- Output tokens (billed at $15.00/M)
- Cache reads (billed at $0.30/M — 10× cheaper than input)
- Cache writes (billed at $3.75/M — one-time cost per cached block)
- **Saved via caching**: the cumulative saving compared to sending uncached input

A cache hit rate bar shows what fraction of input tokens are being served from cache.

The per-call log shows each API call name, its cost, and a ⚡ indicator with the number of cache-read tokens if the call hit the cache.

### How prompt caching works

The combined brief (problem context + research context + available data) is sent as a single cached block with every generation and debate call. The first call in a round writes the cache; all subsequent parallel calls hit it. With the default 10-agent roster, calls 2–10 pay only $0.30/M for the brief instead of $3.00/M — a 10× reduction on the largest part of the input.

The agent mandate is sent as a second, uncached block immediately after the cached brief. This means editing a mandate does not invalidate the shared cache.

The brief cache has a 5-minute TTL (time to live). Within a single session all calls will hit the cache. Across sessions, the first call after the TTL expires will pay a cache write fee.

### Typical costs

| Session type | Approximate cost |
|---|---|
| Single generation round, 10 agents, detailed | $0.05–$0.10 |
| Full round (generation + debate + synthesis), detailed | $0.12–$0.20 |
| 5 full rounds, detailed | $0.50–$0.80 |
| Exhaustive depth, 10 agents, full round | $0.25–$0.40 |

Cache savings typically reach 60–80% on the input token cost by the second call in a generation round.

---

## Saving and exporting

To avoid losing work mid-session — particularly given API calls cost money — the tool exports automatically and frequently. A full session can be restored from a previously exported JSON file even after the browser tab is closed.

### Auto-export (JSON and Markdown)

Both a JSON file and a Markdown file are automatically downloaded after every synthesis completes. This means you always have an up-to-date human-readable record of the session without needing to remember to export manually.

The JSON file contains:
- The full brief (all five fields)
- All agent mandates
- Every round's generation outputs, debate outputs, and synthesis
- The research map with tags
- The contradiction log
- The depth/tractability matrix
- The overlap matrix scores
- Session cost breakdown

The Markdown file contains the same content in human-readable form, suitable for sharing or archiving alongside a paper or project.

Files are named `swarm-[timestamp].json` and `swarm-[timestamp].md`.

### Resuming a session

Click **import session** in the tab bar and select a previously exported JSON file. The tool will restore:
- The research brief and agent mandates
- The accumulated research map with tags
- The contradiction log
- The session log with all round summaries
- The overlap matrix scores
- The agent roster and statuses

The streaming outputs from previous rounds are not restored visually, but the session log repopulates with all round summaries and synthesis outputs, and the accumulated research intelligence (map, contradictions, matrix) is fully intact. You can continue running new rounds from where you left off.

### Manual export

Two manual export buttons are available in the tab bar:

- **export md**: A human-readable Markdown file with the full session
- **export json**: The full session state as JSON

### What is not saved

The API key is never saved anywhere — you will need to re-enter it after importing a session. Session state is not persisted in the browser between tabs or windows; always rely on the auto-exported files to preserve work.

---

## Adapting to a new research domain

The climbing grading system is the default domain, but the swarm is fully domain-agnostic. To adapt it:

1. **Open the brief editor** (click the title) and replace all five fields with content relevant to your domain.

2. **Edit agent mandates** to point each agent's expertise at the new system. The key is ensuring each mandate identifies: the specific frameworks and tools from that discipline, the particular phenomena in your system that those tools would address, and what the agent would argue with other agents about.

3. **Run the roster agent** to check for mandate drift, gaps in coverage, and unexplored overlaps given the new brief.

4. **Consider adding or removing agents** to match the disciplinary landscape of your domain. The + new button and roster agent suggestions are the fastest routes.

### Intended problem characteristics

The swarm is designed for situations where you want to rapidly survey a theoretical landscape from multiple disciplinary perspectives before committing to a research direction. It is intended to be most useful when the research problem has some combination of the following characteristics — though this is a design intention rather than a validated claim, as the tool has not yet been systematically evaluated:

- The system involves distributed consensus or collective judgement under heterogeneous participants
- Social or informational dynamics (anchoring, herding, credibility) interact with the underlying phenomenon
- There is selection or access bias in who generates observable data
- Spatial, demographic, or cultural heterogeneity creates subpopulation structure
- The system drifts or evolves over time in ways that complicate cross-sectional analysis
- There is genuine ambiguity about whether the core quantity of interest is well-defined or measurable

The tool is fully generalisable beyond the default domain — the agent roster, mandates, and brief are all editable, and the generation, debate, and synthesis machinery is domain-agnostic. Whether it produces useful outputs for a given problem will depend on the quality of the brief and mandates you write.

### Problems related to the default climbing grading domain

The following problems share structural features with the climbing grading system and may be natural candidates for the default agent roster with brief and mandate adjustments. The connections are noted briefly; whether the analogy is close enough to be productive in practice remains to be seen:

- **Peer review in academic publishing**: consensus formation under heterogeneous reviewer expertise, anchoring on prior scores, selection bias (only submitted work is reviewed), and disciplinary grading culture differences all map closely onto the climbing problem.
- **Elo and rating systems in competitive games**: chess, Go, and competitive video games have rating systems with known calibration problems, regional culture effects, and feedback dynamics between rating and opponent selection.
- **Economic price discovery in thin markets**: illiquid asset markets (art, rare wine, private equity valuations) involve consensus price formation under sparse information, anchoring on prior transactions, and systematic bias from who participates in price-setting.
- **Reputation and review systems on online platforms**: product reviews, restaurant ratings, and academic citation counts exhibit herding, selection bias in who reviews, and platform-level calibration effects.
- **Clinical diagnosis consensus**: inter-rater agreement on diagnosis, anchoring on prior diagnoses, and the question of whether diagnostic categories map onto a well-defined underlying reality all have parallels in the grade measurement problem.

---

## Token optimisation details

The following optimisations are implemented and active by default. All are designed to reduce cost without affecting research output quality.

### Shared cached brief block
All five brief fields are concatenated into a single cached block (typically 1500–2000 tokens) sent with every generation and debate call. Cache eligibility requires a minimum of 1024 tokens — the combined brief is designed to comfortably exceed this. Cache TTL is 5 minutes.

### Mandate as uncached second block
The agent mandate follows the cached brief as a separate, uncached block. This means editing one agent's mandate does not invalidate the shared cache for other agents' calls.

### Parallel generation
All selected agents run simultaneously in parallel, not sequentially. The first call to the API writes the cache; all subsequent calls within the same round hit it. There is no serial dependency between generation calls.

### Debate batching
When an agent is assigned multiple debate partners, all debates are batched into a single API call. The agent receives all partner outputs in one user message and responds to each in a labelled section. This reduces API calls proportionally to the number of multi-partner agents (e.g. an agent with 3 partners: 3 calls → 1 call).

### Two-stage synthesis compression
For post-debate synthesis, generation outputs are first compressed to ~80 words each in a single batched API call (one call, all outputs, cached brief block). The compressed summaries replace full generation outputs in the synthesis input. Debate outputs are passed at full length. This prevents synthesis input from growing unboundedly as rounds accumulate.

### Synthesis uses brief-only cached block
The synthesis call caches the shared brief block without any agent mandate, since the synthesis agent's role is not specialist but integrative.

### Meta-agent and roster agent are uncached
These calls have unique inputs not shared with other calls and are not worth caching. They use a plain string system prompt.

---

## Architecture

The entire application is a single HTML file with no external dependencies beyond:
- Google Fonts (DM Mono, Instrument Serif) — loaded from `fonts.googleapis.com`
- The Anthropic API — called directly from the browser using the `anthropic-dangerous-direct-browser-access: true` header

There is no build step, no bundler, no package manager, and no server-side component. All state is held in memory in the browser tab. The application can be served from a local filesystem, a static file host, or GitHub Pages.

### API calls made during a session

| Call type | System prompt | Caching |
|---|---|---|
| Generation (per agent) | Cached brief + uncached mandate | ✅ Cached brief |
| Debate (per responding agent) | Cached brief + uncached mandate | ✅ Cached brief |
| Generation compression (batched) | Cached brief | ✅ Cached brief |
| Synthesis | Cached brief only | ✅ Cached brief |
| Meta-agent | Plain string | ❌ |
| Roster agent | Cached brief | ✅ Cached brief |
| Mandate generation | Plain string | ❌ |

### Model

All calls use `claude-sonnet-4-20250514`. This is hardcoded and can be changed by editing the `model` field in the `apiStream` function.

---

## Default agent roster

The swarm ships with ten specialist agents. All mandates are editable and all agents can be replaced.

| Agent | Disciplinary lens |
|---|---|
| **Stochastic process modeler** | Markov chains, Fokker-Planck equations, Langevin dynamics, martingales, first-passage times |
| **Non-equilibrium physics / info geometry** | Jarzynski equality, Landauer's principle, stochastic thermodynamics, Fisher information metric, dissipative adaptation |
| **Evolutionary dynamics / cultural evolution** | Price equation, replicator-mutator dynamics, metapopulation biology, niche construction, multilevel selection |
| **Bayesian inference** | Hierarchical models, item response theory, variational inference, Gaussian processes, censored likelihoods |
| **Agent-based simulation** | Heterogeneous agents, preferential attachment, popularity feedback loops, emergent attractors |
| **Dynamical systems** | Slow manifolds, attractors, bifurcations, hysteresis, timescale separation |
| **Network / sociology** | Bipartite networks, information spreading, community detection, structural holes, credibility |
| **Measurement theory** | Psychophysics, multidimensionality, conjoint measurement, scale validity, rank-reversal |
| **Information theory** | Channel capacity, anchoring as compression, censored channels, mutual information, entropy rate |
| **Statistical / extreme value theory** | GEV distributions, order statistics, records theory, tail sampling, outlier analysis |

---

## AI disclosure

Research Swarm is a tool that calls the [Anthropic](https://www.anthropic.com) API to run AI language model agents. All reasoning in a swarm session is performed by Claude (`claude-sonnet-4-20250514`) via the Anthropic API.

**Licensing**: Anthropic's usage policy governs what the API may be used for, but does not require attribution for software built on top of it. Using the Claude API is a commercial relationship (you pay per token) and does not create any intellectual property obligation toward Anthropic in the outputs or in derivative software. Research Swarm itself is independently licensed under MIT.

**What the AI does and does not do**: The agents in Research Swarm propose research directions, identify theoretical tensions, and synthesise outputs — but they do not verify claims against the literature, run experiments, or access the internet during a session. All outputs should be treated as starting points for human-directed research, not as authoritative conclusions. The quality of outputs depends heavily on the quality of the research brief and agent mandates you provide.

**Transparency in research**: If you use Research Swarm in academic work, standard research ethics apply to disclosing the use of AI tools in your methodology. The appropriate level of disclosure will depend on your institution's policies and the norms of your field. At minimum, noting that AI-assisted brainstorming was used in the research direction selection process is good practice.

---

## Licence

MIT. Use freely, adapt for your research domain, and contribute improvements back. See [LICENSE](LICENSE) for the full text.

If you build something substantially different on top of this codebase — a hosted service, a significantly extended tool, a domain-specific fork — sharing it back as a public repository or contributing improvements upstream is encouraged, though not required.

If the tool contributes to published research, an acknowledgement is welcome but not expected. A suggested form:

> Research directions were explored using Research Swarm (https://github.com/DBoocock/research-swarm).

---

## Contributing

Contributions welcome. The most useful additions would be:

- New domain-specific brief templates (as separate markdown files)
- Additional specialist agent mandate templates
- UI improvements for the overlap matrix
- Session state persistence via localStorage (for resuming sessions after tab close)
- Support for other Anthropic models (Opus for deeper synthesis, Haiku for cheap compression calls)
