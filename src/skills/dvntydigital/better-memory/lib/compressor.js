/**
 * Compressor - Intelligent context compression
 *
 * - Multi-signal priority scoring (role + regex + semantic + length)
 * - Pluggable LLM summarizer (agent provides function)
 * - Extractive fallback (no external dependencies)
 * - Returns scored messages for downstream storage
 */

export class Compressor {
  constructor(memoryStore, options = {}) {
    this.memoryStore = memoryStore;
    this.summarizer = options.summarizer || null; // async (text: string) => string
    this._archetypeEmbeddings = null; // Computed once, cached
  }

  // ---------------------------------------------------------------------------
  // Priority scoring: multi-signal
  // ---------------------------------------------------------------------------

  /**
   * Score a message's importance from 1-10.
   *
   * Signals:
   *   A) Role-based base score
   *   B) Regex pattern matching (word-boundary, not substring)
   *   C) Semantic similarity to importance archetypes
   *   D) Length heuristic
   *   E) Explicit caller-provided priority (passthrough)
   */
  async scorePriority(message) {
    // Signal E: Explicit priority passthrough
    if (typeof message.priority === 'number') {
      return message.priority;
    }

    const content = message.content || '';
    const role = message.role || 'user';

    // Signal A: Role-based base
    const roleScores = { system: 7, user: 6, assistant: 5, tool: 4 };
    let score = roleScores[role] ?? 5;

    // Signal B: Regex patterns (word-boundary matching)
    score += this._regexSignal(content);

    // Signal C: Semantic similarity to importance archetypes
    score += await this._semanticSignal(content);

    // Signal D: Length heuristic
    score += this._lengthSignal(content);

    // Clamp to 1-10
    return Math.max(1, Math.min(10, Math.round(score)));
  }

