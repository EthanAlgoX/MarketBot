---
name: clearbit
description: Enrich leads and companies via Clearbit API. Get company and person data.
metadata: {"clawdbot":{"emoji":"✨","requires":{"env":["CLEARBIT_API_KEY"]}}}
---
# Clearbit
Data enrichment.
## Environment
```bash
export CLEARBIT_API_KEY="sk_xxxxxxxxxx"
```
## Enrich Person
```bash
curl "https://person.clearbit.com/v2/people/find?email=user@example.com" \
  -u "$CLEARBIT_API_KEY:"
```
## Enrich Company
```bash
curl "https://company.clearbit.com/v2/companies/find?domain=example.com" \
  -u "$CLEARBIT_API_KEY:"
```
## Combined Enrichment
```bash
curl "https://person.clearbit.com/v2/combined/find?email=user@example.com" \
  -u "$CLEARBIT_API_KEY:"
```
## Reveal (IP to Company)
```bash
curl "https://reveal.clearbit.com/v1/companies/find?ip=8.8.8.8" \
  -u "$CLEARBIT_API_KEY:"
```
## Links
- Dashboard: https://dashboard.clearbit.com
- Docs: https://clearbit.com/docs
