---
name: bitbucket
description: Manage Bitbucket repositories, pull requests, and pipelines via API.
metadata: {"clawdbot":{"emoji":"🪣","requires":{"env":["BITBUCKET_USERNAME","BITBUCKET_APP_PASSWORD"]}}}
---
# Bitbucket
Git repository hosting.
## Environment
```bash
export BITBUCKET_USERNAME="xxxxxxxxxx"
export BITBUCKET_APP_PASSWORD="xxxxxxxxxx"
```
## List Repositories
```bash
curl -u "$BITBUCKET_USERNAME:$BITBUCKET_APP_PASSWORD" "https://api.bitbucket.org/2.0/repositories/$BITBUCKET_USERNAME"
```
## Create Pull Request
```bash
curl -X POST -u "$BITBUCKET_USERNAME:$BITBUCKET_APP_PASSWORD" \
  "https://api.bitbucket.org/2.0/repositories/{workspace}/{repo}/pullrequests" \
  -H "Content-Type: application/json" \
  -d '{"title": "Feature PR", "source": {"branch": {"name": "feature"}}, "destination": {"branch": {"name": "main"}}}'
```
## Links
- Docs: https://developer.atlassian.com/cloud/bitbucket/rest
