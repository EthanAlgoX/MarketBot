/**
 * MemoryStore - Semantic memory with vector embeddings (SQLite via sql.js)
 *
 * - SQLite storage (WASM, no native build required)
 * - Binary embedding blobs
 * - Deduplication (exact hash + semantic similarity)
 * - Memory decay (age penalty + access boost)
 * - Cosine similarity search with in-memory embedding index
 * - Token-budget-aware retrieval
 */

import { pipeline } from '@xenova/transformers';
import initSqlJs from 'sql.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

const DEFAULT_DATA_DIR = path.join(os.homedir(), '.context-guardian');

export class MemoryStore {
  constructor(options = {}) {
    this.dataDir = options.dataDir || DEFAULT_DATA_DIR;
    fs.mkdirSync(this.dataDir, { recursive: true });

    this.dbPath = path.join(this.dataDir, 'memories.db');
    this.db = null; // Initialized async in _initDb()
    this._dbReady = this._initDb();

    this.embedder = null;
    this._embeddingIndex = null;
  }

  // ---------------------------------------------------------------------------
  // Database init (async because sql.js needs WASM)
  // ---------------------------------------------------------------------------

  async _initDb() {
    const SQL = await initSqlJs();

    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    this._initSchema();
  }

  async _ensureDb() {
    await this._dbReady;
  }

