---
name: weather-nws
description: Reliable US weather data using the National Weather Service API. Free, no API key, detailed forecasts and official alerts.
version: 1.0.0
author: awalker
homepage: https://weather.gov
keywords: weather, forecast, alerts, nws, national-weather-service
metadata:
  openclaw:
    emoji: 🌤️
    requires:
      bins: ["curl", "node"]
---

# Weather NWS

Get reliable, detailed weather data from the National Weather Service API. Perfect for US locations - completely free, no API key required, with official weather alerts.

## When to Use

Use this skill when you need:
- **Reliable US weather data** without API key hassles
- **Official weather alerts** (tornado warnings, flood alerts, etc.)
- **Detailed current conditions** beyond basic temperature
- **7-day forecasts** with comprehensive descriptions
- **Morning briefings** with accurate local weather
- **Weather monitoring** in automation/cron jobs
- **Alert-based notifications** for severe weather

This skill is ideal for US-based OpenClaw deployments that need professional-grade weather data without the complexity or cost of commercial APIs.

## Features

- 🌡️ **Detailed Current Conditions** - Temperature, feels-like, humidity, wind, pressure, visibility, dewpoint
- 📅 **7-Day Forecast** - Comprehensive daily forecasts with detailed descriptions
- 🚨 **Official Alerts** - Cold Weather Advisories, Tornado Warnings, Flood Alerts, etc.
- 🆓 **100% Free** - No API key, no rate limits, reliable government service
- 📍 **Accurate** - Data from official NWS weather stations

## Quick Start

### Get Current Weather

```bash
node weather-nws.js
```

### JSON Output (for scripts)

```bash
node weather-nws.js --json
```

## Configuration

Edit the coordinates in `weather-nws.js` to set your location:

```javascript
// Example: Fort Worth, Texas
const FORT_WORTH = {
    lat: 32.7555,
    lon: -97.3308
};
```

