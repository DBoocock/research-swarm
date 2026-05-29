## Co-evolution of latent difficulty and grade consensus via dynamic Bayesian modeling

**Category:** DEEP+TRACTABLE | **First identified:** Round 3

### Research background
The co-evolution of latent difficulty and grade consensus sits at the intersection of several fundamental challenges in understanding community-driven grading systems. A central tension, highlighted in Round 1 and Round 3, is whether a "true" grade is a fixed, scalar quantity ($G_{target}$) that the consensus grade ($C_t$) asymptotically approaches, or if this "true" grade is itself dynamic and emergent, shaped by the very voting process it purports to measure. The Stochastic Process Modeler (Round 1) initially proposed a fixed $G_{target}$ but was challenged by the Dynamical Systems agent (Round 3 Debate) who argued $G_{target}$ *is* the consensus grade, making it self-referential. The Bayesian Inference agent (Round 3 Debate) further questioned the scalar nature of difficulty, suggesting rank-reversal effects imply multidimensionality.

Anchoring (social herding) is a widely acknowledged mechanism influencing individual grade proposals ($P_{i,r,t}$) toward the existing consensus (Convergences, Round 1, 2, 3). However, the precise empirical magnitude of this anchoring coefficient (Open Question 1) remains unknown. Similarly, individual climber biases ($\beta_i$) are known to exist, but their evolution and interaction with the consensus dynamics (Bayesian Inference vs. Dynamical Systems tension, Round 1) are not fully understood. The system also exhibits discrete grade bands (e.g., 6a, 6a+), which are emergent rather than fixed, with specific coveted grades (7a, 8a) potentially acting as attractors or points of distortion (Open Question 4, Convergences, Round 2, 3). This discrete output from an underlying continuous process further complicates modeling.

The problem is one of dynamic inference in a self-referential system where the observed "measurements" (personal grade proposals) are influenced by the very quantity they are trying to estimate (consensus grade), which is itself a function of past measurements. This creates a feedback loop that necessitates a model capable of simultaneously tracking latent states (difficulty, individual bias) and their dynamic interactions.

```mermaid
graph TD
    A[Climber $i$ has latent Ability $A_i$] --> B{Climber attempts Route $r$};
    D[Route $r$ has latent Difficulty $D_r(t)$] --> B;
    C[Consensus Grade $C_{r}(t)$] --> E[Climber's Perception of $D_r(t)$];
    E --> F[Personal Grade Proposal $P_{i,r,t}$];
    F --> G[Weighted Average of Proposals];
    G --> C;
    A --> F;
    D --> E;
    H[Regional Grading Culture $\theta_{reg}$] --> D;
    I[Coveted Grade Thresholds] --> E;

    subgraph "Dynamic Feedback Loop"
        C -- influences --> E
        F -- updates --> G
        G -- forms --> C
    end
    subgraph "Individual Factors"
        A
        E
        F
    end
    subgraph "Route Factors"
        D
        H
    end
    subgraph "Systemic Factors"
        I
    end
```

### Direction proposal
This direction proposes a Dynamic Hierarchical Bayesian Ordinal Probit model to infer the co-evolution of latent route difficulties and the consensus grade. The model will treat individual grade proposals ($P_{i,r,t}$) as ordinal outcomes from a latent continuous perceived difficulty, conditioned on the climber's ability, individual bias, the route's current consensus grade (anchoring), regional grading culture, and time-varying latent difficulty.

