#!/usr/bin/env node

const { execSync } = require('child_process');

/**
 * National Weather Service API wrapper
 * Free, reliable, no API key needed
 * Works for all US locations
 */
class NWSWeather {
    constructor(lat, lon) {
        this.lat = lat;
        this.lon = lon;
        this.userAgent = 'Clawdbot Weather Monitor (contact@gameye.com)';
    }

    async getWeather() {
        try {
            // Step 1: Get the forecast office and grid coordinates
            const pointsUrl = `https://api.weather.gov/points/${this.lat},${this.lon}`;
            const pointsData = execSync(
                `curl -s -A "${this.userAgent}" "${pointsUrl}"`,
                { encoding: 'utf8', timeout: 15000 }
            );
            
            const points = JSON.parse(pointsData);
            
            if (!points.properties) {
                throw new Error('Invalid response from NWS points API');
            }

            // Step 2: Get the forecast
            const forecastUrl = points.properties.forecast;
            const forecastData = execSync(
                `curl -s -A "${this.userAgent}" "${forecastUrl}"`,
                { encoding: 'utf8', timeout: 15000 }
            );
            
            const forecast = JSON.parse(forecastData);

            // Step 3: Get current observations from nearest station
            const stationsUrl = points.properties.observationStations;
            const stationsData = execSync(
                `curl -s -A "${this.userAgent}" "${stationsUrl}"`,
                { encoding: 'utf8', timeout: 15000 }
            );
            
            const stations = JSON.parse(stationsData);
            const nearestStation = stations.features[0].id;

            const observationUrl = `${nearestStation}/observations/latest`;
            const observationData = execSync(
                `curl -s -A "${this.userAgent}" "${observationUrl}"`,
                { encoding: 'utf8', timeout: 15000 }
            );
            
            const observation = JSON.parse(observationData);

            return this.formatWeatherData(observation, forecast);
        } catch (e) {
            console.error('Error fetching NWS weather:', e.message);
            return null;
        }
    }

    formatWeatherData(observation, forecast) {
        const props = observation.properties;
        const currentPeriod = forecast.properties.periods[0];
        const todayPeriod = forecast.properties.periods.find(p => p.isDaytime) || currentPeriod;

        // Convert Celsius to Fahrenheit
        const tempF = props.temperature.value ? 
            Math.round(props.temperature.value * 9/5 + 32) : null;
        const feelsLikeF = props.heatIndex.value ?
            Math.round(props.heatIndex.value * 9/5 + 32) :
            props.windChill.value ?
            Math.round(props.windChill.value * 9/5 + 32) : tempF;

        return {
            current: {
                temp: tempF ? `${tempF}°F` : 'N/A',
                feelsLike: feelsLikeF ? `${feelsLikeF}°F` : 'N/A',
                condition: props.textDescription || currentPeriod.shortForecast,
                humidity: props.relativeHumidity.value ? `${Math.round(props.relativeHumidity.value)}%` : 'N/A',
                windSpeed: props.windSpeed.value ? 
                    `${Math.round(props.windSpeed.value * 0.621371)} mph` : 'N/A',
                windDirection: props.windDirection.value || 'N/A',
                pressure: props.barometricPressure.value ?
                    `${Math.round(props.barometricPressure.value / 3386.39)} inHg` : 'N/A',
                visibility: props.visibility.value ?
                    `${Math.round(props.visibility.value / 1609.34)} miles` : 'N/A',
                dewpoint: props.dewpoint.value ?
                    `${Math.round(props.dewpoint.value * 9/5 + 32)}°F` : 'N/A'
            },
            forecast: {
                today: todayPeriod.detailedForecast,
                tonight: forecast.properties.periods[1].detailedForecast,
                high: todayPeriod.temperature ? `${todayPeriod.temperature}°F` : 'N/A',
                periods: forecast.properties.periods.slice(0, 7).map(p => ({
                    name: p.name,
                    temp: `${p.temperature}°F`,
                    forecast: p.shortForecast,
                    detailed: p.detailedForecast
                }))
            },
            alerts: props.textDescription ? 
                this.checkForAlertKeywords(props.textDescription + ' ' + currentPeriod.detailedForecast) : 
                [],
            timestamp: new Date().toISOString(),
            source: 'National Weather Service'
        };
    }

