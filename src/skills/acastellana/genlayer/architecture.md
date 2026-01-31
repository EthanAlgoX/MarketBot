# GenLayer Architecture

## Overview

GenLayer is the first AI-native blockchain built for AI-powered smart contracts called **Intelligent Contracts**. Its foundation is the **Optimistic Democracy** consensus mechanism—an enhanced Delegated Proof of Stake (dPoS) model where validators connect directly to Large Language Models (LLMs).

This enables non-deterministic operations—processing text prompts, fetching live web data, executing AI-based decisions—while preserving blockchain reliability and security.

## Core Components

### 1. GenVM (GenLayer Virtual Machine)

The execution environment for Intelligent Contracts.

**Key differences from EVM:**
- **LLM Integration**: Seamless interaction between contracts and Large Language Models
- **Web Access**: Direct access to the Internet from contracts
- **Python-based**: Intelligent Contracts are written in Python (not Solidity)

**Source:** https://github.com/genlayerlabs/genvm

### 2. Validators

Participants who stake GEN tokens to earn the right to validate transactions.

**Components of each validator node:**
- **Validator Software**: Handles networking, block production, transaction management
- **AI Model Integration**: Connects to LLMs (GPT, LLaMA, Anthropic, etc.) for complex reasoning

**Validators handle both:**
- Deterministic transactions (traditional blockchain operations)
- Non-deterministic transactions (AI-driven logic, web data, probabilistic inference)

### 3. Rollup Integration

GenLayer leverages Ethereum rollups (ZKSync, Polygon CDK) for scalability and Ethereum compatibility.

**Benefits:**
- High transaction throughput
- Reduced gas fees
- Ethereum security inheritance
- EVM interoperability

**How it works:**
1. Users submit transactions to the rollup
2. Transactions execute in GenVM
3. Optimistic Democracy reaches consensus
4. Batches submitted to Ethereum mainnet
5. Ethereum verifies integrity

## Technical Implementation

### Distributed Neural Consensus Network

Validators run specialized software connected via API to AI models. This unifies:

- **Delegated Proof of Stake (dPoS)** for efficient block production and governance
- **Neural Consensus** for non-deterministic transactions requiring AI reasoning

### Transaction Flow

```text
User Transaction
      ↓
  GenLayer Network
      ↓
  Leader Selected (random)
      ↓
  Leader Executes → Proposes Result
      ↓
  Validators Recompute (independently)
      ↓
  Equivalence Check (do outputs match criteria?)
      ↓
  Majority Vote
      ↓
  Provisional Accept → Finality Window (30 min)
      ↓
  [Appeal?] → Expand validators, repeat
      ↓
  Final Decision → State Update
```text

### Validator Selection

Token holders delegate tokens to validator candidates. A deterministic function `f(x)` randomly designates Leader and Validators for each transaction.

**Selection weight formula:**
```text
weight = (self_stake × ALPHA + delegated_stake) ^ BETA
```text
Where:
- ALPHA = 0.6 (self-stake counts 50% more)
- BETA = 0.5 (square-root damping prevents whale dominance)

## Network Parameters

| Parameter | Value |
|-----------|-------|
| Max active validators | 1,000 |
| Minimum validator stake | 42,000 GEN |
| Minimum delegation | 42 GEN |
| Epoch duration | 1 day |
| Activation delay | +2 epochs |
| Unbonding period | 7 epochs |
| Initial validators per tx | 5 |
| Appeal expansion | 2N + 1 |
| Finality window | 30 minutes |

## Security Mechanisms

### 1. Multi-Validator Verification
No single validator can determine outcomes. Multiple independent validators must agree.

### 2. Commit-Reveal
Validators commit answers before revealing, preventing copying strategies.

### 3. Grey Boxing
Pre-cleaning process sanitizes prompts before reaching LLMs. Each node can apply its own method, increasing security through diversity.

### 4. Economic Incentives
- Honest behavior is rewarded
- Malicious behavior is slashed
- Appeals are incentivized through bonds

### 5. LLM Diversity
Different validators use different models, seeds, hardware—reducing correlation and single-point manipulation.

## Contract Architecture

### Deterministic Features
- Storage operations (DynArray, TreeMap)
- Balance management
- Contract interactions
- Basic logic

### Non-Deterministic Features
- LLM calls (natural language processing)
- Web data access
- AI-based decision making
- Vector storage and similarity search

### Contract Structure
```python
import genlayer as gl

@gl.contract
class MyContract(gl.Contract):
    counter: u32

    @gl.public.view
    def get_counter(self) -> u32:
        return self.counter

    @gl.public.write
    def increment(self):
        self.counter += u32(1)
```text

## Interoperability

### With Other Intelligent Contracts
```python
other = gl.get_contract_at(address)
result = other.view().method_name()
other.emit(on='finalized').update_status("active")
```text

### With EVM Contracts
```python
@gl.evm.contract_interface
class TokenContract:
    class View:
        def balance_of(self, owner: Address) -> u256: ...
    class Write:
        def transfer(self, to: Address, amount: u256) -> bool: ...

token = TokenContract(address)
balance = token.view().balance_of(owner)
```text

## Infrastructure Requirements

### Validator Node
- CPU: Modern multi-core
- RAM: 16GB+ recommended
- Storage: SSD with adequate space
- Network: Stable, low-latency connection
- LLM Access: API key for provider OR local GPU for self-hosted models

### LLM Options
- **Hosted providers**: OpenAI, Anthropic, Heurist, Atoma
- **Local models**: Open-source LLMs with GPU

### ZKSync Full Node
Each validator needs access to a ZKSync Full Node connected to the GenLayer chain. One node can be shared between multiple validators.
