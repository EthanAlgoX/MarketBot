#!/usr/bin/env node

/**
 * Better Memory CLI
 *
 * Commands:
 *   status                          Show context health
 *   search <query>                  Semantic memory search
 *   store <content>                 Store a memory
 *   identity [name] [traits...]     Set/view agent identity
 *   stats                           Show memory statistics
 *   relevant <query> --budget <n>   Get memories within token budget
 *   compress                        Force compression
 *   end-session                     End current session
 *
 * Flags:
 *   --data-dir <path>               Data directory (default: ~/.better-memory)
 *   --context-limit <n>             Token limit (default: 128000)
 */

import { createContextGuardian } from '../lib/index.js';

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function c(text, color) {
  return `${C[color]}${text}${C.reset}`;
}

// Parse flags
const rawArgs = process.argv.slice(2);
const flags = {};
const args = [];
for (let i = 0; i < rawArgs.length; i++) {
  if (rawArgs[i] === '--data-dir' && rawArgs[i + 1]) {
    flags.dataDir = rawArgs[++i];
  } else if (rawArgs[i] === '--context-limit' && rawArgs[i + 1]) {
    flags.contextLimit = parseInt(rawArgs[++i], 10);
  } else if (rawArgs[i] === '--budget' && rawArgs[i + 1]) {
    flags.budget = parseInt(rawArgs[++i], 10);
  } else {
    args.push(rawArgs[i]);
  }
}

function createCG() {
  const opts = {};
  if (flags.dataDir) opts.dataDir = flags.dataDir;
  if (flags.contextLimit) opts.contextLimit = flags.contextLimit;
  opts.autoRetrieve = false; // CLI doesn't need auto-retrieve
  opts.autoCompress = false;
  return createContextGuardian(opts);
}

async function cmdStatus() {
  const cg = createCG();
  await cg.initialize();

  const status = cg.getStatus();
  const healthColor = status.status === 'HEALTHY' ? 'green'
    : status.status === 'WARNING' ? 'yellow' : 'red';
  const symbol = status.status === 'HEALTHY' ? 'OK'
    : status.status === 'WARNING' ? 'WARN' : 'CRIT';

  console.log(`\n${c('Context Health:', 'bold')} ${c(`${status.status} [${symbol}]`, healthColor)}`);
  console.log(`  Used: ${c(status.used.toLocaleString(), 'cyan')} / ${status.limit.toLocaleString()} tokens (${c(status.percent + '%', healthColor)})`);
  console.log(`  Remaining: ${c(status.remaining.toLocaleString(), 'cyan')} tokens`);
  console.log(`  Messages: ${status.messages}`);
  console.log(`  Duration: ${status.duration_minutes} min`);

  if (status.compressions > 0) {
    console.log(`  Compressions: ${status.compressions}`);
  }

  console.log(`  Session: ${status.session_id}`);

  const mem = cg.getMemoryStats();
  console.log(`\n${c('Memory:', 'bold')} ${c(mem.memory_count.toLocaleString(), 'cyan')} stored memories (${mem.db_size_mb} MB)`);

  const identity = cg.getIdentity();
  if (identity) {
    console.log(`\n${c('Identity:', 'bold')} ${c(identity.name || 'Agent', 'cyan')}`);
    if (identity.personality) {
      console.log(`  ${identity.personality}`);
    }
  }

  console.log('');
  cg.close();
}

async function cmdSearch(query) {
  if (!query) {
    console.log('Usage: better-memory search <query>');
    return;
  }

  const cg = createCG();
  await cg.initialize();

  console.log(`\nSearching: "${query}"\n`);

  const results = await cg.search(query, { limit: 5 });

  if (results.length === 0) {
    console.log('No results found.');
  } else {
    results.forEach((r, i) => {
      console.log(`${i + 1}. ${c((r.similarity * 100).toFixed(0) + '% match', 'cyan')} ${c('(priority: ' + r.priority + ')', 'blue')}`);
      console.log(`   ${r.content.substring(0, 150)}${r.content.length > 150 ? '...' : ''}`);
      console.log(`   ${c(new Date(r.created_at * 1000).toLocaleString(), 'blue')}\n`);
    });
  }

  cg.close();
}

async function cmdStore(content) {
  if (!content) {
    console.log('Usage: better-memory store <content>');
    return;
  }

  const cg = createCG();
  await cg.initialize();

  const id = await cg.store(content, { priority: 8 });
  console.log(`Stored memory #${id}`);
  cg.close();
}

