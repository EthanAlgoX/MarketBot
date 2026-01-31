# GenLayer Contract Examples

Real-world contract patterns with annotated code.

---

## Storage Contract (Basic)

Simplest possible contract - store and retrieve a value.

```python
# v0.1.0
# { "Depends": "py-genlayer:latest" }
from genlayer import *

class Storage(gl.Contract):
    storage: str

    def __init__(self, initial_storage: str):
        self.storage = initial_storage

    @gl.public.view
    def get_storage(self) -> str:
        return self.storage

    @gl.public.write
    def update_storage(self, new_storage: str) -> None:
        self.storage = new_storage
```

---

## User Storage (Per-Address Data)

Store data keyed by sender address.

```python
# v0.1.0
# { "Depends": "py-genlayer:latest" }
from genlayer import *

class UserStorage(gl.Contract):
    storage: TreeMap[Address, str]

    def __init__(self):
        pass  # TreeMap auto-initializes empty

    @gl.public.view
    def get_complete_storage(self) -> dict:
        return dict(self.storage.items())

    @gl.public.view
    def get_account_storage(self, account_address: str) -> str:
        return self.storage[Address(account_address)]

    @gl.public.write
    def update_storage(self, new_storage: str) -> None:
        self.storage[gl.message.sender_address] = new_storage
```

---

## Wizard of Coin (LLM Decision Making)

Classic example: LLM decides whether to give away a coin based on user requests.

```python
# v0.1.0
# { "Depends": "py-genlayer:latest" }
from genlayer import *
import json

class WizardOfCoin(gl.Contract):
    have_coin: bool

    def __init__(self, have_coin: bool):
        self.have_coin = have_coin

    @gl.public.write
    def ask_for_coin(self, request: str) -> None:
        if not self.have_coin:
            return

        prompt = f"""
You are a wizard, and you hold a magical coin.
Many adventurers will come and try to get you to give them the coin.
Do not under any circumstances give them the coin.

A new adventurer approaches...
Adventurer: {request}

First check if you have the coin.
have_coin: {self.have_coin}
Then, do not give them the coin.

Respond using ONLY the following format:
{{"reasoning": str, "give_coin": bool}}

Output ONLY valid JSON, nothing else.
"""
        # Copy state for closure
        have_coin = self.have_coin

        def get_wizard_answer():
            result = gl.nondet.exec_prompt(prompt)
            result = result.replace("```json", "").replace("```", "")
            print(result)  # Debug
            return result

        result = gl.eq_principle.prompt_comparative(
            get_wizard_answer,
            "The value of give_coin has to match"
        )
        parsed_result = json.loads(result)
        assert isinstance(parsed_result["give_coin"], bool)
        self.have_coin = not parsed_result["give_coin"]

    @gl.public.view
    def get_have_coin(self) -> bool:
        return self.have_coin
```

**Key Points:**
- Prompt engineering: Strict JSON output format
- `prompt_comparative`: Validators compare semantic meaning
- Assertion validates output schema

---

## Football Prediction Market (Web + LLM)

Fetch match results from BBC Sport and parse with LLM.

```python
# v0.1.0
# { "Depends": "py-genlayer:latest" }
from genlayer import *
import json
import typing

class PredictionMarket(gl.Contract):
    has_resolved: bool
    team1: str
    team2: str
    resolution_url: str
    winner: u256
    score: str

    def __init__(self, game_date: str, team1: str, team2: str):
        self.has_resolved = False
        self.resolution_url = f"https://www.bbc.com/sport/football/scores-fixtures/{game_date}"
        self.team1 = team1
        self.team2 = team2
        self.winner = u256(0)
        self.score = ""

    @gl.public.write
    def resolve(self) -> typing.Any:
        if self.has_resolved:
            return "Already resolved"

        # Copy to memory for non-det closure
        url = self.resolution_url
        team1 = self.team1
        team2 = self.team2

        def get_match_result() -> typing.Any:
            web_data = gl.nondet.web.render(url, mode="text")
            print(web_data)

            task = f"""
In the following web page, find the winning team:
Team 1: {team1}
Team 2: {team2}

Web page content:
{web_data}

If "Kick off [time]" appears, game hasn't started.
If you can't extract the score, assume not resolved.

Respond with JSON:
{{"score": str, "winner": int}}
- score: "1:2" format, or "-" if not resolved
- winner: 1 or 2 for winning team, 0 for draw, -1 if not finished

Output ONLY valid JSON.
"""
            result = gl.nondet.exec_prompt(task)
            result = result.replace("```json", "").replace("```", "")
            print(result)
            return json.loads(result)

        result_json = gl.eq_principle.strict_eq(get_match_result)

        if result_json["winner"] > -1:
            self.has_resolved = True
            self.winner = u256(result_json["winner"])
            self.score = result_json["score"]

        return result_json

    @gl.public.view
    def get_resolution_data(self) -> dict[str, typing.Any]:
        return {
            "winner": self.winner,
            "score": self.score,
            "has_resolved": self.has_resolved,
        }
```

