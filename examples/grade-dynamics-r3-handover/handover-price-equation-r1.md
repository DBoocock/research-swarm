## Decomposing Grade Inflation/Deflation into Selection vs. Transmission Bias via Price Equation

**Category:** DEEP+TRACTABLE | **First identified:** Round 1

### Research background
The phenomenon of grade inflation or deflation—the systematic drift of route difficulty grades over time—is a central, unresolved problem in the dynamics of community grading systems. This problem is explicitly identified as Open Question 2: "Is grade inflation primarily driven by selection bias (harder climbers systematically proposing lower grades as routes become accessible) or by anchoring/transmission bias in grade proposals?" Understanding the underlying mechanisms is crucial for developing robust and stable grading systems.

The swarm identified two primary candidate mechanisms for grade drift:
1.  **Selection Bias:** Changes in the population of climbers attempting a route. As routes become more popular or accessible to a wider range of abilities, the average ability of climbers attempting them might shift. If more skilled climbers attempt routes initially graded by less skilled climbers (or vice-versa), their personal grade proposals could systematically shift the consensus. This is related to the systematic selection bias noted in the system description: "harder routes exclude lower-ability climbers from voting."
2.  **Transmission Bias (Anchoring):** The influence of existing grades and recent proposals on new personal grade proposals. Climbers are known to be biased by the known consensus grade (anchoring) and recent proposals (social herding). This mechanism describes how the current consensus "pulls" future proposals, leading to systematic shifts even if the underlying objective difficulty perception remains stable. This is explicitly recognized as a "critical force" by multiple agents (Round 2 Synthesis).

These two mechanisms are not mutually exclusive and likely interact. The tension between the Stochastic Process Modeler (Round 1) attributing grade inflation to "diffusion from skewed ability" (selection bias) and the Evolutionary Dynamics agent (Round 1) attributing it to "transmission bias or selection bias" highlights the need for a formal decomposition.

A foundational challenge is the conceptualization of a "grade." Bayesian Inference (Round 3) suggests the "true" grade is dynamic and emergent, while Stochastic Process models (Round 3) sometimes assume a latent "true" grade. This direction approaches grades as a "phenotype" within a cultural evolutionary framework, where the consensus grade for a route, or the average grading "norm" of a community, can be seen as evolving over time.

The system dynamics are complex, involving individual-level psychological biases (anchoring, hypo/hypersensitivity), population-level shifts (climber ability distribution), and spatio-temporal effects (regional cultures, historical drift). Disentangling these factors is essential.

```mermaid
graph TD
    subgraph System Dynamics
        A[Climber Ability Distribution] -- Selection Bias --> C(Personal Grade Proposals)
        B[Consensus Grade History] -- Transmission Bias (Anchoring) --> C
        C -- Individual Biases (Hypo/Hypersensitivity) --> D(Aggregated Proposals)
        D -- Running Average Update --> B
        E[Route Popularity/Quality] -- Modulates --> A & B
        F[Regional Grading Culture] -- Influences --> C
        G[Historical Drift] -- Modifies --> F
    end

    subgraph Research Focus (Price Equation)
        H[Change in Mean Grade]
        I[Selection Component] --&gt; H
        J[Transmission Component] --&gt; H
        K[Covariance(Climber Ability, Proposal Bias)] -- Drives --> I
        L[Expected Shift in Proposal due to Anchoring] -- Drives --> J
    end

    System Dynamics --> Research Focus (Price Equation)
    B --> L
    A --> K
    C --> K & L
```

### Direction proposal
This direction proposes to quantitatively decompose the observed temporal change in consensus route grades (grade inflation/deflation) into two distinct evolutionary components: **selection bias** and **transmission bias**, using a modified Price equation framework. The central research question is to determine the relative empirical magnitude of these two drivers of grade drift.