  _regexSignal(content) {
    const CRITICAL_PATTERNS = [
      { pattern: /\bmy name is\b/i, weight: 1.5 },
      { pattern: /\bremember (?:that|this)\b/i, weight: 1.5 },
      { pattern: /\bimportant:/i, weight: 1.5 },
      { pattern: /\bnote:/i, weight: 1.0 },
      { pattern: /\bwe (?:decided|agreed|concluded)\b/i, weight: 1.5 },
      { pattern: /\bthe (?:solution|answer|fix) (?:is|was)\b/i, weight: 1.0 },
      { pattern: /\bi (?:always|never) \b/i, weight: 1.0 },
      { pattern: /\bi (?:prefer|like|hate|want|need)\b/i, weight: 0.8 },
      { pattern: /\bresult:/i, weight: 0.8 },
      { pattern: /\bconclusion:/i, weight: 1.0 },
    ];

    const LOW_PATTERNS = [
      { pattern: /^(?:thanks|thank you|you're welcome|ok|got it|yes|no|sure|okay|np|cool|nice|great)\.?$/i, weight: -2 },
      { pattern: /^(?:hello|hi|hey|what's up|howdy)\.?$/i, weight: -1.5 },
    ];

    let bonus = 0;
    for (const { pattern, weight } of CRITICAL_PATTERNS) {
      if (pattern.test(content)) bonus += weight;
    }
    for (const { pattern, weight } of LOW_PATTERNS) {
      if (pattern.test(content)) bonus += weight; // weight is negative
    }

    // Cap the regex bonus at +3 / -2
    return Math.max(-2, Math.min(3, bonus));
  }

  async _semanticSignal(content) {
    // Skip for very short content (not enough signal, and saves compute)
    if (content.length < 30) return 0;

    try {
      const archetypes = await this._getArchetypeEmbeddings();
      const contentEmbedding = await this.memoryStore.embed(content);

      let maxSim = 0;
      for (const archEmb of archetypes) {
        const sim = this._cosineSimilarity(contentEmbedding, archEmb);
        if (sim > maxSim) maxSim = sim;
      }

      // Map similarity [0.3, 0.7] to bonus [0, 2]
      if (maxSim < 0.3) return 0;
      if (maxSim > 0.7) return 2;
      return ((maxSim - 0.3) / 0.4) * 2;
    } catch {
      return 0; // Graceful degradation if embedding fails
    }
  }

  async _getArchetypeEmbeddings() {
    if (this._archetypeEmbeddings) return this._archetypeEmbeddings;

    const ARCHETYPES = [
      'This is a critical decision we are making about the project architecture',
      'My personal preference and identity is important to remember',
      'The key fact to remember from this conversation is',
      'We agreed on this solution after careful analysis',
      'This is the final conclusion and outcome of our discussion',
    ];

    this._archetypeEmbeddings = await Promise.all(
      ARCHETYPES.map(text => this.memoryStore.embed(text))
    );
    return this._archetypeEmbeddings;
  }

  _lengthSignal(content) {
    if (content.length < 20) return -1;
    if (content.length > 500) return 1;
    if (content.length > 200) return 0.5;
    return 0;
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
  // Compression
  // ---------------------------------------------------------------------------

  /**
   * Compress messages using priority scoring + summarization.
   * Returns { compressed, scored } so the caller can store from scored.
   */
  async compress(messages, targetTokens) {
    // Score all messages
    const scored = await Promise.all(
      messages.map(async (msg) => ({
        ...msg,
        priority: await this.scorePriority(msg),
      }))
    );

    // Always keep recent messages (last 5)
    const recentCount = Math.min(5, scored.length);
    const recent = scored.slice(-recentCount);
    const older = scored.slice(0, -recentCount);

    // Stratify older messages by priority
    const highPriority = older.filter(m => m.priority >= 8);
    const mediumPriority = older.filter(m => m.priority >= 5 && m.priority < 8);
    // Low priority (< 5) is dropped

    // Summarize medium-priority messages
    const summary = await this.summarizeMessages(mediumPriority);

    // Build compressed output
    const compressed = [
      ...highPriority,
    ];

    if (summary) {
      compressed.push({
        role: 'system',
        content: `[Context compressed: ${mediumPriority.length} messages summarized]\n\n${summary}`,
        priority: 7,
        timestamp: Date.now(),
      });
    }

    compressed.push(...recent);

    return { compressed, scored };
  }

  // ---------------------------------------------------------------------------
  // Summarization
  // ---------------------------------------------------------------------------

  async summarizeMessages(messages) {
    if (messages.length === 0) return '';

    const combined = messages
      .map(m => `[${m.role}]: ${m.content}`)
      .join('\n\n');

    // Try agent-provided summarizer first
    if (this.summarizer) {
      try {
        return await this.summarizer(combined);
      } catch (e) {
        // Fall through to extractive
      }
    }

    return this.extractiveSummarize(messages);
  }

  extractiveSummarize(messages) {
    if (messages.length === 0) return '';

    const points = messages
      .sort((a, b) => (b.priority || 5) - (a.priority || 5))
      .slice(0, 10)
      .map(m => {
        const firstSentence = m.content.match(/^[^.!?\n]+[.!?]?/)?.[0] || m.content.substring(0, 120);
        return `- [${m.role}] ${firstSentence.trim()}`;
      });

    return `Key points from previous conversation:\n${points.join('\n')}`;
  }

  // ---------------------------------------------------------------------------
  // Store compressed (high-priority messages to memory)
  // ---------------------------------------------------------------------------

  async storeCompressed(scoredMessages, sessionId) {
    const highPriority = scoredMessages.filter(m => m.priority >= 8);
    let storedCount = 0;

    for (const msg of highPriority) {
      await this.memoryStore.store(msg.content, {
        metadata: { role: msg.role, compressed_at: Date.now() },
        priority: msg.priority,
        sessionId,
        tags: ['compressed', 'high-priority'],
      });
      storedCount++;
    }

    return storedCount;
  }
}
