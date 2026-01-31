---
name: genlayer-dev-claw-skill
version: 1.0.0
description: Build GenLayer Intelligent Contracts - Python smart contracts with LLM calls and web access. Use for writing/deploying contracts, SDK reference, CLI commands, equivalence principles, storage types. Triggers: write intelligent contract, genlayer contract, genvm, gl.Contract, deploy genlayer, genlayer CLI, genlayer SDK, DynArray, TreeMap, gl.nondet, gl.eq_principle, prompt_comparative, strict_eq, genlayer deploy, genlayer up. (For explaining GenLayer concepts, use genlayer-claw-skill instead.)
---

# GenLayer Intelligent Contracts

GenLayer enables **Intelligent Contracts** - Python smart contracts that can call LLMs, fetch web data, and handle non-deterministic operations while maintaining blockchain consensus.

## Quick Start

### Minimal Contract
```python
# v0.1.0
# { "Depends": "py-genlayer:latest" }
from genlayer import *

class MyContract(gl.Contract):
    value: str
    
    def __init__(self, initial: str):
        self.value = initial
    
    @gl.public.view
    def get_value(self) -> str:
        return self.value
    
    @gl.public.write
    def set_value(self, new_value: str) -> None:
        self.value = new_value
```

### Contract with LLM
```python
# v0.1.0
# { "Depends": "py-genlayer:latest" }
from genlayer import *
import json

class AIContract(gl.Contract):
    result: str
    
    def __init__(self):
        self.result = ""
    
    @gl.public.write
    def analyze(self, text: str) -> None:
        prompt = f"Analyze this text and respond with JSON: {text}"
        
        def get_analysis():
            return gl.nondet.exec_prompt(prompt)
        
        # All validators must get the same result
        self.result = gl.eq_principle.strict_eq(get_analysis)
    
    @gl.public.view
    def get_result(self) -> str:
        return self.result
```

### Contract with Web Access
```python
# v0.1.0
# { "Depends": "py-genlayer:latest" }
from genlayer import *

class WebContract(gl.Contract):
    content: str
    
    def __init__(self):
        self.content = ""
    
    @gl.public.write
    def fetch(self, url: str) -> None:
        url_copy = url  # Capture for closure
        
        def get_page():
            return gl.nondet.web.render(url_copy, mode="text")
        
        self.content = gl.eq_principle.strict_eq(get_page)
    
    @gl.public.view
    def get_content(self) -> str:
        return self.content
```

## Core Concepts

### Contract Structure
1. **Version header**: `# v0.1.0` (required)
2. **Dependencies**: `# { "Depends": "py-genlayer:latest" }`
3. **Import**: `from genlayer import *`
4. **Class**: Extend `gl.Contract` (only ONE per file)
5. **State**: Class-level typed attributes
6. **Constructor**: `__init__` (not public)
7. **Methods**: Decorated with `@gl.public.view` or `@gl.public.write`

### Method Decorators
| Decorator | Purpose | Can Modify State |
|-----------|---------|------------------|
| `@gl.public.view` | Read-only queries | No |
| `@gl.public.write` | State mutations | Yes |
| `@gl.public.write.payable` | Receive value + mutate | Yes |

### Storage Types
Replace standard Python types with GenVM storage-compatible types:

| Python Type | GenVM Type | Usage |
|-------------|------------|-------|
| `int` | `u32`, `u64`, `u256`, `i32`, `i64`, etc. | Sized integers |
| `int` (unbounded) | `bigint` | Arbitrary precision (avoid) |
| `list[T]` | `DynArray[T]` | Dynamic arrays |
| `dict[K,V]` | `TreeMap[K,V]` | Ordered maps |
| `str` | `str` | Strings (unchanged) |
| `bool` | `bool` | Booleans (unchanged) |

**⚠️ `int` is NOT supported!** Always use sized integers.

### Address Type
```python
# Creating addresses
addr = Address("0x03FB09251eC05ee9Ca36c98644070B89111D4b3F")

# Get sender
sender = gl.message.sender_address

# Conversions
hex_str = addr.as_hex      # "0x03FB..."
bytes_val = addr.as_bytes  # bytes
```

### Custom Data Types
```python
from dataclasses import dataclass

@allow_storage
@dataclass
class UserData:
    name: str
    balance: u256
    active: bool

class MyContract(gl.Contract):
    users: TreeMap[Address, UserData]
```

## Non-Deterministic Operations

### The Problem
LLMs and web fetches produce different results across validators. GenLayer solves this with the **Equivalence Principle**.

### Equivalence Principles

#### 1. Strict Equality (`strict_eq`)
All validators must produce **identical** results.
```python
def get_data():
    return gl.nondet.web.render(url, mode="text")

result = gl.eq_principle.strict_eq(get_data)
```

Best for: Factual data, boolean results, exact matches.

#### 2. Prompt Comparative (`prompt_comparative`)
LLM compares leader's result against validators' results using criteria.
```python
def get_analysis():
    return gl.nondet.exec_prompt(prompt)

result = gl.eq_principle.prompt_comparative(
    get_analysis,
    "The sentiment classification must match"
)
```