    checkForAlertKeywords(text) {
        const alerts = [];
        const lowerText = text.toLowerCase();
        
        const alertKeywords = {
            'tornado': ['tornado', 'funnel cloud'],
            'severe-storm': ['severe thunderstorm', 'damaging winds', 'large hail', 'hail'],
            'flood': ['flash flood', 'flood warning', 'flooding'],
            'winter': ['winter storm', 'ice storm', 'blizzard', 'freezing rain', 'heavy snow'],
            'heat': ['excessive heat', 'heat warning', 'heat advisory'],
            'wind': ['high wind', 'wind advisory', 'gale']
        };

        for (const [alertType, keywords] of Object.entries(alertKeywords)) {
            for (const keyword of keywords) {
                if (lowerText.includes(keyword)) {
                    alerts.push({
                        type: alertType,
                        severity: alertType === 'tornado' ? 'critical' : 
                                 ['severe-storm', 'flood', 'winter'].includes(alertType) ? 'high' : 'medium'
                    });
                    break;
                }
            }
        }

        return alerts;
    }

    async getActiveAlerts() {
        try {
            // Get active alerts for the area
            const alertsUrl = `https://api.weather.gov/alerts/active?point=${this.lat},${this.lon}`;
            const alertsData = execSync(
                `curl -s -A "${this.userAgent}" "${alertsUrl}"`,
                { encoding: 'utf8', timeout: 15000 }
            );
            
            const alerts = JSON.parse(alertsData);
            
            if (!alerts.features || alerts.features.length === 0) {
                return [];
            }

            return alerts.features.map(alert => ({
                event: alert.properties.event,
                severity: alert.properties.severity,
                urgency: alert.properties.urgency,
                headline: alert.properties.headline,
                description: alert.properties.description,
                instruction: alert.properties.instruction,
                expires: alert.properties.expires
            }));
        } catch (e) {
            console.error('Error fetching NWS alerts:', e.message);
            return [];
        }
    }
}

// Fort Worth coordinates
const FORT_WORTH = {
    lat: 32.7555,
    lon: -97.3308
};

async function main() {
    const weather = new NWSWeather(FORT_WORTH.lat, FORT_WORTH.lon);
    
    console.log('Fetching weather from National Weather Service...\n');
    
    const data = await weather.getWeather();
    
    if (data) {
        console.log('=== CURRENT CONDITIONS ===');
        console.log(`Temperature: ${data.current.temp} (Feels like: ${data.current.feelsLike})`);
        console.log(`Condition: ${data.current.condition}`);
        console.log(`Humidity: ${data.current.humidity}`);
        console.log(`Wind: ${data.current.windSpeed} ${data.current.windDirection}`);
        console.log(`Pressure: ${data.current.pressure}`);
        console.log(`Visibility: ${data.current.visibility}`);
        console.log(`Dewpoint: ${data.current.dewpoint}`);
        
        console.log('\n=== TODAY\'S FORECAST ===');
        console.log(data.forecast.today);
        
        console.log('\n=== 7-DAY OUTLOOK ===');
        data.forecast.periods.forEach(period => {
            console.log(`${period.name}: ${period.temp} - ${period.forecast}`);
        });

        if (data.alerts.length > 0) {
            console.log('\n⚠️  WEATHER ALERTS DETECTED:');
            data.alerts.forEach(alert => {
                console.log(`  - ${alert.type.toUpperCase()} (${alert.severity})`);
            });
        }

        // Check for active official alerts
        const activeAlerts = await weather.getActiveAlerts();
        if (activeAlerts.length > 0) {
            console.log('\n🚨 ACTIVE NWS ALERTS:');
            activeAlerts.forEach(alert => {
                console.log(`\n  ${alert.event} (${alert.severity}/${alert.urgency})`);
                console.log(`  ${alert.headline}`);
            });
        }

        // Return JSON for programmatic use
        if (process.argv.includes('--json')) {
            console.log('\n' + JSON.stringify(data, null, 2));
        }
    } else {
        console.error('Failed to fetch weather data');
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = NWSWeather;