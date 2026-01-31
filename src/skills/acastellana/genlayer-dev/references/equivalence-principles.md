# Equivalence Principles - In-Depth Guide

The Equivalence Principle is GenLayer's solution for achieving consensus on non-deterministic operations like LLM calls and web fetches.

## The Core Problem

Traditional blockchains require determinism - every node must compute the exact same result. But:
- LLMs produce varying outputs for the same prompt
- Web content can differ between fetches
- Timing differences cause data variations

GenLayer solves this with the **Leader/Validator Pattern**.

---

## How It Works

### Leader/Validator Pattern

1. **Leader Selection**: One validator randomly chosen as "leader"
2. **Leader Execution**: Leader runs the non-deterministic operation
3. **Result Broadcast**: Leader's result shared with validators
4. **Validation**: Validators verify/compare the result
5. **Consensus**: Majority agreement accepts the result

```
Transaction → Random Leader Selected → Leader Executes → Result to Validators
                                                              ↓
                                                    Validators Verify
                                                              ↓
                                                    Consensus Reached
```

---

## Equivalence Principle Options

### 1. Strict Equality (`strict_eq`)

**How it works:**
- All validators execute the same function
- Results must match **exactly**

**When to use:**
- Boolean operations
- Objective, factual data
- Exact classifications
- Parsed/structured data that should be identical

**Example:**
```python
def check_website():
    content = gl.nondet.web.render("https://example.com", mode="text")
    return "maintenance" in content.lower()

is_maintenance = gl.eq_principle.strict_eq(check_website)
```

**Advantages:**
- Simplest and most predictable
- No LLM overhead for validation

**Disadvantages:**
- Any variation causes failure
- Not suitable for LLM text outputs

---

### 2. Prompt Comparative (`prompt_comparative`)

**How it works:**
- Leader AND validators execute the same task
- Results compared using LLM with given criteria

**When to use:**
- LLM outputs where meaning matters, not exact text
- Classifications that might have format variations
- Any task where semantic equivalence matters

**Parameters:**
- `func`: Function to execute
- `criteria`: String describing what must match

**Example:**
```python
def get_sentiment():
    prompt = f"""
    Classify the sentiment of this text as positive, negative, or neutral.
    Text: {user_text}
    Respond with only the classification word.
    """
    return gl.nondet.exec_prompt(prompt)

result = gl.eq_principle.prompt_comparative(
    get_sentiment,
    "The sentiment classification must be the same"
)
```

**Advantages:**
- Handles LLM output variations
- Still verifies independently

**Disadvantages:**
- Higher computational cost (all validators execute)
- Additional LLM call for comparison

---

### 3. Prompt Non-Comparative (`prompt_non_comparative`)

**How it works:**
- Only LEADER executes the full task
- Validators check if result meets criteria (without re-executing)

**Parameters:**
- `input`: Callable returning the input data
- `task`: String describing what to do
- `criteria`: Validation rules for the output

**When to use:**
- Expensive operations (save computation)
- Subjective tasks with clear acceptance criteria
- When re-execution is wasteful

**Example:**
```python
result = gl.eq_principle.prompt_non_comparative(
    lambda: article_text,  # Input
    task="Summarize the main points in 3 bullet points",
    criteria="""
    - Summary must have exactly 3 bullet points
    - Each point must be factually present in the original
    - Total length under 100 words
    - No hallucinated information
    """
)
```

**Advanced Example - ERC20 with LLM:**
```python
input = f"""
Current balances: {json.dumps(self.get_balances())}
Transaction: sender={sender}, recipient={recipient}, amount={amount}
"""

task = """
Process the transaction if sender has sufficient balance.
Return updated balances in JSON format:
{"transaction_success": bool, "updated_balances": {address: balance}}
"""

criteria = """
- Sender balance decreased by exact amount
- Recipient balance increased by exact amount
- Total supply unchanged
- Invalid transactions rejected
"""

result = gl.eq_principle.prompt_non_comparative(
    lambda: input,
    task=task,
    criteria=criteria
)
```

**Advantages:**
- Most efficient (leader-only execution)
- Flexible criteria-based validation

**Disadvantages:**
- Relies on criteria quality
- Validators don't independently verify

---

### 4. Custom Pattern (`run_nondet`)

**How it works:**
- You define both leader and validator functions
- Full control over validation logic

**When to use:**
- Complex validation requirements
- Need custom comparison logic
- Production environments needing error handling