Let $G_t$ be the consensus grade of a specific route at time $t$. We are interested in its change $\Delta G_t = G_{t+1} - G_t$.
The Price equation, typically used in evolutionary biology, describes the change in the average value of a trait (or "phenotype") in a population across generations. Here, we adapt it to track the evolution of a "grade phenotype" for a specific route. Each ascent can be considered a "reproductive event" in the context of grade evolution.

Let $g_{i,t}$ be the personal grade proposed by climber $i$ for a route at time $t$, and let $C_{t}$ be the consensus grade for that route at time $t$. Let $A_{i,t}$ be a measure of climber $i$'s ability *relative to the route's current consensus grade* at time $t$.

The average grade of a route at time $t+1$ is typically an average of proposals from a set of climbers who successfully ascended the route.
$$ \bar{G}_{t+1} = \sum_{i \in \mathcal{A}_{t+1}} w_i g_{i,t+1} $$
where $\mathcal{A}_{t+1}$ is the set of climbers attempting the route between $t$ and $t+1$, and $w_i$ are weights (e.g., $1/|\mathcal{A}_{t+1}|$ for simple averaging).

The change in the mean consensus grade ($\Delta \bar{G}$) can be decomposed using an adapted Price equation into components representing selection and transmission. A common form of the Price equation is:
$$ \Delta \bar{G} = \text{Cov}(w_i, g_{i,t}) + E(w_i \Delta g_{i,t}) $$
Here, we'll adapt it to the continuous updating nature of grading, focusing on the average grade change per "generation" of ascents (i.e., between $t$ and $t+1$).

Let $p(i|t)$ be the probability that climber $i$ attempts a route at time $t$. The population of climbers is dynamic.
The core decomposition for the change in the *mean proposed grade* for a route $\bar{g}_{t}$ can be formulated as:
$$ \Delta \bar{g} = \underbrace{\frac{1}{N_{t+1}} \sum_{i=1}^{N_{t+1}} \left( g_{i,t} - \bar{g}_{t} \right)}_{\text{Selection Component}} + \underbrace{\frac{1}{N_{t+1}} \sum_{i=1}^{N_{t+1}} \left( g_{i,t+1} - g_{i,t} \right)}_{\text{Transmission Component}} $$
This form focuses on the change in the *mean of individual proposals* rather than the consensus itself, which is a running average. For the consensus grade $C_t$:
The change in consensus grade $\Delta C_t$ can be approximated as:
$$ \Delta C_t \approx \alpha \left( \bar{g}_{t, \text{new proposals}} - C_t \right) $$
where $\bar{g}_{t, \text{new proposals}}$ is the average of new proposals since the last update, and $\alpha$ is a weighting factor for new proposals.

The "selection component" captures changes in the population of climbers who successfully complete and grade the route. For example, if a route becomes more accessible to stronger climbers, their (potentially lower) proposals will drive the average grade down. This is effectively a change in the *composition* of the grading population.
$$ \text{Selection Component} = E_{\text{new}}(g_i) - E_{\text{old}}(g_i) $$
where $E_{\text{new}}(g_i)$ is the expected grade proposal of climbers active in the new time interval, and $E_{\text{old}}(g_i)$ is that of the previous interval. This can be further related to climber ability: if stronger climbers (who might systematically propose lower grades due to their comfort zone) replace weaker climbers, this is selection.

The "transmission component" captures the systematic change in individual grade proposals over time, *given the same population of climbers*. This is primarily driven by anchoring: how the existing consensus grade $C_t$ (and recent proposals) influences $g_{i,t+1}$ relative to $g_{i,t}$. If climber $i$ is biased to propose a grade closer to $C_t$, and $C_t$ itself has drifted, this is transmission.
$$ \text{Transmission Component} = E_{\text{new}}(g_{i,t+1} - g_{i,t}) $$
This component reflects how individual "phenotypes" (personal grade proposals) change due to social learning or adaptation to the current environment (the consensus).

The proposed analytical pipeline is:
1.  For each route, identify "generations" of ascents (e.g., time bins, or sequential blocks of $N$ ascents).
2.  For each generation, calculate the mean proposed grade, the mean ability of the ascenders, and the change in individual proposals.