# Staking in GenLayer

Validators and delegators participate in GenLayer's consensus by staking GEN tokens. This document covers the economics, mechanics, and practical operations of staking.

## Overview

| Role | Description | Minimum Stake |
|------|-------------|---------------|
| **Validator** | Runs consensus infrastructure, executes Intelligent Contracts | 42,000 GEN |
| **Delegator** | Stakes tokens with validators, earns passive rewards | 42 GEN |

Validators receive a 10% operational fee from rewards before distribution. Delegators earn proportionally, minus this fee.

---

## How Staking Works

### 1. Stake Deposit
Validators deposit GEN tokens on the rollup layer as a security bond, qualifying them for the active validator pool.

### 2. Validator Participation
Only the top 1,000 validators by stake can be active. Once staked, validators:
- Validate transactions
- Execute Intelligent Contracts
- Maintain network reliability
- Participate in consensus

### 3. Delegated Proof of Stake (DPoS)
Token holders can delegate to trusted validators without running infrastructure:
- Increases validator's total stake
- Share in rewards (90% to delegator, 10% to validator)
- Exposed to validator's slashing risk

### 4. Earning Rewards
Rewards are proportional to:
- Amount staked
- Transaction volume processed

### 5. Slashing Risk
Validators (and their delegators) can have stakes slashed for:
- Missing execution windows
- Supporting fraudulent transactions
- Network rule violations

---

## Validator Addresses

When a validator joins, three entities are created:

| Entity | Description | Security Recommendation |
|--------|-------------|------------------------|
| **ValidatorWallet** | Smart contract wallet created on join; holds staked GEN | Primary validator identifier |
| **Owner Address** | Creates validator, controls staking operations | Cold wallet |
| **Operator Address** | Used for consensus operations | Hot wallet |

The operator can be changed by the owner but cannot be zero address or reused across validators.

---

## Epoch System

Network operates in **epochs** (1 day each).

### Key Rules
- **Epoch +2 Activation**: All deposits become active 2 epochs after made
- Epoch finalization requires all transactions finalized
- Cannot advance to epoch N+1 until epoch N-1 is finalized

### Validator Priming
Validators must call `validatorPrime()` each epoch (permissionless—anyone can call).

**Critical:** If not called, validator is excluded from next epoch's selection.

### Genesis (Epoch 0)
Special bootstrapping period:
- No transactions processed
- No consensus occurs
- Stakes registered for epoch 2 activation
- Network transitions directly from epoch 0 → epoch 2 (epoch 1 skipped)
- No minimum stake requirements during epoch 0
- Stakes must meet minimums to be active in epoch 2

---

## Shares vs Stake

The system uses **shares** to track ownership:

| Concept | Behavior |
|---------|----------|
| **Shares** | Fixed quantities that never change; represent immutable claims |
| **Stake** | Dynamic GEN amount; increases with rewards, decreases with slashing |

### Exchange Rate
```text
stake_per_share = total_stake / total_shares
```text

**Example:**
- 100 shares representing 1,000 GEN (10 GEN/share)
- After rewards: same 100 shares = 1,050 GEN (10.5 GEN/share)
- Rewards automatically compound without user action

---

## Validator Selection and Weight

Validators are selected for consensus based on weight:

```text
weight = (self_stake × ALPHA + delegated_stake) ^ BETA
```text

**Parameters:**
- **ALPHA = 0.6**: Self-stake counts 50% more than delegated
- **BETA = 0.5**: Square-root damping prevents whale dominance

**Effects:**
- Higher stake = higher weight = higher selection probability
- But doubling stake only increases weight by ~41%
- Encourages distribution across validators
- Smaller validators often provide higher returns per GEN

---

## Reward Distribution

### Sources
- Transaction fees
- Inflation (starting 15% APR → decreasing to 4% APR)

### Distribution Pattern
| Recipient | Share |
|-----------|-------|
| Validator owners | 10% (operational fee) |
| Total stake (validators + delegators) | 75% |
| Developers | 10% |
| DeepThought AI-DAO (locked) | 5% |

Within the 75% stake allocation:
- Self-stake receives portion based on validator's own staked amount
- Delegated stake split among delegators proportionally to shares

