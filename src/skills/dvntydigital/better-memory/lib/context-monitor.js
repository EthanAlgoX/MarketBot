/**
 * ContextMonitor - Real-time context tracking and automatic management
 *
 * - Accurate token counting (tiktoken)
 * - Configurable context limits (no hardcoded model)
 * - Threshold-based compression triggering
 * - Auto-retrieval of relevant memories
 * - Session state persistence
 */

import { get_encoding } from 'tiktoken';
import fs from 'fs';
import path from 'path';
import os from 'os';

const DEFAULT_CONFIG = {
  context_limit: 128000,
  warning_threshold: 0.75,
  compress_threshold: 0.85,
  emergency_threshold: 0.95,
  auto_retrieve: true,
  auto_compress: true,
};

export class ContextMonitor {
  constructor(memoryStore, compressor, options = {}) {
    this.memoryStore = memoryStore;
    this.compressor = compressor;
    // Filter out undefined values so they don't override defaults
    const defined = Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined));
    this.config = { ...DEFAULT_CONFIG, ...defined };

    this.encoder = get_encoding(this.config.encoding || 'cl100k_base');

    const dataDir = this.config.dataDir || path.join(os.homedir(), '.context-guardian');
    fs.mkdirSync(dataDir, { recursive: true });
    this.sessionPath = path.join(dataDir, 'current-session.json');

    this.session = this._loadSession();
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  configure(options) {
    if (options.contextLimit != null) this.config.context_limit = options.contextLimit;
    if (options.warningThreshold != null) this.config.warning_threshold = options.warningThreshold;
    if (options.compressThreshold != null) this.config.compress_threshold = options.compressThreshold;
    if (options.emergencyThreshold != null) this.config.emergency_threshold = options.emergencyThreshold;
    if (options.autoRetrieve != null) this.config.auto_retrieve = options.autoRetrieve;
    if (options.autoCompress != null) this.config.auto_compress = options.autoCompress;
    if (options.encoding) {
      this.encoder.free();
      this.encoder = get_encoding(options.encoding);
    }
  }

  // ---------------------------------------------------------------------------
  // Session state
  // ---------------------------------------------------------------------------

  _loadSession() {
    try {
      if (fs.existsSync(this.sessionPath)) {
        return JSON.parse(fs.readFileSync(this.sessionPath, 'utf8'));
      }
    } catch {}
    return this._newSession();
  }

  _newSession() {
    return {
      id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      start_time: Date.now(),
      messages: [],
      token_count: 0,
      input_tokens: 0,
      output_tokens: 0,
      last_compression: null,
      compressions: 0,
    };
  }

  _saveSession() {
    try {
      fs.writeFileSync(this.sessionPath, JSON.stringify(this.session, null, 2));
    } catch {}
  }

  // ---------------------------------------------------------------------------
  // Token counting
  // ---------------------------------------------------------------------------

  countTokens(text) {
    return this.encoder.encode(text).length;
  }

  getTokenUsage() {
    const used = this.session.token_count;
    const limit = this.config.context_limit;
    const percent = limit > 0 ? (used / limit) * 100 : 0;

    return {
      used,
      limit,
      percent: Math.round(percent),
      remaining: limit - used,
      status: this._healthStatus(percent),
    };
  }

  _healthStatus(percent) {
    if (percent >= this.config.emergency_threshold * 100) return 'CRITICAL';
    if (percent >= this.config.compress_threshold * 100) return 'DANGER';
    if (percent >= this.config.warning_threshold * 100) return 'WARNING';
    return 'HEALTHY';
  }

  // ---------------------------------------------------------------------------
  // Message processing
  // ---------------------------------------------------------------------------

  async processMessage(message, role = 'user') {
    const tokens = this.countTokens(message);

    this.session.messages.push({
      role,
      content: message,
      tokens,
      timestamp: Date.now(),
    });

    this.session.token_count += tokens;
    if (role === 'user') this.session.input_tokens += tokens;
    else this.session.output_tokens += tokens;

    // Check thresholds
    const usage = this.getTokenUsage();

    if (usage.status === 'CRITICAL') {
      await this.emergencyCompress();
    } else if (usage.status === 'DANGER' && this.config.auto_compress) {
      await this.compress();
    }

    // Auto-retrieve relevant memories
    if (this.config.auto_retrieve && role === 'user') {
      await this._retrieveRelevant(message);
    }

    this._saveSession();
    return this.getTokenUsage();
  }

  // ---------------------------------------------------------------------------
  // Compression
  // ---------------------------------------------------------------------------

  async compress() {
    const beforeCount = this.session.messages.length;
    const beforeTokens = this.session.token_count;

    const { compressed, scored } = await this.compressor.compress(
      this.session.messages,
      this.config.context_limit * 0.5
    );

    // Store high-priority from SCORED messages (they have priority set)
    await this.compressor.storeCompressed(scored, this.session.id);

    this.session.messages = compressed;
    this.session.token_count = compressed.reduce(
      (sum, m) => sum + this.countTokens(m.content), 0
    );
    this.session.last_compression = Date.now();
    this.session.compressions++;

    this._saveSession();

    return {
      before: { messages: beforeCount, tokens: beforeTokens },
      after: { messages: compressed.length, tokens: this.session.token_count },
    };
  }

  /**
   * Emergency compression: score first, then filter. Fixes the bug where
   * messages without a .priority field caused everything to be dropped.
   */
  async emergencyCompress() {
    // Score ALL messages first
    const scored = await Promise.all(
      this.session.messages.map(async (msg) => ({
        ...msg,
        priority: msg.priority ?? await this.compressor.scorePriority(msg),
      }))
    );

    const highPriority = scored.filter(m => m.priority >= 8);
    const recent = scored.slice(-3);

    // Store medium-priority to memory
    const toStore = scored.filter(m => m.priority >= 5 && m.priority < 8);
    for (const msg of toStore) {
      await this.memoryStore.store(msg.content, {
        metadata: { role: msg.role, emergency_save: true },
        priority: msg.priority,
        sessionId: this.session.id,
      });
    }

    // Deduplicate: avoid recent messages appearing in both lists
    const recentSet = new Set(recent.map(m => m.timestamp));
    const highNotRecent = highPriority.filter(m => !recentSet.has(m.timestamp));

    this.session.messages = [...highNotRecent, ...recent];
    this.session.token_count = this.session.messages.reduce(
      (sum, m) => sum + this.countTokens(m.content), 0
    );

    this._saveSession();
  }

  // ---------------------------------------------------------------------------
  // Auto-retrieval
  // ---------------------------------------------------------------------------

  async _retrieveRelevant(query) {
    try {
      const results = await this.memoryStore.search(query, {
        limit: 3,
        threshold: 0.7,
      });

      if (results.length > 0) {
        const memoryContext = results
          .map(r => `[Memory (${(r.similarity * 100).toFixed(0)}% match)]: ${r.content}`)
          .join('\n\n');

        const content = `[Context Guardian: Retrieved relevant memories]\n\n${memoryContext}`;
        const tokens = this.countTokens(content);

        this.session.messages.push({
          role: 'system',
          content,
          tokens,
          timestamp: Date.now(),
          is_memory: true,
        });

        this.session.token_count += tokens;
      }
    } catch {}
  }

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  getStats() {
    const usage = this.getTokenUsage();
    const duration = Date.now() - this.session.start_time;

    return {
      ...usage,
      session_id: this.session.id,
      duration_minutes: Math.round(duration / 60000),
      messages: this.session.messages.length,
      compressions: this.session.compressions,
      input_tokens: this.session.input_tokens,
      output_tokens: this.session.output_tokens,
      tokens_per_message: this.session.messages.length > 0
        ? Math.round(this.session.token_count / this.session.messages.length)
        : 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Session lifecycle
  // ---------------------------------------------------------------------------

  async endSession() {
    const summary = {
      start_time: this.session.start_time,
      end_time: Date.now(),
      token_count: this.session.token_count,
      messages: this.session.messages.length,
      compressions: this.session.compressions,
    };

    this.memoryStore.storeSession(this.session.id, summary);

    this.session = this._newSession();
    this._saveSession();
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  destroy() {
    try { this.encoder.free(); } catch {}
  }
}
