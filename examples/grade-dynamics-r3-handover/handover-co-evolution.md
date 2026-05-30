## Co-evolution of latent difficulty and grade consensus via dynamic Bayesian modeling

**Category:** DEEP+TRACTABLE | **First identified:** Round 3

### Research background
The co-evolution of latent route difficulty and grade consensus sits at the heart of understanding rock climbing grading systems. The system is characterized by heterogeneous climbers proposing grades for routes, with proposals biased by existing consensus (anchoring) and individual tendencies (bias, skill level). Crucially, only successful ascenders vote, introducing systematic selection bias (Stochastic process modeler, Round 1). The French sport grading scale discretizes a continuous perceived difficulty, but the width and position of these discrete bands are themselves emergent phenomena (System Description).

Previous work, including the Darth Grader framework, suggests a linear relationship between perceived difficulty and grade ($Y = aX + b$), where the intercept $b$ varies regionally, indicating distinct grading cultures (System Description). However, the precise empirical magnitude of anchoring, the relative contributions of selection bias and transmission bias (anchoring) to grade inflation, and whether climbing difficulty is a well-defined scalar quantity or multidimensional, remain open questions (Open Questions 1, 2, 3). Furthermore, coveted grades (7a, 8a) are hypothesized to act as attractors, potentially creating non-monotonic stabilization dynamics or clustering in grade distributions (Open Question 4, Dynamical systems, Round 1).

The core tension lies between models assuming a fixed latent "true" grade (Stochastic process modeler, Round 3 debate with Bayesian inference) and those where "true" difficulty is dynamic and emergent, shaped by collective perception (Bayesian inference, Round 3 synthesis). This direction seeks to reconcile these perspectives by modeling both as interacting dynamic processes.

```mermaid
graph TD
    A[Climber $i$ Ability $A_i$] --> B{Climber $i$ Attempts Route $r$};
    B --> C{Success?};
    C -- Yes --> D[Climber $i$ Proposes Grade $G_{i,r,t}$ at time $t$];
    C -- No --> B;
    D --> E[Consensus Grade $C_{r,t}$];
    E -- Anchoring Bias --> D;
    E -- Updates --> F[Latent Route Difficulty $D_{r,t}$];
    D -- Observation of $D_{r,t}$ --> F;
    F -- Influences --> G[Perceived Difficulty of Route $r$];
    A --> G;
    G -- "Moderate Comfort Zone" effect --> D;
    F -- Feedback --> E;
    F -- Co-evolves with --> E;
    E -- Threshold effects --> H[Coveted Grades 7a, 8a];
    H --> D;
    SubGraph_1[Regional Grading Culture]
        R1[First Ascent] --> E;
        R2[Guidebook Authors] --> E;
        R3[Local Climber Population] --> A;
        R4[Historical Drift] --> E;
    End
    SubGraph_2[Darth Grader Framework]
        DG1[Route Decomposition] --> F;
        DG2[Boulder-Route Conversion] --> F;
        DG3[Rest Quality] --> F;
    End
    A -- Individual Bias --> D;
    style R1 fill:#def,stroke:#fff,stroke-width:0px
    style R2 fill:#def,stroke:#fff,stroke-width:0px
    style R3 fill:#def,stroke:#fff,stroke-width:0px
    style R4 fill:#def,stroke:#fff,stroke-width:0px
    style DG1 fill:#def,stroke:#fff,stroke-width:0px
    style DG2 fill:#def,stroke:#fff,stroke-width:0px
    style DG3 fill:#def,stroke:#fff,stroke-width:0px
```

### Direction proposal
This direction proposes a dynamic hierarchical Bayesian model to investigate the co-evolution of latent route difficulty and the observed grade consensus. The core idea is that neither "true" difficulty nor the consensus grade is static; they influence each other over time. Personal grade proposals are modeled as ordinal outcomes of a latent continuous perceived difficulty, which itself is a function of a latent "true" route difficulty, individual climber bias, and the current consensus grade (anchoring). The "true" route difficulty is permitted to evolve slowly over time, capturing grade drift and re-evaluations, while the consensus grade is a noisy aggregate of proposals. This framework directly addresses the interplay between individual subjective perceptions and collective emergent norms.

