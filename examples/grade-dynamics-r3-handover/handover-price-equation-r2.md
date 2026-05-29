## Price Equation Decomposition for Grade Inflation: Selection vs. Transmission Bias

**Category:** DEEP+TRACTABLE | **First identified:** Round 2

### Research background
The dynamics of rock climbing difficulty grading systems are characterized by a complex interplay of individual perceptions, social influences, and demographic shifts. Routes are graded by individual climbers, leading to a community consensus that evolves over time. A central phenomenon observed in these systems is "grade inflation" or "deflation," where the perceived difficulty of a given numerical grade shifts over historical periods. This direction aims to disentangle the underlying mechanisms driving such grade drift.

Existing frameworks from the session highlight two primary candidate mechanisms for grade inflation (Round 1, Synthesis Convergences, and Tensions):
1.  **Selection Bias (or Climber-Ability Selection):** Harder routes attract a disproportionate number of more skilled climbers. If these climbers systematically propose lower grades due to their higher ability (or due to the "hypersensitivity" effect where very hard climbs for them feel like insurmountable effort, potentially leading to under-grading relative to their overall ability), this could drive down the consensus grade over time. Conversely, if lower-ability climbers are excluded from voting on harder routes, the average ability of those voting on such routes is higher, which could also lead to a different type of bias in proposals. The `Stochastic Process Modeler` (Round 1, Initial Generation) initially suggested that grade inflation is "diffusion from skewed ability."
2.  **Transmission Bias (or Anchoring/Social Herding):** Individual grade proposals are not made in a vacuum but are influenced by the existing consensus grade and recent proposals. This anchoring effect (Round 1, Synthesis Convergences) can lead to a 'herding' behavior, where deviations from the current norm are systematically pulled back towards it or amplified in a specific direction. The `Bayesian Inference` (Round 1, Initial Generation) and `Dynamical Systems` (Round 1, Initial Generation) agents consistently emphasized anchoring as a key mechanism.

A significant tension (Round 1, Contradiction Tracker) emerged between the `Stochastic Process Modeler` and `Evolutionary Dynamics` agent regarding the primary driver of grade inflation: "Grade inflation is diffusion from skewed ability" vs. "Grade inflation is selection or transmission bias." The proposed resolution was to "decompose using Price equation." This direction directly addresses that need, aiming to quantify the relative contributions of these two broad categories of bias.

The system's underlying structure, as described in the brief, includes heterogeneous climbers, selection bias in voting, anchoring in proposals, self-reinforcing route popularity, and varying psychophysical sensitivity to difficulty, all of which contribute to the observed dynamics. The French sport grading scale, with its discrete bands and coveted thresholds, further complicates this by introducing potential non-linearities in how difficulty translates to a grade.

```mermaid
graph TD
    A[Climber Ability Distribution] --> B{Route Selection Bias: Only successful climbers propose grades}
    B --> C[Set of Climbers Proposing for Route R]
    C --> D[Individual Climber $i$ proposes grade $G_{i,R,t}$]
    D -- "Anchoring/Herding" --> E[Consensus Grade $C_{R,t}$]
    E -- "Updated Consensus" --> F[New Consensus $C_{R,t+1}$]
    G[Route Popularity] --> C
    G --> E
    H[Climber $i$ Bias ($b_i$)] --> D
    I[Psychophysical Sensitivity] --> D
    J[Coveted Grade Thresholds] --> D
    F --> B
    F --> J
    subgraph Drivers of Grade Drift
        S[Selection Bias: Change in mean ability of proposing population]
        T[Transmission Bias: Systematic shift in proposals relative to consensus, e.g., anchoring]
    end
    C --> S
    D --> T
    S & T --> F
```

### Direction proposal
This direction proposes to utilize the Price Equation, a fundamental equation in evolutionary dynamics, to formally decompose the observed change in a route's consensus grade ($\Delta C$) into components attributable to (1) selection bias, i.e., changes in the average ability of climbers who successfully complete and grade a route over time, and (2) transmission bias, i.e., systematic shifts in individual grade proposals relative to the existing consensus, accounting for social herding/anchoring.

