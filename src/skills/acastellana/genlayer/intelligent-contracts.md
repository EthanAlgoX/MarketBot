# Intelligent Contracts Developer Guide

Intelligent Contracts are AI-powered smart contracts that combine traditional blockchain capabilities with natural language processing and web connectivity. Written in Python, they can understand human language, process external data, and make complex decisions based on real-world information.

## Key Features

### Natural Language Processing (NLP)
Contracts leverage LLMs to process and understand human language inputs, enabling complex text-based instructions beyond simple conditional logic.

### Web Connectivity
Contracts can fetch real-time information from web APIs, bridging on-chain and off-chain environments without traditional oracles.

### Non-Deterministic Operations
Handle operations with unpredictable outputs through the Equivalence Principle—validators can reach consensus even when processing non-deterministic results.

---

## Contract Structure

### Basic Structure
```python
import genlayer as gl

@gl.contract
class MyContract(gl.Contract):
    # State variables with type annotations
    counter: u32
    owner: Address
    balances: TreeMap[Address, u256]
    
    def __init__(self):
        # Constructor
        self.owner = gl.message.sender_address
    
    @gl.public.view
    def get_counter(self) -> u32:
        """Read-only method - doesn't modify state"""
        return self.counter
    
    @gl.public.write
    def increment(self):
        """Write method - can modify state"""
        self.counter += u32(1)
    
    @gl.public.write.payable
    def deposit(self):
        """Payable method - can receive value"""
        self.balances[gl.message.sender_address] += gl.message.value
```python

### Method Decorators
| Decorator | Description |
|-----------|-------------|
| `@gl.public.view` | Read-only, doesn't modify state |
| `@gl.public.write` | Can modify contract state |
| `@gl.public.write.payable` | Can modify state and receive value |

---

## Storage

### Basic Types
```python
class MyContract(gl.Contract):
    name: str
    count: u32
    amount: u256
    owner: Address
    active: bool
```python

### DynArray (instead of `list`)
```python
class MyContract(gl.Contract):
    items: DynArray[str]
    
    @gl.public.write
    def add_item(self, item: str):
        self.items.append(item)
```python

### TreeMap (instead of `dict`)
```python
class MyContract(gl.Contract):
    balances: TreeMap[Address, u256]
    
    @gl.public.write
    def set_balance(self, addr: Address, amount: u256):
        self.balances[addr] = amount
```python

### Custom Storage Types
```python
@allow_storage
class UserProfile:
    name: str
    score: u32
    joined: u64

class MyContract(gl.Contract):
    profiles: TreeMap[Address, UserProfile]
```python

### Type Restrictions
- Use `DynArray[T]` instead of `list[T]`
- Use `TreeMap[K, V]` instead of `dict[K, V]`
- Use sized integers (`u32`, `i64`) instead of `int`
- Use `bigint` only for arbitrary precision needs
- All generic types must be fully specified
- Storage is zero-initialized

### Memory Operations
Copy storage objects to memory for non-deterministic operations:
```python
# Copy to memory for processing
data = self.storage_var.copy_to_memory()
```python

---

## Balances

### Contract Balance
```python
@gl.public.view
def get_balance(self) -> u256:
    return self.balance

@gl.public.write.payable
def deposit(self):
    # self.balance automatically updated
    pass
```python

### Other Contract's Balance
```python
other_balance = gl.get_balance(other_address)
```python

### Transferring Funds
```python
@gl.public.write
def withdraw(self, amount: u256, to: Address):
    gl.transfer(to, amount)
```python

---

## Interacting with Other Contracts

### Intelligent Contracts
```python
# Dynamic typing
other = gl.get_contract_at(address)
result = other.view().some_method()

# Static typing (recommended for IDE support)
@gl.contract_interface
class OtherContractIface:
    class View:
        def get_value(self) -> u256: ...
    class Write:
        def set_value(self, v: u256): ...

other = OtherContractIface(address)
value = other.view().get_value()
```python

### Emitting Messages
```python
# Async message on acceptance
other.emit(on='accepted').update_status("pending")

# Async message on finality
other.emit(on='finalized').update_status("confirmed")
```python

### Deploying Contracts
```python
# Deploy without salt (random address)
gl.deploy_contract(code=contract_code)

# Deploy with salt (deterministic address)
child_address = gl.deploy_contract(code=contract_code, salt=u256(1))
```python

