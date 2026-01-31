---
name: mongodb-atlas-admin
description: "Manage MongoDB Atlas clusters, projects, users, backups, and alerts via the Atlas Admin API v2. Use when: (1) Creating, scaling, or deleting Atlas clusters, (2) Managing database users and IP access lists, (3) Configuring backups, snapshots, and restore jobs, (4) Setting up alerts and monitoring, (5) Managing projects and organizations, (6) Viewing cluster metrics and logs. Requires Atlas API keys (public/private) or service account credentials."
metadata: {"clawdbot":{"emoji":"🍃","requires":{"bins":["curl","jq"]},"author":{"name":"Michael Lynn","github":"mrlynn","website":"https://mlynn.org","linkedin":"https://linkedin.com/in/mlynn"}}}
---

# MongoDB Atlas Admin

Manage MongoDB Atlas infrastructure programmatically via the Atlas Administration API v2.

## Authentication

Atlas API uses HTTP Digest Authentication with API keys or OAuth2 with service accounts.

### API Keys (Legacy but simpler)

```bash
# Set credentials
export ATLAS_PUBLIC_KEY="your-public-key"
export ATLAS_PRIVATE_KEY="your-private-key"

# All requests use digest auth
curl --user "${ATLAS_PUBLIC_KEY}:${ATLAS_PRIVATE_KEY}" \
  --digest \
  --header "Accept: application/vnd.atlas.2025-03-12+json" \
  --header "Content-Type: application/json" \
  "https://cloud.mongodb.com/api/atlas/v2/..."
```

### Service Accounts (OAuth2 - Recommended)

```bash
# Get access token
TOKEN=$(curl -s --request POST \
  "https://cloud.mongodb.com/api/oauth/token" \
  --header "Content-Type: application/x-www-form-urlencoded" \
  --data "grant_type=client_credentials&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}" \
  | jq -r '.access_token')

# Use token (valid 1 hour)
curl --header "Authorization: Bearer ${TOKEN}" \
  --header "Accept: application/vnd.atlas.2025-03-12+json" \
  "https://cloud.mongodb.com/api/atlas/v2/..."
```

## Quick Reference

| Task | Endpoint | Method |
|------|----------|--------|
| List projects | `/groups` | GET |
| Create project | `/groups` | POST |
| List clusters | `/groups/{groupId}/clusters` | GET |
| Create cluster | `/groups/{groupId}/clusters` | POST |
| Get cluster | `/groups/{groupId}/clusters/{clusterName}` | GET |
| Update cluster | `/groups/{groupId}/clusters/{clusterName}` | PATCH |
| Delete cluster | `/groups/{groupId}/clusters/{clusterName}` | DELETE |
| List DB users | `/groups/{groupId}/databaseUsers` | GET |
| Create DB user | `/groups/{groupId}/databaseUsers` | POST |
| List IP access | `/groups/{groupId}/accessList` | GET |
| Add IP access | `/groups/{groupId}/accessList` | POST |

---

## Clusters

### List All Clusters in Project

```bash
curl --user "${ATLAS_PUBLIC_KEY}:${ATLAS_PRIVATE_KEY}" --digest \
  -H "Accept: application/vnd.atlas.2025-03-12+json" \
  "https://cloud.mongodb.com/api/atlas/v2/groups/${GROUP_ID}/clusters"
```

### Get Cluster Details

```bash
curl --user "${ATLAS_PUBLIC_KEY}:${ATLAS_PRIVATE_KEY}" --digest \
  -H "Accept: application/vnd.atlas.2025-03-12+json" \
  "https://cloud.mongodb.com/api/atlas/v2/groups/${GROUP_ID}/clusters/${CLUSTER_NAME}"
```

### Create Cluster (M10+)

