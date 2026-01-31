/**
 * User Feedback Module - Creates delightful moments without being annoying
 * 
 * Principles:
 * - Show, don't tell (visual proof)
 * - Instant gratification (works immediately)
 * - Simple language (no jargon)
 * - Adapts to agent personality
 * - Non-intrusive (subtle feedback)
 */

export class Feedback {
  constructor(config = {}) {
    this.enabled = config.feedback !== false; // Default: on
    this.verbose = config.verboseFeedback === true; // Default: subtle
    this.firstRun = true;
  }

  /**
   * First-time welcome - creates instant "aha!" moment
   */
  welcome() {
    if (!this.enabled) return null;
    
    // Brief, clear, shows it's working
    return {
      message: "🧠 Better Memory is active — I'll remember our conversations",
      show: true
    };
  }

  /**
   * When storing something important
   */
  stored(content, priority) {
    if (!this.enabled) return null;
    
    // Only show for high-priority (8+)
    if (priority >= 8) {
      return {
        message: `💾 Remembered: "${content.substring(0, 40)}${content.length > 40 ? '...' : ''}"`,
        show: this.verbose
      };
    }
    
    return null;
  }

  /**
   * When retrieving relevant memories
   */
  retrieved(count, query) {
    if (!this.enabled || count === 0) return null;
    
    return {
      message: `💡 Found ${count} relevant ${count === 1 ? 'memory' : 'memories'}`,
      show: this.verbose
    };
  }

  /**
   * First conversation demo - shows what it learned
   * This creates the "aha!" moment
   */
  async firstConversationDemo(memoryStore) {
    if (!this.enabled || !this.firstRun) return null;
    
    this.firstRun = false;
    
    // Get recent high-priority memories from database
    try {
      const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300;
      const stmt = memoryStore.db.prepare(`
        SELECT content, priority, created_at
        FROM memories
        WHERE created_at > ? AND priority >= 7
        ORDER BY created_at DESC
        LIMIT 3
      `);
      const recentMemories = stmt.all(fiveMinutesAgo);
      
      if (recentMemories.length === 0) return null;
      
      // Create clear, simple demo
      const items = recentMemories
        .map(m => `  • ${m.content.substring(0, 60)}${m.content.length > 60 ? '...' : ''}`)
        .join('\n');
      
      return {
        message: `\n💡 **What I learned from our conversation:**\n${items}\n\n*I'll remember this next time we chat.*`,
        show: true
      };
    } catch (error) {
      // Silently fail if database query fails
      return null;
    }
  }

  /**
   * When preventing duplicate memory
   */
  deduplicated() {
    if (!this.enabled || !this.verbose) return null;
    
    return {
      message: "🔄 Already remember that",
      show: false // Don't spam
    };
  }

  /**
   * When compression happens
   */
  compressed(before, after) {
    if (!this.enabled) return null;
    
    return {
      message: `🗜️ Compressed context (${before} → ${after} messages)`,
      show: false // Technical, only if verbose
    };
  }

  /**
   * Quick stats for debugging
   */
  stats(memoryCount, sessionCount) {
    if (!this.enabled || !this.verbose) return null;
    
    return {
      message: `📊 ${memoryCount} memories, ${sessionCount} sessions`,
      show: false
    };
  }

  /**
   * Create instant demo - shows it works RIGHT NOW
   */
  instantDemo(query, results) {
    if (!this.enabled || results.length === 0) return null;
    
    const top = results[0];
    const similarity = Math.round(top.similarity * 100);
    
    return {
      message: `💡 ${similarity}% match: "${top.content.substring(0, 50)}..."`,
      show: true
    };
  }

  /**
   * Format for different agent personalities
   */
  adapt(message, personality = 'neutral') {
    if (!this.enabled) return message;
    
    // Simple personality adaptation
    const styles = {
      professional: message,
      casual: message.replace('I will', "I'll").replace('I am', "I'm"),
      minimal: message.split('—')[0], // Just the key part
      enthusiastic: message + ' 🎉',
      technical: message + ' [Better Memory v2.0]'
    };
    
    return styles[personality] || message;
  }
}

/**
 * Integration helpers for seamless experience
 */
export class ExperienceEnhancer {
  constructor(contextGuardian, feedback) {
    this.cg = contextGuardian;
    this.feedback = feedback;
    this.hasShownDemo = false;
  }

  /**
   * Wrap store to show feedback
   */
  async store(content, options = {}) {
    const id = await this.cg.store(content, options);
    
    const fb = this.feedback.stored(content, options.priority || 5);
    if (fb?.show) {
      console.log(fb.message);
    }
    
    return id;
  }

  /**
   * Wrap search to show feedback
   */
  async search(query, options = {}) {
    const results = await this.cg.search(query, options);
    
    const fb = this.feedback.retrieved(results.length, query);
    if (fb?.show) {
      console.log(fb.message);
    }
    
    // Show instant demo on first search
    if (results.length > 0 && !this.hasShownDemo) {
      this.hasShownDemo = true;
      const demo = this.feedback.instantDemo(query, results);
      if (demo?.show) {
        console.log(demo.message);
      }
    }
    
    return results;
  }

  /**
   * End of conversation - show what we learned
   */
  async showLearnings() {
    if (this.hasShownDemo) return; // Already showed something
    
    const demo = await this.feedback.firstConversationDemo(this.cg.memoryStore);
    if (demo?.show) {
      return demo.message;
    }
    
    return null;
  }
}

export default { Feedback, ExperienceEnhancer };
