# Research Swarm

Research Swarm is a multi-agent AI framework for prototyping theoretical research directions. Specialist agents with distinct disciplinary mandates generate, debate, and synthesise research angles on a problem in parallel — with full researcher control over the brief, roster, debate pairings, and cost. The entire tool runs as a single HTML file opened directly in the browser: no server, no build step, no package manager, no GPU.

Originally built to study the dynamics of community rock climb difficulty grading systems, but fully generalisable to any research domain by editing the brief and agent mandates.

The tool is built on the well-established multi-agent debate framework and is not a novel research contribution. Its distinct position is practical: it prioritises researcher control and interpretability over automation, runs without any infrastructure, and is designed to be cost-aware. Whether it produces useful research outputs has not yet been systematically evaluated — see [issue #3](https://github.com/DBoocock/research-swarm/issues/3). If you use the tool for research, feedback on what works and what doesn't is genuinely useful and is currently the primary source of evidence about its value.

---

> **Running Research Swarm is inexpensive.** The default provider is Google Gemini with billing enabled. A small session with 3–5 agents costs roughly $0.02–0.05; a full 10-agent detailed session around $0.30–0.60 with the reflection round enabled. The free tier (no billing required) works for initial exploration but has a tight daily request limit. See [Gemini billing setup](#gemini-billing-setup) for the full picture.

---

**Live:** [dboocock.github.io/research-swarm](https://dboocock.github.io/research-swarm/) — open in your browser, add an API key, and run immediately. No installation required. To explore without an API key, import the [example session](https://github.com/DBoocock/research-swarm/raw/main/examples/grade-dynamics-4agents-brief-R31.json) (Session log tab → Import).

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
  - [Gemini billing setup](#gemini-billing-setup)
- [Saving and exporting](#saving-and-exporting)
  - [API key security and privacy](#api-key-security-and-privacy)
- [Adapting to a new research domain](#adapting-to-a-new-research-domain)
- [Token optimisation details](#token-optimisation-details)
- [Architecture](#architecture)
- [Default agent roster](#default-agent-roster)
- [Related work and context](#related-work-and-context)
- [AI disclosure](#ai-disclosure)
- [Licence](#licence)

---

## How it works

The swarm operates as an iterative loop of generation, debate, and synthesis rounds — all steered by the researcher at each step. The diagram below shows the full session lifecycle, including the roster agent which sits outside the main loop as an advisory tool.

```
┌─────────────────────────────────────────────────────────────────┐
│                        RESEARCH BRIEF                           │
│          (title · problem context · research context ·          │
│           available data — all editable, cached by API)         │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │   GENERATION ROUND    │  ← agents run in parallel,
                    │  each agent reads     │    each seeing only their
                    │  brief + own mandate  │    own mandate
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │  POST-GEN SYNTHESIS   │  ← convergences · tensions ·
                    │  (arbitration agent)  │    tractable first step ·
                    └───────────┬───────────┘    blind spots · directions
                                │
                    ┌───────────▼───────────┐
                    │     META-AGENT        │  ← proposes typed debate
                    │   PROPOSALS           │    pairings and agent status
                    └───────────┬───────────┘    changes for next round
                                │
                    ┌───────────▼───────────┐
                    │  YOU REVIEW & ACCEPT  │  ← toggle pairs on/off,
                    │  pairing proposals    │    accept/reject status
                    └───────────┬───────────┘    changes
                                │
                    ┌───────────▼───────────┐
                    │     DEBATE ROUND      │  ← each agent reads assigned
                    │  paired agents read   │    partners' generation output
                    │  each other's output  │    and responds critically
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │   REFLECTION ROUND    │  ← each debating agent processes
                    │  (when enabled)       │    what it learned; appends new
                    │                       │    directions to generation output
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │ POST-DEBATE SYNTHESIS │  ← same structure as above;
                    │  (arbitration agent)  │    generation outputs first
                    └───────────┬───────────┘    compressed to ~80 words
                                │
                    ┌───────────▼───────────┐
                    │     META-AGENT        │
                    │   PROPOSALS           │
                    └───────────┬───────────┘
                                │
                         repeat ▼ or end session

           ┌──────────────────────────────────────────┐
           │  ROSTER AGENT  (run at any time)          │
           │  Analyses brief + all mandates to suggest │
           │  new agents · status changes · mandate    │
           │  drift corrections · overlap assessments  │
           └──────────────────────────────────────────┘
```

**Generation round**: Selected agents receive the shared research brief plus their individual specialist mandate. On the first round all selected agents run; on subsequent rounds only newly added agents run — existing generation outputs are preserved. On the Anthropic path, agents run in primer-then-parallel order (the first agent alone to write the prompt cache, then the rest in parallel reading from it). On Gemini, all agents run in true parallel with no sequencing overhead.

**Debate round**: Agents are assigned one or more partners whose generation output they read and respond to. Multiple pairings per agent are allowed and encouraged. Debates are batched: an agent with three partners makes one API call rather than three, with responses labelled per partner. Pairings are proposed by the meta-agent after each synthesis and reviewed by you before the debate launches.

**Reflection round** (enabled by default, toggleable in the sidebar): After each debate round, each debating agent runs two sequential API calls before synthesis. Call 1 (Reflection) collates all debates the agent participated in — both where it critiqued and where it was critiqued — and produces structured output: rebuttals to critiques received and framework learning from critiques it generated. Call 2 (Generation extension) appends new or deepened research directions to the agent's existing generation output based on what it learned. The full history of prior exchanges between each pair is injected chronologically before future debate calls, so agents do not repeat arguments that have already been answered. Newly added agents that have only generated are skipped. When disabled, the tool behaves exactly as before.

**Synthesis**: An arbitration agent reads all generation and debate outputs and produces a concise structured synthesis with explicit word limits per section: convergences, tensions, the single most tractable first empirical step, blind spots, tagged research directions, and a contradiction log.

**Meta-agent**: After each synthesis, a meta-agent proposes debate pairings for the next round (typed as CONTRADICTION, INTERSECTION, DISRUPTION, or BRIDGE) and recommends agent status changes (active, generation-only, retired, promoted). You review and accept or reject each recommendation before the next round launches.

**Roster agent**: A separate advisory agent, available at any time, that analyses the current brief and all agent mandates together. It suggests new agents to add (with draft mandates), flags mandate drift, recommends status changes, and assesses overlap between agent pairs. It is distinct from the meta-agent: the meta-agent reacts to what agents actually produced in a round; the roster agent reasons prospectively about the design of the roster itself.

This cycle repeats. Research directions, contradictions, and matrix entries accumulate across rounds and are preserved in the session log.

---

## Getting started

### Requirements

- A modern web browser (Chrome, Firefox, Safari, Edge)
- A free Google Gemini API key **or** an Anthropic API key — see below

### Quickstart — hosted version

Visit **[dboocock.github.io/research-swarm](https://dboocock.github.io/research-swarm/)**, select your API provider in the sidebar, enter your key, and you're ready to run. No installation, no download.

To explore a mature session without any API cost, import the [example session](https://github.com/DBoocock/research-swarm/raw/main/examples/grade-dynamics-4agents-brief-R31.json) (Session log tab → Import).

### Local installation

If you prefer to run the tool locally or want to modify the code:

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

3. Select your API provider in the sidebar and enter the corresponding key:
   - **Google Gemini** (default): get a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
   - **Anthropic**: get a key at [console.anthropic.com](https://console.anthropic.com) (requires billing)

There is no npm install, no server to run, and no environment variables to configure.

### Getting an API key

**Google Gemini (default)**

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and sign in with a Google account
2. Create a new API key — no credit card or billing setup required for the key itself
3. Paste it into the **Gemini API key** field in the sidebar

Gemini 2.5 Flash is available on a free tier with a daily request quota. For regular use, enabling billing is strongly recommended — it raises the daily limit to 10,000 requests and unlocks true parallel agent execution. See [Gemini billing setup](#gemini-billing-setup). Google's free tier carries a data-use clause: inputs and outputs may be used to improve Google's products.

**Anthropic (paid, parallel, with prompt caching)**

1. Go to [console.anthropic.com](https://console.anthropic.com) and create an account
2. Navigate to **API Keys** and create a new key
3. Add a payment method and a small credit balance — a typical round (generation + debate + reflection + synthesis, 10 agents, detailed depth) costs $0.25–0.35 with the reflection round enabled; the first round of a session is ~$0.35 due to the cache write. A four-round session costs approximately $0.80–1.20 with reflections enabled
4. Select **Anthropic** in the provider section and paste the key — your browser's password manager can save it

> **Note**: The Anthropic API is billed separately from a Claude.ai Pro subscription. Both providers are available simultaneously in the sidebar; you can switch between them at any time.

---

## Interface overview

The interface is divided into a **sidebar** (always visible) and a **main panel** with tabs.

### Sidebar

| Section | Purpose |
|---|---|
| **Swarm title** (clickable) | Opens the brief editor modal |
| **Provider** | Gemini (default) or Anthropic — radio selector + key field |
| **Session cost** | Live cost tracker with cache hit rate |
| **Agents** | Agent list with status, edit, and delete controls |
| **Synthesis model** | Sonnet / Opus toggle (Anthropic only) |
| **Depth** | Brief / Detailed / Exhaustive output length |
| **Reflection round** | Enable / disable the two-call reflection pipeline after each debate round |
| **Run button** | Launches the generation round |
| **Status bar** | Current operation status |

### Main tabs

| Tab | Contents |
|---|---|
| **Generation** | Agent outputs from the current generation round |
| **Debate** | Debate outputs from the current debate round |
| **Synthesis** | Synthesis arbitration output |
| **Next Round** | Meta-agent pairing proposals and status recommendations |
| **Research Map** | Tagged and attributed research directions accumulated across all rounds; **handover ↓** button per direction generates a detailed research brief |
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

> **Caching note**: All three content fields (problem context, research context, available data) are combined into a single cached block sent with every generation and debate call. Editing any of them invalidates the cache and triggers a fresh cache write on the next run. The combined brief must exceed **2,048 tokens** (~8,000 characters) for caching to activate on Sonnet 4.6 — below this threshold every call pays full input price silently. Aim for 2,300–2,800 tokens: above the threshold, comprehensive enough to anchor all agents, not so large that cache-read costs climb. The title and subtitle are not part of the cached block.

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

2. **Select agents** — consider starting with a smaller, familiar subset: 3–5 agents whose disciplinary backgrounds overlap with your own, or that you expect to be most directly relevant to the problem. This keeps the initial outputs interpretable — if an agent in a familiar field produces something shallow or wrong, you'll notice; if an unfamiliar one does, you might not. It also keeps the first debate focused enough to follow closely. Once you've run a round or two and have a feel for the terrain, use the roster agent to identify gaps and bring in new agents to expand the horizon. That said, starting with all agents is a reasonable choice for rapid domain mapping — the tradeoff is breadth vs. legibility in the early rounds.

3. **Choose depth** — `brief` (~180 words per agent) for rapid exploration, `detailed` (~320 words) for standard sessions, `exhaustive` (~500 words) for deep dives into specific directions.

4. **Run generation** — click **run generation round →**. On the first round all selected agents run; on subsequent rounds only newly added agents run (existing outputs are preserved). Outputs stream in as they complete.

5. **Review synthesis** — the synthesis tab auto-populates after generation completes. Read the CONVERGENCES, TENSIONS, BLIND SPOTS, and MOST TRACTABLE FIRST STEP sections.

6. **Review Next Round tab** — the meta-agent proposes debate pairings. Toggle pairs on/off, accept any status change recommendations, then click **launch debate round →**.

7. **Review post-debate synthesis** — if the reflection round is enabled (default), each debating agent first processes what it learned from debate and appends new directions to its generation output, then synthesis runs over the updated outputs. The synthesis tab shows the result.

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

The synthesis agent produces concise output in six structured sections, each with an explicit word limit to control output token cost:

- **RESEARCH DIRECTIONS**: 4–6 short titles tagged `[DEEP+TRACTABLE]`, `[DEEP+BLOCKED]`, `[SHALLOW+TRACTABLE]`, or `[SHALLOW+BLOCKED]` — titles only, no explanation. Appears first so that if synthesis output is truncated at the token ceiling, research directions are preserved over the lower-value sections at the end
- **CONVERGENCES** (60 words): 2–3 mechanisms multiple agents independently converged on, one sentence each
- **TENSIONS** (80 words): 2–3 productive disagreements, each stated as a precise incompatible claim pair
- **MOST TRACTABLE FIRST STEP** (50 words): one specific analysis, one dataset, one method
- **BLIND SPOTS** (40 words): 1–2 phenomena not adequately addressed, one sentence each
- **CONTRADICTIONS**: 2–3 incompatible claim pairs, each field capped at 15 words, in structured format for the contradiction tracker

### Two-stage synthesis compression

For post-debate synthesis, generation outputs are first compressed to ~80 words each in a single batched Haiku call. Only the debate outputs are passed at full length. This keeps synthesis input size bounded across rounds.

### Meta-agent

After synthesis, the meta-agent proposes pairings for the next round and agent status changes. All proposals appear in the **Next Round** tab and require your approval before taking effect. You can toggle individual pairs on/off and accept or reject each status change recommendation independently.

---

## Roster agent

Click **roster ✦** in the agents section header to open the roster agent. This is a higher-level agent that analyses the brief and all current mandates together to make structural recommendations about the roster itself.

The roster agent produces:

- **New agent suggestions**: up to 3 suggested agents with draft mandates, colour suggestions, and justifications. Each can be added immediately or opened for editing first.
- **Status change recommendations**: agents to retire, promote, move to gen-only, or reactivate.
- **Mandate drift corrections**: cases where a mandate has become inconsistent with the current brief or with other mandates. Each correction has two options: **✦ apply correction** (calls Haiku to rewrite the mandate incorporating the fix, preserving the agent's disciplinary identity and keeping it concise) or **edit manually** (opens the agent editor).
- **Overlap notes**: pairs with high or low predicted debate productivity, which update the overlap matrix.

The roster agent is best run before starting a new session, after significantly editing the brief, or after several rounds when the roster may need restructuring. It is intentionally distinct from the meta-agent: the meta-agent reacts to what agents actually produced, while the roster agent reasons prospectively about mandate design.

---

## Research map and contradiction tracker

### Research map

Every synthesis extracts research directions tagged with their depth/tractability category. These accumulate across all rounds in the **Research Map** tab. Each direction carries a stable identifier (`R{round}-{position}`) assigned at parse time.

From the second synthesis onward, the synthesis model sees the existing map (with each entry's methods and phenomenon) and must write one of three explicit labels after each direction's SUMMARY line:

- **`EXTENDS: RN-n`** — builds on or adds a new method/scope to an existing direction; the referenced ID must come from the prior-round map
- **`SAME AS: RN-n`** — same research question and method as an existing direction, even if the title differs; the parser retracts the new entry and merges it into the referenced existing one, preventing near-duplicates that title matching would miss
- **`NEW DIRECTION`** — genuinely new this round with no ancestor in the existing map

Directions with a confirmed `EXTENDS` link are shown indented beneath their parent in the map panel, making the lineage of the research agenda visible across rounds. Root directions labeled `NEW DIRECTION` carry a blue tag; any direction whose label referenced a same-round or non-existent ID carries a red `unresolved` tag.

Each direction also carries structured attribution data recorded at synthesis time: which agents contributed substantively (`{id, round}[]` — recording both the agent and the round they were attributed), and which debate exchanges brought it into focus. Attribution accumulates across rounds — a direction first identified in round 1 may gain additional attributed agents in later rounds as it continues to be developed. This attribution is used to pre-load relevant context when generating a handover document.

Each direction can be tagged:

| Tag | Meaning |
|---|---|
| **pursue** | High priority — tractable and theoretically interesting |
| **revisit** | Worth returning to in a later session |
| **needs data** | Theoretically strong but blocked by data access |
| **blocked** | Theoretically interesting but currently intractable |

Tags persist within the session and are included in JSON and markdown exports.

### Handover documents

Each research map entry has a **handover ↓** button that generates a structured markdown research brief for that direction. The handover agent reads the attributed session context — synthesis history, compressed generation outputs, full debate exchanges attributed to the direction, contradiction tracker, and research map — and produces a document covering: research background, a precise direction proposal with LaTeX equations and Mermaid diagrams, supporting evidence from the session, required data and methods, immediate next steps, a phased research programme, known obstacles, and related directions.

The document is designed as a companion to the JSON session export. It references specific session content by round number and agent name rather than reproducing it at length. Generated documents can be downloaded as `.md` files directly from the modal.

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
- Input tokens
- Output tokens
- Cache reads (10× cheaper than input per model)
- Cache writes (one-time cost per cached block)
- **Saved via caching**: the cumulative saving compared to sending uncached input

A cache hit rate bar shows what fraction of input tokens are being served from cache. Each entry in the per-call log shows the call name, a three-letter model indicator (snt / ops / hku), cost, and a ⚡ indicator with cache-read token count if the call hit the cache.

### Model selection and pricing

Different call types use different models, selectable or fixed:

| Call type | Anthropic model | Gemini model | Control |
|---|---|---|---|
| Generation | Sonnet 4.6 | 2.5 Flash | Fixed |
| Debate | Sonnet 4.6 | 2.5 Flash | Fixed |
| Reflection | Sonnet 4.6 | 2.5 Flash | Fixed (strong model required) |
| Generation extension | Sonnet 4.6 | 2.5 Flash | Fixed (strong model required) |
| Synthesis | Sonnet 4.6 or Opus 4.6 | 2.5 Flash | **Sonnet/Opus toggle** (Anthropic only) |
| Meta-agent | Sonnet 4.6 or Opus 4.6 | 2.5 Flash | Follows synthesis toggle |
| Roster agent | Sonnet 4.6 or Opus 4.6 | 2.5 Flash | Follows synthesis toggle |
| Handover document | Sonnet 4.6 or Opus 4.6 | 2.5 Flash | Follows synthesis toggle |
| Generation compression | Haiku 4.5 | **2.5 Flash Lite** | Fixed (simple summarisation) |
| Direction attribution | Haiku 4.5 | **2.5 Flash Lite** | Fixed (closed-set classification) |
| Mandate generation | Haiku 4.5 | **2.5 Flash Lite** | Fixed (simple drafting) |

Approximate token prices per million:

| Model | Input | Output | Cache write | Cache read |
|---|---|---|---|---|
| Gemini 2.5 Flash | $0.30 | $2.50 | — | — |
| Gemini 2.5 Flash Lite | $0.10 | $0.40 | — | — |
| Sonnet 4.6 | $3.00 | $15.00 | $3.75 | $0.30 |
| Opus 4.6 | $15.00 | $75.00 | $18.75 | $1.50 |
| Haiku 4.5 | $1.00 | $5.00 | $1.25 | $0.10 |

Gemini 2.5 Flash Lite is used for compression and mandate-rewriting tasks — the same "cheap model for cheap tasks" principle as Haiku on the Anthropic path. All generation, debate, synthesis, meta-agent, and roster calls use Gemini 2.5 Flash.

The **Opus toggle** (Anthropic path only) applies to synthesis, meta-agent, and roster agent calls — the three calls where reasoning quality most directly affects the session's value. On Gemini, the synthesis model section is hidden entirely; all roles use Gemini 2.5 Flash. Generation and debate remain on the strong model regardless of the toggle.

### Reducing or eliminating API costs

A typical round (generation + debate + synthesis, 10 agents, detailed depth) costs $0.15–0.20 after the first round; the first round of a session costs ~$0.25 due to the one-time cache write. A four-round session at detailed depth costs approximately $0.50–0.65. For occasional use this is modest, but several routes exist to reduce or eliminate the cost entirely.

**Anthropic credit programmes**

Anthropic runs two grant programmes that provide free API credits to qualifying researchers. Both are applied for via a Google Form and reviewed monthly — the application burden is low relative to a formal grant proposal, though selection is competitive.

| Programme | Who it's for | Credits | Application |
|---|---|---|---|
| [AI for Science](https://support.claude.com/en/articles/11199177-anthropic-s-ai-for-science-program) | Researchers at academic or nonprofit institutions working on high-impact scientific projects. Biology and life sciences prioritised, but physics, chemistry, environmental science, and other quantitative fields are in scope. | Up to $20,000 over 6 months | [Google Form](https://docs.google.com/forms/d/e/1FAIpQLSfwDGfVg2lHJ0cc0oF_ilEnjvr_r4_paYi7VLlr5cLNXASdvA/viewform?usp=header), reviewed first Monday of each month |
| [External Researcher Access](https://support.claude.com/en/articles/9125743-what-is-the-external-researcher-access-program) | Researchers working specifically on AI safety and alignment topics Anthropic considers high priority. | Unspecified | Same application system |

Both programmes award credits to API accounts, not to claude.ai subscriptions — they are directly compatible with Research Swarm. Individual researchers (including those without institutional affiliation) are eligible to apply; the institutional affiliation clause in the rules only applies if you *are* affiliated, requiring you to have obtained appropriate employer or institution consents.

If your research falls within scope, these programmes represent the most cost-effective path: full Sonnet-quality performance at zero marginal cost. Note that accepted researchers grant Anthropic a licence to use their API inputs and outputs for product development and model training — check the [programme rules](https://www.anthropic.com/ai-for-science-program-rules) if this is a concern for your research data.

**Google Gemini free API tier**

As of v4.4.0, Gemini is the default provider in Research Swarm — no Anthropic billing is required. Gemini 2.5 Flash is available on the free tier with a daily request quota, requiring only a Google account.

The free tier carries a data-use clause: Google may use inputs and outputs to improve their products. The daily request limit (20–250 RPD depending on account) is the binding constraint on the free tier — a single 10-agent session can exhaust it. Enabling billing is recommended for any regular use; see [Gemini billing setup](#gemini-billing-setup).

<a name="gemini-billing-setup"></a>
#### Gemini billing setup — the recommended approach

Adding a billing method to your Google AI Studio account unlocks much higher rate limits. This is the recommended setup for regular use.

**What enabling billing changes:**

| Metric | No billing (free tier) | Billing enabled (pay-as-you-go) |
|---|---|---|
| Requests per minute (RPM) | 10 | 1,000 |
| Requests per day (RPD) | 20–250 (varies by account) | 10,000 |
| Tokens per minute (TPM) | 250,000 | 4,000,000 |
| Minimum spend | $0 | $0 (pay only for what you use) |
| Monthly free credit | None | None |

**There is no free monthly credit on the pay-as-you-go tier** — you are charged from the first token once billing is enabled. However, costs are genuinely low:

| Roster size | Depth | Typical session cost |
|---|---|---|
| 3–5 agents | brief | ~$0.02–0.05 |
| 5–8 agents | detailed | ~$0.10–0.25 |
| 10 agents | detailed, 5+ rounds | ~$0.30–0.60 |

These costs reflect the reflection round being enabled (the default from v4.6.0). Disabling the reflection round via the sidebar toggle roughly halves the per-round cost by eliminating the two additional API calls per debating agent. Note that with reflections enabled, per-round input token costs grow across a session as generation outputs accumulate — this will improve once issue #16 (incremental compression) is implemented.

**Practical session capacity by roster size:**

A full round (generation + debate + reflection + synthesis + meta-agent) makes approximately 15–36 API calls depending on roster size, number of debate pairs, and whether the reflection round is enabled. The table below assumes reflection is enabled (the default); disable it to revert to the pre-v4.6.0 call counts.

| Roster size | Calls per full round | Rounds per day (no billing) | Rounds per day (billing enabled) |
|---|---|---|---|
| 3 agents | ~12 calls | ~1 | 800+ |
| 5 agents | ~17 calls | ~1 | 580+ |
| 8 agents | ~24 calls | 0–1 | 400+ |
| 10 agents | ~30 calls | 0–1 | 330+ |

Without billing, the RPD limit is the binding constraint — a single 10-agent session can exhaust it. With billing enabled, the RPD limit is 10,000, which is effectively unlimited for research use.

**How to set up billing:**

1. Go to [aistudio.google.com](https://aistudio.google.com) and sign in
2. Click the settings icon → **Billing** → **Enable billing** (or link an existing Google Cloud project with billing)
3. Add a payment method — you are billed at the end of each month for actual usage
4. To guard against unexpected charges, set a **monthly budget alert** in Google Cloud Console → Billing → Budgets & alerts. A cap of $5–10/month is a practical ceiling for typical research use

> **Can the spending cap be set to zero?** Google Cloud budget *alerts* can be set to notify you at $0 of spend, but a hard cap of exactly $0 is not supported — the minimum enforceable cap is $0.01. A $5/month cap with a $1 email alert is the recommended setup.

---

## Saving and exporting

### Example session

Two example session exports are available in the `examples/` directory:

- **`grade-dynamics-4agents-brief-R31.json`** — a 31-round session on climbing grade dynamics with 4 agents at brief depth, reflection round enabled throughout. Costs $1.64 in total; contains 136 research map entries across all four depth/tractability categories. The most mature example of an extended session.
- **`grade-dynamics-r3-handover/`** — a 3-round session with 4 agents at brief depth, including five handover documents generated from selected directions. Demonstrates the handover feature introduced in v4.8.0 and illustrates the duplicate direction problem tracked in [issue #12](https://github.com/DBoocock/research-swarm/issues/12).

Both can be imported directly into the tool (Session log tab → Import) to explore what a session looks like without incurring any API cost.

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

### API key security and privacy

Keys are held only in JavaScript memory for the lifetime of the tab — never written to `localStorage`, `sessionStorage`, cookies, or any other browser storage, and never included in session exports. The only outbound network calls the application makes are to `api.anthropic.com` and `generativelanguage.googleapis.com`. There is no analytics or telemetry. Because the entire application is a single auditable HTML file with no server component, you can verify exactly what happens to your key before running it.

One technical note: Google's Gemini API requires authentication via a URL query parameter (`?key=...`) rather than a request header. All requests are made over HTTPS so the key is encrypted in transit on normal networks. On networks that perform SSL inspection (common in some corporate environments in regulated industries), the full request URL including the key would be visible in proxy logs. If you are on such a network and key confidentiality matters, prefer the Anthropic provider, whose key is sent as a request header. For most users on personal or research networks this is not a concern.

---

## Adapting to a new research domain

The climbing grading system is the default domain, but the swarm is fully domain-agnostic. To adapt it:

1. **Open the brief editor** (click the title) and replace all five fields with content relevant to your domain.

2. **Edit agent mandates** to point each agent's expertise at the new system. The key is ensuring each mandate identifies: the specific frameworks and tools from that discipline, the particular phenomena in your system that those tools would address, and what the agent would argue with other agents about.

3. **Run the roster agent** to check for mandate drift, gaps in coverage, and unexplored overlaps given the new brief.

4. **Consider adding or removing agents** to match the disciplinary landscape of your domain. The + new button and roster agent suggestions are the fastest routes.

### On roster size when starting in a new domain

Resist the temptation to immediately populate a full ten-agent roster. Starting with the 3–5 agents whose frameworks you know best lets you validate that the brief and mandates are producing sensible outputs before expanding — it's much easier to spot a weak mandate in a familiar discipline than an unfamiliar one. Once the brief is stable and the initial rounds look productive, the roster agent is well-suited to the expansion step: it can survey what's missing and suggest new agents with draft mandates grounded in the current brief.

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
All brief fields are concatenated into a single cached block sent with every generation and debate call. **The combined brief must exceed 2,048 tokens** to qualify for caching on Claude Sonnet 4.6 — this is the model-specific minimum, not the 1,024 figure sometimes cited for older models. If the threshold is not met, the API silently skips caching with no error, and every call pays full input price. The default climbing grading brief is ~2,300 tokens, giving a comfortable 250-token margin. Cache TTL is 5 minutes.

### Writing a brief that keeps costs down
The brief is the largest single cost driver in the tool. Two principles apply:

**Keep it above the caching threshold.** The combined brief (problem context + research context + available data) must exceed 2,048 tokens (~8,000 characters) for Sonnet 4.6. Below this threshold every call pays full input price; above it the brief costs ~10× less per call after the first. If your brief is short, expand the research context with genuine domain knowledge — benchmark examples, prior theoretical frameworks, specific empirical observations. This both activates caching and improves agent output quality.

**Don't pad unnecessarily beyond ~3,000 tokens.** The cache write fee is charged once per session start. Larger briefs cost more to write and more to read (at cache-read rates). A brief of 2,300–2,800 tokens is the practical sweet spot: comfortably above the threshold, comprehensive enough to anchor all agents, not so large that the cache-read cost per call becomes significant.

**Mandates are billed at full price per call** — they are intentionally kept outside the cached block so that editing one agent's mandate does not invalidate the shared cache for all other agents. Keep individual mandates under ~300 tokens (~1,200 characters) each.

### Primer-then-parallel generation (Anthropic path only)
Cache entries only become available after a response begins streaming — they are not available for concurrent parallel requests. To exploit this, agent[0] runs alone first (writing the cache), then agents[1–N] run in parallel (reading from the warm cache). This adds the latency of one serial agent call at the start of each generation round but saves ~90% of the brief input cost for all subsequent agents. On the Gemini path there is no prompt caching, so all agents fire in true parallel immediately — no primer, no sequencing overhead.

### Mandate as uncached second block
The agent mandate follows the cached brief as a separate, uncached block. Editing one agent's mandate does not invalidate the shared cache for other agents' calls. All ten agents share a single cache entry, written once and read nine times per generation round.

### Debate batching
When an agent is assigned multiple debate partners, all debates are batched into a single API call. The agent receives all partner outputs in one user message and responds to each in a labelled section. This reduces API calls proportionally to the number of multi-partner agents (e.g. an agent with 3 partners: 3 calls → 1 call).

### Incremental synthesis compression

For post-debate synthesis, generation outputs are compressed before being passed to the synthesis agent — keeping the synthesis input bounded regardless of how many rounds have accumulated. Compression is incremental: a per-agent compressed summary is maintained in state and updated each round by compressing only the new content since the last run. Initial generation blocks are compressed to ~80 words; each reflection-extended directions block is compressed to ~60 words and appended. Two separate batched calls run per synthesis — one for agents needing initial compression, one for agents with a new extension to compress. The compression model always sees a bounded input; the summary grows linearly across rounds. Debate outputs are passed to synthesis at full length. This prevents synthesis input from growing unboundedly while preserving the chronological progression of each agent's thinking.

### Haiku for low-reasoning tasks
Generation compression and mandate generation use Haiku (~3× cheaper than Sonnet for input and output tokens). These are simple summarisation and drafting tasks where reasoning depth does not affect quality.

### Tightly constrained synthesis prompt
The synthesis prompt specifies exact word limits per section (60 / 80 / 50 / 40 words for the prose sections, short titles only for research directions, 15-word field caps for contradictions). This reduces synthesis output from ~2,900 tokens to ~600–800 tokens — a saving of roughly $0.03 per synthesis call at Sonnet rates. The `max_tokens` for synthesis is set to 1,500 to provide headroom above the constrained output size.

### Smart generation — only new agents
After the first round, the generation button only runs agents with no existing output. Newly added agents get their initial generation without re-running agents who have already contributed. If all agents already have outputs, the button redirects to the debate tab. This means generation outputs persist between debate rounds and are only cleared at the very start of a fresh session.

---

## Architecture

The entire application is a single HTML file with no external dependencies beyond:
- Google Fonts (DM Mono, Instrument Serif) — loaded from `fonts.googleapis.com`
- The active API provider — either the Anthropic API (using the `anthropic-dangerous-direct-browser-access: true` header) or the Google Gemini API (key sent as a URL query parameter)

There is no build step, no bundler, no package manager, and no server-side component. All state is held in memory in the browser tab. The application can be served from a local filesystem, a static file host, or GitHub Pages.

### API calls made during a session

| Call type | Anthropic model | Gemini model | Caching (Anthropic) | Gemini parallelism |
|---|---|---|---|---|
| Generation (per agent) | Sonnet 4.6 | 2.5 Flash | ✅ Cached brief | Parallel |
| Debate (per responding agent) | Sonnet 4.6 | 2.5 Flash | ✅ Cached brief | Parallel |
| Reflection (per debating agent) | Sonnet 4.6 | 2.5 Flash | ✅ Cached brief | Parallel |
| Generation extension (per debating agent) | Sonnet 4.6 | 2.5 Flash | ✅ Cached brief | Sequential within agent |
| Generation compression — initial blocks (batched) | **Haiku 4.5** | 2.5 Flash Lite | ✅ Cached brief | — |
| Generation compression — extension blocks (batched) | **Haiku 4.5** | 2.5 Flash Lite | ✅ Cached brief | — |

On the Anthropic path, agent[0] runs alone first to write the prompt cache, then all remaining agents run in `Promise.all` reading from it. On the Gemini path, all agents fire in true parallel with no delays — prompt caching is Anthropic-specific and is not used on the Gemini path. Within each agent's reflection pipeline, Call 1 (Reflection) must complete before Call 2 (Generation extension) starts — agents run in parallel with each other, but the two calls within each agent are sequential.
| Synthesis | Sonnet 4.6 / **Opus 4.6** | Cached brief only | ✅ Cached brief |
| Meta-agent | Sonnet 4.6 / **Opus 4.6** | Plain string | ❌ |
| Roster agent | Sonnet 4.6 / **Opus 4.6** | Cached brief | ✅ Cached brief |
| Mandate generation | **Haiku 4.5** | Plain string | ❌ |
| Mandate auto-apply correction | **Haiku 4.5** | Plain string | ❌ |

### Models

Generation, debate, reflection, and generation extension use `claude-sonnet-4-6` — these all require genuine reasoning. Synthesis, meta-agent, and roster agent use Sonnet by default, switchable to `claude-opus-4-6` via the sidebar toggle. Generation compression and mandate generation use `claude-haiku-4-5-20251001`. All model strings are defined in the `MODELS` constant and can be changed there.

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

## Related work and context

Research Swarm applies a well-established approach — multi-agent debate among agents with heterogeneous disciplinary personas — to the problem of theoretical research ideation. This space is active and well-populated. Researchers should be aware of the following comparable systems before deciding whether Research Swarm fits their needs:

| System | Approach | Key difference from Research Swarm |
|---|---|---|
| [Perspectra](https://arxiv.org/abs/2509.20553) (UIUC / Allen AI, 2025) | Forum-style multi-agent deliberation among user-chosen expert personas, with mind-map visualisation and empirical user study | Academically evaluated; richer visualisation UI; requires a server or hosted deployment |
| [IDVSCI](https://arxiv.org/abs/2506.18348) | Dynamic knowledge exchange and dual-diversity review among heterogeneous agents | Automated pipeline with no human steering of individual rounds |
| [The AI Scientist](https://github.com/SakanaAI/AI-Scientist) (Sakana AI) | Fully automated research lifecycle: ideation → experiments → manuscript | Requires Linux, NVIDIA GPU, conda environment; targets ML research specifically |
| [SciAgents](https://pmc.ncbi.nlm.nih.gov/articles/PMC12138853/) | Multi-agent graph reasoning for materials science ideation | Domain-specific; automated; no human-in-the-loop |
| [ResearchAgent](https://arxiv.org/abs/2404.07738) (Baek et al., 2024) | Knowledge-augmented single agent for idea generation and refinement | Single agent; literature-grounded; requires backend infrastructure |

**Where Research Swarm sits differently**: it is human-in-the-loop by design (the researcher reviews and steers every round rather than receiving a fully automated output), runs as a single HTML file in the browser with no infrastructure, is domain-agnostic via an editable brief, and is cost-aware by architecture. These are practical rather than conceptual distinctions — the underlying multi-agent debate approach is shared with the academic literature.

**Current limitations**: the tool has not been systematically evaluated against single-agent baselines or compared to the systems above. It is not known whether the debate round adds value over generation alone, or how output quality scales with roster size and session length. These are open questions — see [issue #3](https://github.com/DBoocock/research-swarm/issues/3). If you use the tool for research, your feedback on what works and what doesn't is genuinely useful and is currently the primary source of evidence about its value.

---

## AI disclosure

Research Swarm is a tool that calls an AI language model API to run agents. Depending on the selected provider, all reasoning in a swarm session is performed either by Claude (`claude-sonnet-4-6` via the [Anthropic](https://www.anthropic.com) API) or by Gemini (`gemini-2.5-flash` via the [Google Gemini](https://ai.google.dev) API).

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
- Evaluation methodology for comparing swarm outputs against single-agent baselines

> **Note**: Session state persistence via localStorage is explicitly out of scope — explicit export/import is a design principle, not a gap. See the *No localStorage for session state* principle in CONTRIBUTING.md.
