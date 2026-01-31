# 🎙️ EachLabs ElevenLabs Speech-to-Text Skill

A [Clawdbot](https://github.com/clawdbot/clawdbot) skill for transcribing audio from URLs using EachLabs' ElevenLabs Scribe v1 model integration.

## Features

- 🌍 **32+ languages** supported
- 👥 **Speaker diarization** — identify different speakers
- 🎵 **Audio event tagging** — detect laughter, music, applause, etc.
- 📝 **Word-level timestamps** — precise timing in JSON output
- 🔗 **URL Input** — process audio directly from a URL

## Installation

### For Clawdbot

Add to your `clawdbot.json`:

```json5
{
  skills: {
    entries: {
      "eachlabs-tts": {
        source: "local:EachlabsSkills/tts/eachlabs-tts",
        apiKey: "el_your_api_key_here"
      }
    }
  }
}
```

## Usage

```bash
# Basic transcription
./scripts/transcribe.sh https://example.com/audio.mp3

# With speaker diarization
./scripts/transcribe.sh https://example.com/meeting.mp3 --diarize

# Specify language for better accuracy
./scripts/transcribe.sh https://example.com/voice_note.ogg --lang en

# Full JSON with timestamps
./scripts/transcribe.sh https://example.com/podcast.mp3 --json

# Tag audio events (laughter, music, etc.)
./scripts/transcribe.sh https://example.com/recording.wav --events
```

## Options

| Flag | Description |
|------|-------------|
| `--diarize` | Enable speaker diarization |
| `--lang CODE` | ISO language code (e.g., `en`, `pt`, `es`, `fr`) |
| `--json` | Output full JSON response with word timestamps |
| `--events` | Tag audio events like laughter, music, applause |
| `-h, --help` | Show help message |

## Requirements

- `curl` — for API requests
- `jq` — for JSON parsing (recommended)
- EachLabs API key

## API Key

Get your API key from [EachLabs](https://eachlabs.ai).

## License

MIT