**Example:**
```python
def leader_fetch():
    data = gl.nondet.web.render(url, mode="text")
    # Parse and return structured data
    return {"price": extract_price(data), "timestamp": extract_time(data)}

def validator_check(leader_result):
    # Independently verify
    my_data = gl.nondet.web.render(url, mode="text")
    my_price = extract_price(my_data)
    
    # Allow 5% tolerance
    price_diff = abs(leader_result["price"] - my_price) / my_price
    return price_diff < 0.05

result = gl.vm.run_nondet(
    leader=leader_fetch,
    validator=validator_check
)
```

**With error handling:**
```python
result = gl.vm.run_nondet(
    leader=lambda: risky_operation(),
    validator=lambda r: validate(r),
    eq_fn=lambda a, b: abs(a - b) < tolerance  # Custom comparison
)
```

---

### 5. Unsafe Custom Pattern (`run_nondet_unsafe`)

Same as `run_nondet` but without sandbox protection.

**When to use:**
- Performance-critical applications
- Simple validators that won't error
- When you need maximum speed

**⚠️ Warning:** Validator errors become Disagree status directly.

```python
result = gl.vm.run_nondet_unsafe(
    leader=lambda: compute_value(),
    validator=lambda v: isinstance(v, int) and 0 < v < 1000
)
```

---

## Writing Secure Validators

### ❌ Bad Example
```python
def bad_validator(leader_result):
    return True  # Always accepts - DANGEROUS!
```

This allows a malicious leader to return arbitrary data.

### ✅ Good Example - Independent Verification
```python
def good_validator(leader_result):
    # Fetch data independently
    my_data = gl.nondet.web.render(url, mode="text")
    my_result = parse_score(my_data)
    
    # Compare with tolerance
    return abs(leader_result["score"] - my_result) <= 1
```

### ✅ Good Example - LLM Validation
```python
def llm_validator(leader_result):
    prompt = f"""
    Verify this analysis is reasonable for the given data:
    Data: {original_data}
    Analysis: {leader_result}
    
    Respond only with: valid or invalid
    """
    verdict = gl.nondet.exec_prompt(prompt)
    return "valid" in verdict.lower()
```

---

## Key Principles for Custom Validators

### 1. Independent Verification
Don't blindly trust the leader. Verify independently when possible.

### 2. Tolerance for Non-Determinism
For AI/web data, allow reasonable variations:
```python
# Use similarity thresholds
def validator(leader_text):
    my_text = get_content()
    similarity = compute_similarity(leader_text, my_text)
    return similarity > 0.9

# Account for timing
def validator(leader_price):
    my_price = fetch_price()
    return abs(leader_price - my_price) / my_price < 0.02  # 2% tolerance
```

### 3. Error Handling
```python
def safe_validator(leader_result):
    if isinstance(leader_result, Exception):
        # Leader had error
        return False
    
    try:
        return verify(leader_result)
    except Exception:
        return False
```

### 4. Security First
When in doubt, reject. It's better to fail a transaction than accept bad data.

---

## Best Practices Summary

| Scenario | Recommended Approach |
|----------|---------------------|
| Boolean result | `strict_eq` |
| Exact data match | `strict_eq` |
| LLM classification | `prompt_comparative` |
| Text generation | `prompt_non_comparative` |
| Expensive computation | `prompt_non_comparative` |
| Price/data with tolerance | Custom `run_nondet` |
| Performance critical | `run_nondet_unsafe` |

---

## Decision Flowchart

```
Is result deterministic? (bool, parsed exact data)
├── Yes → strict_eq
└── No → Is it LLM output?
    ├── Yes → Should all validators execute?
    │   ├── Yes → prompt_comparative
    │   └── No (expensive) → prompt_non_comparative
    └── No → Need custom validation?
        ├── Yes → run_nondet (or _unsafe)
        └── No → prompt_comparative with custom criteria
```

---

## Common Pitfalls

### 1. Using strict_eq for LLM outputs
LLMs rarely produce identical text. Use `prompt_comparative` or `prompt_non_comparative`.

### 2. Weak validation criteria
Be specific:
```python
# Bad
criteria = "Response should be reasonable"

# Good
criteria = """
- Must be valid JSON with keys: sentiment, confidence
- Sentiment must be one of: positive, negative, neutral
- Confidence must be a number between 0 and 1
"""
```

### 3. No tolerance for timing
Web data changes. Allow reasonable differences:
```python
# Bad
return leader_price == my_price

# Good
return abs(leader_price - my_price) < 0.01 * my_price
```

### 4. Accessing storage in non-det blocks
Storage is inaccessible in non-deterministic blocks:
```python
# Bad
def process():
    return gl.nondet.exec_prompt(f"Data: {self.data}")  # ERROR!

# Good
data_copy = gl.storage.copy_to_memory(self.data)
def process():
    return gl.nondet.exec_prompt(f"Data: {data_copy}")
```
