---
name: read-ai
description: Access meeting summaries, transcripts, and action items from Read.ai. Get AI-powered meeting insights via API.
metadata: {"clawdbot":{"emoji":"🎙️","requires":{"env":["READAI_API_KEY"]}}}
---

# Read.ai

AI meeting assistant with transcription and summaries.

## Environment

```bash
export READAI_API_KEY="xxxxxxxxxx"
```

## List Meetings

```bash
curl "https://api.read.ai/v1/meetings" \
  -H "Authorization: Bearer $READAI_API_KEY"
```

## Get Meeting Details

```bash
curl "https://api.read.ai/v1/meetings/{meeting_id}" \
  -H "Authorization: Bearer $READAI_API_KEY"
```

## Get Meeting Transcript

```bash
curl "https://api.read.ai/v1/meetings/{meeting_id}/transcript" \
  -H "Authorization: Bearer $READAI_API_KEY"
```

## Get Meeting Summary

```bash
curl "https://api.read.ai/v1/meetings/{meeting_id}/summary" \
  -H "Authorization: Bearer $READAI_API_KEY"
```

## Get Action Items

```bash
curl "https://api.read.ai/v1/meetings/{meeting_id}/action-items" \
  -H "Authorization: Bearer $READAI_API_KEY"
```

## Get Key Topics

```bash
curl "https://api.read.ai/v1/meetings/{meeting_id}/topics" \
  -H "Authorization: Bearer $READAI_API_KEY"
```

## Search Meetings

```bash
curl "https://api.read.ai/v1/meetings/search?query=project%20update" \
  -H "Authorization: Bearer $READAI_API_KEY"
```

## Features
- Automatic transcription for Zoom, Teams, Meet
- AI-generated summaries
- Action item extraction
- Speaker identification
- Sentiment analysis

## Links
- Dashboard: https://app.read.ai
- Docs: https://docs.read.ai
