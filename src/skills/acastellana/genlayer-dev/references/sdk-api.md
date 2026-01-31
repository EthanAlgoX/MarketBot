# GenLayer SDK API Reference

## Module: genlayer

Import everything with:
```python
from genlayer import *
```

This provides:
- `gl` - Main SDK namespace (lazy-loaded as `genlayer.std`)
- All storage types
- Decorators and utilities

---

## gl.Contract

Base class for all Intelligent Contracts.

```python
class MyContract(gl.Contract):
    # State variables with type annotations
    counter: u256
    owner: Address
    data: TreeMap[Address, str]
    
    def __init__(self, initial_value: int):
        self.counter = u256(initial_value)
        self.owner = gl.message.sender_address
```

**Rules:**
- Only ONE class per file can extend `gl.Contract`
- All state variables must have type annotations
- Constructor (`__init__`) cannot be public

---

## Method Decorators

### @gl.public.view
Read-only method. Cannot modify state.

```python
@gl.public.view
def get_balance(self, addr: str) -> u256:
    return self.balances[Address(addr)]
```

### @gl.public.write
State-modifying method.

```python
@gl.public.write
def set_value(self, new_value: str) -> None:
    self.value = new_value
```

### @gl.public.write.payable
Can receive native tokens and modify state.

```python
@gl.public.write.payable
def deposit(self) -> None:
    self.balances[gl.message.sender_address] += gl.message.value
```

---

## gl.message

Transaction context information.

| Property | Type | Description |
|----------|------|-------------|
| `gl.message.sender_address` | `Address` | Transaction sender |
| `gl.message.value` | `u256` | Attached value (for payable) |
| `gl.message.contract_address` | `Address` | Current contract address |

---

## Non-Deterministic Operations

### gl.nondet.exec_prompt(prompt: str) -> str

Execute an LLM prompt and return the response.

```python
def analyze():
    result = gl.nondet.exec_prompt("""
        Classify this text as positive or negative.
        Text: The product is amazing!
        Respond with only: positive or negative
    """)
    return result.strip().lower()
```

**Must be called within an equivalence principle function!**

### gl.nondet.web.render(url: str, mode: str) -> str

Fetch web content.

| Parameter | Description |
|-----------|-------------|
| `url` | Target URL |
| `mode` | `"text"` (plain text) or `"html"` (raw HTML body) |

```python
def fetch_content():
    return gl.nondet.web.render("https://example.com", mode="text")
```

---

## Equivalence Principles

### gl.eq_principle.strict_eq(func)

All validators must return identical results.

```python
def get_page():
    return gl.nondet.web.render(url, mode="text")

content = gl.eq_principle.strict_eq(get_page)
```

**Best for:** Boolean results, exact data, deterministic parsing.

### gl.eq_principle.prompt_comparative(func, criteria: str)

Leader and validators execute the task, then compare results using LLM.

```python
def classify():
    return gl.nondet.exec_prompt(f"Classify: {text}")

result = gl.eq_principle.prompt_comparative(
    classify,
    "Classification labels must match exactly"
)
```

**Best for:** LLM tasks where output format varies but meaning should match.

### gl.eq_principle.prompt_non_comparative(input, task: str, criteria: str)

Only leader executes the full task. Validators verify result meets criteria.

```python
result = gl.eq_principle.prompt_non_comparative(
    lambda: self.get_user_text(),  # Input to process
    task="Summarize the key points in 3 bullet points",
    criteria="Summary must be accurate, under 100 words, and contain exactly 3 points"
)
```

**Parameters:**
- `input`: Callable returning the input data
- `task`: What operation to perform
- `criteria`: Validation rules for validators

**Best for:** Expensive operations, subjective tasks, when re-execution is wasteful.

### gl.vm.run_nondet(leader, validator, eq_fn=None)

Custom leader/validator pattern with error handling.

```python
result = gl.vm.run_nondet(
    leader=lambda: fetch_and_process(),
    validator=lambda leader_result: verify_result(leader_result),
    eq_fn=lambda a, b: a == b  # Optional custom comparison
)
```

