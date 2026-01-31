/**
 * Context Guardian - Semantic memory, intelligent compression, and context
 * management for AI agents.
 *
 * Usage:
 *   import { createContextGuardian } from 'context-guardian';
 *
 *   const cg = createContextGuardian({
 *     dataDir: '/path/to/data',
 *     contextLimit: 128000,
 *     summarizer: async (text) => myLLM.summarize(text),
 *   });
 *   await cg.initialize();
 *
 *   await cg.store('Important fact', { priority: 9 });
 *   const results = await cg.search('relevant query');
 *   const { memories, tokensUsed } = await cg.getRelevantContext('query', 4000);
 */

import { MemoryStore } from './memory-store.js';
import { Compressor } from './compressor.js';
import { ContextMonitor } from './context-monitor.js';
import { Feedback } from './feedback.js';

export class ContextGuardian {
  constructor(options = {}) {
    const {
      dataDir,
      contextLimit,
      encoding,
      summarizer,
      warningThreshold,
      compressThreshold,
      emergencyThreshold,
      autoRetrieve,
      autoCompress,
      feedback = true,        // Enable user feedback by default
      verboseFeedback = false, // Subtle by default
      personality = 'neutral', // Adapt to agent personality
    } = options;

    this.memoryStore = new MemoryStore({ dataDir });
    this.compressor = new Compressor(this.memoryStore, { summarizer });
    this.monitor = new ContextMonitor(this.memoryStore, this.compressor, {
      dataDir,
      context_limit: contextLimit,
      encoding,
      warning_threshold: warningThreshold,
      compress_threshold: compressThreshold,
      emergency_threshold: emergencyThreshold,
      auto_retrieve: autoRetrieve,
      auto_compress: autoCompress,
    });
    this.feedback = new Feedback({ feedback, verboseFeedback });
    this.personality = personality;
    this.initialized = false;
    this._firstRun = true;
  }

  /**
   * Initialize (loads embedding model + identity).
   * Safe to call multiple times.
   * Returns welcome message on first run (optional).
   */
  async initialize() {
    if (this.initialized) return null;
    await this.memoryStore.getEmbedder();
    this.initialized = true;
    
    // Show welcome on first run
    if (this._firstRun) {
      this._firstRun = false;
      const welcome = this.feedback.welcome();
      if (welcome?.show) {
        return this.feedback.adapt(welcome.message, this.personality);
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Core: Store & Search
  // ---------------------------------------------------------------------------

  /**
   * Store a memory. Auto-deduplicates (exact + semantic).
   * Returns the memory ID.
   */
  async store(content, options = {}) {
    if (!this.initialized) await this.initialize();
    return await this.memoryStore.store(content, options);
  }

  /**
   * Semantic search across all memories.
   * Returns array of { id, content, similarity, priority, metadata, tags, created_at }.
   */
  async search(query, options = {}) {
    if (!this.initialized) await this.initialize();
    return await this.memoryStore.search(query, options);
  }

  /**
   * Get relevant memories that fit within a token budget.
   * Returns { memories: [...], tokensUsed: number }.
   */
  async getRelevantContext(query, tokenBudget, options = {}) {
    if (!this.initialized) await this.initialize();
    return await this.memoryStore.getRelevantContext(query, tokenBudget, options);
  }

  // ---------------------------------------------------------------------------
  // Core: Compression
  // ---------------------------------------------------------------------------

  /**
   * Compress a set of messages: score by priority, summarize medium-priority,
   * store high-priority to memory, drop low-priority.
   *
   * Returns { compressed: [...], storedCount: number }.
   */
  async summarizeAndStore(messages, options = {}) {
    if (!this.initialized) await this.initialize();
    const { compressed, scored } = await this.compressor.compress(
      messages, options.targetTokens
    );
    const storedCount = await this.compressor.storeCompressed(
      scored, options.sessionId
    );
    return { compressed, storedCount };
  }

  /**
   * Process a message through the monitor (token tracking, auto-compress,
   * auto-retrieve). Returns current token usage stats.
   */
  async process(message, role = 'user') {
    if (!this.initialized) await this.initialize();
    return await this.monitor.processMessage(message, role);
  }

  /**
   * Force compression of the current session.
   */
  async compress() {
    if (!this.initialized) await this.initialize();
    return await this.monitor.compress();
  }

  // ---------------------------------------------------------------------------
  // Identity
  // ---------------------------------------------------------------------------

  setIdentity(identity) {
    this.memoryStore.storeIdentity('core', identity);
  }

  getIdentity() {
    return this.memoryStore.getIdentity('core');
  }

  // ---------------------------------------------------------------------------
  // Configuration & Status
  // ---------------------------------------------------------------------------

  /**
   * Reconfigure at runtime (context limit, thresholds, encoding, etc).
   */
  configure(options) {
    this.monitor.configure(options);
  }

  /**
   * Get current status: token usage, session info, memory stats.
   */
  getStatus() {
    return this.monitor.getStats();
  }

  getMemoryStats() {
    return this.memoryStore.getStats();
  }

  // ---------------------------------------------------------------------------
  // Session lifecycle
  // ---------------------------------------------------------------------------

  async endSession() {
    await this.monitor.endSession();
  }

  // ---------------------------------------------------------------------------
  // User Experience - Creates "aha!" moments
  // ---------------------------------------------------------------------------

  /**
   * Show what Better Memory learned from recent conversation.
   * Call this after a conversation to create instant demonstration.
   * Returns formatted message or null.
   */
  async showWhatILearned() {
    if (!this.initialized) await this.initialize();
    
    const demo = await this.feedback.firstConversationDemo(this.memoryStore);
    if (demo?.show) {
      return this.feedback.adapt(demo.message, this.personality);
    }
    return null;
  }

  /**
   * Quick demo: search and show instant proof it works.
   * Returns formatted result or null.
   */
  async demonstrateMemory(query) {
    if (!this.initialized) await this.initialize();
    
    const results = await this.search(query, { limit: 1 });
    if (results.length === 0) return null;
    
    const demo = this.feedback.instantDemo(query, results);
    if (demo?.show) {
      return this.feedback.adapt(demo.message, this.personality);
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  close() {
    this.monitor.destroy();
    this.memoryStore.close();
  }
}

// ---------------------------------------------------------------------------
// Factory (preferred)
// ---------------------------------------------------------------------------

export function createContextGuardian(options = {}) {
  return new ContextGuardian(options);
}

// ---------------------------------------------------------------------------
// Backward-compatible singleton
// ---------------------------------------------------------------------------

let _singleton = null;

export function getContextGuardian(options = {}) {
  if (!_singleton) {
    _singleton = new ContextGuardian(options);
  }
  return _singleton;
}

export default ContextGuardian;
