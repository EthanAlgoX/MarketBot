# genlayer-dev-claw-skill

A Claw skill for building GenLayer Intelligent Contracts—Python smart contracts with LLM calls and web access.

## Purpose

This skill helps AI assistants write and deploy Intelligent Contracts:
- SDK API reference
- Code examples and patterns
- CLI commands
- Deployment workflows
- Equivalence principles

**For explaining GenLayer concepts**, use the companion skill: [genlayer-claw-skill](https://github.com/acastellana/genlayer-claw-skill)

## What's Inside

| File | Description |
|------|-------------|
| `SKILL.md` | Quick start, core concepts, common patterns |
| `references/sdk-api.md` | Complete SDK API reference |
| `references/equivalence-principles.md` | Consensus patterns in depth |
| `references/examples.md` | Annotated contract examples |
| `references/deployment.md` | CLI commands, networks, deployment |
| `references/genvm-internals.md` | VM architecture, storage, ABI |

## Quick Example

```python
# v0.1.0
# { "Depends": "py-genlayer:latest" }
from genlayer import *

class MyContract(gl.Contract):
    result: str
    
    def __init__(self):
        self.result = ""
    
    @gl.public.write
    def analyze(self, text: str) -> None:
        prompt = f"Analyze: {text}"
        
        def get_analysis():
            return gl.nondet.exec_prompt(prompt)
        
        self.result = gl.eq_principle.strict_eq(get_analysis)
    
    @gl.public.view
    def get_result(self) -> str:
        return self.result
```

## Key Topics Covered

- **Contract structure** — `gl.Contract`, decorators, state types
- **Storage types** — `DynArray`, `TreeMap`, sized integers (`u256`, etc.)
- **Non-deterministic ops** — `gl.nondet.exec_prompt()`, `gl.nondet.web.render()`
- **Equivalence principles** — `strict_eq`, `prompt_comparative`, `prompt_non_comparative`, custom patterns
- **Contract interactions** — Cross-contract calls, EVM interop
- **CLI** — `genlayer deploy`, `genlayer call`, `genlayer write`
- **Networks** — localnet, studionet, testnet

## Installation

### Claw
```bash
claw skill add https://github.com/acastellana/genlayer-dev-claw-skill
```

### Manual
Clone to your skills directory and reference in your agent config.

## Related

- **Companion skill:** [genlayer-claw-skill](https://github.com/acastellana/genlayer-claw-skill) — For explaining GenLayer
- **Docs:** https://docs.genlayer.com
- **SDK:** https://sdk.genlayer.com
- **GitHub:** https://github.com/genlayerlabs

## License

MIT