The central mathematical formulation models the $k$-th personal grade proposal $G_{i,r,t,k}$ by climber $i$ for route $r$ at time $t$ as an ordinal outcome of a latent continuous perceived difficulty $P_{i,r,t,k}$:
$$
P_{i,r,t,k} = D_{r,t} + \beta_i + \alpha \cdot (C_{r,t-1} - D_{r,t}) + \epsilon_{i,r,t,k}
$$
where:
- $D_{r,t}$ is the latent "true" difficulty of route $r$ at time $t$. This is modeled as a Wiener process (or similar stochastic process) to capture its slow evolution:
  $$
  D_{r,t} \sim \mathcal{N}(D_{r,t-1}, \sigma_D^2)
  $$
- $\beta_i$ is the time-invariant (or slowly varying) individual grading bias for climber $i$, modeled hierarchically across the climber population:
  $$
  \beta_i \sim \mathcal{N}(\mu_\beta, \sigma_\beta^2)
  $$
- $\alpha$ is the anchoring coefficient, representing the strength with which the previous consensus grade $C_{r,t-1}$ pulls the proposed grade towards it. This term effectively models "transmission bias" (Bayesian inference, Round 3 synthesis).
- $C_{r,t-1}$ is the consensus grade of route $r$ at time $t-1$, which acts as an informative prior for new proposals.
- $\epsilon_{i,r,t,k}$ is observation noise, typically $\mathcal{N}(0, \sigma_P^2)$.

The discrete grade proposal $G_{i,r,t,k}$ is generated from $P_{i,r,t,k}$ via an ordinal probit link function with latent cut-points $\theta_j$:
$$
G_{i,r,t,k} = j \quad \text{if} \quad \theta_{j-1} < P_{i,r,t,k} \le \theta_j
$$
These cut-points $\theta_j$ can be data-driven, potentially clustering around coveted grades (Bayesian inference, Round 3 reflection).

The consensus grade $C_{r,t}$ at time $t$ is an updated function of all proposals up to time $t$, and the previous consensus $C_{r,t-1}$:
$$
C_{r,t} = (1-\lambda_t) C_{r,t-1} + \lambda_t \cdot \text{mean}(G_{i,r,t,k} \text{ for ascents at time } t)
$$
where $\lambda_t$ is a learning rate or time-varying weighting of new proposals.

```mermaid
graph TD
    A[Initial Latent Difficulty $D_{r,0}$] --> D_t[Latent Difficulty $D_{r,t}$];
    D_t -- Evolves via Wiener Process --> D_t_plus_1[Latent Difficulty $D_{r,t+1}$];

    C_prev[Consensus Grade $C_{r,t-1}$] --> Anchor[Anchoring Term $\alpha (C_{r,t-1} - D_{r,t})$];
    D_t --> P_latent[Latent Perceived Difficulty $P_{i,r,t,k}$];
    B_i[Individual Bias $\beta_i$] --> P_latent;
    Anchor --> P_latent;
    Noise[Observation Noise $\epsilon_{i,r,t,k}$] --> P_latent;

    P_latent -- Ordinal Probit Link --> G_prop[Personal Grade Proposal $G_{i,r,t,k}$];
    G_prop -- Aggregation --> C_t[Consensus Grade $C_{r,t}$];
    C_t --> C_prev_feedback[C_{r,t} becomes C_{r,t-1} for next step];

    SubGraph_C[Hierarchical Priors]
        beta_mu[Population Mean Bias $\mu_\beta$] --> B_i;
        beta_sigma[Population Std Dev Bias $\sigma_\beta$] --> B_i;
        alpha_prior[Prior on Anchoring $\alpha$] --> Anchor;
        sigma_D_prior[Prior on Difficulty Evolution $\sigma_D^2$] --> D_t;
        sigma_P_prior[Prior on Proposal Noise $\sigma_P^2$] --> Noise;
    End

    style C_prev_feedback fill:#fff,stroke:#fff,stroke-width:0px
```

### Why this direction
This direction is scientifically promising because it directly tackles several core tensions and open questions identified in the synthesis and debates.

1.  **Reconciling Static vs. Dynamic "True" Grade:** It addresses the contradiction between Stochastic Process models assuming a fixed $G_{target}$ and Bayesian/Evolutionary Dynamics views of difficulty as dynamic and emergent (Stochastic Process Modeler vs Evolutionary Dynamics, Round 3). By allowing $D_{r,t}$ to evolve as a latent stochastic process, it explicitly models the "co-evolution" of latent difficulty and observed consensus, rather than assuming one as fixed or an artifact of the other. This allows for disentangling grade inflation driven by genuine changes in perceived difficulty from inflation due to anchoring/transmission bias.

