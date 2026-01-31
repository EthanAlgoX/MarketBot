# Atlas Admin API v2 - Complete Endpoint Reference

Base URL: `https://cloud.mongodb.com/api/atlas/v2`

## Organizations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/orgs` | List all organizations |
| GET | `/orgs/{orgId}` | Get organization by ID |
| PATCH | `/orgs/{orgId}` | Update organization |
| DELETE | `/orgs/{orgId}` | Delete organization |
| GET | `/orgs/{orgId}/users` | List organization users |
| GET | `/orgs/{orgId}/teams` | List organization teams |
| GET | `/orgs/{orgId}/apiKeys` | List organization API keys |
| POST | `/orgs/{orgId}/apiKeys` | Create organization API key |

## Projects (Groups)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/groups` | List all projects |
| POST | `/groups` | Create project |
| GET | `/groups/{groupId}` | Get project by ID |
| PATCH | `/groups/{groupId}` | Update project |
| DELETE | `/groups/{groupId}` | Delete project |
| GET | `/groups/{groupId}/users` | List project users |
| GET | `/groups/{groupId}/settings` | Get project settings |

## Clusters

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/groups/{groupId}/clusters` | List all clusters |
| POST | `/groups/{groupId}/clusters` | Create cluster |
| GET | `/groups/{groupId}/clusters/{clusterName}` | Get cluster |
| PATCH | `/groups/{groupId}/clusters/{clusterName}` | Update cluster (scale, pause) |
| DELETE | `/groups/{groupId}/clusters/{clusterName}` | Delete cluster |
| GET | `/groups/{groupId}/clusters/{clusterName}/status` | Get cluster status |
| POST | `/groups/{groupId}/clusters/{clusterName}/restartPrimaries` | Restart primaries |

### Cluster Configuration Body

```json
{
  "name": "cluster-name",
  "clusterType": "REPLICASET|SHARDED|GEOSHARDED",
  "replicationSpecs": [{
    "numShards": 1,
    "regionConfigs": [{
      "providerName": "AWS|GCP|AZURE|TENANT",
      "backingProviderName": "AWS|GCP|AZURE",  // only for M0/M2/M5
      "regionName": "US_EAST_1",
      "priority": 7,
      "electableSpecs": {
        "instanceSize": "M10",
        "nodeCount": 3,
        "diskIOPS": 3000,
        "ebsVolumeType": "STANDARD|PROVISIONED"
      },
      "readOnlySpecs": {
        "instanceSize": "M10",
        "nodeCount": 0
      },
      "analyticsSpecs": {
        "instanceSize": "M10",
        "nodeCount": 0
      }
    }]
  }],
  "mongoDBMajorVersion": "7.0",
  "backupEnabled": true,
  "pitEnabled": true,
  "paused": false,
  "terminationProtectionEnabled": false,
  "diskSizeGB": 10,
  "labels": [{"key": "env", "value": "prod"}],
  "tags": [{"key": "team", "value": "platform"}]
}
```

## Database Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/groups/{groupId}/databaseUsers` | List database users |
| POST | `/groups/{groupId}/databaseUsers` | Create database user |
| GET | `/groups/{groupId}/databaseUsers/{dbName}/{username}` | Get user |
| PATCH | `/groups/{groupId}/databaseUsers/{dbName}/{username}` | Update user |
| DELETE | `/groups/{groupId}/databaseUsers/{dbName}/{username}` | Delete user |

### User Roles

```json
{
  "databaseName": "admin",
  "username": "myuser",
  "password": "password123",
  "roles": [
    {"databaseName": "admin", "roleName": "readWriteAnyDatabase"},
    {"databaseName": "mydb", "roleName": "dbAdmin"}
  ],
  "scopes": [
    {"name": "cluster-name", "type": "CLUSTER"}
  ]
}
```

Common roles:
- `atlasAdmin` - Full access
- `readWriteAnyDatabase` - Read/write all DBs
- `readAnyDatabase` - Read-only all DBs
- `dbAdmin` - DB administration
- `read` - Read-only specific DB
- `readWrite` - Read/write specific DB

## IP Access List

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/groups/{groupId}/accessList` | List IP access entries |
| POST | `/groups/{groupId}/accessList` | Add IP access entries |
| GET | `/groups/{groupId}/accessList/{entryValue}` | Get entry |
| DELETE | `/groups/{groupId}/accessList/{entryValue}` | Delete entry |

```json
[
  {"ipAddress": "192.168.1.1", "comment": "Office"},
  {"cidrBlock": "10.0.0.0/8", "comment": "VPC"},
  {"awsSecurityGroup": "sg-1234", "comment": "AWS SG"}
]
```

## Backups & Snapshots

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/groups/{groupId}/clusters/{clusterName}/backup/snapshots` | List snapshots |
| POST | `/groups/{groupId}/clusters/{clusterName}/backup/snapshots` | Take snapshot |
| GET | `/groups/{groupId}/clusters/{clusterName}/backup/snapshots/{snapshotId}` | Get snapshot |
| DELETE | `/groups/{groupId}/clusters/{clusterName}/backup/snapshots/{snapshotId}` | Delete snapshot |
| GET | `/groups/{groupId}/clusters/{clusterName}/backup/schedule` | Get backup schedule |
| PATCH | `/groups/{groupId}/clusters/{clusterName}/backup/schedule` | Update schedule |
| GET | `/groups/{groupId}/clusters/{clusterName}/backup/restoreJobs` | List restore jobs |
| POST | `/groups/{groupId}/clusters/{clusterName}/backup/restoreJobs` | Create restore job |

