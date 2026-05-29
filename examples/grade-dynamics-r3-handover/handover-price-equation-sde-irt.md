## Disentangling grade inflation drivers using Price equation decomposition and SDEs

**Category:** DEEP+TRACTABLE | **First identified:** Round 3

### Research background
The phenomenon of "grade inflation" (or deflation) in rock climbing difficulty grading systems is a persistent observation, yet its underlying mechanisms remain unresolved. The research swarm has identified several potential drivers:
1.  **Selection Bias:** Changes in the composition of climbers attempting a route. If routes become accessible to stronger climbers over time, their systematically lower grade proposals (due to the psychophysical "moderate comfort zone" effect, as described in the system brief) could drive the consensus grade down. Conversely, if routes become relatively harder for the average population due to skill drift, grades might inflate.
2.  **Transmission Bias (Anchoring/Social Herding):** Individual grade proposals are not independent estimates of intrinsic difficulty but are systematically biased by the existing consensus grade and recent proposals. This anchoring effect, also known as social herding, suggests that the consensus itself influences future proposals, potentially leading to a self-reinforcing drift irrespective of changes in climber ability.
3.  **Coveted Grade Attractors:** Specific grades (e.g., 7a, 8a) are particularly desirable. This may lead to clustering of proposed grades around these thresholds and potentially "sticky" dynamics where grades resist moving past them or are pulled towards them. This could introduce non-linearities and biases distinct from continuous anchoring effects.
4.  **Individual Bias:** Climbers exhibit systematic tendencies to over-grade or under-grade, which could contribute to overall drift if the distribution of these biases in the active climbing population shifts.
5.  **Regional Grading Cultures:** Systematic differences in average grading between regions, which can interact with global trends.

A key tension identified in the Synthesis History (Round 1, Stochastic Process Modeler vs Evolutionary Dynamics) is whether grade inflation is primarily a "diffusion phenomenon amplified by non-uniform sampling" (Stochastic Process Modeler) or driven by "transmission bias or selection bias" (Evolutionary Dynamics). This direction directly addresses this tension by employing the Price equation, a framework from evolutionary biology, to formally decompose the total change in consensus grade into these distinct components. This approach combines with Stochastic Differential Equations (SDEs) to model the continuous-time evolution of the consensus grade under these influences, acknowledging the inherent noise and stochasticity of individual proposals.

The system can be conceptualized as a co-evolutionary process where climber abilities and route grades influence each other, mediated by social transmission.

```mermaid
graph TD
    A[Climber Population Ability Distribution] --> B{Individual Climber's Perceived Difficulty}
    B --> C[Personal Grade Proposal]
    C -- Anchoring/Social Herding --> D(Consensus Grade History)
    D --> C
    C --> E[Consensus Grade Update]
    E -- Selection Bias (who attempts) --> A
    E -- Grade Inflation/Deflation --> F[Overall Grade Scale Drift]
    F -- Regional Culture/History --> B
    SubGraph External Factors
        G[Route Popularity/Quality] --> E
        H[Weather/Conditions] --> B
        I[Regional Grading Culture] --> B
    End
```

### Direction proposal
This research direction proposes to formally disentangle the contributions of selection bias and transmission bias (anchoring) to observed grade inflation or deflation using a combination of the Price equation and Stochastic Differential Equations (SDEs). The core idea is to treat the consensus grade of a route as an evolving "phenotype" and individual grade proposals as observations or "reproductions" of this phenotype, subject to both intrinsic climber ability and social influence.

The central research question is: What is the relative empirical magnitude of selection bias (changes in the average ability of climbers attempting a route) versus transmission bias (the anchoring effect of the existing consensus grade on new proposals) in driving observed grade inflation/deflation?

We will adapt the discrete-time Price equation to a continuous-time framework for the evolution of the consensus grade $\bar{G}_t$ for a given route $r$. The Price equation for the change in mean phenotype $\bar{z}$ in a population over one generation is typically given by:
$$ \Delta \bar{z} = \frac{1}{\bar{w}} \text{Cov}(w, z) + \frac{1}{\bar{w}} E[w \Delta z] $$
where $\bar{z}$ is the mean trait value, $w$ is fitness, $\text{Cov}(w, z)$ is the covariance between fitness and trait value, and $E[w \Delta z]$ is the expected fitness-weighted change in the trait value due to transmission bias (mutation/reproduction fidelity).

