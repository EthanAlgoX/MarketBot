---
name: rue-chialisp
version: 1.0.0
description: Create Chia blockchain puzzles using Rue, a type-safe language that compiles to CLVM. Use for smart contract development, custom puzzle creation, or when user says "create a coin that...", "build a puzzle", "chialisp", "rue", "timelock", "multisig", "escrow", "atomic swap", or describes coin spending conditions.
---

# Rue Chialisp Skill

Build type-safe Chia puzzles using Rue. Compile to CLVM bytecode for on-chain deployment.

## Setup

```bash
# Check dependencies
scripts/rue-check.sh

# Initialize project
scripts/rue-init.sh my-project
```

## Quick Build

```bash
cd my-project
rue build              # Compile all puzzles
rue build puzzles/x.rue  # Compile one
brun "$CLVM" "(args)"  # Simulate execution
```

## Natural Language → Puzzle

When user describes a puzzle in plain language, map to these patterns:

| User Says | Pattern | Example File |
|-----------|---------|--------------|
| "only spend after block X" | Timelock | `examples/timelock.rue` |
| "requires N signatures" | Multisig | `examples/multisig.rue` |
| "burn X%" | Partial Burn | `examples/burn_10_percent.rue` |
| "split payment" | Royalty | `examples/royalty.rue` |
| "escrow with arbiter" | Escrow | `examples/escrow.rue` |
| "atomic swap / HTLC" | Atomic Swap | `examples/atomic_swap.rue` |
| "reversible / clawback" | Clawback | `examples/clawback.rue` |
| "spending limit" | Rate Limited | `examples/rate_limited.rue` |
| "recurring payment" | Subscription | `examples/subscription.rue` |
| "password protected" | Password | `examples/password_puzzle.rue` |
| "signature required" | Signature | `examples/sig_puzzle.rue` |

## Core Syntax

```rue
fn main(curried_arg: Type, solution_arg: Type) -> List<Condition> {
    assert condition;
    let x = expression;
    if cond { a } else { b }
    [item1, item2, ...rest]
}
```

## Types

| Type | Description |
|------|-------------|
| `Int` | Signed integer |
| `Bool` | true/false |
| `Bytes32` | 32-byte hash |
| `PublicKey` | BLS G1 (48 bytes) |
| `List<T>` | Nil-terminated list |
| `Condition` | CLVM condition |

## Key Conditions

| Condition | Opcode | Purpose |
|-----------|--------|---------|
| `CreateCoin { puzzle_hash, amount, memos }` | 51 | Create output |
| `AggSigMe { public_key, message }` | 50 | Require signature |
| `AssertHeightAbsolute { height }` | 83 | Min block height |
| `AssertBeforeHeightAbsolute { height }` | 87 | Max block height |
| `AssertMyAmount { amount }` | 73 | Verify coin value |
| `ReserveFee { amount }` | 52 | Transaction fee |

See `references/conditions.md` for full list (30+ conditions).

## Built-in Functions

| Function | Use |
|----------|-----|
| `sha256(data)` | Hash data |
| `tree_hash(value)` | CLVM tree hash |
| `coinid(parent, puzzle_hash, amount)` | Compute coin ID |

## Example: Timelock

```rue
fn main(unlock_height: Int, dest: Bytes32, amount: Int) -> List<Condition> {
    let wait = AssertHeightAbsolute { height: unlock_height };
    let output = CreateCoin { puzzle_hash: dest, amount, memos: nil };
    [wait, output]
}
```

## Example: 2-of-2 Multisig

```rue
fn main(pk1: PublicKey, pk2: PublicKey, conditions: List<Condition>) -> List<Condition> {
    let msg = tree_hash(conditions);
    let sig1 = AggSigMe { public_key: pk1, message: msg };
    let sig2 = AggSigMe { public_key: pk2, message: msg };
    [sig1, sig2, ...conditions]
}
```

## Simulation

```bash
# Compile
CLVM=$(rue build puzzles/my_puzzle.rue 2>&1 | grep -v Warning | head -1)

# Execute with test inputs
brun "$CLVM" "(arg1 arg2 arg3)"

# Output is list of conditions: ((51 <hash> <amount>) (83 <height>) ...)
```

## Security Notes

- Password puzzles are educational only — use signatures for real value
- Always validate input types with `assert value is Type`
- Use `tree_hash(conditions)` as signature message to bind signatures to outputs
