#!/usr/bin/env node
/**
 * Test Scenario Injector
 * Simulates safety alerts for testing the alert/escalation flow
 * 
 * Usage:
 *   node test-scenarios.js <scenario>
 * 
 * Scenarios:
 *   weather    - Simulate severe weather alert
 *   earthquake - Simulate nearby earthquake
 *   aqi        - Simulate unhealthy air quality
 *   news       - Simulate concerning local news
 *   disk       - Simulate disk almost full
 *   memory     - Simulate low memory
 *   all        - Simulate multiple alerts at once
 *   clear      - Clear all test overrides
 */

const fs = require('fs');
const path = require('path');

const TEST_OVERRIDE_FILE = path.join(__dirname, 'test-override.json');

const scenarios = {
  weather: {
    source: 'NWS',
    ok: false,
    alerts: [{
      event: 'Severe Thunderstorm Warning',
      severity: 'Severe',
      headline: 'TEST: Severe Thunderstorm Warning for King County',
      description: 'This is a TEST alert. A severe thunderstorm is approaching your area with 60mph winds and quarter-size hail.',
      expires: new Date(Date.now() + 3600000).toISOString()
    }]
  },
  
  earthquake: {
    source: 'USGS',
    ok: false,
    alerts: [{
      magnitude: 5.2,
      place: 'TEST: 3km NE of Redmond, Washington',
      time: new Date().toISOString(),
      distance: '3km away'
    }]
  },
  
  aqi: {
    source: 'AirQuality',
    ok: false,
    alerts: [{ aqi: 175, level: 'Unhealthy', pm25: 95.5 }],
    current: { aqi: 175, level: 'Unhealthy' }
  },
  
  news: {
    source: 'LocalNews',
    ok: false,
    alerts: [{
      title: 'TEST: Structure fire reported near Overlake area in Redmond',
      source: 'test-news.com',
      link: 'https://example.com/test-fire',
      age: '10m ago'
    }]
  },
  
  disk: {
    source: 'System',
    ok: false,
    alerts: [{ type: 'disk', severity: 'critical', message: 'TEST: Disk almost full: 94% used' }]
  },
  
  memory: {
    source: 'System', 
    ok: false,
    alerts: [{ type: 'memory', severity: 'warning', message: 'TEST: Memory getting low: 25% free' }]
  }
};

const scenario = process.argv[2];

if (!scenario) {
  console.log('Usage: node test-scenarios.js <scenario>');
  console.log('');
  console.log('Available scenarios:');
  console.log('  weather    - Severe weather alert');
  console.log('  earthquake - Nearby earthquake');
  console.log('  aqi        - Unhealthy air quality');
  console.log('  news       - Concerning local news');
  console.log('  disk       - Disk almost full (self-check)');
  console.log('  memory     - Low memory (self-check)');
  console.log('  all        - Multiple alerts at once');
  console.log('  clear      - Clear all test overrides');
  process.exit(1);
}

if (scenario === 'clear') {
  try {
    fs.unlinkSync(TEST_OVERRIDE_FILE);
    console.log('✅ Test overrides cleared');
  } catch (e) {
    console.log('✅ No test overrides to clear');
  }
  process.exit(0);
}

let override = {};

if (scenario === 'all') {
  override = {
    nws: scenarios.weather,
    usgs: scenarios.earthquake,
    aqi: scenarios.aqi,
    news: scenarios.news
  };
} else if (scenarios[scenario]) {
  const key = {
    weather: 'nws',
    earthquake: 'usgs',
    aqi: 'aqi',
    news: 'news',
    disk: 'system',
    memory: 'system'
  }[scenario];
  override[key] = scenarios[scenario];
} else {
  console.error(`Unknown scenario: ${scenario}`);
  process.exit(1);
}

override._test = true;
override._scenario = scenario;
override._createdAt = new Date().toISOString();
override._expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour

fs.writeFileSync(TEST_OVERRIDE_FILE, JSON.stringify(override, null, 2));

console.log(`✅ Test scenario '${scenario}' injected`);
console.log('');
console.log('Override file:', TEST_OVERRIDE_FILE);
console.log('Expires:', override._expiresAt);
console.log('');
console.log('Now run safety-check.js or self-check.js to see the simulated alert.');
console.log('');
console.log('To clear: node test-scenarios.js clear');
