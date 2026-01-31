---
name: voice-ai-tts
description: >
  High-quality voice synthesis with 9 personas, 11 languages, streaming, and voice cloning using Voice.ai API.
---

# Voice.ai Voices

## ✨ Features

- **9 Voice Personas** - Carefully curated voices for different use cases
- **11 Languages** - Multi-language synthesis with multilingual model
- **Streaming Mode** - Real-time audio output as it generates
- **Voice Cloning** - Clone voices from audio samples
- **Voice Design** - Customize with temperature and top_p parameters
- **OpenClaw Integration** - Works with OpenClaw's built-in TTS

## 🎙️ Available Voices

| Voice   | Gender | Persona     | Best For                   |
|---------|--------|-------------|----------------------------|
| ellie   | female | youthful    | Vlogs, social content      |
| oliver  | male   | british     | Narration, tutorials       |
| lilith  | female | soft        | ASMR, calm content         |
| smooth  | male   | deep        | Documentaries, audiobooks  |
| corpse  | male   | distinctive | Gaming, entertainment      |
| skadi   | female | anime       | Character voices           |
| zhongli | male   | deep        | Gaming, dramatic content   |
| flora   | female | cheerful    | Kids content, upbeat       |
| chief   | male   | heroic      | Gaming, action content     |

## 🌍 Languages

Available: `en`, `es`, `fr`, `de`, `it`, `pt`, `pl`, `ru`, `nl`, `sv`, `ca`

## 🎨 Voice Design

Customize voice output with these parameters:

- **temperature** (0-2) — Higher = more expressive, lower = more consistent
- **top_p** (0-1) — Controls randomness in speech generation

## 📡 Streaming Mode

Generate audio with real-time streaming (good for long texts):

```bash
# Stream audio as it generates
node scripts/tts.js --text "This is a long story..." --voice ellie --stream

# Streaming with custom output
node scripts/tts.js --text "Chapter one..." --voice oliver --stream --output chapter1.mp3
```

## 🔗 OpenClaw TTS Integration

```yaml
tts:
  skill: voice-ai-tts
  voice_id: d1bf0f33-8e0e-4fbf-acf8-45c3c6262513
```

## 💬 Triggering TTS in Chat

```
/tts Hello, welcome to Voice.ai!
```

## 💻 CLI Usage

```bash
export VOICE_AI_API_KEY="your-api-key"

# Generate speech
node scripts/tts.js --text "Hello world!" --voice ellie

# Choose different voice
node scripts/tts.js --text "Good morning!" --voice oliver --output morning.mp3

# Show help
node scripts/tts.js --help
```

## 🔗 Links

- [Voice.ai Docs](https://voice.ai/docs)
- [API Reference](https://voice.ai/docs/api-reference/text-to-speech/generate-speech)


---

Made with ❤️ by [Nick Gill](https://github.com/gizmoGremlin)