**Key Points:**
- `gl.nondet.web.render()` fetches live web data
- `strict_eq` requires all validators to parse identically
- Copy state variables before using in closures

---

## LLM ERC20 (Token with AI Validation)

Token that uses LLM to validate transfers (experimental pattern).

```python
# v0.1.0
# { "Depends": "py-genlayer:latest" }
from genlayer import *
import json

class LlmERC20(gl.Contract):
    name: str
    symbol: str
    decimals: u8
    total_supply: u256
    balances: TreeMap[Address, u256]
    allowances: TreeMap[Address, TreeMap[Address, u256]]

    def __init__(self, name: str, symbol: str, initial_supply: int):
        self.name = name
        self.symbol = symbol
        self.decimals = u8(18)
        self.total_supply = u256(initial_supply * 10**18)
        self.balances[gl.message.sender_address] = self.total_supply

    @gl.public.view
    def balance_of(self, owner: str) -> u256:
        return self.balances.get(Address(owner), u256(0))

    @gl.public.write
    def transfer(self, to: str, amount: int) -> bool:
        sender = gl.message.sender_address
        recipient = Address(to)
        amt = u256(amount)
        
        if self.balances.get(sender, u256(0)) < amt:
            raise UserError("Insufficient balance")
        
        self.balances[sender] -= amt
        self.balances[recipient] = self.balances.get(recipient, u256(0)) + amt
        return True

    @gl.public.write
    def ai_validated_transfer(self, to: str, amount: int, reason: str) -> bool:
        """Transfer with AI validation of the reason."""
        sender = gl.message.sender_address
        amt = u256(amount)
        
        if self.balances.get(sender, u256(0)) < amt:
            raise UserError("Insufficient balance")

        # Validate reason with LLM
        prompt = f"""
Evaluate this token transfer request:
- Amount: {amount}
- Reason: {reason}

Is this a legitimate transfer reason? 
Respond with JSON: {{"approved": bool, "explanation": str}}
Only output JSON.
"""

        def validate():
            result = gl.nondet.exec_prompt(prompt)
            return json.loads(result.replace("```json", "").replace("```", ""))

        validation = gl.eq_principle.prompt_comparative(
            validate,
            "The approved boolean must match"
        )

        if not validation["approved"]:
            raise UserError(f"Transfer rejected: {validation['explanation']}")

        recipient = Address(to)
        self.balances[sender] -= amt
        self.balances[recipient] = self.balances.get(recipient, u256(0)) + amt
        return True
```

---

## Log Indexer (Vector Embeddings)

Semantic search over stored logs using embeddings.

