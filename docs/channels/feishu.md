---
summary: "Feishu/Lark bot support status, capabilities, and configuration"
read_when:
  - You want to connect MarketBot to Feishu or Lark
  - You are troubleshooting Feishu setup
---
# Feishu (plugin)

Updated: 2026-02-07

Status: text, media, edits, replies, threads, and reactions are supported. Polls are not supported.

## Plugin required
Feishu ships as a plugin and is not bundled with the core install.

Install via CLI (npm registry):
```bash
marketbot plugins install @marketbot/feishu
```

Local checkout (when running from a git repo):
```bash
marketbot plugins install ./extensions/feishu
```

Details: [Plugins](/plugin)

## Quick setup
1. Install and enable the Feishu plugin.
2. Create a Feishu Open Platform app (self-built app).
3. Copy App ID and App Secret.
4. Configure MarketBot.
5. Start the gateway and open the Control UI.

Minimal config:
```json5
{
  channels: {
    feishu: {
      enabled: true,
      domain: "feishu", // or "lark"
      connectionMode: "websocket",
      appId: "<APP_ID>",
      appSecret: "<APP_SECRET>",

      // Safety defaults
      dmPolicy: "pairing",
      groupPolicy: "allowlist"
    }
  }
}
```

## Credentials
MarketBot requires:
- `channels.feishu.appId`
- `channels.feishu.appSecret`

If you use webhook mode, you may also set:
- `channels.feishu.encryptKey`
- `channels.feishu.verificationToken`

## Domain
Set `channels.feishu.domain`:
- `feishu` for Feishu (feishu.cn)
- `lark` for Lark (larksuite.com)

## Access control
DMs are gated by `channels.feishu.dmPolicy`:
- `pairing` (default): unknown users must be approved
- `allowlist`: only `channels.feishu.allowFrom` can trigger
- `open`: allow anyone listed in `allowFrom` with `*` present

Groups are gated by `channels.feishu.groupPolicy`:
- `allowlist` (default): blocked unless you set `channels.feishu.groupAllowFrom`
- `open`: allow any member (mention-gated by default)
- `disabled`: do not respond in groups

## Control UI
You can edit Feishu config in the Control UI:
- Open [Control UI](/web/control-ui)
- Go to Channels
- Find Feishu
- Fill in App ID and App Secret
- Click Save

