/**
 * Twitter DM API client
 * Uses same auth as bird CLI
 */

import type { TwitterCookies } from '@steipete/bird';

const DM_INBOX_URL = 'https://x.com/i/api/1.1/dm/inbox_initial_state.json';
const DM_CONVERSATION_URL = 'https://x.com/i/api/1.1/dm/conversation';

// Bearer token (same as bird uses)
const BEARER_TOKEN = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

const COMMON_PARAMS: Record<string, string> = {
  include_profile_interstitial_type: '1',
  include_blocking: '1',
  include_blocked_by: '1',
  include_followed_by: '1',
  include_want_retweets: '1',
  include_mute_edge: '1',
  include_can_dm: '1',
  include_can_media_tag: '1',
  include_ext_is_blue_verified: '1',
  include_ext_verified_type: '1',
  include_ext_profile_image_shape: '1',
  skip_status: '1',
  dm_secret_conversations_enabled: 'false',
  cards_platform: 'Web-12',
  include_cards: '1',
  include_ext_alt_text: 'true',
  include_quote_count: 'true',
  include_reply_count: '1',
  tweet_mode: 'extended',
  include_ext_views: 'true',
  dm_users: 'true',
  include_groups: 'true',
  include_inbox_timelines: 'true',
  supports_reactions: 'true',
  include_conversation_info: 'true',
};

function makeHeaders(cookies: TwitterCookies): Record<string, string> {
  return {
    authorization: `Bearer ${BEARER_TOKEN}`,
    cookie: cookies.cookieHeader || `auth_token=${cookies.authToken}; ct0=${cookies.ct0}`,
    'x-csrf-token': cookies.ct0 || '',
    'x-twitter-active-user': 'yes',
    'x-twitter-auth-type': 'OAuth2Session',
  };
}

export async function fetchDMInbox(cookies: TwitterCookies, count = 20): Promise<any> {
  const params = new URLSearchParams({
    ...COMMON_PARAMS,
    count: count.toString(),
  });

  const response = await fetch(`${DM_INBOX_URL}?${params}`, {
    headers: makeHeaders(cookies),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function fetchDMConversation(
  cookies: TwitterCookies,
  conversationId: string,
  maxId?: string
): Promise<any> {
  const params = new URLSearchParams({
    ...COMMON_PARAMS,
    context: 'FETCH_DM_CONVERSATION',
  });

  let url = `${DM_CONVERSATION_URL}/${conversationId}.json?${params}`;
  if (maxId) {
    url += `&max_id=${maxId}`;
  }

  const response = await fetch(url, {
    headers: makeHeaders(cookies),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export interface DMConversation {
  id: string;
  type: string;
  name?: string;
  participants: string[];
  lastMessage?: string;
  lastSender?: string;
  timestamp: string;
}

export interface DMMessage {
  id: string;
  text: string;
  sender: string;
  timestamp: string;
}

export function parseInbox(data: any): DMConversation[] {
  const state = data.inbox_initial_state;
  if (!state) return [];

  const users = state.users || {};
  const conversations = state.conversations || {};
  const entries = state.entries || [];

  const convList = Object.entries(conversations).map(([id, conv]: [string, any]) => {
    const participants = (conv.participants || []).map((p: any) => {
      const user = users[p.user_id];
      return user ? `@${user.screen_name}` : p.user_id;
    });

    // Find last message
    const lastEntry = entries.find(
      (e: any) => e.message?.conversation_id === id
    );

    return {
      id,
      type: conv.type,
      name: conv.name,
      participants,
      lastMessage: lastEntry?.message?.message_data?.text,
      lastSender: lastEntry?.message?.message_data?.sender_id
        ? users[lastEntry.message.message_data.sender_id]?.screen_name
        : undefined,
      timestamp: conv.sort_timestamp,
    };
  });

  // Sort by timestamp descending
  return convList.sort((a, b) => parseInt(b.timestamp, 10) - parseInt(a.timestamp, 10));
}

export function parseConversation(data: any): DMMessage[] {
  const state = data.conversation_timeline;
  if (!state) return [];

  const users = state.users || {};
  const entries = state.entries || [];

  return entries
    .filter((e: any) => e.message?.message_data?.text)
    .map((e: any) => {
      const msg = e.message.message_data;
      const sender = users[msg.sender_id];
      return {
        id: msg.id,
        text: msg.text,
        sender: sender ? `@${sender.screen_name}` : msg.sender_id,
        timestamp: msg.time,
      };
    })
    .sort((a: DMMessage, b: DMMessage) => parseInt(a.timestamp, 10) - parseInt(b.timestamp, 10));
}
