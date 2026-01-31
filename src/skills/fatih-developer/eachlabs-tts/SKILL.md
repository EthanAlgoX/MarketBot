---
name: eachlabs-tts
description: Transcribe audio from URL using EachLabs Speech-to-Text (Scribe v1).
homepage: https://eachlabs.ai/
metadata: {"clawdbot":{"emoji":"🎙️","requires":{"bins":["curl"],"env":["EACHLABS_API_KEY"]},"primaryEnv":"EACHLABS_API_KEY"}}
---

# EachLabs ElevenLabs Speech-to-Text

Transcribe audio files using EachLabs' integration with ElevenLabs Scribe v1 model. Supports diarization and timestamp granularity.

## Quick Start

```bash
# Basic transcription from URL
{baseDir}/scripts/transcribe.sh https://storage.googleapis.com/magicpoint/inputs/elevenlabs-s2t-input.mp3

# With speaker diarization
{baseDir}/scripts/transcribe.sh https://.../audio.mp3 --diarize

# Specify language (improves accuracy)
{baseDir}/scripts/transcribe.sh https://.../audio.mp3 --lang en

# Full JSON output with timestamps (word-level)
{baseDir}/scripts/transcribe.sh https://.../audio.mp3 --json
```

## Options

| Flag | Description |
|------|-------------|
| `--diarize` | Identify different speakers |
| `--lang CODE` | ISO language code (e.g., en, pt, es) |
| `--json` | Output full JSON with word timestamps |
| `--events` | Tag audio events (laughter, music, etc.) |

## Supported Input

Currently supports **Audio URLs** only. The file must be publicly accessible via HTTP/HTTPS.

## API Key

Set `EACHLABS_API_KEY` environment variable, or configure in clawdbot.json:

```json5
{
  skills: {
    entries: {
      "eachlabs-elevenlabs-stt": {
        apiKey: "el_..."
      }
    }
  }
}
```
