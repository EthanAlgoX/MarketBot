#!/usr/bin/env bun
/**
 * bird-dm - DM add-on for bird CLI
 * Read your X/Twitter direct messages
 */

import { Command } from 'commander';
import { resolveCredentials, type TwitterCookies } from '@steipete/bird';
import { fetchDMInbox, fetchDMConversation, parseInbox, parseConversation } from './dm-client.js';

const program = new Command();

program
  .name('bird-dm')
  .description('DM add-on for bird CLI - read your X/Twitter direct messages')
  .version('1.0.0');

// Shared options
const addAuthOptions = (cmd: Command) => {
  return cmd
    .option('--auth-token <token>', 'Twitter auth_token cookie')
    .option('--ct0 <token>', 'Twitter ct0 cookie')
    .option('--cookie-source <source>', 'Cookie source: chrome, firefox, safari', 'chrome');
};

async function getCookies(opts: any): Promise<TwitterCookies> {
  // If tokens provided directly, use them
  if (opts.authToken && opts.ct0) {
    return {
      authToken: opts.authToken,
      ct0: opts.ct0,
      cookieHeader: `auth_token=${opts.authToken}; ct0=${opts.ct0}`,
      source: 'manual',
    };
  }
  
  // Otherwise extract from browser (same as bird)
  const result = await resolveCredentials({
    authToken: opts.authToken,
    ct0: opts.ct0,
    cookieSource: opts.cookieSource || 'chrome',
  });
  
  if (!result.cookies.authToken || !result.cookies.ct0) {
    console.error('Error: Could not get Twitter credentials.');
    console.error('Make sure you are logged into X/Twitter in your browser.');
    console.error('Run: bird check');
    process.exit(1);
  }
  
  return result.cookies;
}

// bird-dm inbox
addAuthOptions(
  program
    .command('inbox')
    .alias('dms')
    .description('List DM conversations')
    .option('-n, --count <number>', 'Number of conversations', '20')
    .option('--json', 'Output as JSON')
)
  .action(async (opts) => {
    const cookies = await getCookies(opts);
    const count = parseInt(opts.count || '20', 10);
    
    try {
      const data = await fetchDMInbox(cookies, count);
      const conversations = parseInbox(data);
      
      if (opts.json) {
        console.log(JSON.stringify(conversations, null, 2));
        return;
      }
      
      if (conversations.length === 0) {
        console.log('No DM conversations found.');
        return;
      }
      
      for (const conv of conversations) {
        const icon = conv.type === 'GROUP_DM' ? '👥' : '💬';
        const name = conv.name || conv.participants.join(', ');
        console.log(`${icon} ${name}`);
        console.log(`   ID: ${conv.id}`);
        if (conv.lastMessage) {
          const sender = conv.lastSender ? `@${conv.lastSender}` : '';
          const preview = conv.lastMessage.slice(0, 60) + (conv.lastMessage.length > 60 ? '...' : '');
          console.log(`   ${sender}: ${preview}`);
        }
        console.log(`   ${formatTimestamp(conv.timestamp)}`);
        console.log();
      }
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

// bird-dm read <conversation-id>
addAuthOptions(
  program
    .command('read <conversation-id>')
    .alias('dm')
    .description('Read messages from a DM conversation')
    .option('-n, --count <number>', 'Number of messages', '50')
    .option('--json', 'Output as JSON')
)
  .action(async (conversationId, opts) => {
    const cookies = await getCookies(opts);
    
    try {
      const data = await fetchDMConversation(cookies, conversationId);
      const messages = parseConversation(data);
      
      if (opts.json) {
        console.log(JSON.stringify(messages, null, 2));
        return;
      }
      
      if (messages.length === 0) {
        console.log('No messages found.');
        return;
      }
      
      console.log(`Conversation: ${conversationId}\n`);
      
      const count = parseInt(opts.count || '50', 10);
      const displayMessages = messages.slice(-count);
      
      for (const msg of displayMessages) {
        console.log(`${msg.sender} • ${formatTimestamp(msg.timestamp)}`);
        console.log(msg.text);
        console.log();
      }
      
      console.log(`Showing ${displayMessages.length} of ${messages.length} messages`);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

function formatTimestamp(ms: string): string {
  return new Date(parseInt(ms, 10)).toLocaleString();
}

program.parse();
