---
name: newrelic
description: Monitor applications and infrastructure via New Relic API. Query metrics and manage alerts.
metadata: {"clawdbot":{"emoji":"📈","requires":{"env":["NEWRELIC_API_KEY","NEWRELIC_ACCOUNT_ID"]}}}
---
# New Relic
Observability platform.
## Environment
```bash
export NEWRELIC_API_KEY="xxxxxxxxxx"
export NEWRELIC_ACCOUNT_ID="xxxxxxxxxx"
```
## Query NRQL
```bash
curl -X POST "https://api.newrelic.com/graphql" \
  -H "API-Key: $NEWRELIC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ actor { account(id: '$NEWRELIC_ACCOUNT_ID') { nrql(query: \"SELECT count(*) FROM Transaction\") { results } } } }"}'
```
## List Applications
```bash
curl "https://api.newrelic.com/v2/applications.json" -H "Api-Key: $NEWRELIC_API_KEY"
```
## Links
- Dashboard: https://one.newrelic.com
- Docs: https://docs.newrelic.com/docs/apis/
