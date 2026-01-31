---
name: slack-power-tools
description: Advanced Slack automation beyond basic messaging. Use when user needs to manage channels (create, archive, invite users), schedule messages, upload files, search workspace, manage user groups, set status/DND, get analytics, or automate Slack workflows. Covers channel ops, user management, scheduled messages, file uploads, search, and workspace analytics.
---

# Slack Power Tools

Advanced Slack automation via Slack Web API. Requires a Slack Bot Token with appropriate scopes.

## Prerequisites

```bash
export SLACK_BOT_TOKEN="xoxb-your-token"
```

Required OAuth scopes depend on features used (see each section).

## Channel Management

**Scopes:** `channels:manage`, `channels:read`, `groups:write`, `groups:read`

### List all channels
```bash
curl -s -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  "https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=200" | jq '.channels[] | {id, name, num_members, is_archived}'
```

### Create a channel
```bash
curl -s -X POST -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "new-channel", "is_private": false}' \
  "https://slack.com/api/conversations.create" | jq '.'
```

### Archive a channel
```bash
curl -s -X POST -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channel": "C123456"}' \
  "https://slack.com/api/conversations.archive"
```

### Set channel topic/purpose
```bash
curl -s -X POST -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channel": "C123456", "topic": "Project X Discussion"}' \
  "https://slack.com/api/conversations.setTopic"

curl -s -X POST -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channel": "C123456", "purpose": "All things Project X"}' \
  "https://slack.com/api/conversations.setPurpose"
```

### Invite users to channel
```bash
curl -s -X POST -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channel": "C123456", "users": "U111,U222,U333"}' \
  "https://slack.com/api/conversations.invite"
```

### Kick user from channel
```bash
curl -s -X POST -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channel": "C123456", "user": "U111"}' \
  "https://slack.com/api/conversations.kick"
```

## Scheduled Messages

**Scopes:** `chat:write`

### Schedule a message
```bash
# post_at is Unix timestamp
curl -s -X POST -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "C123456",
    "text": "Reminder: Team standup in 15 minutes!",
    "post_at": 1735689600
  }' \
  "https://slack.com/api/chat.scheduleMessage" | jq '.'
```

### List scheduled messages
```bash
curl -s -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  "https://slack.com/api/chat.scheduledMessages.list" | jq '.scheduled_messages[]'
```

### Delete scheduled message
```bash
curl -s -X POST -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channel": "C123456", "scheduled_message_id": "Q123456"}' \
  "https://slack.com/api/chat.deleteScheduledMessage"
```

## File Management

**Scopes:** `files:write`, `files:read`

### Upload a file
```bash
# Get upload URL
UPLOAD=$(curl -s -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  "https://slack.com/api/files.getUploadURLExternal?filename=report.pdf&length=$(stat -f%z report.pdf)")

UPLOAD_URL=$(echo $UPLOAD | jq -r '.upload_url')
FILE_ID=$(echo $UPLOAD | jq -r '.file_id')

# Upload file content
curl -s -X POST "$UPLOAD_URL" -F "file=@report.pdf"

# Complete upload and share to channel
curl -s -X POST -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"files\": [{\"id\": \"$FILE_ID\"}], \"channel_id\": \"C123456\"}" \
  "https://slack.com/api/files.completeUploadExternal"
```

### List files
```bash
curl -s -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  "https://slack.com/api/files.list?channel=C123456&count=20" | jq '.files[] | {id, name, filetype, size, created}'
```

### Delete a file
```bash
curl -s -X POST -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"file": "F123456"}' \
  "https://slack.com/api/files.delete"
```

## User Management

**Scopes:** `users:read`, `users.profile:write`

### List all users
```bash
curl -s -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  "https://slack.com/api/users.list?limit=200" | jq '.members[] | select(.deleted==false) | {id, name, real_name, is_admin}'
```

### Get user info
```bash
curl -s -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  "https://slack.com/api/users.info?user=U123456" | jq '.user'
```

### Set user status (for bot/self)
```bash
curl -s -X POST -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "profile": {
      "status_text": "In a meeting",
      "status_emoji": ":calendar:",
      "status_expiration": 1735693200
    }
  }' \
  "https://slack.com/api/users.profile.set"
```

## User Groups

**Scopes:** `usergroups:write`, `usergroups:read`

### List user groups
```bash
curl -s -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  "https://slack.com/api/usergroups.list?include_users=true" | jq '.usergroups[] | {id, handle, name, user_count}'
```

### Create user group
```bash
curl -s -X POST -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Backend Team", "handle": "backend-team"}' \
  "https://slack.com/api/usergroups.create"
```

### Update user group members
```bash
curl -s -X POST -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"usergroup": "S123456", "users": "U111,U222,U333"}' \
  "https://slack.com/api/usergroups.users.update"
```

## Search

**Scopes:** `search:read`

