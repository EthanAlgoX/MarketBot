---
name: elastic
description: Search and analyze data via Elasticsearch API. Index, search, and manage clusters.
metadata: {"clawdbot":{"emoji":"🔍","requires":{"env":["ELASTICSEARCH_URL","ELASTICSEARCH_API_KEY"]}}}
---
# Elasticsearch
Distributed search and analytics.
## Environment
```bash
export ELASTICSEARCH_URL="https://elastic.example.com:9200"
export ELASTICSEARCH_API_KEY="xxxxxxxxxx"
```
## Cluster Health
```bash
curl "$ELASTICSEARCH_URL/_cluster/health" -H "Authorization: ApiKey $ELASTICSEARCH_API_KEY"
```
## Search
```bash
curl -X POST "$ELASTICSEARCH_URL/my-index/_search" \
  -H "Authorization: ApiKey $ELASTICSEARCH_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": {"match": {"message": "error"}}}'
```
## Index Document
```bash
curl -X POST "$ELASTICSEARCH_URL/my-index/_doc" \
  -H "Authorization: ApiKey $ELASTICSEARCH_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message": "Log entry", "timestamp": "2024-01-30T10:00:00Z"}'
```
## Links
- Docs: https://www.elastic.co/guide/en/elasticsearch/reference/current/rest-apis.html