**Rewards automatically increase stake-per-share ratio—no user action required.**

---

## Unbonding Period

Both validators and delegators face a **7-epoch unbonding period** when withdrawing:

- Prevents rapid stake movements that could destabilize network
- Tokens stop earning rewards immediately upon exit
- Countdown starts from exit epoch
- Funds claimable when: `current_epoch >= exit_epoch + 7`

---

## Validator Operations

### Joining
```solidity
// Option 1: Owner as Operator
staking.validatorJoin{value: 42000 ether}();

// Option 2: Separate Operator (recommended)
staking.validatorJoin{value: 42000 ether}(operatorAddress);
```text

### Depositing (additional stake)
```solidity
validatorWallet.deposit{value: amount}();
```text

### Withdrawing
```solidity
// Step 1: Calculate shares to exit
uint256 shares = staking.sharesOf(validatorWallet);

// Step 2: Initiate exit
staking.validatorExit(shares);

// Step 3: Wait 7 epochs

// Step 4: Claim
staking.validatorClaim();
```text

---

## Delegator Operations

### Joining
```solidity
// Single validator
staking.delegatorJoin{value: 42 ether}(validatorWallet);

// Multiple validators
staking.delegatorJoin{value: 100 ether}(validator1);
staking.delegatorJoin{value: 200 ether}(validator2);
```text

### Depositing (additional delegation)
```solidity
staking.delegatorDeposit{value: amount}(validatorWallet);
```text

### Withdrawing
```solidity
// Step 1: Calculate shares
uint256 shares = staking.sharesOf(delegator, validatorWallet);

// Step 2: Initiate exit
staking.delegatorExit(validatorWallet, shares);

// Step 3: Wait 7 epochs

// Step 4: Claim
staking.delegatorClaim(delegator, validatorWallet);
```text

**Note:** Exit each validator separately if delegating to multiple.

---

## Validator Priming Function

`validatorPrime(address validator)` is critical:

| Action | Description |
|--------|-------------|
| Activates pending deposits | Makes new stakes active |
| Processes pending withdrawals | Finalizes exits |
| Distributes rewards | From previous epoch |
| Applies slashing penalties | If any |
| Sorts validator into selection tree | For next epoch |

**Properties:**
- Permissionless (anyone can call)
- Caller receives 1% of any slashed amount
- Missing priming excludes validator from next epoch
- Doesn't lose rewards, just can't be selected

---

## Governance and Safeguards

- **24-Hour Delay**: All slashing actions have governance delay
- Parameters adjustable through governance:
  - ALPHA, BETA
  - Minimum stakes
  - Unbonding periods
- Maximum 1,000 active validators per epoch (adjustable)

---

## Best Practices

### For Validators
- Ensure node health—automatic `validatorPrime()` execution
- Use separate keys: cold wallet for owner, hot wallet for operator
- Monitor priming for deposit activation
- Monitor quarantine status
- Maintain high uptime (downtime = idleness strikes)
- Set up backup monitoring

### For Delegators
- Diversify across multiple validators
- Select validators with good uptime records
- Verify validators are consistently primed
- Consider smaller validators (higher returns)
- Monitor validator health regularly
- Use shares for exits (percentages, not absolute amounts)

### For Both
- Account for 7-epoch unbonding when exiting
- Monitor epochs for claim eligibility
- Calculate exits carefully (use share percentages)
- Understand compounding (rewards auto-increase stake-per-share)
- Watch governance for parameter changes

---

## Activation Timelines

### Normal Epochs (2+)
```text
Deposit in Epoch N → Active in Epoch N+2
```text

### Epoch 0 (Bootstrapping)
```text
Deposit in Epoch 0 → Active in Epoch 2 (if meets minimums)
```text

### Unbonding
```text
Exit in Epoch N → Claimable in Epoch N+7
```text

---

## CLI Commands

### Validator Wizard
```bash
genlayer staking wizard
```text

### Check Status
```bash
genlayer staking status --validator <wallet>
```text

### Verify Configuration
```bash
genlayer node doctor
```text

Full CLI reference: https://docs.genlayer.com/api-references/genlayer-cli#staking-operations-testnet