2.  **Integrating Individual Bias and System Dynamics:** The proposed dynamic hierarchical Bayesian model (Bayesian inference, Round 1, Round 2, Round 3) allows for individual biases $\beta_i$ to be estimated as latent parameters while simultaneously modeling their impact on the aggregate consensus dynamics. This resolves the tension between Bayesian Inference viewing biases as stable latent parameters and Dynamical Systems exploring how biases can cause bifurcations (Bayesian Inference vs Dynamical Systems, Round 1). The model can estimate how individual biases contribute to the variance in proposals which, in turn, influences the stability or drift of the consensus.

3.  **Quantifying Anchoring and Its Impact:** The explicit inclusion of the anchoring coefficient $\alpha$ directly addresses Open Question 1 (empirical magnitude of anchoring coefficient). It quantifies the strength of social herding in grade proposals, providing a mechanism for "transmission bias" within a rigorous statistical framework. This moves beyond qualitative descriptions to a precise, empirically estimable parameter.

4.  **Addressing Multidimensionality and Scale Discretization:** The ordinal probit link, combined with the possibility of data-driven thresholds $\theta_j$ (Bayesian inference, Round 3 reflection), offers a flexible way to model the discrete nature of the French grading scale. It allows investigation into whether coveted grades (7a, 8a, Open Question 4) create detectable clustering in these thresholds, or if the underlying continuous difficulty is being distorted by the discrete scale. The debate between Bayesian inference and Stochastic process modeler (Round 3) regarding scalar vs. multidimensional difficulty can be addressed via Bayesian model comparison within this framework.

5.  **Leveraging Available Data:** The model is specifically designed to leverage the `ascentionist identity`, `personal grade proposed`, `consensus grade at time of ascent`, and `date of ascent` fields from the specified databases, making it highly tractable (Open Question 1, 2, 4, 5).

A successful outcome would provide empirically grounded estimates for the anchoring coefficient, quantified individual biases, and a robust model for how perceived difficulties evolve over time. It would also offer insights into the nature of grade thresholds and potentially resolve whether difficulty is best modeled as a scalar or multidimensional quantity. This constitutes a genuine scientific contribution by moving from descriptive observations to a predictive, mechanistic understanding of grading system dynamics.

### Evidence from the session
This direction synthesizes strong contributions from Bayesian inference, Stochastic process modeler, and addresses key points from Dynamical systems:

*   **Bayesian Inference (Round 1, Round 2, Round 3 Reflection):** The core methodological approach of a dynamic hierarchical Bayesian model is driven by Bayesian inference.
    *   Round 1: Proposed "hierarchical Bayesian model to quantify anchoring and individual climber bias by treating personal grade proposals as noisy observations influenced by latent climber biases and the consensus grade." This forms the foundation for estimating $\beta_i$ and $\alpha$.
    *   Round 2: Extended to "dynamic hierarchical Bayesian model for consensus grade evolution. Personal proposals will be modeled with latent 'true' difficulty, individual bias, and a dynamic anchoring term towards the consensus. A non-parametric component will model 'attractors' at coveted grade thresholds". This introduces the time-varying nature and coveted grade considerations.
    *   Round 3: Further refined to a "Dynamic Hierarchical Bayesian Ordinal Probit model... modeling climber bias, regional effects, and anchoring via a time-varying consensus parameter $\lambda_t$, alongside an evolving consensus grade $C_{r,t}$." This specifies the ordinal nature of the proposals and introduces the explicit co-evolution of $D_{r,t}$ and $C_{r,t}$. The suggestion of "data-driven thresholds clustering around coveted grades" is directly incorporated.
    *   Round 3 Debate with Stochastic Process Modeler: Argued against a fixed scalar $G_{target}$ and for "incorporating a Bayesian hierarchical structure for $\beta_i$ and $\tau_i^2$." This directly feeds into the hierarchical modeling of individual biases and allowing $D_{r,t}$ to evolve. The idea of "Bayesian model comparison to test the scalar vs. multidimensional difficulty hypothesis" is also a crucial aspect.

