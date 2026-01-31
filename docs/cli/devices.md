---
summary: "CLI reference for `marketbot devices` (device pairing + token rotation/revocation)"
read_when:
  - You are approving device pairing requests
  - You need to rotate or revoke device tokens
---

# `marketbot devices`

Manage device pairing requests and device-scoped tokens.

## Commands

### `marketbot devices list`

List pending pairing requests and paired devices.

```
marketbot devices list
marketbot devices list --json
```

### `marketbot devices approve <requestId>`

Approve a pending device pairing request.

```
marketbot devices approve <requestId>
```

### `marketbot devices reject <requestId>`

Reject a pending device pairing request.

```
marketbot devices reject <requestId>
```

### `marketbot devices rotate --device <id> --role <role> [--scope <scope...>]`

Rotate a device token for a specific role (optionally updating scopes).

```
marketbot devices rotate --device <deviceId> --role operator --scope operator.read --scope operator.write
```

### `marketbot devices revoke --device <id> --role <role>`

Revoke a device token for a specific role.

```
marketbot devices revoke --device <deviceId> --role node
```

## Common options

- `--url <url>`: Gateway WebSocket URL (defaults to `gateway.remote.url` when configured).
- `--token <token>`: Gateway token (if required).
- `--password <password>`: Gateway password (password auth).
- `--timeout <ms>`: RPC timeout.
- `--json`: JSON output (recommended for scripting).

## Notes

- Token rotation returns a new token (sensitive). Treat it like a secret.
- These commands require `operator.pairing` (or `operator.admin`) scope.
