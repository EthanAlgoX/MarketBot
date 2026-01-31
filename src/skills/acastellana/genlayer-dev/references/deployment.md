# GenLayer Deployment Guide

## Local Development (GenLayer Studio)

### Prerequisites
- Docker 26+
- Node.js 18+
- npm

### Installation
```bash
npm install -g genlayer
```

### First Time Setup
```bash
genlayer init
```
Downloads Docker images and initializes local environment.

### Start Local Network
```bash
genlayer up
```
Opens Studio at `http://localhost:8080` with:
- Local validator network
- Contract IDE
- Transaction explorer
- Debug console

### Stop
```bash
genlayer down
```

---

## GenLayer CLI Reference

### Network Management

```bash
# Show current network
genlayer network

# List available networks
genlayer network list

# Switch networks
genlayer network set localnet       # Local Docker
genlayer network set studionet      # Hosted dev environment  
genlayer network set testnet-asimov # Public testnet
```

### Deploy Contracts

```bash
# Basic deploy
genlayer deploy --contract path/to/contract.py

# With constructor arguments
genlayer deploy --contract my_contract.py --args "arg1" 42 true

# Specify sender account
genlayer deploy --contract my_contract.py --from 0x...

# Get deployed address
genlayer deploy --contract my_contract.py --output json | jq .address
```

### Interact with Contracts

#### Read (View Methods)
```bash
# Call view method
genlayer call --address 0x... --function get_value

# With arguments
genlayer call --address 0x... --function balance_of --args "0x..."

# Output as JSON
genlayer call --address 0x... --function get_data --output json
```

#### Write Methods
```bash
# Execute write method
genlayer write --address 0x... --function set_value --args "new_value"

# With value (payable methods)
genlayer write --address 0x... --function deposit --value 1000000000000000000

# Wait for finality
genlayer write --address 0x... --function update --args "data" --wait
```

### Transaction Info

```bash
# Get transaction receipt
genlayer receipt --tx-hash 0x...

# Get transaction status
genlayer status --tx-hash 0x...

# List recent transactions
genlayer transactions --address 0x... --limit 10
```

### Contract Info

```bash
# Get contract ABI/schema
genlayer schema --address 0x...

# Get contract code
genlayer code --address 0x...

# Verify contract
genlayer verify --address 0x... --contract source.py
```

### Account Management

```bash
# List accounts
genlayer accounts

# Create new account
genlayer accounts create

# Import private key
genlayer accounts import --private-key 0x...

# Get balance
genlayer balance --address 0x...

# Request testnet tokens
genlayer faucet --address 0x...
```

---

## Networks

### Localnet
- **Purpose**: Local development
- **RPC**: `http://localhost:4000/api`
- **Explorer**: `http://localhost:8080`
- **Setup**: `genlayer up`

### Studionet
- **Purpose**: Hosted development environment
- **RPC**: `https://studionet.genlayer.com/api`
- **Explorer**: `https://studio.genlayer.com`
- **Tokens**: Free from faucet

### Testnet (Asimov)
- **Purpose**: Public testing
- **RPC**: `https://testnet-asimov.genlayer.com/api`
- **Explorer**: `https://explorer-testnet.genlayer.com`
- **Tokens**: Faucet at `https://faucet.genlayer.com`

---

## Deployment Workflow

### 1. Local Development
```bash
# Start local network
genlayer up

# Deploy and test
genlayer deploy --contract my_contract.py
genlayer call --address 0x... --function test_method

# Iterate using Studio UI for debugging
```

### 2. Studionet Testing
```bash
# Switch network
genlayer network set studionet

# Get test tokens
genlayer faucet --address 0x...

# Deploy
genlayer deploy --contract my_contract.py

# Test with real validators
genlayer write --address 0x... --function my_method --args "test"
```

### 3. Testnet Deployment
```bash
# Switch to testnet
genlayer network set testnet-asimov

# Get testnet tokens
genlayer faucet --address 0x...

# Deploy (use production-ready contract)
genlayer deploy --contract my_contract.py

# Verify
genlayer verify --address 0x... --contract my_contract.py
```

---

## Environment Configuration

### Environment Variables
```bash
# Default network
export GENLAYER_NETWORK=testnet-asimov

# Default account
export GENLAYER_ACCOUNT=0x...

# Custom RPC endpoint
export GENLAYER_RPC_URL=https://custom.endpoint.com/api

# API key (if required)
export GENLAYER_API_KEY=your_api_key
```

### Config File
Location: `~/.genlayer/config.json`

```json
{
  "defaultNetwork": "testnet-asimov",
  "defaultAccount": "0x...",
  "networks": {
    "custom": {
      "rpc": "https://my-node.example.com/api",
      "explorer": "https://explorer.example.com"
    }
  }
}
```

---

## Contract Versioning

### Version Header
Every contract must start with a version header:
```python
# v0.1.0
# { "Depends": "py-genlayer:latest" }
```

### Dependencies
For production, pin specific versions:
```python
# v0.1.0
# { "Depends": "py-genlayer:0.1.0" }
```

Multiple dependencies:
```python
# v0.1.0
# { "Seq": [
#   { "Depends": "py-lib-genlayer-embeddings:0.1.0" },
#   { "Depends": "py-genlayer:0.1.0" }
# ]}
```

---

## Hardhat Integration (Optional)

For EVM interop testing:

### Enable Hardhat
Add to `.env`:
```
HARDHAT_URL=http://hardhat
HARDHAT_PORT=8545
COMPOSE_PROFILES=hardhat
```

### Run with Hardhat
```bash
genlayer up  # Now includes Hardhat node
```

### Deploy EVM Contracts
Use standard Hardhat workflow, then reference from GenLayer contracts:
```python
@gl.evm.contract_interface
class MyERC20:
    class View:
        def balance_of(self, owner: Address) -> u256: ...

evm_token = MyERC20(Address("0x..."))  # Hardhat-deployed address
```

---

## Debugging Tips

### Studio Logs
1. Open GenLayer Studio (`genlayer up`)
2. Navigate to "Logs" tab
3. Filter by:
   - Transaction hash
   - Contract address
   - Log level (debug/info/error)

### Contract Prints
```python
@gl.public.write
def debug_method(self, value: str) -> None:
    print(f"Received value: {value}")  # Visible in logs
    print(f"Current state: {self.some_state}")
    # ... actual logic
```

### Transaction Inspection
```bash
# Full transaction details
genlayer receipt --tx-hash 0x... --verbose

# Execution trace
genlayer trace --tx-hash 0x...
```

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| "int not supported" | Using `int` type | Use `u256`, `i64`, etc. |
| "Cannot access storage" | Storage in non-det block | `gl.storage.copy_to_memory()` |
| "Validators disagree" | Non-deterministic result | Use appropriate equivalence principle |
| "Contract not found" | Wrong network | Check `genlayer network` |
| "Insufficient funds" | No tokens | Use `genlayer faucet` |

---

## Security Checklist

Before deploying to testnet/mainnet:

- [ ] No hardcoded secrets
- [ ] Input validation on all public methods
- [ ] Prompt injection mitigations
- [ ] Correct equivalence principle for each non-det operation
- [ ] Tested with multiple validators locally
- [ ] Error handling for all edge cases
- [ ] Gas/compute limits considered
- [ ] Access control where needed (`gl.message.sender_address`)