```bash
curl --user "${ATLAS_PUBLIC_KEY}:${ATLAS_PRIVATE_KEY}" --digest \
  -H "Accept: application/vnd.atlas.2025-03-12+json" \
  -H "Content-Type: application/json" \
  -X POST "https://cloud.mongodb.com/api/atlas/v2/groups/${GROUP_ID}/clusters" \
  -d '{
    "name": "my-cluster",
    "clusterType": "REPLICASET",
    "replicationSpecs": [{
      "regionConfigs": [{
        "providerName": "AWS",
        "regionName": "US_EAST_1",
        "priority": 7,
        "electableSpecs": {
          "instanceSize": "M10",
          "nodeCount": 3
        }
      }]
    }]
  }'
```

### Create Free Tier Cluster (M0)

```bash
curl --user "${ATLAS_PUBLIC_KEY}:${ATLAS_PRIVATE_KEY}" --digest \
  -H "Accept: application/vnd.atlas.2025-03-12+json" \
  -H "Content-Type: application/json" \
  -X POST "https://cloud.mongodb.com/api/atlas/v2/groups/${GROUP_ID}/clusters" \
  -d '{
    "name": "free-cluster",
    "clusterType": "REPLICASET",
    "replicationSpecs": [{
      "regionConfigs": [{
        "providerName": "TENANT",
        "backingProviderName": "AWS",
        "regionName": "US_EAST_1",
        "priority": 7,
        "electableSpecs": {
          "instanceSize": "M0",
          "nodeCount": 3
        }
      }]
    }]
  }'
```

### Scale Cluster (Change Instance Size)

```bash
curl --user "${ATLAS_PUBLIC_KEY}:${ATLAS_PRIVATE_KEY}" --digest \
  -H "Accept: application/vnd.atlas.2025-03-12+json" \
  -H "Content-Type: application/json" \
  -X PATCH "https://cloud.mongodb.com/api/atlas/v2/groups/${GROUP_ID}/clusters/${CLUSTER_NAME}" \
  -d '{
    "replicationSpecs": [{
      "regionConfigs": [{
        "providerName": "AWS",
        "regionName": "US_EAST_1",
        "priority": 7,
        "electableSpecs": {
          "instanceSize": "M20",
          "nodeCount": 3
        }
      }]
    }]
  }'
```

### Delete Cluster

```bash
curl --user "${ATLAS_PUBLIC_KEY}:${ATLAS_PRIVATE_KEY}" --digest \
  -H "Accept: application/vnd.atlas.2025-03-12+json" \
  -X DELETE "https://cloud.mongodb.com/api/atlas/v2/groups/${GROUP_ID}/clusters/${CLUSTER_NAME}"
```

### Pause/Resume Cluster

```bash
# Pause (M10+ only)
curl --user "${ATLAS_PUBLIC_KEY}:${ATLAS_PRIVATE_KEY}" --digest \
  -H "Accept: application/vnd.atlas.2025-03-12+json" \
  -H "Content-Type: application/json" \
  -X PATCH "https://cloud.mongodb.com/api/atlas/v2/groups/${GROUP_ID}/clusters/${CLUSTER_NAME}" \
  -d '{"paused": true}'

# Resume
curl --user "${ATLAS_PUBLIC_KEY}:${ATLAS_PRIVATE_KEY}" --digest \
  -H "Accept: application/vnd.atlas.2025-03-12+json" \
  -H "Content-Type: application/json" \
  -X PATCH "https://cloud.mongodb.com/api/atlas/v2/groups/${GROUP_ID}/clusters/${CLUSTER_NAME}" \
  -d '{"paused": false}'
```

---

## Projects (Groups)

### List All Projects

```bash
curl --user "${ATLAS_PUBLIC_KEY}:${ATLAS_PRIVATE_KEY}" --digest \
  -H "Accept: application/vnd.atlas.2025-03-12+json" \
  "https://cloud.mongodb.com/api/atlas/v2/groups"
```

### Create Project

```bash
curl --user "${ATLAS_PUBLIC_KEY}:${ATLAS_PRIVATE_KEY}" --digest \
  -H "Accept: application/vnd.atlas.2025-03-12+json" \
  -H "Content-Type: application/json" \
  -X POST "https://cloud.mongodb.com/api/atlas/v2/groups" \
  -d '{
    "name": "my-project",
    "orgId": "YOUR_ORG_ID"
  }'
```