*   **Stochastic Process Modeler (Round 1, Round 2, Round 3 Debate with Bayesian inference):** The dynamic evolution of $D_{r,t}$ and $C_{r,t}$ draws heavily from stochastic process thinking.
    *   Round 1: Proposed "modeling route grade stabilization as a first-passage time problem in a stochastic process, treating the consensus grade's evolution as a random walk." This underlies the time-dependent nature of difficulty and consensus.
    *   Round 2: Proposed to "Extend the SDE model of consensus grade evolution. The drift term will capture anchoring to a latent 'true' grade, while the diffusion term will dynamically reflect the variance and weighting of individual proposals." The proposed $D_{r,t} \sim \mathcal{N}(D_{r,t-1}, \sigma_D^2)$ reflects this SDE-like evolution for the latent difficulty.
    *   Round 3 Debate with Dynamical Systems: Highlighted the concern that "the proposed drift term, $\alpha(G_{target} - G_t)$, implicitly assumes a fixed $G_{target}$ or one evolving independently." This criticism helps refine the model by making $D_{r,t}$ itself a dynamic latent variable that co-evolves, rather than a fixed external target.

*   **Dynamical Systems (Round 1):** The concept of coveted grades acting as "attractors" and creating "sawtooth" distributions (Round 1) is integrated through the data-driven ordinal cut-points $\theta_j$ which can reveal clustering around these thresholds.

### Required data and methods

**Required Data:**
The model is designed to fully utilize the specified available data:
*   `Ascentionist identity`: Essential for modeling individual climber biases $\beta_i$ within the hierarchical structure. (Available)
*   `Date of ascent`: Crucial for tracking the time series of proposals, consensus, and latent difficulty evolution $D_{r,t}$. (Available)
*   `Personal grade proposed by the ascentionist`: The primary observable outcome $G_{i,r,t,k}$. (Available)
*   `Consensus grade at the time of ascent`: Provides $C_{r,t-1}$ for the anchoring term. (Available)
*   `Location of the climb (crag, region, country)`: Will be used for extending the model to hierarchical regional effects or to investigate the parameter $b$ from the Darth Grader framework. (Available)
*   `Route quality rating`: Can be incorporated as a covariate influencing $\sigma_P^2$ (noise in proposals) or $\sigma_D^2$ (stability of difficulty). (Available)

**Methods:**
1.  **Dynamic Hierarchical Bayesian Ordinal Probit Model:**
    *   **Core Method:** This will be implemented using probabilistic programming languages like Stan or PyMC. These languages allow for specifying complex hierarchical models with latent variables, stochastic processes (e.g., Wiener process for $D_{r,t}$), and custom likelihoods (e.g., ordinal probit).
    *   **Inference:** Markov Chain Monte Carlo (MCMC) algorithms (e.g., No-U-Turn Sampler in Stan) will be used for posterior inference of model parameters ($\alpha, \mu_\beta, \sigma_\beta^2, \sigma_D^2, \sigma_P^2$) and latent variables ($D_{r,t}, \beta_i, \theta_j$).
    *   **Technical Dependency:** Strong proficiency in Bayesian modeling, hierarchical structures, time series analysis, and probabilistic programming.

2.  **Model Comparison (for Scalar vs. Multidimensional Difficulty):**
    *   **Method:** Bayesian model comparison techniques such as Watanabe-Akaike Information Criterion (WAIC) or Leave-One-Out Cross-Validation (LOO-CV) will be employed. This will involve developing an alternative model where route difficulty is represented by multiple latent dimensions (e.g., strength, endurance, technique) and comparing its fit to the scalar model (Bayesian inference, Round 3 debate).
    *   **Technical Dependency:** Understanding of information criteria and cross-validation for Bayesian models.

3.  **Data Preprocessing and Feature Engineering:**
    *   **Method:** Cleaning and structuring the `8a.nu` and `ukclimbing.com` logbook data. This includes handling missing values, standardizing grade formats, and creating time series for each route. Climber ability will need to be approximated (e.g., median of their highest 5 redpoints).
    *   **Technical Dependency:** Data manipulation skills (e.g., Python with Pandas).

### Immediate next steps