## Alerts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/groups/{groupId}/alertConfigs` | List alert configurations |
| POST | `/groups/{groupId}/alertConfigs` | Create alert config |
| GET | `/groups/{groupId}/alertConfigs/{alertConfigId}` | Get alert config |
| PUT | `/groups/{groupId}/alertConfigs/{alertConfigId}` | Update alert config |
| DELETE | `/groups/{groupId}/alertConfigs/{alertConfigId}` | Delete alert config |
| GET | `/groups/{groupId}/alerts` | List alerts |
| GET | `/groups/{groupId}/alerts/{alertId}` | Get alert |
| PATCH | `/groups/{groupId}/alerts/{alertId}` | Acknowledge alert |

## Metrics & Logs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/groups/{groupId}/processes` | List MongoDB processes |
| GET | `/groups/{groupId}/processes/{processId}/measurements` | Get process metrics |
| GET | `/groups/{groupId}/clusters/{clusterName}/logs` | Get cluster logs |

## Network Peering

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/groups/{groupId}/peers` | List peering connections |
| POST | `/groups/{groupId}/peers` | Create peering connection |
| GET | `/groups/{groupId}/containers` | List network containers |
| POST | `/groups/{groupId}/containers` | Create network container |

## Private Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/groups/{groupId}/privateEndpoint/{cloudProvider}/endpointService` | List endpoint services |
| POST | `/groups/{groupId}/privateEndpoint/{cloudProvider}/endpointService` | Create endpoint service |
| GET | `/groups/{groupId}/privateEndpoint/{cloudProvider}/endpointService/{endpointServiceId}/endpoint` | List endpoints |
| POST | `/groups/{groupId}/privateEndpoint/{cloudProvider}/endpointService/{endpointServiceId}/endpoint` | Create endpoint |

## Search (Atlas Search)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/groups/{groupId}/clusters/{clusterName}/fts/indexes` | List search indexes |
| POST | `/groups/{groupId}/clusters/{clusterName}/fts/indexes` | Create search index |
| GET | `/groups/{groupId}/clusters/{clusterName}/fts/indexes/{indexId}` | Get search index |
| PATCH | `/groups/{groupId}/clusters/{clusterName}/fts/indexes/{indexId}` | Update search index |
| DELETE | `/groups/{groupId}/clusters/{clusterName}/fts/indexes/{indexId}` | Delete search index |

## Data Federation

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/groups/{groupId}/dataFederation` | List data federation instances |
| POST | `/groups/{groupId}/dataFederation` | Create data federation |
| GET | `/groups/{groupId}/dataFederation/{tenantName}` | Get data federation |
| PATCH | `/groups/{groupId}/dataFederation/{tenantName}` | Update data federation |
| DELETE | `/groups/{groupId}/dataFederation/{tenantName}` | Delete data federation |

## Serverless Instances

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/groups/{groupId}/serverless` | List serverless instances |
| POST | `/groups/{groupId}/serverless` | Create serverless instance |
| GET | `/groups/{groupId}/serverless/{instanceName}` | Get serverless instance |
| PATCH | `/groups/{groupId}/serverless/{instanceName}` | Update serverless instance |
| DELETE | `/groups/{groupId}/serverless/{instanceName}` | Delete serverless instance |

## Flex Clusters (New 2024+)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/groups/{groupId}/flexClusters` | List flex clusters |
| POST | `/groups/{groupId}/flexClusters` | Create flex cluster |
| GET | `/groups/{groupId}/flexClusters/{name}` | Get flex cluster |
| PATCH | `/groups/{groupId}/flexClusters/{name}` | Update flex cluster |
| DELETE | `/groups/{groupId}/flexClusters/{name}` | Delete flex cluster |

## Region Codes

### AWS Regions
- `US_EAST_1`, `US_EAST_2`, `US_WEST_1`, `US_WEST_2`
- `EU_WEST_1`, `EU_WEST_2`, `EU_WEST_3`, `EU_CENTRAL_1`, `EU_NORTH_1`
- `AP_SOUTHEAST_1`, `AP_SOUTHEAST_2`, `AP_NORTHEAST_1`, `AP_NORTHEAST_2`
- `AP_SOUTH_1`, `SA_EAST_1`, `CA_CENTRAL_1`, `ME_SOUTH_1`, `AF_SOUTH_1`

### GCP Regions
- `CENTRAL_US`, `EASTERN_US`, `WESTERN_US`
- `WESTERN_EUROPE`, `EUROPE_WEST_2`, `EUROPE_WEST_3`, `EUROPE_WEST_4`
- `ASIA_EAST_1`, `ASIA_SOUTH_1`, `ASIA_NORTHEAST_1`

### Azure Regions
- `US_EAST`, `US_EAST_2`, `US_WEST`, `US_WEST_2`, `US_CENTRAL`
- `EUROPE_NORTH`, `EUROPE_WEST`, `UK_SOUTH`
- `ASIA_SOUTH_EAST`

## Error Codes

| Code | Meaning |
|------|---------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid credentials |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Resource already exists |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Server Error |