### Delete Project

```bash
curl --user "${ATLAS_PUBLIC_KEY}:${ATLAS_PRIVATE_KEY}" --digest \
  -H "Accept: application/vnd.atlas.2025-03-12+json" \
  -X DELETE "https://cloud.mongodb.com/api/atlas/v2/groups/${GROUP_ID}"
```

---

## Database Users

### List Database Users

```bash
curl --user "${ATLAS_PUBLIC_KEY}:${ATLAS_PRIVATE_KEY}" --digest \
  -H "Accept: application/vnd.atlas.2025-03-12+json" \
  "https://cloud.mongodb.com/api/atlas/v2/groups/${GROUP_ID}/databaseUsers"
```

### Create Database User

```bash
curl --user "${ATLAS_PUBLIC_KEY}:${ATLAS_PRIVATE_KEY}" --digest \
  -H "Accept: application/vnd.atlas.2025-03-12+json" \
  -H "Content-Type: application/json" \
  -X POST "https://cloud.mongodb.com/api/atlas/v2/groups/${GROUP_ID}/databaseUsers" \
  -d '{
    "databaseName": "admin",
    "username": "myuser",
    "password": "securePassword123!",
    "roles": [{
      "databaseName": "admin",
      "roleName": "readWriteAnyDatabase"
    }]
  }'
```

### Delete Database User

```bash
curl --user "${ATLAS_PUBLIC_KEY}:${ATLAS_PRIVATE_KEY}" --digest \
  -H "Accept: application/vnd.atlas.2025-03-12+json" \
  -X DELETE "https://cloud.mongodb.com/api/atlas/v2/groups/${GROUP_ID}/databaseUsers/admin/${USERNAME}"
```

---

## IP Access List

### List IP Access Entries

```bash
curl --user "${ATLAS_PUBLIC_KEY}:${ATLAS_PRIVATE_KEY}" --digest \
  -H "Accept: application/vnd.atlas.2025-03-12+json" \
  "https://cloud.mongodb.com/api/atlas/v2/groups/${GROUP_ID}/accessList"
```

### Add IP Address

```bash
curl --user "${ATLAS_PUBLIC_KEY}:${ATLAS_PRIVATE_KEY}" --digest \
  -H "Accept: application/vnd.atlas.2025-03-12+json" \
  -H "Content-Type: application/json" \
  -X POST "https://cloud.mongodb.com/api/atlas/v2/groups/${GROUP_ID}/accessList" \
  -d '[{
    "ipAddress": "192.168.1.1",
    "comment": "Office IP"
  }]'
```

### Allow All IPs (Development Only!)

```bash
curl --user "${ATLAS_PUBLIC_KEY}:${ATLAS_PRIVATE_KEY}" --digest \
  -H "Accept: application/vnd.atlas.2025-03-12+json" \
  -H "Content-Type: application/json" \
  -X POST "https://cloud.mongodb.com/api/atlas/v2/groups/${GROUP_ID}/accessList" \
  -d '[{
    "cidrBlock": "0.0.0.0/0",
    "comment": "Allow all - DEV ONLY"
  }]'
```

---

## Backups & Snapshots

### List Snapshots

```bash
curl --user "${ATLAS_PUBLIC_KEY}:${ATLAS_PRIVATE_KEY}" --digest \
  -H "Accept: application/vnd.atlas.2025-03-12+json" \
  "https://cloud.mongodb.com/api/atlas/v2/groups/${GROUP_ID}/clusters/${CLUSTER_NAME}/backup/snapshots"
```

### Take On-Demand Snapshot

```bash
curl --user "${ATLAS_PUBLIC_KEY}:${ATLAS_PRIVATE_KEY}" --digest \
  -H "Accept: application/vnd.atlas.2025-03-12+json" \
  -H "Content-Type: application/json" \
  -X POST "https://cloud.mongodb.com/api/atlas/v2/groups/${GROUP_ID}/clusters/${CLUSTER_NAME}/backup/snapshots" \
  -d '{
    "description": "Pre-deployment snapshot",
    "retentionInDays": 7
  }'
```

