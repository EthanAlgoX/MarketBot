---
name: zoominfo
description: Access B2B contact and company data via ZoomInfo API. Enrich leads and find prospects.
metadata: {"clawdbot":{"emoji":"🔍","requires":{"env":["ZOOMINFO_USERNAME","ZOOMINFO_PASSWORD"]}}}
---
# ZoomInfo
B2B intelligence platform.
## Environment
```bash
export ZOOMINFO_USERNAME="xxxxxxxxxx"
export ZOOMINFO_PASSWORD="xxxxxxxxxx"
```
## Get Access Token
```bash
curl -X POST "https://api.zoominfo.com/authenticate" \
  -H "Content-Type: application/json" \
  -d '{"username": "'$ZOOMINFO_USERNAME'", "password": "'$ZOOMINFO_PASSWORD'"}'
```
## Search Companies
```bash
curl -X POST "https://api.zoominfo.com/search/company" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"companyName": "Acme Inc", "rpp": 10}'
```
## Search Contacts
```bash
curl -X POST "https://api.zoominfo.com/search/contact" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"companyId": "123456", "jobTitle": "CEO"}'
```
## Enrich Company
```bash
curl -X POST "https://api.zoominfo.com/enrich/company" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"companyName": "Acme Inc", "companyWebsite": "acme.com"}'
```
## Links
- Dashboard: https://app.zoominfo.com
- Docs: https://api-docs.zoominfo.com
