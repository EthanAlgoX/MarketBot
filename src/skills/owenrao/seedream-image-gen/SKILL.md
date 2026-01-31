---
name: seedream-image-gen
description: Generate images via Seedream API (doubao-seedream models). Synchronous generation.
metadata: {"clawdbot":{"emoji":"🎨","requires":{"bins":["python3"],"env":["SEEDREAM_API_KEY"]},"primaryEnv":"SEEDREAM_API_KEY"}}
---

# Seedream Image Generation

Generate images using Seedream API (synchronous, no polling needed).

## Generate Image

```bash
python3 {baseDir}/scripts/generate_image.py --prompt "your description" --filename "output.png"
```

Options:
- `--size`: `2K`, `4K`, or pixels (e.g., `2048x2048`)
- `--input-image`: Image URL for image-to-image/editing

## API Key

The `SEEDREAM_API_KEY` is automatically injected from `skills.entries.seedream-image-gen.apiKey` in `clawdbot.json`. You do NOT need to provide it manually.

## Notes

- Synchronous API: returns immediately when generation completes (no polling)
- Image URLs valid for 24 hours
- Script prints `MEDIA:` line for auto-attachment
- Include datetime in filenames to distinguish
- Models 4.5/4.0 support group image generation (multiple images per request)