### Restore From Snapshot

```bash
curl --user "${ATLAS_PUBLIC_KEY}:${ATLAS_PRIVATE_KEY}" --digest \
  -H "Accept: application/vnd.atlas.2025-03-12+json" \
  -H "Content-Type: application/json" \
  -X POST "https://cloud.mongodb.com/api/atlas/v2/groups/${GROUP_ID}/clusters/${CLUSTER_NAME}/backup/restoreJobs" \
  -d '{
    "snapshotId": "SNAPSHOT_ID",
    "deliveryType": "automated",
    "targetClusterName": "restored-cluster",
    "targetGroupId": "${GROUP_ID}"
  }'
```

---

## Alerts

### List Alert Configurations

```bash
curl --user "${ATLAS_PUBLIC_KEY}:${ATLAS_PRIVATE_KEY}" --digest \
  -H "Accept: application/vnd.atlas.2025-03-12+json" \
  "https://cloud.mongodb.com/api/atlas/v2/groups/${GROUP_ID}/alertConfigs"
```

### Get Active Alerts

```bash
curl --user "${ATLAS_PUBLIC_KEY}:${ATLAS_PRIVATE_KEY}" --digest \
  -H "Accept: application/vnd.atlas.2025-03-12+json" \
  "https://cloud.mongodb.com/api/atlas/v2/groups/${GROUP_ID}/alerts?status=OPEN"
```

---

## Instance Sizes

| Tier | vCPUs | RAM | Storage | Use Case |
|------|-------|-----|---------|----------|
| M0 | Shared | Shared | 512 MB | Free tier, dev/learning |
| M2 | Shared | Shared | 2 GB | Small dev projects |
| M5 | Shared | Shared | 5 GB | Larger dev projects |
| M10 | 2 | 2 GB | 10 GB | Dev/staging, low traffic |
| M20 | 2 | 4 GB | 20 GB | Light production |
| M30 | 2 | 8 GB | 40 GB | Production |
| M40 | 4 | 16 GB | 80 GB | High-traffic production |
| M50 | 8 | 32 GB | 160 GB | Large production |
| M60+ | 16+ | 64+ GB | 320+ GB | Enterprise |

---

## Helper Script

For convenience, use `scripts/atlas.sh` wrapper:

```bash
# Usage
./scripts/atlas.sh <command> [args]

# Examples
./scripts/atlas.sh projects list
./scripts/atlas.sh clusters list <project-id>
./scripts/atlas.sh clusters create <project-id> <name> <size> <region>
./scripts/atlas.sh clusters delete <project-id> <name>
./scripts/atlas.sh clusters pause <project-id> <name>
./scripts/atlas.sh users list <project-id>
./scripts/atlas.sh users create <project-id> <username> <password>
```

---

## Environment Variables

```bash
# Required
export ATLAS_PUBLIC_KEY="..."
export ATLAS_PRIVATE_KEY="..."

# Optional (for service accounts)
export ATLAS_CLIENT_ID="..."
export ATLAS_CLIENT_SECRET="..."

# Common IDs
export ATLAS_ORG_ID="..."      # Organization ID
export ATLAS_GROUP_ID="..."    # Project/Group ID
```

---

## API Reference

- **Base URL:** `https://cloud.mongodb.com/api/atlas/v2`
- **Accept Header:** `application/vnd.atlas.2025-03-12+json`
- **Full Docs:** https://www.mongodb.com/docs/atlas/reference/api-resources-spec/v2/
- **OpenAPI Spec:** https://github.com/mongodb/atlas-sdk-go/blob/main/openapi/atlas-api.yaml

For detailed endpoint documentation, see `references/api-endpoints.md`.

---

## Author

**Michael Lynn** — Principal Staff Developer Advocate at MongoDB

- 🌐 Website: [mlynn.org](https://mlynn.org)
- 🐙 GitHub: [@mrlynn](https://github.com/mrlynn)
- 💼 LinkedIn: [linkedin.com/in/mlynn](https://linkedin.com/in/mlynn)

Issues & contributions welcome on GitHub!
