# Better Memory

Semantic memory, intelligent compression, and context management for AI agents.

## The Problem

Agents hit context limits and lose everything. Mid-conversation amnesia. No memory across sessions. System prompts eat token budgets.

## The Solution

Better Memory gives agents persistent semantic memory with automatic deduplication, priority-based compression, and token-budget-aware retrieval.

- Real vector embeddings (local, no API calls)
- SQLite storage with binary embedding blobs
- Auto-deduplication (exact hash + cosine similarity >0.9)
- Multi-signal priority scoring (role + regex + semantic + length)
- Pluggable LLM summarizer with extractive fallback
- Memory decay (age penalty + access boost)
- Token-budget-aware retrieval
- Configurable everything (context limit, thresholds, data dir, encoding)

## Install

```bash
npm install better-memory
```

## Usage

### Programmatic (Primary)

```javascript
import { createContextGuardian } from 'better-memory';

const cg = createContextGuardian({
  dataDir: '/path/to/data',       // Default: ~/.better-memory
  contextLimit: 128000,            // Default: 128000
  encoding: 'cl100k_base',        // Default: cl100k_base
  summarizer: async (text) => {    // Optional: your LLM summarizer
    return await myLLM.summarize(text);
  },
  autoRetrieve: true,              // Auto-inject relevant memories
  autoCompress: true,              // Auto-compress at thresholds
});

await cg.initialize();
```

### Store Memories

```javascript
// Auto-deduplicates: exact match returns existing ID,
// cosine similarity >0.9 updates existing instead of creating duplicate
await cg.store('User prefers TypeScript over JavaScript', { priority: 9 });
await cg.store('Project uses PostgreSQL on AWS RDS', { priority: 8 });
```

### Search

```javascript
const results = await cg.search('database choice', { threshold: 0.5, limit: 5 });
// Returns: [{ id, content, similarity, priority, metadata, tags, created_at }]
```

### Token-Budget Retrieval

```javascript
// Get relevant memories that fit within a token budget
const { memories, tokensUsed } = await cg.getRelevantContext(
  'tech stack decisions',
  4000,  // max tokens
  { threshold: 0.5 }
);
```

### Compress Conversations

```javascript
// Score, summarize, and store a conversation chunk
const { compressed, storedCount } = await cg.summarizeAndStore(messages, {
  targetTokens: 2000,
  sessionId: 'session-123',
});
```

### Process Messages (Auto Mode)

```javascript
// Tracks tokens, auto-compresses at thresholds, auto-retrieves memories
const usage = await cg.process(userMessage, 'user');
// Returns: { used, limit, percent, remaining, status }
```

### Identity

```javascript
cg.setIdentity({ name: 'Kit', personality: 'direct, competent' });
const identity = cg.getIdentity();
```

### Runtime Configuration

```javascript
cg.configure({
  contextLimit: 200000,
  autoRetrieve: false,
});
```

### Status

```javascript
const status = cg.getStatus();
// { used, limit, percent, status, session_id, messages, compressions, ... }

const memStats = cg.getMemoryStats();
// { memory_count, db_size_bytes, db_size_mb }
```

### Cleanup

```javascript
cg.close(); // Frees tiktoken encoder + closes SQLite
```

## CLI

```bash
better-memory status                        # Context health
better-memory search <query>                # Semantic search
better-memory store <content>               # Store a memory
better-memory identity [name] [traits...]   # Set/view identity
better-memory stats                         # Statistics
better-memory relevant <query> --budget <n> # Budget-aware retrieval
better-memory compress                      # Force compression
better-memory end-session                   # End session

# Flags
--data-dir <path>       # Data directory (default: ~/.better-memory)
--context-limit <n>     # Token limit (default: 128000)
```

## Architecture

```
lib/
  index.js            # ContextGuardian class + factory exports
  memory-store.js     # SQLite vector store with dedup + decay
  compressor.js       # Multi-signal priority scoring + summarization
  context-monitor.js  # Token tracking + threshold management
```

### Storage

SQLite database at `~/.better-memory/memories.db` (configurable via `dataDir`).

Tables: `memories` (content + binary embedding blob + priority + metadata + access tracking), `identity`, `sessions`.

### Embeddings

`@xenova/transformers` with `Xenova/all-MiniLM-L6-v2` (384-dim vectors). Runs locally, no API calls. Embeddings loaded into memory for fast cosine similarity search.

### Priority Scoring

Multi-signal, not keyword matching:
- **Role base**: system=7, user=6, assistant=5, tool=4
- **Regex patterns**: word-boundary matching for importance indicators (+/- weight)
- **Semantic archetypes**: cosine similarity to pre-computed importance embeddings
- **Length**: bonus for substantive content, penalty for very short
- **Explicit**: caller-provided priority passes through unchanged

### Deduplication

On every `store()`:
1. SHA-256 hash check (exact match = update existing)
2. Cosine similarity >0.9 check (near-duplicate = update existing)

### Memory Decay

`effectivePriority = basePriority - (daysSinceAccess * 0.3) + min(accessCount * 0.1, 2)`

Old unused memories decay. Frequently accessed memories get boosted.

### Compression

At 85% capacity (configurable):
1. Score all messages by priority
2. Keep high-priority (>=8) + last 5 messages
3. Summarize medium-priority (5-7) via pluggable LLM or extractive fallback
4. Drop low-priority (<5)
5. Store high-priority to persistent memory

## Configuration Options

| Option | Default | Description |
|---|---|---|
| `dataDir` | `~/.better-memory` | Data storage directory |
| `contextLimit` | `128000` | Token limit |
| `encoding` | `cl100k_base` | Tiktoken encoding |
| `summarizer` | `null` | `async (text) => string` LLM function |
| `warningThreshold` | `0.75` | Warning at 75% |
| `compressThreshold` | `0.85` | Auto-compress at 85% |
| `emergencyThreshold` | `0.95` | Emergency compress at 95% |
| `autoRetrieve` | `true` | Auto-inject relevant memories |
| `autoCompress` | `true` | Auto-compress at threshold |

## Dependencies

- `@xenova/transformers` - Local sentence embeddings
- `sql.js` - SQLite storage (WASM, no native build required)
- `tiktoken` - Accurate token counting

## License

MIT
