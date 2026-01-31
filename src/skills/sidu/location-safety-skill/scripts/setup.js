#!/usr/bin/env node
/**
 * Location Safety Setup Script
 * Run this on first install to configure the skill for your location.
 * 
 * Usage:
 *   node setup.js                    # Interactive setup
 *   node setup.js --city "Portland"  # Quick setup by city
 *   node setup.js --lat 45.5 --lon -122.6 --city "Portland"
 *   node setup.js --show             # Show current config
 */

const fs = require('fs');
const https = require('https');
const path = require('path');
const readline = require('readline');

const CONFIG_FILE = path.join(__dirname, 'config.json');

// City presets for quick setup
const CITY_PRESETS = {
  'seattle': {
    lat: 47.6062, lon: -122.3321,
    keywords: ['seattle', 'king county', 'puget sound', 'bellevue', 'redmond', 'tacoma'],
    feeds: [
      'https://www.king5.com/feeds/syndication/rss/news/local',
      'https://www.seattletimes.com/seattle-news/feed/'
    ]
  },
  'portland': {
    lat: 45.5152, lon: -122.6784,
    keywords: ['portland', 'multnomah county', 'oregon', 'vancouver wa', 'beaverton'],
    feeds: [
      'https://www.oregonlive.com/news/rss.xml',
      'https://www.kgw.com/feeds/syndication/rss/news/local'
    ]
  },
  'san francisco': {
    lat: 37.7749, lon: -122.4194,
    keywords: ['san francisco', 'bay area', 'oakland', 'sf', 'silicon valley'],
    feeds: [
      'https://www.sfchronicle.com/local/feed/',
      'https://www.sfgate.com/rss/feed/SFGATE-Bay-Area-News-702.php'
    ]
  },
  'los angeles': {
    lat: 34.0522, lon: -118.2437,
    keywords: ['los angeles', 'la county', 'hollywood', 'santa monica', 'pasadena'],
    feeds: [
      'https://www.latimes.com/local/rss2.0.xml',
      'https://abc7.com/feed/'
    ]
  },
  'new york': {
    lat: 40.7128, lon: -74.0060,
    keywords: ['new york', 'nyc', 'manhattan', 'brooklyn', 'queens'],
    feeds: [
      'https://rss.nytimes.com/services/xml/rss/nyt/NYRegion.xml'
    ]
  },
  'chicago': {
    lat: 41.8781, lon: -87.6298,
    keywords: ['chicago', 'cook county', 'illinois', 'evanston'],
    feeds: [
      'https://www.chicagotribune.com/news/rss2.0.xml'
    ]
  }
};

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (e) {
    return null;
  }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  console.log(`\n✅ Configuration saved to ${CONFIG_FILE}`);
}

function showConfig() {
  const config = loadConfig();
  if (!config) {
    console.log('No configuration found. Run setup first.');
    return;
  }
  console.log('\n📍 Current Configuration:\n');
  console.log(JSON.stringify(config, null, 2));
}