### gl.vm.run_nondet_unsafe(leader, validator)

Same as `run_nondet` but without sandbox protection for validators. 
Validator errors result in Disagree status.

```python
result = gl.vm.run_nondet_unsafe(
    leader=lambda: compute_value(),
    validator=lambda val: val > 0 and val < 100
)
```

**Use when:** Performance critical, simple validators that won't error.

---

## Storage Types

### Sized Integers

**Unsigned:**
```
u8, u16, u24, u32, u40, u48, u56, u64, u72, u80, u88, u96,
u104, u112, u120, u128, u136, u144, u152, u160, u168, u176,
u184, u192, u200, u208, u216, u224, u232, u240, u248, u256
```

**Signed:**
```
i8, i16, i24, i32, i40, i48, i56, i64, i72, i80, i88, i96,
i104, i112, i120, i128, i136, i144, i152, i160, i168, i176,
i184, i192, i200, i208, i216, i224, i232, i240, i248, i256
```

**Common choices:**
- `u256` - Token amounts, large numbers
- `u64` - Timestamps, counters
- `u32` - Small counters
- `i64` - Signed values

**bigint** - Arbitrary precision (use sparingly, prefer sized types)

### Address

20-byte blockchain address.

```python
# Construction
addr = Address("0x03FB09251eC05ee9Ca36c98644070B89111D4b3F")
addr = Address(bytes_value)

# Properties
addr.as_hex     # "0x03FB09251eC05ee9Ca36c98644070B89111D4b3F"
addr.as_bytes   # bytes

# Comparison
addr1 == addr2
```

### DynArray[T]

Dynamic array replacing `list[T]`.

```python
class MyContract(gl.Contract):
    items: DynArray[str]
    numbers: DynArray[u256]
    
    @gl.public.write
    def add_item(self, item: str) -> None:
        self.items.append(item)
    
    @gl.public.view
    def get_item(self, index: int) -> str:
        return self.items[index]
    
    @gl.public.view
    def count(self) -> int:
        return len(self.items)
```

**Methods:** `append()`, `pop()`, `__getitem__()`, `__setitem__()`, `__len__()`, `__iter__()`

### TreeMap[K, V]

Ordered map replacing `dict[K, V]`.

```python
class MyContract(gl.Contract):
    balances: TreeMap[Address, u256]
    names: TreeMap[str, str]
    
    @gl.public.write
    def set_balance(self, addr: str, amount: int) -> None:
        self.balances[Address(addr)] = u256(amount)
    
    @gl.public.view
    def get_balance(self, addr: str) -> u256:
        return self.balances.get(Address(addr), u256(0))
```

**Methods:** `get()`, `items()`, `keys()`, `values()`, `__getitem__()`, `__setitem__()`, `__contains__()`

---

## Custom Storage Types

### @allow_storage

Decorator for dataclasses that can be stored.

```python
from dataclasses import dataclass

@allow_storage
@dataclass
class UserProfile:
    name: str
    balance: u256
    active: bool

@allow_storage
@dataclass
class Item[T]:  # Generic types supported
    data: T
    label: str

class MyContract(gl.Contract):
    profiles: TreeMap[Address, UserProfile]
    string_items: DynArray[Item[str]]
```

### gl.storage.inmem_allocate(cls, *args)

Allocate generic storage types in memory.

```python
item = gl.storage.inmem_allocate(Item[str], "data", "label")
self.string_items.append(item)
```

### gl.storage.copy_to_memory(obj)

Copy storage object to memory for use in non-deterministic blocks.

```python
@gl.public.write
def process(self) -> None:
    data_copy = gl.storage.copy_to_memory(self.data)
    
    def analyze():
        # Can use data_copy here
        return gl.nondet.exec_prompt(f"Analyze: {data_copy}")
    
    result = gl.eq_principle.strict_eq(analyze)
```

---

## Contract Interactions

### gl.get_contract_at(address: Address)

Get reference to another contract.

```python
other = gl.get_contract_at(Address("0x..."))

# Call view method
result = other.view().get_value()

# Emit write message
other.emit(on='accepted').set_value("new")
```