1.  **Data Acquisition and Initial Exploration:** Submit formal research data requests to Vertical Life (8a.nu) and UKClimbing. Simultaneously, perform an initial exploratory data analysis on a small, publicly available subset of climbing data (e.g., from OpenBeta) to familiarize with data structures, identify common issues (e.g., grade variations, climber identity consistency), and prototype basic time series extraction for a few popular routes.
2.  **Define a Minimal Working Model:** Implement a simplified version of the dynamic hierarchical Bayesian ordinal probit model in Stan/PyMC. Start with a single route, assume fixed $\beta_i$ (no hierarchy initially), and perhaps a fixed $\alpha$. Focus on getting the time evolution of $D_{r,t}$ and the ordinal likelihood to work. This validates the core dynamic and ordinal components.

### Research programme

#### Phase 1 — Groundwork
**Objective:** Establish a robust data pipeline and a foundational Bayesian model for a single route.
*   **Action 1:** Secure full data access from 8a.nu and UKClimbing. Develop robust data cleaning, integration, and time-series construction scripts for all routes and ascents. Normalize grades across platforms and handle inconsistent climber IDs where possible (e.g., by matching names/emails if permissible).
*   **Action 2:** Develop an initial, single-route, dynamic hierarchical Bayesian model. Begin by estimating $D_{r,t}$ for a highly popular benchmark route, along with the anchoring coefficient $\alpha$ and a common individual bias $\beta$. Use fixed, equidistant cut-points for the ordinal scale. This will test the core dynamic and ordinal components.
*   **Action 3:** Validate model inference. Conduct posterior predictive checks and sensitivity analyses for the single-route model. Assess convergence diagnostics (R-hat, effective sample size).
*   **Deliverable:** A cleaned and preprocessed dataset ready for modeling, and a validated single-route dynamic Bayesian model capable of estimating latent difficulty evolution and anchoring.

#### Phase 2 — Core contribution
**Objective:** Fully implement and infer the multi-route dynamic hierarchical Bayesian ordinal probit model, addressing Open Questions 1, 2, 4.
*   **Action 1:** Extend the model to incorporate individual climber biases $\beta_i$ via a hierarchical structure, and estimate the population-level parameters ($\mu_\beta, \sigma_\beta^2$). This addresses the core individual variability.
*   **Action 2:** Implement data-driven ordinal cut-points $\theta_j$ by allowing them to be parameters inferred from the data. Analyze whether these cut-points cluster around coveted grades (e.g., 7a, 8a, Open Question 4).
*   **Action 3:** Develop and test a multidimensional latent difficulty model (e.g., $D_{r,t}$ as a 2D vector for strength and endurance). Perform Bayesian model comparison (WAIC/LOO-CV) against the scalar model to assess if difficulty is truly multidimensional (Open Question 3).
*   **Action 4:** Infer the full model across a representative sample of routes (e.g., a region, a grade band). Quantify the empirical magnitude of the anchoring coefficient $\alpha$ (Open Question 1) and analyze the evolution of latent difficulty $D_{r,t}$ to understand grade inflation/deflation dynamics (Open Question 2).
*   **Deliverable:** A fully implemented and inferred multi-route dynamic hierarchical Bayesian ordinal probit model with estimated parameters for $\alpha$, hierarchical $\beta_i$, and data-driven $\theta_j$. A robust conclusion on the scalar vs. multidimensional difficulty hypothesis. Quantitative answers to Open Questions 1, 3, and initial insights into 2 and 4.

#### Phase 3 — Extension and consolidation
**Objective:** Generalize the core findings, explore regional variations, and contribute to the broader understanding of grading systems.
*   **Action 1 (Regional Variation):** Extend the model to include regional-specific parameters for $\alpha$, $\mu_\beta$, $\sigma_D^2$, or even $D_{r,0}$ (initial difficulty), allowing for an empirical quantification of regional grading cultures as described by the Darth Grader $Y=aX+b$ intercept $b$. Analyze the spatial correlation of these regional parameters.
*   **Action 2 (Grade Inflation Drivers):** Further disentangle the drivers of grade inflation/deflation (Open Question 2) by analyzing the interplay between changes in the estimated $D_{r,t}$ (actual difficulty evolution) and the influence of $\alpha$ (transmission bias), alongside potential effects of selection bias (e.g., by incorporating climber ability distributions in the model or using a Price equation decomposition as a complementary analysis).
*   **Action 3 (Stochastic Resonance):** Investigate if the dynamic evolution of $D_{r,t}$ or $C_{r,t}$ exhibits stochastic resonance near coveted grade thresholds, or if the variance of proposals impacts stabilization non-monotonically, building on Stochastic process modeler's (Round 3) suggestions.
*   **Potential Publishable Outputs:**
    *   A peer-reviewed journal article detailing the dynamic hierarchical Bayesian model, quantifying anchoring, individual biases, and the evolution of latent difficulty.
    *   A technical report on the nature of grade scale discretization and the influence of coveted grades.
    *   An open-source software package implementing the proposed model.