Best for: LLM tasks where semantic equivalence matters.

#### 3. Prompt Non-Comparative (`prompt_non_comparative`)
Validators verify the leader's result meets criteria (don't re-execute).
```python
result = gl.eq_principle.prompt_non_comparative(
    lambda: input_data,  # What to process
    task="Summarize the key points",
    criteria="Summary must be under 100 words and factually accurate"
)
```

Best for: Expensive operations, subjective tasks.

#### 4. Custom Leader/Validator Pattern
```python
result = gl.vm.run_nondet(
    leader=lambda: expensive_computation(),
    validator=lambda leader_result: verify(leader_result)
)
```

### Non-Deterministic Functions

| Function | Purpose |
|----------|---------|
| `gl.nondet.exec_prompt(prompt)` | Execute LLM prompt |
| `gl.nondet.web.render(url, mode)` | Fetch web page (`mode="text"` or `"html"`) |

**⚠️ Rules:**
- Must be called inside equivalence principle functions
- Cannot access storage directly
- Copy storage data to memory first with `gl.storage.copy_to_memory()`

## Contract Interactions

### Call Other Contracts
```python
# Dynamic typing
other = gl.get_contract_at(Address("0x..."))
result = other.view().some_method()

# Static typing (better IDE support)
@gl.contract_interface
class TokenInterface:
    class View:
        def balance_of(self, owner: Address) -> u256: ...
    class Write:
        def transfer(self, to: Address, amount: u256) -> bool: ...

token = TokenInterface(Address("0x..."))
balance = token.view().balance_of(my_address)
```

### Emit Messages (Async Calls)
```python
other = gl.get_contract_at(addr)
other.emit(on='accepted').update_status("active")
other.emit(on='finalized').confirm_transaction()
```

### Deploy Contracts
```python
child_addr = gl.deploy_contract(code=contract_code, salt=u256(1))
```

### EVM Interop
```python
@gl.evm.contract_interface
class ERC20:
    class View:
        def balance_of(self, owner: Address) -> u256: ...
    class Write:
        def transfer(self, to: Address, amount: u256) -> bool: ...

token = ERC20(evm_address)
balance = token.view().balance_of(addr)
token.emit().transfer(recipient, u256(100))  # Messages only on finality
```

## CLI Commands

### Setup
```bash
npm install -g genlayer
genlayer init      # Download components
genlayer up        # Start local network
```

### Deployment
```bash
# Direct deploy
genlayer deploy --contract my_contract.py

# With constructor args
genlayer deploy --contract my_contract.py --args "Hello" 42

# To testnet
genlayer network set testnet-asimov
genlayer deploy --contract my_contract.py
```

### Interaction
```bash
# Read (view methods)
genlayer call --address 0x... --function get_value

# Write
genlayer write --address 0x... --function set_value --args "new_value"

# Get schema
genlayer schema --address 0x...

# Check transaction
genlayer receipt --tx-hash 0x...
```

### Networks
```bash
genlayer network                    # Show current
genlayer network list               # Available networks
genlayer network set localnet       # Local dev
genlayer network set studionet      # Hosted dev
genlayer network set testnet-asimov # Testnet
```

## Best Practices

### Prompt Engineering
```python
prompt = f"""
Analyze this text and classify the sentiment.

Text: {text}

Respond using ONLY this JSON format:
{{"sentiment": "positive" | "negative" | "neutral", "confidence": float}}

Output ONLY valid JSON, no other text.
"""
```

### Security: Prompt Injection
- **Restrict inputs**: Minimize user-controlled text in prompts
- **Restrict outputs**: Define exact output formats
- **Validate**: Check parsed results match expected schema
- **Simplify logic**: Clear contract flow reduces attack surface

### Error Handling
```python
from genlayer import UserError

@gl.public.write
def safe_operation(self, value: int) -> None:
    if value <= 0:
        raise UserError("Value must be positive")
    # ... proceed
```

### Memory Management
```python
# Copy storage to memory for non-det blocks
data_copy = gl.storage.copy_to_memory(self.some_data)

def process():
    return gl.nondet.exec_prompt(f"Process: {data_copy}")

result = gl.eq_principle.strict_eq(process)
```

## Common Patterns

### Token with AI Transfer Validation
See `references/examples.md` → LLM ERC20

### Prediction Market
See `references/examples.md` → Football Prediction Market

### Vector Search / Embeddings
See `references/examples.md` → Log Indexer

## Debugging

1. **GenLayer Studio**: Use `genlayer up` for local testing
2. **Logs**: Filter by transaction hash, debug level
3. **Print statements**: `print()` works in contracts (debug only)

## Reference Files
- `references/sdk-api.md` - Complete SDK API reference
- `references/equivalence-principles.md` - Consensus patterns in depth
- `references/examples.md` - Full annotated contract examples (incl. production oracle)
- `references/deployment.md` - CLI, networks, deployment workflow
- `references/genvm-internals.md` - VM architecture, storage, ABI details

## Links
- Docs: https://docs.genlayer.com
- SDK: https://sdk.genlayer.com
- Studio: https://studio.genlayer.com
- GitHub: https://github.com/genlayerlabs