The core formulation for an individual $i$'s grade proposal $P_{i,r,t}$ for route $r$ at time $t$ will be modelled as an ordinal outcome of a latent continuous variable $\tilde{P}_{i,r,t}$. We will assume that $\tilde{P}_{i,r,t}$ follows a linear model structure:
$$ \tilde{P}_{i,r,t} = \delta_r(t) + \beta_i + \gamma_i(A_i, \delta_r(t)) + \alpha \cdot C_{r,t} + \theta_{reg} + \epsilon_{i,r,t} $$
where:
*   $\delta_r(t)$ is the latent, time-varying "true" difficulty of route $r$. This is a key departure from static models, acknowledging that perceived difficulty may shift, or the *interpretation* of difficulty may evolve.
*   $\beta_i$ is a latent individual climber bias, drawn from a hierarchical distribution (e.g., $\mathcal{N}(\mu_\beta, \sigma_\beta^2)$).
*   $\gamma_i(A_i, \delta_r(t))$ represents a non-linear interaction capturing the psychophysical sensitivity effect (hyposensitivity at extremes, hypersensitivity near max effort) based on climber ability $A_i$ and $\delta_r(t)$. This term might involve a Gaussian Process or a spline.
*   $\alpha$ is the anchoring coefficient, representing the strength with which the current consensus grade $C_{r,t}$ biases individual proposals.
*   $\theta_{reg}$ is a hierarchical parameter representing the baseline adjustment for regional grading culture.
*   $\epsilon_{i,r,t} \sim \mathcal{N}(0, \sigma^2)$ is i.i.d. noise.

The observed discrete grade $P_{i,r,t}$ is generated from $\tilde{P}_{i,r,t}$ via a set of ordered thresholds $\kappa_k$:
$$ P_{i,r,t} = k \quad \text{if} \quad \kappa_{k-1} < \tilde{P}_{i,r,t} \le \kappa_k $$
Crucially, these thresholds $\kappa_k$ will be data-driven and allowed to cluster around coveted grade boundaries (e.g., 7a, 8a), rather than being fixed.

The latent route difficulty $\delta_r(t)$ and consensus grade $C_{r,t}$ will co-evolve. $\delta_r(t)$ will follow a dynamic process, possibly an autoregressive model or a continuous-time Ornstein-Uhlenbeck process, where its evolution is influenced by the aggregated proposals over time. The consensus grade $C_{r,t}$ is itself updated by a weighted average of personal proposals, forming a feedback loop:
$$ C_{r,t+1} = (1-\lambda_t) C_{r,t} + \lambda_t \cdot \frac{\sum_{i \in \mathcal{A}_t} w_i P_{i,r,t}}{\sum_{i \in \mathcal{A}_t} w_i} $$
where $\mathcal{A}_t$ is the set of ascents at time $t$, $w_i$ are weights (e.g., inverse variance of individual climber's proposals, or flat), and $\lambda_t$ is a time-varying parameter reflecting the rate of consensus update, potentially higher for newer routes or during periods of active discussion.

```mermaid
graph TD
    A[Observed: Personal Grade $P_{i,r,t}$] --> B{Ordinal Probit Link};
    B --> C[Latent Perceived Difficulty $\tilde{P}_{i,r,t}$];
    C -- "Generated by" --> D[Latent Route Difficulty $\delta_r(t)$];
    C -- "Generated by" --> E[Individual Bias $\beta_i$];
    C -- "Generated by" --> F[Ability-Sensitivity $\gamma_i(\cdot)$];
    C -- "Generated by" --> G[Anchoring Term $\alpha \cdot C_{r,t}$];
    C -- "Generated by" --> H[Regional Effect $\theta_{reg}$];
    C -- "Generated by" --> I[Noise $\epsilon_{i,r,t}$];

    subgraph "Hierarchical Structure"
        E -- "from" --> E_H[Population distribution for $\beta$];
        F -- "from" --> F_H[Population distribution for $\gamma$ parameters];
        H -- "from" --> H_H[Spatial hierarchy for $\theta_{reg}$];
    end

    subgraph "Time Dynamics"
        D -- "evolves as" --> D_T[State-space model for $\delta_r(t)$];
        G --> C_T[Consensus Grade $C_{r,t}$];
        C_T -- "updates via" --> A_agg[Aggregated Proposals];
        A_agg -- "from" --> A;
        D_T -- "influenced by" --> C_T;
        C_T -- "influences" --> D_T;
    end

    subgraph "Key Parameters to Estimate"
        alpha_p[$\alpha$ Anchoring Coeff