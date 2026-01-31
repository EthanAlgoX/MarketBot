# Changelog

All notable changes to the Weather NWS skill will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-30

### Added
- Initial release of Weather NWS skill
- National Weather Service API integration
- Current conditions (temperature, feels-like, humidity, wind, pressure, visibility, dewpoint)
- 7-day detailed forecast
- Official NWS weather alerts detection
- Active alerts API integration
- JSON output mode for programmatic use
- Example scripts for basic usage, alert monitoring, and programmatic integration
- Complete documentation in SKILL.md
- MIT License

### Features
- 100% free, no API key required
- Highly reliable US government service
- Official weather alerts (tornado, flood, winter storms, etc.)
- Detailed current conditions from nearest weather station
- Comprehensive 7-day forecast
- Alert severity detection (critical, high, medium)

### Technical
- Node.js implementation using curl for API requests
- User-Agent header for NWS API compliance
- Error handling and fallback mechanisms
- Timeout protection (15-30 seconds)
- JSON and human-readable output formats

## Future Enhancements

Potential features for future versions:
- Multi-location support
- Radar imagery integration
- Hourly forecast details
- Historical weather data
- Weather statistics and trends
- Custom alert notifications
- Weather API comparison tool