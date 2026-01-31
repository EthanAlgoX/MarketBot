# Bird DM 💬

DM add-on for [bird](https://github.com/steipete/bird) - read your X/Twitter direct messages.

## Install

```bash
npm install -g bird-dm
```

Requires:
- Node.js 22+
- [bird](https://github.com/steipete/bird) for auth verification

## Usage

```bash
# List your DM conversations
bird-dm inbox
bird-dm inbox -n 50        # more conversations
bird-dm inbox --json       # JSON output

# Read a specific conversation
bird-dm read <conversation-id>
bird-dm read <id> -n 100   # more messages
bird-dm read <id> --json   # JSON output
```

## Auth

Uses the same browser cookie auth as bird. Must be logged into X/Twitter in Chrome/Firefox/Safari.

```bash
# Verify your session
bird check

# Or pass cookies directly
bird-dm inbox --auth-token <token> --ct0 <token>
```

## For AI Agents

Available as a skill on [ClawHub](https://clawhub.ai):

```bash
clawdhub install bird-dm
```

## API

Can also be used as a library:

```typescript
import { fetchDMInbox, parseInbox } from 'bird-dm';
import { resolveCredentials } from '@steipete/bird';

const { cookies } = await resolveCredentials({ cookieSources: ['chrome'] });
const data = await fetchDMInbox(cookies);
const conversations = parseInbox(data);
```

## License

MIT
