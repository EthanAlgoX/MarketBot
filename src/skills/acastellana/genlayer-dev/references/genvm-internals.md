# GenVM Internals

Technical details from GenVM Architecture Decision Records (ADRs).

---

## ABI (Application Binary Interface)

### Method Calls
```json
{
    "method": "method_name",
    "args": ["positional", "args"],
    "kwargs": {"named": "args"}
}
```

### Constructor Calls
```json
{
    "args": ["positional"],
    "kwargs": {"named": "value"}
}
```

### Schema Retrieval
Call with `"method": "#get-schema"` returns JSON schema of contract.

### Type System
- **Primitives**: `"bool"`, `"null"`, `"int"`, `"string"`, `"bytes"`, `"address"`
- **Terminals**: `"array"`, `"dict"`, `"any"`
- **Unions**: `{ "$or": [type1, type2] }`
- **Arrays**: `[type1, type2, { "$rep": type }]`
- **References**: `{ "$ref": "/path" }`

---

## Storage System

### Three-Tier Architecture

1. **Low-Level**: Linear memory slots with `read`/`write` operations
2. **Mid-Level**: Host-optimized caching and batching
3. **High-Level**: Language-specific encoding

### Storage Layout

**Constant-size types**: Stored sequentially in-place
```
[field1][field2][field3]...
```

**Variable-size types**: Data at `hash_combine(slot_addr, offset)`
```
Slot: [size_marker] → Data at hash(slot, offset)
```

### Why Not Native Python Types?

- `list` and `dict` can't be used directly for storage
- Use `DynArray[T]` and `TreeMap[K,V]` instead
- Serialization of native types causes full storage rewrites
- Storage-aware types enable efficient deltas

### Storage Encoding

Storage requires static typing via annotations:
```python
class MyContract(gl.Contract):
    counter: u256          # Fixed-size: stored inline
    data: TreeMap[str, str]  # Variable-size: hash-addressed
```

---

## Non-Deterministic Blocks

### Constraints

1. **No storage access** - Storage inaccessible in non-det blocks
2. **No interpreter state transfer** - Global changes don't persist
3. **Must be wrapped** - Call via `gl.eq_principle_*` functions

### Data Flow
```
Deterministic Code
      ↓
Copy data to memory (gl.storage.copy_to_memory)
      ↓
Non-deterministic block executes
      ↓
Result returned to deterministic code
      ↓
Storage updated deterministically
```

### Example Pattern
```python
# Copy needed data BEFORE the non-det block
data = gl.storage.copy_to_memory(self.user_data)
url = self.target_url  # Simple types can be captured directly

def non_det_operation():
    # Can use: data, url (captured)
    # Cannot use: self.anything (storage)
    web = gl.nondet.web.render(url, mode="text")
    return gl.nondet.exec_prompt(f"Process: {data}\n{web}")

result = gl.eq_principle.strict_eq(non_det_operation)
self.result = result  # Now can write to storage
```

---

## Code Loading & Deployment

### Contract File Structure
```python
# v0.1.0                              ← ABI version
# { "Depends": "py-genlayer:latest" } ← Dependencies

from genlayer import *

class MyContract(gl.Contract):
    ...
```

### Dependency Declaration

**Single dependency:**
```python
# { "Depends": "py-genlayer:0.1.0" }
```

**Multiple dependencies (sequential):**
```python
# { "Seq": [
#   { "Depends": "py-lib-genlayer-embeddings:0.1.0" },
#   { "Depends": "py-genlayer:0.1.0" }
# ]}
```

### Deployment Process

1. Code parsed and validated
2. Dependencies resolved
3. Schema extracted via `#get-schema`
4. Constructor executed with provided args
5. Contract address assigned
6. Initial state committed

---

## Sandboxing (WASI)

GenVM uses WebAssembly System Interface (WASI) for isolation:

- **Memory isolation**: Each contract has separate memory
- **Deterministic execution**: Same inputs → same outputs
- **Resource limits**: Gas metering, memory caps
- **Host functions**: Controlled interface to GenLayer

### Host Communication

Contracts communicate with host via defined syscalls:
- Storage read/write
- Web fetching
- LLM execution
- Contract calls
- Balance queries

---

## Versioning

### Contract Versions
```python
# v0.1.0  ← This line is mandatory
```

Version affects:
- Available SDK features
- ABI encoding
- Storage format

### SDK Versions

Pin for production:
```python
# { "Depends": "py-genlayer:0.1.0" }
```

Use `latest` only for development:
```python
# { "Depends": "py-genlayer:latest" }
```

---

## Code Upgradability

Contracts can be upgradable or immutable:

### Upgradable Pattern
```python
class UpgradableContract(gl.Contract):
    def __init__(self, upgrader: Address):
        root = gl.storage.Root.get()
        root.upgraders.append(upgrader)
    
    @gl.public.write
    def upgrade(self, new_code: bytes) -> None:
        root = gl.storage.Root.get()
        # Only authorized upgraders can call truncate()
        code_vla = root.code.get()
        code_vla.truncate()
        code_vla.extend(new_code)
```

### Immutable (Default)
If no upgraders are set, `truncate()` raises VMError.

---

## Float Handling

**⚠️ Floats are NOT recommended for consensus-critical values!**

- Different validators may compute slightly different results
- Use fixed-point arithmetic instead:

```python
# Instead of: price = 1.5
# Use: price_cents = u256(150)  # 1.50 as integer cents

# For percentages:
# Instead of: rate = 0.05
# Use: rate_bps = u256(500)  # 5% as basis points (500/10000)
```

If floats are unavoidable, use appropriate equivalence principles with tolerance.

---

## Calldata Encoding

All data passed to contracts is encoded as "calldata":

### Supported Types
- `null`
- `bool`
- `int` (arbitrary precision in calldata, but use sized types in storage)
- `string`
- `bytes`
- `address`
- `array`
- `dict`

### Encoding Notes
- Addresses: 20-byte values
- Integers: Variable-length encoding
- Strings: UTF-8 encoded
- Arrays: Length-prefixed
- Dicts: Key-value pairs