Find coordinates at [latlong.net](https://www.latlong.net)

## Usage Examples

### Basic Weather Check

Get a quick overview of current conditions and forecast:

```bash
node weather-nws.js
```

**Output:**
```
=== CURRENT CONDITIONS ===
Temperature: 30°F (Feels like: 21°F)
Condition: Clear
Humidity: 69%
Wind: 10 mph 310
Pressure: 30 inHg
Visibility: 10 miles
Dewpoint: 21°F

=== TODAY'S FORECAST ===
Sunny, with a high near 47. North northwest wind 5 to 10 mph.

=== 7-DAY OUTLOOK ===
Today: 47°F - Sunny
Tonight: 21°F - Mostly Clear
Saturday: 33°F - Sunny
Saturday Night: 22°F - Mostly Clear
Sunday: 53°F - Sunny
Sunday Night: 34°F - Clear
Monday: 64°F - Mostly Sunny

🚨 ACTIVE NWS ALERTS:
Cold Weather Advisory (Moderate/Expected)
Cold Weather Advisory issued January 29 at 11:49PM CST until January 31 at 11:00AM CST
```

### Programmatic Use (JSON)

For automation and integration:

```bash
node weather-nws.js --json
```

Returns structured JSON with:
- `current` - Current conditions object
- `forecast` - 7-day forecast array
- `alerts` - Detected alert keywords
- `timestamp` - ISO timestamp
- `source` - "National Weather Service"

### Integration with OpenClaw

Use in your OpenClaw prompts:

```
Check the weather and let me know if I need a jacket today.
```

Or in cron jobs:

```bash
# Morning weather brief
0 8 * * * node /path/to/weather-nws.js
```

### Weather Alert Monitoring

The skill includes alert detection for:
- 🌪️ **Tornado** warnings and watches (CRITICAL)
- ⛈️ **Severe Storms** with damaging winds, hail (HIGH)
- 🌊 **Flood** warnings and flash floods (HIGH)
- ❄️ **Winter Weather** - ice storms, blizzards, heavy snow (HIGH)
- 🔥 **Heat** advisories and excessive heat warnings (MEDIUM)
- 💨 **Wind** advisories and high wind warnings (MEDIUM)

## API Details

### National Weather Service API

- **Endpoint:** api.weather.gov
- **Authentication:** None required (User-Agent header recommended)
- **Rate Limiting:** None (reasonable use expected)
- **Coverage:** United States only
- **Documentation:** https://weather-gov.github.io/api/

### Data Sources

1. **Points API** - Gets forecast office and grid coordinates for your location
2. **Forecast API** - 7-day forecast with detailed descriptions
3. **Observations API** - Real-time data from nearest weather station
4. **Alerts API** - Active weather alerts for your area

## Advanced Usage

### Custom Location

Create a wrapper script for a different city:

```javascript
const NWSWeather = require('./weather-nws.js');

// Chicago coordinates
const weather = new NWSWeather(41.8781, -87.6298);
const data = await weather.getWeather();
console.log(JSON.stringify(data, null, 2));
```

### Alert Monitoring

Check for active official alerts:

```javascript
const NWSWeather = require('./weather-nws.js');

const weather = new NWSWeather(32.7555, -97.3308);
const alerts = await weather.getActiveAlerts();

if (alerts.length > 0) {
    console.log('⚠️ ACTIVE ALERTS:');
    alerts.forEach(alert => {
        console.log(`${alert.event} - ${alert.severity}/${alert.urgency}`);
        console.log(alert.headline);
    });
}
```

## Output Format

### Current Conditions Object

```json
{
  "current": {
    "temp": "30°F",
    "feelsLike": "21°F",
    "condition": "Clear",
    "humidity": "69%",
    "windSpeed": "10 mph",
    "windDirection": "310",
    "pressure": "30 inHg",
    "visibility": "10 miles",
    "dewpoint": "21°F"
  },
  "forecast": {
    "today": "Sunny, with a high near 47...",
    "tonight": "Mostly clear...",
    "high": "47°F",
    "periods": [...]
  },
  "alerts": [],
  "timestamp": "2026-01-30T15:00:00.000Z",
  "source": "National Weather Service"
}
```

## Why NWS?

Compared to other weather APIs:

| Feature | NWS | wttr.in | OpenWeather | WeatherAPI |
|---------|-----|---------|-------------|------------|
| Cost | FREE | FREE | $40+/mo | $0-$50/mo |
| API Key | ❌ No | ❌ No | ✅ Yes | ✅ Yes |
| Reliability | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Official Alerts | ✅ Yes | ❌ No | ❌ No | ⚠️ Limited |
| Detail Level | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| US Coverage | ✅ Excellent | ✅ Good | ✅ Good | ✅ Good |

## Troubleshooting

### "Invalid response from NWS"

Check your coordinates are correct and within the US. The NWS API only covers United States territories.

### Timeout errors

Increase the timeout in the script:

```javascript
{ encoding: 'utf8', timeout: 30000 } // 30 seconds
```

### No alerts showing

This is normal! The skill only shows alerts when there are active weather warnings for your area.

## Integration Examples

### Morning Brief

Include weather in your daily automation:

```javascript
const NWSWeather = require('./weather-nws.js');
const weather = new NWSWeather(32.7555, -97.3308);
const data = await weather.getWeather();

console.log(`Good morning! It's ${data.current.temp} and ${data.current.condition}.`);
console.log(`Today's high will be ${data.forecast.high}.`);

if (data.alerts.length > 0) {
    console.log(`⚠️ Weather alerts: ${data.alerts.map(a => a.type).join(', ')}`);
}
```

### Discord/Telegram Bot

Post weather updates to channels:

```javascript
const data = await weather.getWeather();
const message = `🌤️ **Weather Update**\n` +
    `Current: ${data.current.temp} (feels like ${data.current.feelsLike})\n` +
    `Today's high: ${data.forecast.high}\n` +
    `Forecast: ${data.forecast.today}`;

// Send to your messaging platform
await sendMessage(message);
```

### Cron Job with Alerts

Monitor for severe weather:

```bash
#!/bin/bash
# Check weather every 15 minutes, alert on warnings

weather_json=$(node weather-nws.js --json)
alerts=$(echo "$weather_json" | jq -r '.alerts[] | .type')

if [ -n "$alerts" ]; then
    # Send notification
    echo "Weather alerts detected: $alerts"
    # Your notification logic here
fi
```

## License

This skill uses the National Weather Service API, which is public domain (US Government).

## Support

- **NWS API Issues:** https://github.com/weather-gov/weather.gov/issues
- **Skill Issues:** Contact the author

## Credits

Weather data provided by the National Weather Service (NOAA).

---

**Built for OpenClaw** (formerly Clawdbot)