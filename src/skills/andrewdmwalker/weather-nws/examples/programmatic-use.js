#!/usr/bin/env node

/**
 * Example: Using NWSWeather programmatically
 */

const NWSWeather = require('../weather-nws.js');

async function main() {
    // Fort Worth coordinates
    const weather = new NWSWeather(32.7555, -97.3308);
    
    console.log('Fetching weather data...\n');
    
    // Get weather data
    const data = await weather.getWeather();
    
    if (!data) {
        console.error('Failed to fetch weather');
        return;
    }
    
    // Simple condition check
    const temp = parseInt(data.current.temp);
    const condition = data.current.condition.toLowerCase();
    
    // Decision logic
    if (temp < 32) {
        console.log('🥶 It\'s freezing! Wear a heavy coat.');
    } else if (temp < 50) {
        console.log('🧥 It\'s chilly. Bring a jacket.');
    } else if (temp < 70) {
        console.log('👕 Nice weather! A light layer should be fine.');
    } else if (temp < 85) {
        console.log('☀️ Warm and pleasant!');
    } else {
        console.log('🔥 It\'s hot! Stay hydrated.');
    }
    
    // Check for rain/storms
    if (condition.includes('rain') || condition.includes('storm')) {
        console.log('☔ Don\'t forget your umbrella!');
    }
    
    // Check for alerts
    const alerts = await weather.getActiveAlerts();
    if (alerts.length > 0) {
        console.log('\n⚠️  WEATHER ALERTS:');
        alerts.forEach(alert => {
            console.log(`- ${alert.event} (${alert.severity})`);
        });
    }
    
    // Show forecast
    console.log(`\n📅 Today's forecast: ${data.forecast.today}`);
}

main().catch(console.error);