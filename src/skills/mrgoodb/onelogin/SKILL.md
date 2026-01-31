---
name: onelogin
description: Manage users and apps via OneLogin API. Handle SSO and identity management.
metadata: {"clawdbot":{"emoji":"1️⃣","requires":{"env":["ONELOGIN_CLIENT_ID","ONELOGIN_CLIENT_SECRET","ONELOGIN_REGION"]}}}
---
# OneLogin
Identity and access management.
## Environment
```bash
export ONELOGIN_CLIENT_ID="xxxxxxxxxx"
export ONELOGIN_CLIENT_SECRET="xxxxxxxxxx"
export ONELOGIN_REGION="us"  # or eu
```
## Get Access Token
```bash
curl -X POST "https://api.$ONELOGIN_REGION.onelogin.com/auth/oauth2/v2/token" \
  -u "$ONELOGIN_CLIENT_ID:$ONELOGIN_CLIENT_SECRET" \
  -d "grant_type=client_credentials"
```
## List Users
```bash
curl "https://api.$ONELOGIN_REGION.onelogin.com/api/2/users" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```
## Create User
```bash
curl -X POST "https://api.$ONELOGIN_REGION.onelogin.com/api/2/users" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "firstname": "John", "lastname": "Doe"}'
```
## Links
- Admin: https://your-org.onelogin.com/admin
- Docs: https://developers.onelogin.com