### Search messages
```bash
curl -s -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  "https://slack.com/api/search.messages?query=project%20deadline&sort=timestamp&count=20" | jq '.messages.matches[] | {channel: .channel.name, user, text, ts}'
```

### Search files
```bash
curl -s -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  "https://slack.com/api/search.files?query=report%20Q4&count=20" | jq '.files.matches[] | {name, filetype, user}'
```

## Do Not Disturb

**Scopes:** `dnd:write`, `dnd:read`

### Set DND
```bash
# Snooze for 60 minutes
curl -s -X POST -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  "https://slack.com/api/dnd.setSnooze?num_minutes=60"
```

### End DND
```bash
curl -s -X POST -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  "https://slack.com/api/dnd.endSnooze"
```

### Check DND status
```bash
curl -s -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  "https://slack.com/api/dnd.info?user=U123456" | jq '.'
```

## Reminders

**Scopes:** `reminders:write`, `reminders:read`

### Create reminder
```bash
curl -s -X POST -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Review PR #42",
    "time": "in 2 hours",
    "user": "U123456"
  }' \
  "https://slack.com/api/reminders.add"
```

### List reminders
```bash
curl -s -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  "https://slack.com/api/reminders.list" | jq '.reminders[]'
```

## Analytics & Stats

### Channel message count (last 7 days)
```bash
# Get channel history and count
curl -s -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  "https://slack.com/api/conversations.history?channel=C123456&oldest=$(($(date +%s) - 604800))&limit=1000" | jq '.messages | length'
```

### Most active users in channel
```bash
curl -s -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  "https://slack.com/api/conversations.history?channel=C123456&limit=1000" | jq '[.messages[].user] | group_by(.) | map({user: .[0], count: length}) | sort_by(-.count) | .[0:10]'
```

### Workspace stats
```bash
# Count total users
curl -s -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  "https://slack.com/api/users.list" | jq '[.members[] | select(.deleted==false and .is_bot==false)] | length'

# Count channels
curl -s -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  "https://slack.com/api/conversations.list?types=public_channel&exclude_archived=true" | jq '.channels | length'
```

## Bookmarks

**Scopes:** `bookmarks:write`, `bookmarks:read`

### Add bookmark to channel
```bash
curl -s -X POST -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel_id": "C123456",
    "title": "Project Wiki",
    "type": "link",
    "link": "https://wiki.company.com/project"
  }' \
  "https://slack.com/api/bookmarks.add"
```

### List bookmarks
```bash
curl -s -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  "https://slack.com/api/bookmarks.list?channel_id=C123456" | jq '.bookmarks[]'
```

## Common Workflows

### Daily standup reminder (schedule for 9 AM)
```bash
# Calculate next 9 AM timestamp
NINE_AM=$(date -v+1d -v9H -v0M -v0S +%s)
curl -s -X POST -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"channel\": \"C123456\", \"text\": \"🌅 Good morning team! Time for standup.\nWhat did you do yesterday?\nWhat will you do today?\nAny blockers?\", \"post_at\": $NINE_AM}" \
  "https://slack.com/api/chat.scheduleMessage"
```

### Bulk invite users to a new project channel
```bash
# Create channel, set topic, invite team
CHANNEL=$(curl -s -X POST -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "project-phoenix"}' \
  "https://slack.com/api/conversations.create" | jq -r '.channel.id')

curl -s -X POST -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"channel\": \"$CHANNEL\", \"topic\": \"🔥 Project Phoenix - Q1 2026\"}" \
  "https://slack.com/api/conversations.setTopic"

curl -s -X POST -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"channel\": \"$CHANNEL\", \"users\": \"U111,U222,U333,U444\"}" \
  "https://slack.com/api/conversations.invite"
```

### Weekly channel cleanup report
```bash
echo "# Slack Cleanup Report"
echo "Generated: $(date)"
echo ""
echo "## Inactive Channels (no messages in 30 days)"
# List channels, check last message date
curl -s -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  "https://slack.com/api/conversations.list?types=public_channel&exclude_archived=true&limit=500" | \
  jq -r '.channels[] | "\(.id) \(.name)"' | while read id name; do
    last_msg=$(curl -s -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
      "https://slack.com/api/conversations.history?channel=$id&limit=1" | jq -r '.messages[0].ts // "0"')
    if [ $(echo "$last_msg < $(date -v-30d +%s)" | bc) -eq 1 ]; then
      echo "- #$name (last activity: $(date -r ${last_msg%.*} +%Y-%m-%d 2>/dev/null || echo 'never'))"
    fi
done
```

## Error Handling

All Slack API responses include `ok: true/false`. Check errors:
```bash
response=$(curl -s ...)
if [ "$(echo $response | jq -r '.ok')" != "true" ]; then
  echo "Error: $(echo $response | jq -r '.error')"
fi
```

Common errors:
- `channel_not_found` - Invalid channel ID
- `not_in_channel` - Bot not in channel
- `missing_scope` - Need additional OAuth scope
- `ratelimited` - Too many requests, check `Retry-After` header
