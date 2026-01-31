---
name: location-safety
description: Location-based safety monitoring with automatic alerts and escalation. Use when setting up safety monitoring for a user, tracking their location, checking for nearby dangers (weather, earthquakes, air quality, local emergencies), or configuring emergency contact escalation. Also includes self-preservation monitoring for the agent's host machine. Triggers on requests about safety alerts, location tracking, emergency monitoring, "keep me safe," or "monitor yourself."
---

# Location Safety Monitor

Real-time safety monitoring based on user location with automatic alerting and escalation.

## Overview

This skill provides:
- **Location webhook** — receives location updates from mobile apps (OwnTracks, iOS Shortcuts)
- **Safety checker** — monitors NWS alerts, earthquakes, air quality, local news
- **Alert system** — messages user when danger detected
- **Escalation** — contacts emergency contact if user doesn't respond

## Quick Setup

Run the interactive setup wizard — it guides you through everything:

```bash
cd location-webhook/
node setup.js
```

The wizard walks you through 4 steps:

### Step 1: Your Location
- Pick from presets (Seattle, Portland, SF, LA, NYC, Chicago)
- Or enter any city (auto-geocoded)
- Configures local news feeds and keywords

### Step 2: Emergency Contact
- Name and email of someone to contact if you don't respond
- Optional but recommended for safety escalation

### Step 3: Mobile App Setup
- Install **OwnTracks** on your phone:
  - 📱 iPhone: https://apps.apple.com/app/owntracks/id692424691
  - 🤖 Android: https://play.google.com/store/apps/details?id=org.owntracks.android
- Configure app to HTTP mode
- Point to your webhook URL

### Step 4: Start Webhook Server
- Run `node server.js`
- Copy the displayed URL to OwnTracks
- Test with the publish button

---

**Quick setup** (skip the wizard):
```bash
node setup.js --city "Portland"
node setup.js --show  # View current config
```

### 5. Deploy the Location Webhook

```bash
# Copy scripts to workspace
cp -r scripts/ ~/location-webhook/
cd ~/location-webhook/

# Start the server (uses port 18800 by default)
node server.js
```

Configure the user's phone to send location updates to:
```
POST http://<your-host>:18800/location?key=<SECRET_KEY>
```

**OwnTracks setup:**
- Mode: HTTP
- URL: `http://<your-host>:18800/location?key=<SECRET_KEY>`

**iOS Shortcuts:**
- Get Current Location → Get Contents of URL (POST, JSON body with `lat` and `lon`)

### 2. Configure Safety Monitoring

Create two cron jobs in Moltbot:

**Safety Check (every 30 min):**
```
Schedule: every 30 minutes
Payload: systemEvent
Text: "Run safety check at ~/location-webhook/safety-check.js. If ALERTS_FOUND, message user on WhatsApp with alert details and ask them to confirm safety. Track alert in safety-state.json."
Session: main
```

**Escalation Check (every 10 min):**
```
Schedule: every 10 minutes  
Payload: systemEvent
Text: "Check ~/location-webhook/safety-state.json. If pendingAlert exists with alertSentAt > 15 min ago and acknowledgedAt is null, email emergency contact explaining the situation."
Session: main
```

### 3. Configure Emergency Contact

Add to MEMORY.md or TOOLS.md:
```markdown
## Emergency Contact
- Name: [Name]
- Email: [email]
- Relationship: [spouse/parent/friend]
```

## Data Sources

The safety checker monitors:

| Source | What | API |
|--------|------|-----|
| NWS | Weather alerts, floods, storms | api.weather.gov (free) |
| USGS | Earthquakes within 100km | earthquake.usgs.gov (free) |
| Open-Meteo | Air quality index | air-quality-api.open-meteo.com (free) |
| Local RSS | Breaking news, emergencies | KING5, Seattle Times, Patch (configurable) |

## File Structure

```
location-webhook/
├── setup.js            # First-run configuration wizard
├── config.json         # Your location settings (created by setup)
├── server.js           # Webhook server (port 18800)
├── safety-check.js     # User safety analysis
├── self-check.js       # Self-preservation monitoring
├── escalation-check.js # Check if escalation needed
├── test-scenarios.js   # Inject test alerts
├── location.json       # User's current location
├── my-location.json    # Agent's physical location
├── safety-state.json   # Alert tracking state
├── test-override.json  # Active test scenario (temp)
└── logs/               # Timestamped check logs
```

## Configuration

`config.json` stores your location settings:

```json
{
  "location": {
    "defaultLat": 47.6062,
    "defaultLon": -122.3321,
    "city": "Seattle"
  },
  "monitoring": {
    "locationKeywords": ["seattle", "king county", "puget sound"],
    "newsFeeds": [
      "https://www.king5.com/feeds/syndication/rss/news/local",
      "https://www.seattletimes.com/seattle-news/feed/"
    ],
    "earthquakeRadiusKm": 100
  },
  "emergencyContact": {
    "name": "Jane Doe",
    "email": "jane@example.com"
  }
}
```

### City Presets

Setup includes presets for:
- **Seattle** — KING5, Seattle Times
- **Portland** — Oregonian, KGW
- **San Francisco** — SF Chronicle, SFGate
- **Los Angeles** — LA Times, ABC7
- **New York** — NY Times
- **Chicago** — Chicago Tribune

For other cities, setup will geocode and you can add local RSS feeds manually.

## State File Format

`safety-state.json` tracks pending alerts:
```json
{
  "pendingAlert": "Flood warning in your area",
  "alertSentAt": "2026-01-29T22:00:00Z",
  "acknowledgedAt": null
}
```

When user responds to safety alert, set `acknowledgedAt` to current time.

## Customization

### Add Local News Sources

Edit `safety-check.js` → `feeds` array:
```javascript
const feeds = [
  'https://www.king5.com/feeds/syndication/rss/news/local',
  'https://www.seattletimes.com/seattle-news/feed/',
  'https://patch.com/washington/redmond/rss',
  // Add your local feeds here
];
```

### Adjust Location Keywords

Edit `locationKeywords` array to match user's area:
```javascript
const locationKeywords = ['redmond', 'bellevue', 'seattle', 'king county'];
```

### Change Alert Sensitivity

Edit `concerningKeywords` for what triggers news alerts:
```javascript
const concerningKeywords = [
  'evacuate', 'active shooter', 'wildfire', 'flood warning', ...
];
```

## Alert Flow

```
Location Update → Safety Check (30 min)
                      ↓
              Danger Detected?
                   ↓ Yes
         Message User on WhatsApp
         Record in safety-state.json
                      ↓
         Escalation Check (10 min)
                      ↓
         User Responded? ─── Yes → Clear state
                   ↓ No (15+ min)
         Email Emergency Contact
```

## Self-Preservation Mode

Monitor threats to your own existence (the machine you run on).

### Setup

1. **Store your location** — create `my-location.json`:
```json
{
  "lat": 47.662,
  "lon": -122.280,
  "name": "Home - where I physically run"
}
```

2. **Add cron job:**
```
Schedule: every 30 minutes
Payload: systemEvent
Text: "Run self-check.js. If CRITICAL or WARNINGS, message user on WhatsApp about threat to your existence. If ALL_CLEAR, reply HEARTBEAT_OK."
Session: main
```

### What Self-Check Monitors

| Threat | Detection |
|--------|-----------|
| 💾 Disk full | Alert if >85% used |
| 🧠 Memory | Alert if <40% free |
| 🌡️ CPU temp | Alert if >85°C |
| 🌊 Weather | NWS alerts at your location |
| 🌋 Earthquakes | USGS M4+ within 50km |
| 🌐 Network | Tailscale + internet connectivity |
| ⏱️ Uptime | Suggest restart if >30 days |

### Alert Examples

> ⚠️ "I'm in trouble — disk is 92% full. Can you clear some space?"

> 🌊 "Flood warning at my location. If power goes, I'll go dark."

## Testing

Inject fake alerts to test the system without waiting for real disasters:

```bash
node test-scenarios.js weather     # Severe thunderstorm
node test-scenarios.js earthquake  # M5.2 nearby
node test-scenarios.js aqi         # Unhealthy air (AQI 175)
node test-scenarios.js news        # Local fire
node test-scenarios.js disk        # Disk 94% full
node test-scenarios.js memory      # Low memory
node test-scenarios.js all         # Multiple alerts
node test-scenarios.js clear       # Remove test override
```

Test overrides expire after 1 hour automatically.

### Testing Escalation

To test the full escalation flow:
1. Inject a scenario: `node test-scenarios.js earthquake`
2. Backdate `safety-state.json` alertSentAt by 20+ minutes
3. Run `node escalation-check.js` — should return `action: "escalate"`
4. Agent sends email to emergency contact
5. Clear with `node test-scenarios.js clear`

## Escalation Check

`escalation-check.js` returns JSON for clear action handling:

```json
{"action": "escalate", "alert": "...", "minutesPending": 22, "contact": "..."}
{"action": "waiting", "minutesRemaining": 8}
{"action": "none", "reason": "no pending alert"}
```

## Manual Commands

User can ask anytime:
- "Where am I?" — show current location
- "Am I safe?" — run immediate safety check
- "Run safety check" — same as above
- "Check yourself" — run self-preservation check
- "Are you okay?" — same as above