### Known obstacles

1.  **Computational Cost:** Full MCMC inference for complex hierarchical models with many latent variables ($D_{r,t}$ for hundreds/thousands of routes, $\beta_i$ for thousands of climbers) and a time dimension can be computationally intensive and slow.
    *   **Resolution proposed in session:** None explicitly for this obstacle.
    *   **Remains open:** Yes. Potential solutions include variational inference (Bayesian inference, Round 1), parallel computing, or focusing on subsets of data.

2.  **Identifiability Issues:** Distinguishing between changes in latent difficulty $D_{r,t}$, individual bias $\beta_i$, and the anchoring coefficient $\alpha$ can be challenging if data is sparse or correlated. For example, if a route feels easier over time, is it because $D_{r,t}$ changed, or because higher-ability climbers are now attempting it (selection bias leading to lower $\beta_i$ proposals), or because the consensus $C_{r,t-1}$ itself has softened?
    *   **Resolution proposed in session:** The hierarchical structure of $\beta_i$ (Bayesian inference, Round 1) helps by "sharing" information across climbers. The explicit inclusion of $C_{r,t-1}$ in the anchoring term helps isolate $\alpha$.
    *   **Remains open:** Mitigated, but requires careful model design and robust prior specification to ensure identifiability.

3.  **Censored Likelihood (Selection Bias):** Only successful climbers propose grades, meaning the observed proposals are not a random sample of all climbers. Lower-ability climbers attempting harder routes are censored from the grading process.
    *   **Resolution proposed in session:** Bayesian Item Response Theory (IRT) (Bayesian inference, Round 1) inherently deals with this by modeling the probability of success given climber ability and route difficulty. While not explicitly in the proposed formula, the model could be extended to an IRT framework where grade proposals are conditional on successful ascent, or success/failure is modeled as a precursor to grading.
    *   **Remains open:** The current formulation does not explicitly model the success probability, which means the likelihood is effectively conditional on success. Extending to a full IRT model would address this more directly.

4.  **Discretization of Grades and Psychophysical Effects:** The non-linear relationship between perceived exertion and difficulty (System Description) means graders at extremes of their range produce systematically biased grades (hypo/hypersensitivity). The discrete nature of the grade scale itself might distort fine-grained perception.
    *   **Resolution proposed in session:** The ordinal probit model with data-driven thresholds (Bayesian inference, Round 3) is designed to handle the discrete scale. The "moderate comfort zone" effect could be modeled by making the proposal noise $\sigma_P^2$ dependent on $|D_{r,t} - A_i|$, where $A_i$ is climber $i$'s ability.
    *   **Remains open:** The exact form of the $\sigma_P^2$ dependency on ability still needs to be specified and tested.

### Related directions
*   **[SHALLOW+TRACTABLE] Quantifying anchoring strength and individual bias with hierarchical Bayesian models (Round 3):** This direction represents a streamlined subset of Phase 2, focusing primarily on estimating $\alpha$ and $\beta_i$ without the full dynamic component or ordinal probit, making it a valuable precursor or a direct benchmark for the more complex model.
*   **[DEEP+TRACTABLE] Stochastic Differential Equation Modeling of Consensus Grade Evolution with State-Dependent Noise (Round 2):** This direction is highly complementary as it focuses on the SDE framework for consensus evolution. It could inform the stochastic process component for $D_{r,t}$ or the update rule for $C_{r,t}$, particularly regarding state-dependent noise or the impact of climber ability distribution.
*   **[DEEP+TRACTABLE] Disentangling grade inflation drivers using Price equation decomposition and SDEs (Round 3):** This direction shares the goal of understanding grade inflation (Open Question 2). A Price equation decomposition could be used to cross-validate or provide a complementary perspective on the drivers of grade inflation inferred from our Bayesian model (e.g., comparing the contribution of $\alpha$ to "transmission bias" in the Price equation).