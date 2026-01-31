---
name: grafana
description: Manage Grafana dashboards, data sources, and alerts via API. Visualize metrics and logs.
metadata: {"clawdbot":{"emoji":"📉","requires":{"env":["GRAFANA_URL","GRAFANA_API_KEY"]}}}
---
# Grafana
Observability dashboards.
## Environment
```bash
export GRAFANA_URL="https://grafana.example.com"
export GRAFANA_API_KEY="xxxxxxxxxx"
```
## List Dashboards
```bash
curl "$GRAFANA_URL/api/search?type=dash-db" -H "Authorization: Bearer $GRAFANA_API_KEY"
```
## Get Dashboard
```bash
curl "$GRAFANA_URL/api/dashboards/uid/{uid}" -H "Authorization: Bearer $GRAFANA_API_KEY"
```
## List Data Sources
```bash
curl "$GRAFANA_URL/api/datasources" -H "Authorization: Bearer $GRAFANA_API_KEY"
```
## Create Alert Rule
```bash
curl -X POST "$GRAFANA_URL/api/v1/provisioning/alert-rules" \
  -H "Authorization: Bearer $GRAFANA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "High CPU", "condition": "A", "data": [...]}'
```
## Links
- Docs: https://grafana.com/docs/grafana/latest/developers/http_api/