async function cmdIdentity(name, ...traits) {
  const cg = createCG();
  await cg.initialize();

  if (!name) {
    const identity = cg.getIdentity();
    if (identity) {
      console.log(`\nIdentity:`);
      console.log(JSON.stringify(identity, null, 2));
    } else {
      console.log('No identity set.');
    }
  } else {
    const identity = { name, personality: traits.join(' '), set_at: Date.now() };
    cg.setIdentity(identity);
    console.log(`Identity set: ${name}`);
  }

  cg.close();
}

async function cmdStats() {
  const cg = createCG();
  await cg.initialize();

  const mem = cg.getMemoryStats();
  const status = cg.getStatus();

  console.log('\nBetter Memory Statistics\n');
  console.log('Session:');
  console.log(`  ID: ${status.session_id}`);
  console.log(`  Duration: ${status.duration_minutes} min`);
  console.log(`  Messages: ${status.messages}`);
  console.log(`  Tokens: ${status.used.toLocaleString()} / ${status.limit.toLocaleString()}`);
  console.log(`  Input: ${status.input_tokens.toLocaleString()} | Output: ${status.output_tokens.toLocaleString()}`);
  console.log(`  Compressions: ${status.compressions}`);

  console.log('\nMemory:');
  console.log(`  Stored: ${mem.memory_count.toLocaleString()}`);
  console.log(`  Database: ${mem.db_size_mb} MB`);
  console.log('');

  cg.close();
}

async function cmdRelevant(query) {
  if (!query) {
    console.log('Usage: better-memory relevant <query> --budget <tokens>');
    return;
  }

  const budget = flags.budget || 2000;
  const cg = createCG();
  await cg.initialize();

  console.log(`\nRetrieving context for: "${query}" (budget: ${budget} tokens)\n`);

  const { memories, tokensUsed } = await cg.getRelevantContext(query, budget);

  if (memories.length === 0) {
    console.log('No relevant memories found.');
  } else {
    memories.forEach((r, i) => {
      console.log(`${i + 1}. ${c((r.similarity * 100).toFixed(0) + '%', 'cyan')} ${r.content.substring(0, 150)}${r.content.length > 150 ? '...' : ''}`);
    });
    console.log(`\n${c(memories.length, 'cyan')} memories, ${c(tokensUsed, 'cyan')} tokens used of ${budget} budget`);
  }

  cg.close();
}

async function cmdCompress() {
  const cg = createCG();
  cg.configure({ autoCompress: true });
  await cg.initialize();

  const result = await cg.compress();
  if (result) {
    console.log(`Compressed: ${result.before.messages} -> ${result.after.messages} messages, ${result.before.tokens} -> ${result.after.tokens} tokens`);
  } else {
    console.log('Nothing to compress.');
  }

  cg.close();
}

async function cmdEndSession() {
  const cg = createCG();
  await cg.initialize();
  await cg.endSession();
  console.log('Session ended, new session started.');
  cg.close();
}

// Main
const command = args[0];

(async () => {
  try {
    switch (command) {
      case 'status': await cmdStatus(); break;
      case 'search': await cmdSearch(args.slice(1).join(' ')); break;
      case 'store': await cmdStore(args.slice(1).join(' ')); break;
      case 'identity': await cmdIdentity(...args.slice(1)); break;
      case 'stats': await cmdStats(); break;
      case 'relevant': await cmdRelevant(args.slice(1).join(' ')); break;
      case 'compress': await cmdCompress(); break;
      case 'end-session': await cmdEndSession(); break;
      default:
        console.log(`
${c('Better Memory', 'bold')}

${c('Usage:', 'bold')}
  better-memory status                        Context health
  better-memory search <query>                 Semantic search
  better-memory store <content>                Store a memory
  better-memory identity [name] [traits...]    Set/view identity
  better-memory stats                          Statistics
  better-memory relevant <query> --budget <n>  Budget-aware retrieval
  better-memory compress                       Force compression
  better-memory end-session                    End session

${c('Flags:', 'bold')}
  --data-dir <path>       Data directory (default: ~/.better-memory)
  --context-limit <n>     Token limit (default: 128000)
  --budget <n>            Token budget for relevant command
`);
    }
    process.exit(0);
  } catch (error) {
    console.error(c('Error:', 'red'), error.message);
    process.exit(1);
  }
})();