  _initSchema() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        embedding BLOB NOT NULL,
        priority REAL DEFAULT 5,
        metadata TEXT DEFAULT '{}',
        tags TEXT DEFAULT '[]',
        session_id TEXT,
        created_at INTEGER NOT NULL,
        last_accessed_at INTEGER,
        access_count INTEGER DEFAULT 0,
        content_hash TEXT NOT NULL
      )
    `);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_memories_hash ON memories(content_hash)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_memories_priority ON memories(priority)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_memories_session ON memories(session_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at)`);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS identity (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        start_time INTEGER,
        end_time INTEGER
      )
    `);
  }

  _save() {
    const data = this.db.export();
    fs.writeFileSync(this.dbPath, Buffer.from(data));
  }

  // ---------------------------------------------------------------------------
  // Embedder
  // ---------------------------------------------------------------------------

  async getEmbedder() {
    if (!this.embedder) {
      this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    return this.embedder;
  }

  async embed(text) {
    const embedder = await this.getEmbedder();
    const output = await embedder(text, { pooling: 'mean', normalize: true });
    return new Float32Array(output.data);
  }

  // ---------------------------------------------------------------------------
  // Embedding index (in-memory for fast cosine similarity)
  // ---------------------------------------------------------------------------

  // Note: _loadEmbeddingIndex is handled inside _getEmbeddingIndex

  async _getEmbeddingIndex() {
    await this._ensureDb();
    if (!this._embeddingIndex) {
      // sql.js prepare/step approach
      const stmt = this.db.prepare('SELECT id, embedding FROM memories');
      this._embeddingIndex = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        this._embeddingIndex.push({
          id: row.id,
          embedding: new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 4),
        });
      }
      stmt.free();
    }
    return this._embeddingIndex;
  }

  _invalidateIndex() {
    this._embeddingIndex = null;
  }

  // ---------------------------------------------------------------------------
  // Store (with deduplication)
  // ---------------------------------------------------------------------------

  async store(content, options = {}) {
    await this._ensureDb();
    const {
      metadata = {},
      priority = 5,
      sessionId = null,
      tags = [],
    } = options;

    const now = Math.floor(Date.now() / 1000);
    const contentHash = crypto.createHash('sha256').update(content).digest('hex');

    // --- Exact duplicate check ---
    const exactStmt = this.db.prepare('SELECT id, priority FROM memories WHERE content_hash = ?');
    exactStmt.bind([contentHash]);
    if (exactStmt.step()) {
      const existing = exactStmt.getAsObject();
      exactStmt.free();
      this.db.run('UPDATE memories SET last_accessed_at = ?, priority = MAX(priority, ?) WHERE id = ?',
        [now, priority, existing.id]);
      this._save();
      return existing.id;
    }
    exactStmt.free();

    // --- Generate embedding ---
    const embedding = await this.embed(content);
    const embeddingBuf = Buffer.from(embedding.buffer);

    // --- Semantic duplicate check (cosine > 0.9) ---
    const nearest = await this._findNearestFromEmbedding(embedding, 1, 0.9);
    if (nearest.length > 0) {
      const existingId = nearest[0].id;
      this.db.run('UPDATE memories SET last_accessed_at = ?, priority = MAX(priority, ?), access_count = access_count + 1 WHERE id = ?',
        [now, priority, existingId]);
      this._save();
      return existingId;
    }

    // --- Insert new memory ---
    this.db.run(`
      INSERT INTO memories (content, embedding, priority, metadata, tags, session_id, created_at, last_accessed_at, access_count, content_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `, [
      content,
      embeddingBuf,
      priority,
      JSON.stringify(metadata),
      JSON.stringify(tags),
      sessionId,
      now,
      now,
      contentHash,
    ]);

    const newId = this.db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];

    // Append to in-memory index if loaded
    if (this._embeddingIndex) {
      this._embeddingIndex.push({ id: newId, embedding });
    }

    this._save();
    return newId;
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  async search(query, options = {}) {
    await this._ensureDb();
    const {
      limit = 5,
      threshold = 0.5,
      sessionId = null,
      useDecay = false,
    } = options;

    const queryEmbedding = await this.embed(query);
    let candidates = await this._findNearestFromEmbedding(queryEmbedding, limit * 3, threshold);

    // Filter by session if specified
    if (sessionId) {
      const sessionStmt = this.db.prepare('SELECT id FROM memories WHERE session_id = ?');
      sessionStmt.bind([sessionId]);
      const sessionIds = new Set();
      while (sessionStmt.step()) {
        sessionIds.add(sessionStmt.getAsObject().id);
      }
      sessionStmt.free();
      candidates = candidates.filter(c => sessionIds.has(c.id));
    }

    if (candidates.length === 0) return [];

    const topCandidates = candidates.slice(0, limit);
    const now = Math.floor(Date.now() / 1000);
    const results = [];

    for (const c of topCandidates) {
      const stmt = this.db.prepare('SELECT id, content, metadata, priority, tags, session_id, created_at, last_accessed_at, access_count FROM memories WHERE id = ?');
      stmt.bind([c.id]);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        const effectivePriority = useDecay ? this.getEffectivePriority(row, now) : row.priority;
        results.push({
          id: row.id,
          content: row.content,
          metadata: JSON.parse(row.metadata),
          priority: effectivePriority,
          basePriority: row.priority,
          tags: JSON.parse(row.tags),
          created_at: row.created_at,
          similarity: c.similarity,
        });
      }
      stmt.free();
    }

    // Update access tracking
    for (const r of results) {
      this.db.run('UPDATE memories SET last_accessed_at = ?, access_count = access_count + 1 WHERE id = ?', [now, r.id]);
    }
    this._save();

    return results;
  }

  // ---------------------------------------------------------------------------
  // Cosine similarity (in-memory)
  // ---------------------------------------------------------------------------

  async _findNearestFromEmbedding(queryEmbedding, limit, threshold) {
    const index = await this._getEmbeddingIndex();
    const results = [];

    for (const entry of index) {
      const sim = this._cosineSimilarity(queryEmbedding, entry.embedding);
      if (sim >= threshold) {
        results.push({ id: entry.id, similarity: sim });
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit);
  }

  _cosineSimilarity(a, b) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // ---------------------------------------------------------------------------
  // Memory decay
  // ---------------------------------------------------------------------------

  getEffectivePriority(memory, now = null) {
    now = now || Math.floor(Date.now() / 1000);
    const daysSinceAccess = memory.last_accessed_at
      ? (now - memory.last_accessed_at) / 86400
      : (now - memory.created_at) / 86400;

    const decay = Math.min(daysSinceAccess * 0.3, memory.priority - 1);
    const accessBoost = Math.min((memory.access_count || 0) * 0.1, 2);
    return Math.max(1, memory.priority - decay + accessBoost);
  }

  // ---------------------------------------------------------------------------
  // Priority-based retrieval
  // ---------------------------------------------------------------------------

  async getByPriority(minPriority = 7, limit = 10) {
    await this._ensureDb();
    const result = this.db.exec(
      'SELECT id, content, metadata, priority, tags, session_id, created_at FROM memories WHERE priority >= ? ORDER BY priority DESC, created_at DESC LIMIT ?',
      [minPriority, limit]
    );

    if (!result.length) return [];

    return result[0].values.map(row => ({
      id: row[0],
      content: row[1],
      metadata: JSON.parse(row[2]),
      priority: row[3],
      tags: JSON.parse(row[4]),
      created_at: row[6],
    }));
  }

  // ---------------------------------------------------------------------------
  // Token-budget-aware retrieval
  // ---------------------------------------------------------------------------

  async getRelevantContext(query, tokenBudget, options = {}) {
    const { threshold = 0.5, limit = 20 } = options;
    const results = await this.search(query, { limit, threshold });

    const selected = [];
    let usedTokens = 0;

    for (const result of results) {
      const tokens = this._estimateTokens(result.content);
      if (usedTokens + tokens <= tokenBudget) {
        selected.push(result);
        usedTokens += tokens;
      }
    }

    return { memories: selected, tokensUsed: usedTokens };
  }

  _estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }

  // ---------------------------------------------------------------------------
  // Identity
  // ---------------------------------------------------------------------------

  storeIdentity(key, value) {
    this._ensureDbSync();
    const now = Math.floor(Date.now() / 1000);
    this.db.run(`
      INSERT OR REPLACE INTO identity (key, value, updated_at) VALUES (?, ?, ?)
    `, [key, JSON.stringify(value), now]);
    this._save();
  }

  getIdentity(key) {
    this._ensureDbSync();
    const result = this.db.exec('SELECT value FROM identity WHERE key = ?', [key]);
    if (!result.length || !result[0].values.length) return null;
    return JSON.parse(result[0].values[0][0]);
  }

  // Sync version for methods that can't be async (identity get/set called sync)
  _ensureDbSync() {
    // db should be ready if initialize() was called
    if (!this.db) {
      throw new Error('MemoryStore not initialized. Call initialize() first.');
    }
  }

  // ---------------------------------------------------------------------------
  // Sessions
  // ---------------------------------------------------------------------------

  storeSession(id, data) {
    this._ensureDbSync();
    this.db.run(`
      INSERT OR REPLACE INTO sessions (id, data, start_time, end_time) VALUES (?, ?, ?, ?)
    `, [id, JSON.stringify(data), data.start_time || null, data.end_time || null]);
    this._save();
  }

  getRecentSessions(limit = 10) {
    this._ensureDbSync();
    const result = this.db.exec(
      'SELECT id, data, start_time, end_time FROM sessions ORDER BY start_time DESC LIMIT ?',
      [limit]
    );
    if (!result.length) return [];
    return result[0].values.map(row => ({
      id: row[0],
      ...JSON.parse(row[1]),
    }));
  }

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  getStats() {
    this._ensureDbSync();
    const result = this.db.exec('SELECT COUNT(*) as count FROM memories');
    const count = result.length ? result[0].values[0][0] : 0;
    let dbSize = 0;
    try { dbSize = fs.statSync(this.dbPath).size; } catch {}

    return {
      memory_count: count,
      db_size_bytes: dbSize,
      db_size_mb: (dbSize / 1024 / 1024).toFixed(2),
    };
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  close() {
    if (this.db) {
      this._save();
      this.db.close();
      this.db = null;
    }
  }
}
