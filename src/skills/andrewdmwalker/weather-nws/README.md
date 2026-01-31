# Weather NWS - OpenClaw Skill

🌤️ Reliable US weather data from the National Weather Service API.

## Features

- **100% Free** - No API key required
- **Highly Reliable** - US government service
- **Official Alerts** - Tornado warnings, flood alerts, winter storms
- **Detailed Data** - Temperature, wind, pressure, visibility, dewpoint
- **7-Day Forecast** - Comprehensive daily forecasts

## Quick Start

```bash
node weather-nws.js
```

See [SKILL.md](SKILL.md) for complete documentation.

## Installation

### As an OpenClaw Skill

```bash
# Copy to your skills directory
cp -r weather-nws /path/to/openclaw/skills/

# Or clone if published
git clone https://github.com/yourusername/weather-nws openclaw/skills/weather-nws
```

### Standalone

```bash
git clone https://github.com/yourusername/weather-nws
cd weather-nws
node weather-nws.js
```

## Example Output

```
=== CURRENT CONDITIONS ===
Temperature: 30°F (Feels like: 21°F)
Condition: Clear
Humidity: 69%
Wind: 10 mph 310

🚨 ACTIVE NWS ALERTS:
Cold Weather Advisory (Moderate/Expected)
```

## Configuration

Edit coordinates in `weather-nws.js`:

```javascript
const LOCATION = {
    lat: 32.7555,  // Your latitude
    lon: -97.3308  // Your longitude
};
```

## Why NWS?

Unlike other weather APIs:
- ✅ No API key required
- ✅ No rate limits
- ✅ Official government data
- ✅ Real weather alerts from NOAA
- ✅ Most accurate for US locations

## Documentation

Full documentation available in [SKILL.md](SKILL.md)

## License

MIT

## Credits

Weather data from the National Weather Service (NOAA).