For our climbing grade system, the "population" refers to the set of recent grade proposals for a given route. The "trait" is the proposed grade, and "fitness" can be implicitly defined by the weight given to a proposal in the consensus update.
Let $G_{r,t}$ be the consensus grade for route $r$ at time $t$. Let $P_{i,r,t}$ be the personal grade proposed by climber $i$ for route $r$ at time $t$. The consensus grade update can be written as:
$$ G_{r, t+\Delta t} = (1-\alpha) G_{r,t} + \alpha P_{i,r,t} $$
where $\alpha$ is a weighting factor for a new proposal. For a continuous-time SDE formulation, we consider infinitesimal updates.

The continuous-time Price equation for grade evolution $\frac{d\bar{G}}{dt}$ will decompose into:
$$ \frac{dG_{r,t}}{dt} = \beta_{selection} \cdot \frac{d\bar{A}_{r,t}}{dt} + \beta_{transmission} \cdot (G_{target} - G_{r,t}) + \sigma \xi_t $$
where:
*   $\frac{d\bar{A}_{r,t}}{dt}$ represents the change in the average ability of climbers attempting route $r$ over time (selection bias component).
*   $(G_{target} - G_{r,t})$ represents the "pull" towards a latent true or reference grade $G_{target}$ (or average of recent proposals), reflecting transmission bias (anchoring) if $G_{target}$ itself is influenced by previous consensus.
*   $\beta_{selection}$ and $\beta_{transmission}$ are coefficients to be estimated, representing the magnitude of each driving force.
*   $\sigma \xi_t$ is a stochastic noise term, where $\xi_t$ is a white noise process, reflecting the inherent variability and measurement noise in individual proposals. $\sigma$ may be state-dependent, reflecting the variance of proposals.

This approach integrates the continuous dynamics of SDEs with the decomposition power of the Price equation.

The analytical pipeline involves:
1.  **Estimating Climber Ability:** Infer individual climber abilities $A_i$ using a Hierarchical Bayesian Item Response Theory (IRT) model (as suggested by Bayesian Inference, Round 1). This is crucial for quantifying $\bar{A}_{r,t}$.
2.  **Modeling Personal Grade Proposals:** Model individual proposals $P_{i,r,t}$ as a function of $A_i$, $G_{r,t}$, and individual bias $\epsilon_i$, and potentially $G_{target}$ (representing the "true" grade, or the average of proposals if $G_{target}$ is emergent).
3.  **SDE Formulation and Parameter Estimation:** Formulate the consensus grade evolution as an SDE and estimate $\beta_{selection}$, $\beta_{transmission}$, and $\sigma$ using a state-space model or approximate Bayesian computation (ABC) on the observed time series of consensus grades and inferred average climber abilities.

```mermaid
graph TD
    A[Raw Ascent Data: Climber ID, Date, Personal Grade, Consensus Grade] --> B{Hierarchical Bayesian IRT Model}
    B --> C[Inferred Climber Ability (A_i)]
    B --> D[Inferred Route Latent Difficulty (G_target_r)]
    C --> E[Calculate Time-Varying Average Climber Ability per Route (A_bar_r,t)]
    D --> F[Consensus Grade Time Series (G_r,t)]
    F --> G[Estimate Anchoring Coefficient from Personal Proposals]
    G --> H{SDE & Price Equation Decomposition Model}
    E --> H
    H --> I[Estimate beta_selection]
    H --> J[Estimate beta_transmission (anchoring)]
    H --> K[Estimate sigma (proposal variance/noise)]
    H --> L[Decomposition of Grade Inflation/Deflation]
    L --> M[Quantify Relative Contributions]
```

### Why this direction
This direction is scientifically promising because it directly tackles a central, unresolved question: the drivers of grade inflation (Open Question 2). It resolves a key tension from Round 1 (Stochastic Process Modeler vs Evolutionary Dynamics) by explicitly decomposing the overall grade change into components attributed to selection and transmission bias, rather than viewing them as competing explanations.

*   **Addresses Contradictions:**
    *   **Stochastic Process Modeler vs Evolutionary Dynamics (Round 1):** This direction