#!/bin/bash
# Weather alert monitoring example
# Run this in a cron job to get notified of severe weather

cd "$(dirname "$0")/.."

# Get weather data as JSON
weather_json=$(node weather-nws.js --json 2>/dev/null)

# Extract alerts using grep (simple method)
if echo "$weather_json" | grep -q '"alerts":\['; then
    echo "⚠️  Weather alerts detected!"
    node weather-nws.js | grep -A 5 "ACTIVE NWS ALERTS"
    
    # You could send notifications here:
    # - Send email
    # - Post to Slack/Discord
    # - Send SMS via Twilio
    # - etc.
else
    echo "✅ No weather alerts"
fi