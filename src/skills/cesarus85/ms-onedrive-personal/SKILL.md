---
name: ms-onedrive-personal-graph
description: Access OneDrive Personal (consumer Microsoft accounts) via Microsoft Graph using OAuth device-code flow. Supports ls/mkdir/upload/download/info; safe-by-default (no delete).
metadata:
  openclaw:
    requires:
      bins: ["bash","curl","jq","python3"]
---

# OneDrive Personal (Consumer) via Microsoft Graph

A small, safe-by-default skill to access **OneDrive Personal** (consumer Microsoft accounts) using the **Microsoft Graph API**.

It uses **OAuth 2.0 device-code flow** (no browser automation needed on the server) and stores tokens locally.

## Features
- Authenticate via device code
- List folders (`ls`)
- Create folders (`mkdir`)
- Upload files (simple upload; best for small/medium files)
- Download files
- Show item metadata (`info`)

## Safety / non-features
- **No delete** operations (by design)
- No bulk move/rename (can be added later)

## Setup (first time)
### 1) Create a Microsoft Entra app registration
You need a **Client ID**.

Create an app registration (recommended):
1. Go to the Entra portal: https://entra.microsoft.com/
2. **App registrations** → **New registration**
3. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
4. Create
5. In the app: **Authentication** → enable **Allow public client flows**
   - (Some tenants also require setting `isFallbackPublicClient=true` — the script will tell you if needed.)

> Note: Some users hit Azure portal sign-in errors like “tenant blocked due to inactivity”. That is *not* required for OneDrive itself, but it can block creating an app registration. In that case, create the app under a different Entra tenant you control, **as long as it’s configured to allow personal Microsoft accounts**.

### 2) Run setup
On the machine running OpenClaw:
```bash
cd /root/clawd/skills/ms-onedrive-personal-graph
./scripts/onedrive-setup.sh
```

The script will:
- Ask for the Client ID
- Print a device login URL + code
- Wait until you approve the login
- Save tokens to `~/.onedrive-mcp/credentials.json`
- Test access to `https://graph.microsoft.com/v1.0/me/drive`

## Usage
All commands use the token in `~/.onedrive-mcp/credentials.json`.

```bash
./scripts/onedrive-cli.sh ls /
./scripts/onedrive-cli.sh mkdir "/Invoices"
./scripts/onedrive-cli.sh upload ./invoice.pdf "/Invoices/invoice.pdf"
./scripts/onedrive-cli.sh download "/Invoices/invoice.pdf" ./invoice.pdf
./scripts/onedrive-cli.sh info "/Invoices/invoice.pdf"
```

## Token refresh
If you get 401/invalid token, refresh with:
```bash
./scripts/onedrive-token.sh refresh
```

## Troubleshooting
### AADSTS5000225: tenant has been blocked due to inactivity
This happens when your login is tied to an Entra tenant that Microsoft marked inactive.
- Use https://account.microsoft.com/ for the consumer account (usually works)
- Create the app registration in a different tenant you control (or via a different admin identity)

### AADSTS70002: client must be marked as 'mobile'
Enable **Allow public client flows** and/or set `isFallbackPublicClient=true` in the app.

### Upload limits
This skill uses the **simple upload** endpoint (`...:/content`). For large files, we should add upload-session support.