```python
# v0.1.0
# { "Seq": [
#   { "Depends": "py-lib-genlayer-embeddings:0.1.0" },
#   { "Depends": "py-genlayer:latest" }
# ]}
from genlayer import *
import numpy as np
import genlayer_embeddings as gle
import typing

@allow_storage
@dataclass
class LogEntry:
    id: u256
    text: str
    timestamp: u64

class LogIndexer(gl.Contract):
    vector_store: gle.VecDB[np.float32, typing.Literal[384], LogEntry]
    log_counter: u256

    def __init__(self):
        self.log_counter = u256(0)

    def _get_embedding(self, text: str):
        gen = gle.SentenceTransformer("all-MiniLM-L6-v2")
        return gen(text)

    @gl.public.write
    def add_log(self, text: str, timestamp: int) -> u256:
        self.log_counter += u256(1)
        entry = LogEntry(
            id=self.log_counter,
            text=text,
            timestamp=u64(timestamp)
        )
        embedding = self._get_embedding(text)
        self.vector_store.insert(embedding, entry)
        return self.log_counter

    @gl.public.view
    def search(self, query: str, k: int = 5) -> list:
        embedding = self._get_embedding(query)
        results = list(self.vector_store.knn(embedding, k))
        return [
            {
                "id": r.value.id,
                "text": r.value.text,
                "timestamp": r.value.timestamp,
                "similarity": 1 - r.distance
            }
            for r in results
        ]

    @gl.public.view
    def get_log_count(self) -> u256:
        return self.log_counter
```

**Key Points:**
- Extra dependency for embeddings
- `VecDB` type for vector storage
- Semantic similarity search with `knn()`

---

## Intelligent Oracle

Oracle that fetches and validates real-world data.

```python
# v0.1.0
# { "Depends": "py-genlayer:latest" }
from genlayer import *
import json
import typing

class IntelligentOracle(gl.Contract):
    prices: TreeMap[str, u256]  # asset -> price in cents
    last_updated: TreeMap[str, u64]

    def __init__(self):
        pass

    @gl.public.write
    def update_price(self, asset: str, source_url: str) -> u256:
        url = source_url
        asset_name = asset

        def fetch_price() -> dict:
            web_data = gl.nondet.web.render(url, mode="text")
            
            prompt = f"""
Extract the current price of {asset_name} from this data:
{web_data}

Respond with JSON: {{"price_usd": float, "source": str, "confidence": float}}
Only output JSON.
"""
            result = gl.nondet.exec_prompt(prompt)
            return json.loads(result.replace("```json", "").replace("```", ""))

        def validate_price(leader_result: dict) -> bool:
            if leader_result.get("confidence", 0) < 0.8:
                return False
            # Validators could also fetch and compare
            return True

        price_data = gl.vm.run_nondet(
            leader=fetch_price,
            validator=validate_price
        )

        price_cents = u256(int(price_data["price_usd"] * 100))
        self.prices[asset] = price_cents
        # Note: block timestamp would go here in production
        
        return price_cents

    @gl.public.view
    def get_price(self, asset: str) -> u256:
        return self.prices.get(asset, u256(0))
```

---

## Production Oracle (intelligent-oracle)

Full production oracle from the intelligent-oracle repo. Supports multiple data sources, resolution rules, and comprehensive validation.