async function geocodeCity(city) {
  return new Promise((resolve, reject) => {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1`;
    https.get(url, { headers: { 'User-Agent': 'LocationSafetySetup/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const results = JSON.parse(data);
          if (results.length > 0) {
            resolve({
              lat: parseFloat(results[0].lat),
              lon: parseFloat(results[0].lon),
              displayName: results[0].display_name
            });
          } else {
            reject(new Error('City not found'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function interactiveSetup() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const ask = (q) => new Promise(resolve => rl.question(q, resolve));

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║          🛡️  LOCATION SAFETY - SETUP WIZARD                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('\nThis wizard will help you set up location-based safety monitoring.');
  console.log('Your AI assistant will watch for dangers near you and alert you.\n');
  
  await ask('Press Enter to begin setup...');
  
  // Step 1: Location
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  STEP 1 of 4: YOUR LOCATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // City
  console.log('Available presets: Seattle, Portland, San Francisco, Los Angeles, New York, Chicago');
  console.log('(Other cities will be geocoded automatically)\n');
  const city = await ask('Enter your city (or press Enter for Seattle): ');
  
  let config = loadConfig() || {};
  const cityLower = (city || 'seattle').toLowerCase();
  
  if (CITY_PRESETS[cityLower]) {
    const preset = CITY_PRESETS[cityLower];
    config.location = {
      defaultLat: preset.lat,
      defaultLon: preset.lon,
      city: city || 'Seattle',
      region: '',
      country: 'US'
    };
    config.monitoring = {
      ...config.monitoring,
      locationKeywords: preset.keywords,
      newsFeeds: preset.feeds
    };
    console.log(`\n✅ Using preset for ${city || 'Seattle'}`);
  } else {
    // Try to geocode
    console.log(`\nLooking up "${city}"...`);
    try {
      const geo = await geocodeCity(city);
      console.log(`Found: ${geo.displayName}`);
      config.location = {
        defaultLat: geo.lat,
        defaultLon: geo.lon,
        city: city,
        region: '',
        country: ''
      };
      // Default keywords based on city name
      config.monitoring = {
        ...config.monitoring,
        locationKeywords: [city.toLowerCase()],
        newsFeeds: []
      };
      console.log('\n⚠️  No preset news feeds for this city. You may want to add local RSS feeds manually.');
    } catch (e) {
      console.log(`Could not find city. Using Seattle defaults.`);
      const preset = CITY_PRESETS['seattle'];
      config.location = { defaultLat: preset.lat, defaultLon: preset.lon, city: 'Seattle' };
    }
  }

  // Step 2: Emergency Contact
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  STEP 2 of 4: EMERGENCY CONTACT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('If you don\'t respond to a safety alert within 15 minutes,');
  console.log('we can notify someone you trust.\n');
  
  const contactName = await ask('Emergency contact name (or press Enter to skip): ');
  if (contactName) {
    const contactEmail = await ask('Emergency contact email: ');
    const contactPhone = await ask('Emergency contact phone (optional): ');
    config.emergencyContact = {
      name: contactName,
      email: contactEmail || null,
      phone: contactPhone || null
    };
  }

  config.configured = true;
  config.configuredAt = new Date().toISOString();
  
  saveConfig(config);
  
  // Step 3: Mobile App Setup
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  STEP 3 of 4: MOBILE APP SETUP');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('To share your location, install the OwnTracks app:\n');
  console.log('  📱 iPhone:  https://apps.apple.com/app/owntracks/id692424691');
  console.log('  🤖 Android: https://play.google.com/store/apps/details?id=org.owntracks.android\n');
  
  await ask('Press Enter once you\'ve installed OwnTracks...');
  
  console.log('\nNow configure OwnTracks:\n');
  console.log('  1. Open OwnTracks');
  console.log('  2. Tap (i) → Settings');
  console.log('  3. Set Mode to: HTTP');
  console.log('  4. Set URL to your webhook (you\'ll get this in the next step)');
  console.log('  5. Tap the publish button (arrow icon) to test\n');
  
  // Step 4: Webhook Setup
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  STEP 4 of 4: START THE WEBHOOK SERVER');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('Start the location webhook server:\n');
  console.log('  node server.js\n');
  console.log('The server will display your webhook URL. It will look like:\n');
  console.log('  http://YOUR-IP:18800/location?key=YOUR-SECRET-KEY\n');
  console.log('Copy this URL and paste it into OwnTracks settings.\n');
  
  // Summary
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    ✅ SETUP COMPLETE!                        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  console.log('📍 Location:', config.location.city, `(${config.location.defaultLat.toFixed(4)}, ${config.location.defaultLon.toFixed(4)})`);
  console.log('🔍 Keywords:', config.monitoring.locationKeywords.join(', '));
  console.log('📰 News feeds:', config.monitoring.newsFeeds.length, 'configured');
  if (config.emergencyContact?.name) {
    console.log('🚨 Emergency:', config.emergencyContact.name, `<${config.emergencyContact.email}>`);
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  NEXT STEPS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('  1. Run: node server.js');
  console.log('  2. Copy the webhook URL to OwnTracks');
  console.log('  3. Test by tapping the publish button in OwnTracks');
  console.log('  4. Set up cron jobs in Moltbot for safety checks\n');
  console.log('Your AI assistant will now monitor for dangers in your area!');
  console.log('It checks: weather alerts, earthquakes, air quality, and local news.\n');
  
  rl.close();
}

// Parse args
const args = process.argv.slice(2);

if (args.includes('--show')) {
  showConfig();
} else if (args.includes('--city')) {
  const cityIdx = args.indexOf('--city');
  const city = args[cityIdx + 1];
  const preset = CITY_PRESETS[city?.toLowerCase()];
  if (preset) {
    const config = loadConfig() || {};
    config.location = { defaultLat: preset.lat, defaultLon: preset.lon, city };
    config.monitoring = { ...config.monitoring, locationKeywords: preset.keywords, newsFeeds: preset.feeds };
    config.configured = true;
    saveConfig(config);
    console.log(`✅ Configured for ${city}`);
  } else {
    console.log(`Unknown city preset: ${city}`);
    console.log('Available: Seattle, Portland, San Francisco, Los Angeles, New York, Chicago');
  }
} else {
  interactiveSetup().catch(console.error);
}