### @gl.contract_interface

Define typed interface for other contracts.

```python
@gl.contract_interface
class TokenContract:
    class View:
        def balance_of(self, owner: Address) -> u256: ...
        def total_supply(self) -> u256: ...
    
    class Write:
        def transfer(self, to: Address, amount: u256) -> bool: ...

token = TokenContract(Address("0x..."))
balance = token.view().balance_of(addr)
```

### gl.deploy_contract(code, salt=None)

Deploy a new contract.

```python
# Without salt (random address)
gl.deploy_contract(code=contract_source)

# With salt (deterministic address)
child_addr = gl.deploy_contract(code=contract_source, salt=u256(1))
```

---

## EVM Interop

### @gl.evm.contract_interface

Define interface for EVM contracts.

```python
@gl.evm.contract_interface
class ERC20:
    class View:
        def balance_of(self, owner: Address) -> u256: ...
        def total_supply(self) -> u256: ...
    
    class Write:
        def transfer(self, to: Address, amount: u256) -> bool: ...
        def approve(self, spender: Address, amount: u256) -> bool: ...

token = ERC20(Address("0x..."))

# Read
supply = token.view().total_supply()

# Write (message only on finality!)
token.emit().transfer(recipient, u256(100))
```

**Note:** Messages to EVM contracts can only be emitted on finality.

---

## Balances

### self.balance

Get current contract's balance.

```python
@gl.public.view
def get_balance(self) -> u256:
    return self.balance
```

### Other contract balance

```python
other = gl.get_contract_at(addr)
balance = other.balance
```

---

## Error Handling

### UserError

Raise user-defined errors with messages.

```python
from genlayer import UserError

@gl.public.write
def withdraw(self, amount: int) -> None:
    if amount > self.balances[gl.message.sender_address]:
        raise UserError("Insufficient balance")
    # ...
```

### VMError

System errors (exit codes, resource limits). Caught automatically.

### Catching Errors from Sub-VMs

```python
try:
    result = other.view().some_method()
except UserError as e:
    # Handle user error from other contract
    pass
```

---

## Vector Store (Embeddings)

For contracts needing semantic search:

```python
# Requires additional dependency
# { "Seq": [
#   { "Depends": "py-lib-genlayer-embeddings:..." },
#   { "Depends": "py-genlayer:latest" }
# ]}

import numpy as np
import genlayer_embeddings as gle

@allow_storage
@dataclass
class StoreValue:
    id: u256
    text: str

class SearchContract(gl.Contract):
    vector_store: gle.VecDB[np.float32, typing.Literal[384], StoreValue]
    
    def get_embedding(self, txt: str):
        gen = gle.SentenceTransformer("all-MiniLM-L6-v2")
        return gen(txt)
    
    @gl.public.write
    def add(self, text: str, id: int) -> None:
        emb = self.get_embedding(text)
        self.vector_store.insert(emb, StoreValue(text=text, id=u256(id)))
    
    @gl.public.view
    def search(self, query: str) -> dict | None:
        emb = self.get_embedding(query)
        results = list(self.vector_store.knn(emb, 1))
        if not results:
            return None
        r = results[0]
        return {"id": r.value.id, "text": r.value.text, "similarity": 1 - r.distance}
```

---

## Upgradability

Contracts can be made upgradable or non-upgradable.

```python
class Proxy(gl.Contract):
    def __init__(self, upgrader: Address):
        root = gl.storage.Root.get()
        root.upgraders.append(upgrader)
    
    @gl.public.write
    def update_code(self, new_code: bytes):
        root = gl.storage.Root.get()
        code_vla = root.code.get()
        code_vla.truncate()  # Clear existing
        code_vla.extend(new_code)  # Set new
```

**Note:** If sender not in upgraders list, `truncate()` will raise VMError.

---

## Default Values

Storage is zero-initialized:
- Integers: `0`
- Strings: `""`
- Booleans: `False`
- DynArray: empty
- TreeMap: empty

Struct types are recursively zero-initialized.