### EVM Contracts
```python
@gl.evm.contract_interface
class TokenContract:
    class View:
        def balance_of(self, owner: Address) -> u256: ...
        def total_supply(self) -> u256: ...
    class Write:
        def transfer(self, to: Address, amount: u256) -> bool: ...

token = TokenContract(token_address)
supply = token.view().total_supply()
token.emit().transfer(receiver, u256(100))  # On finality only
```python

---

## Non-Deterministic Features

### LLM Calls
```python
@gl.public.write
def analyze_text(self, text: str) -> str:
    # LLM processes the text
    result = gl.llm.complete(
        prompt=f"Analyze the sentiment of: {text}",
        # Define equivalence criteria
        equivalence="semantic_similarity > 0.9"
    )
    return result
```python

### Web Data Access
```python
@gl.public.write
def get_price(self, symbol: str) -> u256:
    # Fetch from web API
    data = gl.web.fetch(f"https://api.example.com/price/{symbol}")
    price = parse_price(data)
    return price
```python

### Vector Storage
```python
from genlayer.std import VectorStore

class SearchableContract(gl.Contract):
    store: VectorStore
    
    @gl.public.write
    def add_text(self, text: str, metadata: str):
        self.store.add(text, metadata=metadata)
    
    @gl.public.view
    def search(self, query: str, k: u32) -> DynArray[str]:
        # Find k most similar texts
        results = self.store.similarity_search(query, k=k)
        return results
```python

---

## Error Handling

### Exit Codes (Unrecoverable)
```python
if condition_failed:
    gl.exit(1)  # Terminates execution immediately
```python

### UserError
```python
raise gl.UserError("Insufficient balance")
```python

### Catching Errors
```python
try:
    other_contract.view().risky_method()
except gl.UserError as e:
    # Handle user-generated error
    pass
```python

### VM Result Types
- **Return**: Successful execution with encoded result
- **VMError**: VM errors (exit codes, resource limits)
- **UserError**: User-generated errors with UTF-8 messages
- **InternalError**: Critical VM failures (not visible to contracts)

---

## Upgradability

Contracts can be made upgradable through frozen storage slots and upgrader lists.

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
        code_vla.extend(new_code)  # Put new code
```python

- Empty locked upgraders list + frozen code slot = non-upgradable
- Only addresses in upgraders list can modify frozen slots

---

## Best Practices

### Defining Equivalence Criteria
Always specify clear equivalence criteria for non-deterministic operations:
```python
# Good: Clear margin of error
gl.llm.complete(prompt, equivalence="numeric_diff < 0.5")

# Good: Semantic similarity threshold
gl.llm.complete(prompt, equivalence="semantic_similarity > 0.85")

# Bad: No criteria (unreliable consensus)
gl.llm.complete(prompt)
```python

### Testing
- Test deterministic logic thoroughly
- Test non-deterministic operations with various inputs
- Consider edge cases where LLM outputs might diverge

### Security
- Validate all external data
- Handle potential web API failures
- Be aware of prompt injection risks
- Use grey boxing for sensitive operations

### Performance
- LLM calls and web fetches add latency and cost
- Batch operations when possible
- Cache results where appropriate
- Use comparative vs non-comparative equivalence based on needs

---

## Example: Prediction Market

```python
import genlayer as gl

@gl.contract
class PredictionMarket(gl.Contract):
    predictions: TreeMap[Address, str]
    points: TreeMap[Address, u32]
    resolved: bool
    
    @gl.public.write
    def predict(self, team: str):
        self.predictions[gl.message.sender_address] = team
    
    @gl.public.write
    def resolve(self, match_info: str):
        # Use LLM to determine winner from match data
        result = gl.llm.complete(
            prompt=f"Who won the match? {match_info}. Reply with team name only.",
            equivalence="exact_match"
        )
        
        # Award points to correct predictions
        for addr, prediction in self.predictions.items():
            if prediction == result:
                self.points[addr] += u32(1)
        
        self.resolved = True
```python

---

## Resources

- **SDK Docs:** https://sdk.genlayer.com
- **API Reference:** https://docs.genlayer.com/developers
- **Example Contracts:** https://github.com/genlayerlabs/genvm/tree/main/examples
- **Boilerplate Project:** https://docs.genlayer.com/developers/decentralized-applications/project-boilerplate
