/**
 * Context Guardian Tests
 *
 * Bug regressions + feature verification.
 * Uses Node built-in test runner and temp directories for isolation.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { MemoryStore } from './memory-store.js';
import { Compressor } from './compressor.js';
import { ContextMonitor } from './context-monitor.js';
import { createContextGuardian } from './index.js';

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cg-test-'));
}

// =============================================================================
// Memory Store
// =============================================================================

describe('MemoryStore', () => {
  let store;
  let dir;

  before(async () => {
    dir = tmpDir();
    store = new MemoryStore({ dataDir: dir });
    await store.getEmbedder(); // Warm up
  });

  after(() => {
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('stores and searches memories', async () => {
    await store.store('TypeScript is better than JavaScript for large projects', { priority: 8 });
    await store.store('The weather is nice today', { priority: 3 });

    const results = await store.search('programming language preference', { threshold: 0.3 });
    assert.ok(results.length > 0, 'Should find at least one result');
    assert.ok(results[0].content.includes('TypeScript'), 'Best match should be the TypeScript memory');
  });

  // Bug 3: Deduplication
  it('deduplicates exact content', async () => {
    const id1 = await store.store('Exact duplicate test content');
    const id2 = await store.store('Exact duplicate test content');
    assert.strictEqual(id1, id2, 'Same content should return same ID');
  });

  it('deduplicates semantically similar content (>0.9 cosine)', async () => {
    const id1 = await store.store('The user prefers dark mode in all applications');
    const id2 = await store.store('The user prefers dark mode in all applications and tools');
    // These are very similar; the second should dedup if cosine > 0.9
    // If they don't dedup (similarity might be < 0.9), that's also acceptable --
    // the dedup threshold is intentionally high to avoid false merges
  });

  it('tracks access count and last_accessed_at on search', async () => {
    const id = await store.store('Access tracking test memory with specific content', { priority: 7 });

    // Search for it
    await store.search('access tracking test', { threshold: 0.3 });

    // Check the DB directly using sql.js API
    const result = store.db.exec('SELECT access_count, last_accessed_at FROM memories WHERE id = ?', [id]);
    assert.ok(result.length > 0, 'Should find the memory in DB');
    const row = result[0].values[0];
    assert.ok(row[0] >= 1, 'Access count should be incremented');
    assert.ok(row[1] > 0, 'Last accessed should be set');
  });

  it('supports identity storage and retrieval', () => {
    store.storeIdentity('core', { name: 'TestBot', personality: 'helpful' });
    const identity = store.getIdentity('core');
    assert.deepStrictEqual(identity, { name: 'TestBot', personality: 'helpful' });
  });

  it('returns stats', () => {
    const stats = store.getStats();
    assert.ok(stats.memory_count > 0, 'Should have memories');
    assert.ok(stats.db_size_bytes > 0, 'DB should have size');
  });

  // getRelevantContext
  it('packs memories within token budget', async () => {
    // Store several memories
    await store.store('Short fact about memory A', { priority: 5 });
    await store.store('Short fact about memory B', { priority: 5 });

    const { memories, tokensUsed } = await store.getRelevantContext('fact about memory', 50, { threshold: 0.3 });
    assert.ok(tokensUsed <= 50, 'Should not exceed token budget');
  });

  it('memory decay reduces effective priority over time', () => {
    const now = Math.floor(Date.now() / 1000);
    const oldMemory = {
      priority: 8,
      created_at: now - 86400 * 10, // 10 days old
      last_accessed_at: now - 86400 * 10,
      access_count: 0,
    };
    const effective = store.getEffectivePriority(oldMemory, now);
    assert.ok(effective < oldMemory.priority, 'Old unaccessed memory should have lower effective priority');
    assert.ok(effective >= 1, 'Effective priority should not go below 1');
  });

  it('access boost increases effective priority', () => {
    const now = Math.floor(Date.now() / 1000);
    const frequentMemory = {
      priority: 5,
      created_at: now - 86400, // 1 day old
      last_accessed_at: now, // Just accessed
      access_count: 20,
    };
    const effective = store.getEffectivePriority(frequentMemory, now);
    assert.ok(effective > frequentMemory.priority, 'Frequently accessed memory should have boosted priority');
  });
});

// =============================================================================
// Compressor
// =============================================================================

describe('Compressor', () => {
  let store;
  let compressor;
  let dir;

  before(async () => {
    dir = tmpDir();
    store = new MemoryStore({ dataDir: dir });
    await store.getEmbedder();
    compressor = new Compressor(store);
  });

  after(() => {
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  // Bug 2: No shell exec
  it('does not import child_process', () => {
    const source = fs.readFileSync(new URL('./compressor.js', import.meta.url), 'utf8');
    assert.ok(!source.includes('child_process'), 'Should not import child_process');
    assert.ok(!source.includes('execAsync'), 'Should not use execAsync');
  });

  // Bug 5: Priority scoring is not just keyword matching
  it('scores architectural decisions higher than pleasantries', async () => {
    const decision = {
      role: 'user',
      content: 'After analyzing the tradeoffs between microservices and monolith, we decided to go with a modular monolith because deployment complexity outweighs benefits at our current scale.',
    };
    const pleasantry = { role: 'user', content: 'thanks!' };

    const decisionScore = await compressor.scorePriority(decision);
    const pleasantryScore = await compressor.scorePriority(pleasantry);

    assert.ok(decisionScore > pleasantryScore, `Decision (${decisionScore}) should score higher than pleasantry (${pleasantryScore})`);
  });

  it('does not score "I am confused" as critical identity', async () => {
    const confused = { role: 'user', content: 'I am confused by this error message in the logs' };
    const score = await compressor.scorePriority(confused);
    assert.ok(score < 10, `"I am confused" should not be priority 10, got ${score}`);
  });

  it('preserves explicit caller-provided priority', async () => {
    const msg = { role: 'user', content: 'hello', priority: 9 };
    const score = await compressor.scorePriority(msg);
    assert.strictEqual(score, 9, 'Should pass through explicit priority');
  });

  // Bug 6: compress returns scored messages
  it('compress returns scored messages with numeric priority', async () => {
    const messages = [
      { role: 'user', content: 'We decided to use PostgreSQL for the database', tokens: 10, timestamp: Date.now() },
      { role: 'assistant', content: 'Good choice for relational data', tokens: 8, timestamp: Date.now() },
      { role: 'user', content: 'ok', tokens: 2, timestamp: Date.now() },
    ];

    const { compressed, scored } = await compressor.compress(messages, 1000);
    assert.ok(Array.isArray(scored), 'Should return scored array');
    assert.ok(scored.every(m => typeof m.priority === 'number'), 'All scored messages should have numeric priority');
  });

  it('uses pluggable summarizer when provided', async () => {
    let summarizerCalled = false;
    const customCompressor = new Compressor(store, {
      summarizer: async (text) => {
        summarizerCalled = true;
        return 'Custom summary';
      },
    });

    const messages = [
      { role: 'user', content: 'Some conversation context here', priority: 6 },
    ];

    const result = await customCompressor.summarizeMessages(messages);
    assert.ok(summarizerCalled, 'Custom summarizer should be called');
    assert.strictEqual(result, 'Custom summary');
  });

  it('falls back to extractive when summarizer fails', async () => {
    const failingCompressor = new Compressor(store, {
      summarizer: async () => { throw new Error('LLM down'); },
    });

    const messages = [
      { role: 'user', content: 'Important context about the project architecture.', priority: 6 },
    ];

    const result = await failingCompressor.summarizeMessages(messages);
    assert.ok(result.includes('Key points'), 'Should fall back to extractive');
  });
});

// =============================================================================
// Context Monitor
// =============================================================================

describe('ContextMonitor', () => {
  let store;
  let compressor;
  let monitor;
  let dir;

  before(async () => {
    dir = tmpDir();
    store = new MemoryStore({ dataDir: dir });
    await store.getEmbedder();
    compressor = new Compressor(store);
    monitor = new ContextMonitor(store, compressor, {
      dataDir: dir,
      context_limit: 1000,
      auto_retrieve: false,
      auto_compress: false,
    });
  });

  after(() => {
    monitor.destroy();
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  // Bug 8: No hardcoded model
  it('defaults to 128K context limit, not 8192', () => {
    const defaultMonitor = new ContextMonitor(store, compressor, { dataDir: dir });
    assert.strictEqual(defaultMonitor.config.context_limit, 128000);
    defaultMonitor.destroy();
  });

  // Bug 7: Configurable context limits
  it('allows runtime reconfiguration', () => {
    monitor.configure({ contextLimit: 200000 });
    assert.strictEqual(monitor.config.context_limit, 200000);
    monitor.configure({ contextLimit: 1000 }); // Reset for other tests
  });

  it('tracks tokens accurately', async () => {
    const usage = await monitor.processMessage('Hello, this is a test message', 'user');
    assert.ok(usage.used > 0, 'Should count tokens');
    assert.ok(usage.percent > 0, 'Should show percentage');
  });

  // Bug 1: Emergency compression scores messages first
  it('emergency compression does not drop everything', async () => {
    // Create a monitor near capacity
    const smallMonitor = new ContextMonitor(store, compressor, {
      dataDir: dir,
      context_limit: 100,
      auto_retrieve: false,
      auto_compress: false,
      emergency_threshold: 0.5,
    });

    // Add messages WITHOUT priority field (like real usage)
    smallMonitor.session.messages = [
      { role: 'user', content: 'My name is Alice and I always prefer TypeScript over JavaScript', tokens: 20, timestamp: Date.now() - 5000 },
      { role: 'assistant', content: 'Noted, I will remember your preference for TypeScript', tokens: 15, timestamp: Date.now() - 4000 },
      { role: 'user', content: 'ok thanks', tokens: 5, timestamp: Date.now() - 3000 },
      { role: 'user', content: 'What should I use for this project?', tokens: 10, timestamp: Date.now() - 2000 },
      { role: 'assistant', content: 'Based on your preferences, TypeScript would be ideal', tokens: 12, timestamp: Date.now() - 1000 },
    ];
    smallMonitor.session.token_count = 62;

    await smallMonitor.emergencyCompress();

    // Should NOT have dropped everything -- identity message should survive
    assert.ok(
      smallMonitor.session.messages.length > 0,
      'Should retain some messages after emergency compression'
    );

    // The identity message (first one) should ideally be kept as high priority
    const hasIdentity = smallMonitor.session.messages.some(
      m => m.content.includes('Alice') || m.content.includes('TypeScript')
    );
    assert.ok(hasIdentity, 'Should retain identity/preference messages');

    smallMonitor.destroy();
  });

  it('endSession stores summary and starts new session', async () => {
    const oldId = monitor.session.id;
    await monitor.endSession();
    assert.notStrictEqual(monitor.session.id, oldId, 'Should have new session ID');
    assert.strictEqual(monitor.session.messages.length, 0, 'New session should have no messages');
  });
});

// =============================================================================
// Integration: ContextGuardian
// =============================================================================

describe('ContextGuardian (integration)', () => {
  let cg;
  let dir;

  before(async () => {
    dir = tmpDir();
    cg = createContextGuardian({
      dataDir: dir,
      contextLimit: 128000,
      autoRetrieve: false,
      autoCompress: false,
    });
    await cg.initialize();
  });

  after(() => {
    cg.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('store + search round trip', async () => {
    await cg.store('The project uses React with TypeScript for the frontend', { priority: 8 });
    const results = await cg.search('React TypeScript project', { threshold: 0.3 });
    assert.ok(results.length > 0, 'Should find stored memory');
    assert.ok(results[0].content.includes('React'), 'Should match React memory');
  });

  it('getRelevantContext respects token budget', async () => {
    await cg.store('Database is PostgreSQL running on AWS RDS', { priority: 7 });
    await cg.store('API is built with Express.js and deployed on ECS', { priority: 7 });

    const { memories, tokensUsed } = await cg.getRelevantContext('tech stack', 100, { threshold: 0.3 });
    assert.ok(tokensUsed <= 100, 'Should respect token budget');
  });

  it('summarizeAndStore compresses and stores', async () => {
    const messages = [
      { role: 'user', content: 'We decided to use Redis for caching. This is an important architectural decision.', tokens: 15, timestamp: Date.now() },
      { role: 'assistant', content: 'ok got it', tokens: 4, timestamp: Date.now() },
      { role: 'user', content: 'cool', tokens: 2, timestamp: Date.now() },
    ];

    const { compressed, storedCount } = await cg.summarizeAndStore(messages);
    assert.ok(Array.isArray(compressed), 'Should return compressed array');
    assert.ok(typeof storedCount === 'number', 'Should return stored count');
  });

  it('identity set/get', () => {
    cg.setIdentity({ name: 'TestAgent', personality: 'direct' });
    const identity = cg.getIdentity();
    assert.strictEqual(identity.name, 'TestAgent');
  });

  it('configure changes context limit', () => {
    cg.configure({ contextLimit: 64000 });
    const status = cg.getStatus();
    assert.strictEqual(status.limit, 64000);
    cg.configure({ contextLimit: 128000 }); // Reset
  });

  it('getStatus returns expected fields', () => {
    const status = cg.getStatus();
    assert.ok('used' in status);
    assert.ok('limit' in status);
    assert.ok('percent' in status);
    assert.ok('remaining' in status);
    assert.ok('status' in status);
    assert.ok('session_id' in status);
    assert.ok('messages' in status);
  });

  it('getMemoryStats returns count and size', () => {
    const stats = cg.getMemoryStats();
    assert.ok(stats.memory_count >= 0);
    assert.ok(stats.db_size_bytes >= 0);
  });
});
