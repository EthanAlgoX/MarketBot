/**
 * Better Memory - User Experience Demo
 * 
 * Shows the seamless human experience:
 * - Instant "aha!" moment on first use
 * - Clear demonstration of what it learned
 * - Simple language, no jargon
 * - Non-intrusive feedback
 */

import { createContextGuardian } from '../lib/index.js';

console.log('🎬 Better Memory - User Experience Demo\n');
console.log('Simulating a conversation between user and agent...\n');
console.log('─'.repeat(60));

// Agent creates Better Memory with feedback enabled
const cg = createContextGuardian({
  dataDir: '/tmp/demo-experience',
  feedback: true,         // Enable user-facing feedback
  verboseFeedback: false, // Subtle (not spammy)
  personality: 'casual'   // Adapt to agent style
});

// ============================================================================
// MOMENT 1: First initialization - Shows it's active
// ============================================================================

console.log('\n📍 MOMENT 1: Agent initializes Better Memory\n');

const welcome = await cg.initialize();
if (welcome) {
  console.log(`Agent: ${welcome}\n`);
} else {
  console.log('Agent: Better Memory initialized (no message shown)\n');
}

// ============================================================================
// MOMENT 2: Conversation happens (memories stored automatically)
// ============================================================================

console.log('📍 MOMENT 2: Conversation happens\n');

console.log('User: "I prefer TypeScript over JavaScript for my projects."');
await cg.store('User prefers TypeScript over JavaScript', { priority: 9 });

console.log('User: "I hate MVP timelines. Build the full solution."');
await cg.store('User hates MVP timelines, wants complete solutions', { priority: 9 });

console.log('User: "Make sure it works on all platforms."');
await cg.store('Important: Must work on all platforms', { priority: 8 });

console.log('\n(Memories stored silently - no spam)\n');

// ============================================================================
// MOMENT 3: Show what was learned - The "Aha!" moment
// ============================================================================

console.log('─'.repeat(60));
console.log('\n📍 MOMENT 3: End of conversation - Demo what was learned\n');

const learned = await cg.showWhatILearned();
if (learned) {
  console.log(`Agent:\n${learned}\n`);
}

// ============================================================================
// MOMENT 4: Next session - Instant proof it remembers
// ============================================================================

console.log('─'.repeat(60));
console.log('\n📍 MOMENT 4: Next conversation - It remembers!\n');

console.log('User: "What languages do I prefer?"');

const demo = await cg.demonstrateMemory('programming languages');
if (demo) {
  console.log(`\nAgent: ${demo}`);
}

const results = await cg.search('programming language preference', { limit: 1 });
if (results.length > 0) {
  console.log(`Agent: "You prefer ${results[0].content.includes('TypeScript') ? 'TypeScript' : results[0].content}."`);
}

// ============================================================================
// MOMENT 5: Complex query - Semantic understanding
// ============================================================================

console.log('\n─'.repeat(60));
console.log('\n📍 MOMENT 5: Semantic search works\n');

console.log('User: "How should I approach new projects?"');

const approach = await cg.search('project approach methodology', { limit: 2 });
if (approach.length > 0) {
  console.log(`\nAgent: "Based on what I remember about you:"`);
  approach.forEach((mem, i) => {
    console.log(`  ${i + 1}. ${mem.content} (${Math.round(mem.similarity * 100)}% relevant)`);
  });
}

// ============================================================================
// Summary
// ============================================================================

console.log('\n' + '─'.repeat(60));
console.log('\n🎉 USER EXPERIENCE SUMMARY:\n');
console.log('✅ First use: Clear activation message');
console.log('✅ During conversation: Silent storage (no spam)');
console.log('✅ After conversation: Shows what it learned (aha!)');
console.log('✅ Next time: Instant proof it remembers');
console.log('✅ Semantic search: Finds relevant memories');
console.log('✅ Simple language: No technical jargon');
console.log('✅ Non-intrusive: Works in the background');

const stats = cg.getMemoryStats();
console.log(`\n📊 Stored ${stats.memory_count} memories silently`);

console.log('\n💡 The human sees Better Memory work WITHOUT technical details.');
console.log('   They just see: "Oh wow, it actually remembers!"\n');

cg.close();
