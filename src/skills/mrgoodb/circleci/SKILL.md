---
name: circleci
description: Manage CircleCI pipelines, jobs, and workflows via API. Trigger and monitor builds.
metadata: {"clawdbot":{"emoji":"⭕","requires":{"env":["CIRCLECI_TOKEN"]}}}
---
# CircleCI
Continuous integration platform.
## Environment
```bash
export CIRCLECI_TOKEN="xxxxxxxxxx"
```
## List Pipelines
```bash
curl "https://circleci.com/api/v2/project/gh/{org}/{repo}/pipeline" \
  -H "Circle-Token: $CIRCLECI_TOKEN"
```
## Trigger Pipeline
```bash
curl -X POST "https://circleci.com/api/v2/project/gh/{org}/{repo}/pipeline" \
  -H "Circle-Token: $CIRCLECI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"branch": "main"}'
```
## Get Workflow
```bash
curl "https://circleci.com/api/v2/workflow/{workflowId}" -H "Circle-Token: $CIRCLECI_TOKEN"
```
## Links
- Docs: https://circleci.com/docs/api/v2/
