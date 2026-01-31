---
name: fly-machines
description: Deploy and manage Fly.io Machines - create, start, stop, delete, and monitor containerized apps. Use for deploying containers, managing app instances, and orchestrating multi-tenant workloads.
metadata: {"clawdbot":{"emoji":"🪰"}}
---

# fly-machines

Deploy and manage containers on Fly.io using the Machines API.

## Setup

1. Get a Fly.io API token from https://fly.io/user/personal_access_tokens
2. Store it:
```bash
mkdir -p ~/.config/fly
echo "your_token_here" > ~/.config/fly/token
```

Or use environment variable:
```bash
export FLY_API_TOKEN="your_token_here"
```

## API Reference

Base URL: `https://api.machines.dev/v1`

All requests require:
```bash
FLY_TOKEN=$(cat ~/.config/fly/token 2>/dev/null || echo $FLY_API_TOKEN)
curl -H "Authorization: Bearer $FLY_TOKEN" \
     -H "Content-Type: application/json" \
     "https://api.machines.dev/v1/..."
```

## Apps Management

**List all apps:**
```bash
curl -H "Authorization: Bearer $FLY_TOKEN" \
  "https://api.machines.dev/v1/apps?org_slug=personal"
```

**Create app:**
```bash
curl -X POST -H "Authorization: Bearer $FLY_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.machines.dev/v1/apps" \
  -d '{
    "app_name": "my-app",
    "org_slug": "personal"
  }'
```

**Get app details:**
```bash
curl -H "Authorization: Bearer $FLY_TOKEN" \
  "https://api.machines.dev/v1/apps/my-app"
```

## Machines

**List machines in app:**
```bash
curl -H "Authorization: Bearer $FLY_TOKEN" \
  "https://api.machines.dev/v1/apps/my-app/machines"
```

**Create machine:**
```bash
curl -X POST -H "Authorization: Bearer $FLY_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.machines.dev/v1/apps/my-app/machines" \
  -d '{
    "name": "worker-1",
    "region": "iad",
    "config": {
      "image": "nginx:latest",
      "env": {
        "MY_VAR": "value"
      },
      "services": [{
        "ports": [{"port": 443, "handlers": ["tls", "http"]}],
        "protocol": "tcp",
        "internal_port": 80
      }],
      "guest": {
        "cpu_kind": "shared",
        "cpus": 1,
        "memory_mb": 256
      }
    }
  }'
```

**Get machine:**
```bash
curl -H "Authorization: Bearer $FLY_TOKEN" \
  "https://api.machines.dev/v1/apps/my-app/machines/{machine_id}"
```

**Start machine:**
```bash
curl -X POST -H "Authorization: Bearer $FLY_TOKEN" \
  "https://api.machines.dev/v1/apps/my-app/machines/{machine_id}/start"
```

**Stop machine:**
```bash
curl -X POST -H "Authorization: Bearer $FLY_TOKEN" \
  "https://api.machines.dev/v1/apps/my-app/machines/{machine_id}/stop"
```

**Delete machine:**
```bash
curl -X DELETE -H "Authorization: Bearer $FLY_TOKEN" \
  "https://api.machines.dev/v1/apps/my-app/machines/{machine_id}?force=true"
```

**Wait for state:**
```bash
curl -H "Authorization: Bearer $FLY_TOKEN" \
  "https://api.machines.dev/v1/apps/my-app/machines/{machine_id}/wait?state=started&timeout=60"
```

## Volumes

**List volumes:**
```bash
curl -H "Authorization: Bearer $FLY_TOKEN" \
  "https://api.machines.dev/v1/apps/my-app/volumes"
```

**Create volume:**
```bash
curl -X POST -H "Authorization: Bearer $FLY_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.machines.dev/v1/apps/my-app/volumes" \
  -d '{
    "name": "data_vol",
    "region": "iad",
    "size_gb": 1
  }'
```

**Mount volume to machine:**
```bash
# Include in machine config:
{
  "config": {
    "mounts": [{
      "volume": "vol_abc123",
      "path": "/data"
    }]
  }
}
```

## Machine Config Options

```json
{
  "name": "my-machine",
  "region": "iad",
  "config": {
    "image": "registry.fly.io/my-app:latest",
    "env": {"KEY": "value"},
    "guest": {
      "cpu_kind": "shared",
      "cpus": 1,
      "memory_mb": 256
    },
    "services": [{
      "ports": [
        {"port": 80, "handlers": ["http"]},
        {"port": 443, "handlers": ["tls", "http"]}
      ],
      "protocol": "tcp",
      "internal_port": 8080
    }],
    "mounts": [{"volume": "vol_id", "path": "/data"}],
    "auto_destroy": false,
    "restart": {"policy": "on-failure"}
  }
}
```

## Regions

Common regions:
- `iad` - Ashburn, Virginia (US East)
- `lax` - Los Angeles (US West)
- `cdg` - Paris
- `lhr` - London
- `nrt` - Tokyo
- `sin` - Singapore
- `syd` - Sydney

## Auto-Stop/Start

Machines automatically stop after idle timeout (default 5 min). They wake on incoming request (~3s cold start).

**Disable auto-stop:**
```json
{
  "config": {
    "auto_destroy": false,
    "services": [{
      "auto_stop_machines": false,
      "auto_start_machines": true
    }]
  }
}
```

## Secrets

**Set secret:**
```bash
curl -X POST -H "Authorization: Bearer $FLY_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.machines.dev/v1/apps/my-app/secrets" \
  -d '{"MY_SECRET": "secret_value"}'
```

Secrets are available as environment variables to all machines.

## Common Patterns

### Deploy a bot instance
```bash
FLY_TOKEN=$(cat ~/.config/fly/token)
APP="botspawn"
BOT_ID="user123"

curl -X POST -H "Authorization: Bearer $FLY_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.machines.dev/v1/apps/$APP/machines" \
  -d '{
    "name": "bot-'"$BOT_ID"'",
    "region": "iad",
    "config": {
      "image": "registry.fly.io/botspawn-bot:latest",
      "env": {
        "BOT_ID": "'"$BOT_ID"'",
        "AI_PROVIDER": "anthropic"
      },
      "guest": {"cpu_kind": "shared", "cpus": 1, "memory_mb": 256}
    }
  }'
```

### Scale to zero
Machines auto-stop when idle. To wake:
```bash
curl -X POST -H "Authorization: Bearer $FLY_TOKEN" \
  "https://api.machines.dev/v1/apps/my-app/machines/{id}/start"
```

### Health check
```bash
MACHINE=$(curl -s -H "Authorization: Bearer $FLY_TOKEN" \
  "https://api.machines.dev/v1/apps/my-app/machines/{id}")
echo $MACHINE | jq '{state: .state, region: .region, updated: .updated_at}'
```

## CLI Alternative

For interactive use, the `flyctl` CLI is often easier:
```bash
# Install
curl -L https://fly.io/install.sh | sh

# Auth
fly auth login

# Deploy
fly deploy

# List machines
fly machines list -a my-app

# SSH into machine
fly ssh console -a my-app
```

## Notes

- Machines API is separate from the main Fly GraphQL API
- Each machine is an independent VM (Firecracker microVM)
- Volumes are regional and can only attach to machines in same region
- Private networking between machines via `.internal` DNS
- Logs: `fly logs -a my-app` or via Fly dashboard
