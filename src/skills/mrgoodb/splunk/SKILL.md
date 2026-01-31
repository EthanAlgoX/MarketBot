---
name: splunk
description: Search and analyze machine data via Splunk API. Run searches and manage dashboards.
metadata: {"clawdbot":{"emoji":"📊","requires":{"env":["SPLUNK_URL","SPLUNK_TOKEN"]}}}
---
# Splunk
Data analytics and SIEM.
## Environment
```bash
export SPLUNK_URL="https://splunk.example.com:8089"
export SPLUNK_TOKEN="xxxxxxxxxx"
```
## Run Search
```bash
curl -X POST "$SPLUNK_URL/services/search/jobs" \
  -H "Authorization: Bearer $SPLUNK_TOKEN" \
  -d "search=search index=main | head 10"
```
## Get Search Results
```bash
curl "$SPLUNK_URL/services/search/jobs/{sid}/results?output_mode=json" \
  -H "Authorization: Bearer $SPLUNK_TOKEN"
```
## List Saved Searches
```bash
curl "$SPLUNK_URL/services/saved/searches?output_mode=json" \
  -H "Authorization: Bearer $SPLUNK_TOKEN"
```
## Links
- Docs: https://docs.splunk.com/Documentation/Splunk/latest/RESTREF/RESTprolog
