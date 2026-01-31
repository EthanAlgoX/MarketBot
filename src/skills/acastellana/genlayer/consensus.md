# Consensus: Optimistic Democracy

Optimistic Democracy is GenLayer's consensus mechanism for validating transactions and Intelligent Contract operations. It's especially good at handling unpredictable outcomes from AI and web data while maintaining network reliability and security.

## Theoretical Foundation

### Condorcet's Jury Theorem

Proposed by Marquis de Condorcet in 1785: If each member of a group has an independent probability >50% of making the correct decision, the likelihood that the majority is correct increases with group size and approaches certainty as the group grows infinitely.

**Numerically:** If each member has 0.6 probability of being correct, ~100 members reaches near 100% accuracy.

**Limitation:** The theorem assumes statistical independence. LLMs aren't entirely uncorrelated (trained on the same internet corpus). GenLayer compensates by using ~1,000 different validators with different models, seeds, GPUs, providers, and configurations.

### Schelling Point

A focal point that emerges from collective behavior. When agents reason independently and know their reward depends on aligning with the majority, the rational strategy is to provide the true answer—truth has internal coherence while falsehood takes many inconsistent forms.

**Through this mechanism, honesty becomes the most rational strategy.**

## How Optimistic Democracy Works

### 1. Transaction Submission
User sends a transaction to the GenLayer network.

### 2. Leader Proposes Result
- A validator is randomly chosen as **Leader**
- Leader processes the transaction and proposes an outcome

### 3. Validators Recompute
- A committee of validators independently re-compute the transaction
- They either **approve** or **deny** based on whether output aligns with Leader's result (via Equivalence Principle)

### 4. Result Accepted
Once majority approves, the result is **provisionally accepted**.

### 5. Finality Window
A time period (~30 minutes) during which anyone can challenge the decision.

### 6. Appeal (if disputed)
- Participant posts a bond to appeal
- New validators (2N+1) join original group
- New leader may be chosen if transaction is overturned
- Process can escalate, doubling validators each round

### 7. Final Decision
After all appeals resolved, outcome becomes final. Correct appellants are rewarded; incorrect ones lose their bond.

---

## The Equivalence Principle

A cornerstone ensuring Intelligent Contracts function consistently despite non-deterministic outputs (LLM responses, web data).

### The Problem
LLMs are probabilistic—the same input can produce different outputs. How do validators agree?

### The Solution
Instead of requiring exact matches, validators assess whether outputs are **sufficiently equivalent** within predefined criteria.

### Types of Equivalence

#### 1. Comparative Equivalence
Both Leader and validators perform identical tasks and compare results with an acceptable margin of error.

**Example: Product Rating Calculation**
- Leader calculates average rating: 4.5
- Validator calculates: 4.6
- Equivalence Principle: ratings should not differ by >0.1 points
- Decision: Accepted (difference is exactly 0.1)

**Pros:** Rigorous verification
**Cons:** Higher computational cost (all validators do full work)

#### 2. Non-Comparative Equivalence
Validators assess the Leader's result against criteria **without replicating the work**.

**Example: News Summary**
- Leader generates summary of news article
- Validators check: Is it accurate? Relevant? Appropriate length?
- Decision: Accepted if criteria met

**Pros:** Faster, cheaper
**Cons:** More subjective evaluation

### Developer Responsibility
Developers must define what "equivalent" means for each non-deterministic operation. This guideline helps validators judge if different outcomes are close enough.

---

## Appeals Process

Critical component ensuring non-deterministic transactions are accurately evaluated.

### Initiating an Appeal
1. Participant disagrees with initial validation
2. Submits appeal request during Finality Window
3. Posts required bond
4. New validators join original group

### Appeal Evaluation
1. New validators review existing transaction
2. Vote whether to overturn
3. If yes, new leader re-evaluates
4. Combined group reviews new evaluation

### Escalation
If unresolved, appeals can escalate:
- Round 1: 5 validators
- Round 2 (appealed): 11 validators (2×5+1)
- Round 3 (appealed again): 23 validators (2×11+1)
- Continues until consensus or all validators participate

### Gas Costs
Appeal gas can be covered by:
- Original user
- Appellant
- Any third party

Transactions can include an optional tip for potential appeal costs.

---

## Finality

The state where a transaction is settled and unchangeable.

### Finality Window
Time frame during which transactions can be challenged before becoming final.

**Purposes:**
- Allows appeals if validation seems incorrect
- Provides time for re-computation
- Acts as security feature to correct errors before finalizing

### Deterministic vs Non-Deterministic

| Contract Type | Finality Window | Reason |
|--------------|-----------------|--------|
| Deterministic | Shorter | Straightforward validation, no appeals |
| Non-deterministic | Longer | Accounts for potential appeals and re-computation |

### Fast Finality
For scenarios requiring immediate finality (e.g., emergency DAO decisions):
- Pay for all validators to validate immediately
- More costly but bypasses typical Finality Window

---

## Validator Roles

### Leader Validator
- Randomly selected for each transaction
- Executes transaction
- Proposes result to other validators

### Consensus Validators
- Assess leader's proposed result
- Vote to accept or reject based on Equivalence Principle

### Key Responsibilities
1. **Transaction Validation**: Verify correctness using Equivalence Principle
2. **Leader Selection**: Participate in random selection process
3. **Consensus Participation**: Cast votes on proposed outcomes
4. **Staking**: Stake tokens to earn validation rights and rewards

---

## Slashing

Mechanism to penalize validators who harm the network.

### Slashing Conditions
- **Missing Transaction Execution Window**: Validators must execute within specified timeframe
- **Missing Appeal Execution Window**: Must respond to appeals within set time

### Slashing Process
1. Violation detected
2. Slash amount calculated based on violation and rules
3. Amount deducted from validator's stake
4. Becomes final after Finality Window closes

### Amount
Varies by severity—substantial enough to deter malicious/negligent behavior but not excessively punitive for honest mistakes.

---

## Economic Incentives

### Reward Sources
- Transaction fees
- Inflation (starting 15% APR, decreasing to 4% over time)

### Distribution
- 10% → Validator owners (operational fee)
- 75% → Total validator stake (validators + delegators)
- 10% → Developers
- 5% → Locked for DeepThought AI-DAO (future allocation)

### Validator Selection Weight
Higher stake = higher weight = higher selection probability, but:
- Doubling stake only increases weight by ~41% (square-root damping)
- Encourages distribution across validators
- Smaller validators often provide higher returns per GEN staked

### Nash Equilibrium
The system achieves Nash equilibrium where:
- Honest behavior is the dominant strategy
- Deviating from truth reduces expected rewards
- Consensus emerges naturally from self-interested behavior