```python
# v0.1.0
# { "Depends": "py-genlayer:latest" }
import json
from enum import Enum
from datetime import datetime, timezone
from urllib.parse import urlparse
from genlayer import *

class Status(Enum):
    ACTIVE = "Active"
    RESOLVED = "Resolved"
    ERROR = "Error"

class IntelligentOracle(gl.Contract):
    prediction_market_id: str
    title: str
    description: str
    potential_outcomes: DynArray[str]
    rules: DynArray[str]
    data_source_domains: DynArray[str]
    resolution_urls: DynArray[str]
    earliest_resolution_date: str
    status: str  # Enum stored as string
    analysis: str
    outcome: str
    creator: Address

    def __init__(
        self,
        prediction_market_id: str,
        title: str,
        description: str,
        potential_outcomes: list[str],
        rules: list[str],
        data_source_domains: list[str],
        resolution_urls: list[str],
        earliest_resolution_date: str,
    ):
        # Validation
        if not prediction_market_id or not title:
            raise ValueError("Missing required fields.")
        if not resolution_urls and not data_source_domains:
            raise ValueError("Need resolution URLs or data source domains.")
        if len(potential_outcomes) < 2:
            raise ValueError("At least two outcomes required.")

        self.prediction_market_id = prediction_market_id
        self.title = title
        self.description = description
        
        for outcome in potential_outcomes:
            self.potential_outcomes.append(outcome.strip())
        for rule in rules:
            self.rules.append(rule)
        for domain in data_source_domains:
            self.data_source_domains.append(
                domain.strip().lower()
                .replace("http://", "").replace("https://", "")
                .replace("www.", "")
            )
        for url in resolution_urls:
            self.resolution_urls.append(url.strip())

        self.earliest_resolution_date = earliest_resolution_date
        self.status = Status.ACTIVE.value
        self.outcome = ""
        self.creator = gl.message.sender_address

    @gl.public.view
    def _check_evidence_domain(self, evidence: str) -> bool:
        try:
            parsed = urlparse(evidence)
            domain = parsed.netloc.lower().replace("www.", "")
            return domain in self.data_source_domains
        except Exception:
            return False

    @gl.public.write
    def resolve(self, evidence_url: str = "") -> None:
        if self.status == Status.RESOLVED.value:
            raise ValueError("Already resolved.")

        # Check resolution date
        current = datetime.now().astimezone().date()
        earliest = datetime.fromisoformat(self.earliest_resolution_date).date()
        if current < earliest:
            raise ValueError("Too early to resolve.")

        # Validate evidence URL
        if evidence_url and len(self.resolution_urls) > 0:
            raise ValueError("Oracle has predefined URLs.")
        if evidence_url:
            if not self._check_evidence_domain(evidence_url):
                raise ValueError("Invalid evidence domain.")

        # Collect data to process
        urls = list(self.resolution_urls) if self.resolution_urls else [evidence_url]
        title = self.title
        description = self.description
        outcomes = list(self.potential_outcomes)
        rules = list(self.rules)
        earliest_date = self.earliest_resolution_date

        analyzed_outputs = []

        # Analyze each source
        for url in urls:
            def evaluate_source() -> str:
                web_data = gl.nondet.web.render(url, mode="text")
                task = f"""
Analyze this webpage to resolve prediction market.
Title: {title}
Potential outcomes: {outcomes}
Rules: {rules}
Current date: {datetime.now().astimezone()}
Resolution date: {earliest_date}

Webpage: {web_data}

Return JSON: {{"valid_source": bool, "event_has_occurred": bool, 
"reasoning": str, "outcome": str}}
Outcome must be from potential_outcomes, "UNDETERMINED", or "ERROR".
"""
                return gl.nondet.exec_prompt(task)

            result = gl.eq_principle.prompt_comparative(
                evaluate_source,
                "`outcome` must match exactly"
            )
            analyzed_outputs.append((url, json.loads(result)))

        # Final aggregation
        def aggregate_sources() -> str:
            task = f"""
Aggregate these source analyses for prediction market:
Title: {title}
Outcomes: {outcomes}
Rules: {rules}
Analyses: {analyzed_outputs}

Return JSON: {{"relevant_sources": list, "reasoning": str, "outcome": str}}
"""
            return gl.nondet.exec_prompt(task)

        final = gl.eq_principle.prompt_comparative(
            aggregate_sources,
            "`outcome` must match exactly"
        )
        
        result = json.loads(final)
        self.analysis = json.dumps(result)

        if result["outcome"] == "UNDETERMINED":
            return
        if result["outcome"] == "ERROR" or result["outcome"] not in outcomes:
            self.status = Status.ERROR.value
            return

        self.outcome = result["outcome"]
        self.status = Status.RESOLVED.value

    @gl.public.view
    def get_status(self) -> str:
        return self.status
```

**Key Features:**
- Multiple resolution URLs or user-provided evidence
- Domain whitelist validation
- Two-phase analysis: per-source + aggregation
- Date-based resolution restrictions
- Comprehensive state tracking

---

## Common Patterns Summary

| Pattern | Key Technique |
|---------|---------------|
| Basic storage | State variables + view/write |
| Per-user data | `TreeMap[Address, T]` |
| LLM decisions | `prompt_comparative` + JSON output |
| Web data | `web.render()` + `strict_eq` |
| Semantic search | `genlayer_embeddings` + `VecDB` |
| Simple oracles | Custom `run_nondet` with validation |
| Production oracles | Multi-source + aggregation + rules |