The central research question is: What is the relative empirical magnitude of selection bias versus transmission bias in driving grade inflation or deflation in community rock climb difficulty grading systems?

The Price Equation, in its general form, describes the evolution of the average of a trait within a population. For a trait $z$, the change in its population average $\langle z \rangle$ is given by:
$$
\Delta \langle z \rangle = \text{Cov}(w, z) + \mathbb{E}(w \Delta z)
$$
where $w$ is the fitness of each individual, and $\Delta z$ is the change in the trait value during transmission.

In the context of grade evolution, we adapt the Price Equation as follows:
Let the "trait" be the *personal grade proposal* $G_{p}$ by a climber for a given route, and the "population" be the set of all climbers who successfully ascend and grade a route within a defined time interval. The "mean trait" $\langle G_p \rangle$ is the average of these personal proposals. The "fitness" $w$ is conceptualized as the *contribution* of a personal proposal to the *new consensus grade*.

We define the *consensus grade* for a route $r$ at time $t$ as $C_{r,t}$. When a new climber $i$ ascends route $r$ and proposes a grade $G_{i,r,t}$, the consensus grade is updated. Let the "parent" population be the set of proposals that led to $C_{r,t}$, and the "offspring" population be the set of proposals contributing to $C_{r,t+1}$.

The change in consensus grade for a route $r$ over a discrete time step (e.g., between two successive ascents or within a fixed period) can be represented as:
$$
\Delta C_r = C_{r,t+1} - C_{r,t}
$$
We propose to decompose this change using a Price Equation formulation tailored to the grading system, focusing on the *deviation of individual proposals from the previous consensus* and the *selection of who gets to propose*.

Let $C_{r,t}$ be the consensus grade at time $t$. A new proposal $G_{i,r,t}$ by climber $i$ contributes to the update.
The expected value of the personal grade proposal, given the population of climbers who successfully send the route, can be denoted $\mathbb{E}[G_{i,r,t}]$.

The Price Equation can be adapted to quantify how the average of a variable (e.g., ability or grade proposal) changes in a population over time. Here, we are interested in the evolution of the *consensus grade* itself.

A more direct application, as suggested by the `Evolutionary Dynamics` agent (Round 1, Initial Generation), would be to decompose grade drift ($\Delta G_{consensus}$) into a component due to changes in the population of climbers (selection bias) and a component due to changes in how grades are transmitted (transmission bias/anchoring).

Consider the *mean personal grade proposal* $\bar{G}_{p,t}$ from the pool of climbers successfully ascending the route within a time interval $[t, t+\Delta t]$. The consensus grade $C_t$ evolves towards $\bar{G}_{p,t}$ with some inertia.
Let $\mathcal{A}_t$ be the set of climbers who successfully ascend route $r$ in time interval $(t-\delta t, t]$ and contribute to $C_t$.
Let $\mathcal{A}_{t+\Delta t}$ be the set of climbers who successfully ascend route $r$ in $(t, t+\Delta t]$ and contribute to $C_{t+\Delta t}$.

We can define a "fitness" of a climber's proposal as its contribution to shifting the consensus grade. However, the Price equation is more naturally applied to the evolution of a *trait within a population*.
Let the "trait" be the individual grade proposal $G_{i,r}$ of climber $i$ for route $r$.
Let the "population" be the set of climbers $S_r$ who successfully complete and propose a grade for route $r$ within a given time window.
The average "trait value" in this population is $\bar{G}_r = \frac{1}{|S_r|} \sum_{i \in S_r} G_{i,r}$.
The consensus grade $C_r$ is a running average of these proposals.

A more direct Price Equation decomposition (following `Evolutionary Dynamics` in Round 1) for the change in consensus grade $\Delta C_r$ would consider:
1.  **Selection Component (Selection Bias):** How the *average ability* of climbers successfully sending the route changes over time, and how this change in the *composition of the voting population* affects the average proposed grade. For example, if the route gets "softer"