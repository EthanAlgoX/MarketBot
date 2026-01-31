#!/usr/bin/env bash
set -euo pipefail

# EachLabs (ElevenLabs) Speech-to-Text transcription script
# Usage: transcribe.sh <audio_url> [options]

show_help() {
    cat << EOF
Usage: $(basename "$0") <audio_url> [options]

Arguments:
  <audio_url>   Publicly accessible URL to the audio file

Options:
  --diarize     Enable speaker diarization
  --lang CODE   ISO language code (e.g., en, pt, es, fr)
  --json        Output full JSON response
  --events      Tag audio events (laughter, music, etc.)
  -h, --help    Show this help

Environment:
  EACHLABS_API_KEY  Required API key

Examples:
  $(basename "$0") https://example.com/voice_note.ogg
  $(basename "$0") https://example.com/meeting.mp3 --diarize --lang en
  $(basename "$0") https://example.com/podcast.mp3 --json > transcript.json
EOF
    exit 0
}

# Defaults
DIARIZE="false"
LANG_CODE=""
JSON_OUTPUT="false"
TAG_EVENTS="false"
AUDIO_URL=""
TIMESTAMP_GRANULARITY="none"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help) show_help ;;
        --diarize) DIARIZE="true"; shift ;;
        --lang) LANG_CODE="$2"; shift 2 ;;
        --json) JSON_OUTPUT="true"; TIMESTAMP_GRANULARITY="word"; shift ;;
        --events) TAG_EVENTS="true"; shift ;;
        -*) echo "Unknown option: $1" >&2; exit 1 ;;
        *) AUDIO_URL="$1"; shift ;;
    esac
done

# Validate
if [[ -z "$AUDIO_URL" ]]; then
    echo "Error: No audio URL specified" >&2
    show_help
fi

# API key (check env)
API_KEY="${EACHLABS_API_KEY:-}"
if [[ -z "$API_KEY" ]]; then
    echo "Error: EACHLABS_API_KEY not set" >&2
    exit 1
fi

# Construct JSON payload
# Note: we use a temp file to construct json properly if jq isn't available, 
# but here specific json construction is complex, so we'll use a simple heredoc and hope for no special char issues in URL
# or verify if jq is present. Given the previous skill used jq, we can use it.

generate_json() {
  cat <<JSON
{
  "model": "elevenlabs-speech-to-text",
  "version": "0.0.1",
  "input": {
    "audio_url": "$AUDIO_URL",
    "model_id": "scribe_v1",
    "timestamp_granularity": "$TIMESTAMP_GRANULARITY",
    "diarize": $DIARIZE,
    "tag_audio_events": $TAG_EVENTS
    $(if [[ -n "$LANG_CODE" ]]; then echo ", \"language_code\": \"$LANG_CODE\""; fi)
  },
  "webhook_url": ""
}
JSON
}

PAYLOAD=$(generate_json)

# 1. Create Prediction
RESPONSE=$(curl -s -X POST \
  "https://api.eachlabs.ai/v1/prediction/" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

# Check for errors in creation
if echo "$RESPONSE" | grep -q '"status": "error"'; then
    echo "Error creating prediction:" >&2
    echo "$RESPONSE" | jq -r '.message // .' >&2
    exit 1
fi

PREDICTION_ID=$(echo "$RESPONSE" | jq -r '.predictionID // empty')

if [[ -z "$PREDICTION_ID" || "$PREDICTION_ID" == "null" ]]; then
    echo "Error: ID not returned" >&2
    echo "$RESPONSE" >&2
    exit 1
fi

echo "Prediction created: $PREDICTION_ID" >&2

# 2. Poll for result
while true; do
    POLL_RES=$(curl -s -X GET \
      "https://api.eachlabs.ai/v1/prediction/$PREDICTION_ID" \
      -H "X-API-Key: $API_KEY")
    
    STATUS=$(echo "$POLL_RES" | jq -r '.status')
    
    if [[ "$STATUS" == "success" ]]; then
        OUTPUT_URL=$(echo "$POLL_RES" | jq -r '.output')
        
        # Fetch the actual output
        FINAL_OUTPUT=$(curl -s "$OUTPUT_URL")
        
        if [[ "$JSON_OUTPUT" == "true" ]]; then
            echo "$FINAL_OUTPUT"
        else
            # Try to extract text if it is JSON, otherwise print as is
            # If the output file is JSON, it likely has a 'text' field.
            # If it is plain text, jq might fail or we just print it.
            
            # Check if it starts with {
            if [[ "$FINAL_OUTPUT" == \{* ]]; then
                 echo "$FINAL_OUTPUT" | jq -r '.text // .'
            else
                 echo "$FINAL_OUTPUT"
            fi
        fi
        break
        
    elif [[ "$STATUS" == "error" ]]; then
        echo "Prediction failed:" >&2
        echo "$POLL_RES" | jq -r '.message // .' >&2
        exit 1
    else
        # processing or other
        echo -n "." >&2
        sleep 2
    fi
done
