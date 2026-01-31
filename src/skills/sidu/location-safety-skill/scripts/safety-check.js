const fs = require('fs');
const https = require('https');
const http = require('http');
const path = require('path');

const LOCATION_FILE = path.join(__dirname, 'location.json');
const TEST_OVERRIDE_FILE = path.join(__dirname, 'test-override.json');
const CONFIG_FILE = path.join(__dirname, 'config.json');
const LOGS_DIR = path.join(__dirname, 'logs');

// Load configuration (or use defaults)
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (e) {
    // Default config (Seattle)
    return {
      location: { defaultLat: 47.6062, defaultLon: -122.3321, city: 'Seattle' },
      monitoring: {
        locationKeywords: ['seattle', 'king county', 'puget sound', 'washington'],
        newsFeeds: [
          'https://www.king5.com/feeds/syndication/rss/news/local',
          'https://www.seattletimes.com/seattle-news/feed/'
        ],
        earthquakeRadiusKm: 100
      }
    };
  }
}

const CONFIG = loadConfig();

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Check for test overrides
function getTestOverride() {
  try {
    const override = JSON.parse(fs.readFileSync(TEST_OVERRIDE_FILE, 'utf8'));
    // Check if expired
    if (override._expiresAt && new Date(override._expiresAt) < new Date()) {
      fs.unlinkSync(TEST_OVERRIDE_FILE);
      return null;
    }
    console.error('⚠️  TEST MODE: Using injected test scenario:', override._scenario);
    return override;
  } catch (e) {
    return null;
  }
}

// Helper to make HTTP requests
function fetch(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': 'SidAlto-SafetyCheck/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// Get current location
function getLocation() {
  try {
    return JSON.parse(fs.readFileSync(LOCATION_FILE, 'utf8'));
  } catch (e) {
    return null;
  }
}

// NWS Alerts - National Weather Service
async function checkNWSAlerts(lat, lon) {
  try {
    const url = `https://api.weather.gov/alerts/active?point=${lat},${lon}`;
    const data = JSON.parse(await fetch(url));
    const alerts = (data.features || []).map(f => ({
      event: f.properties.event,
      severity: f.properties.severity,
      headline: f.properties.headline,
      description: f.properties.description?.slice(0, 500),
      expires: f.properties.expires
    }));
    return { source: 'NWS', ok: alerts.length === 0, alerts };
  } catch (e) {
    return { source: 'NWS', ok: true, error: e.message, alerts: [] };
  }
}

// USGS Earthquakes - past 24h within 100km
async function checkEarthquakes(lat, lon) {
  try {
    const radiusKm = CONFIG.monitoring?.earthquakeRadiusKm || 100;
    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=${lat}&longitude=${lon}&maxradiuskm=${radiusKm}&starttime=${new Date(Date.now() - 86400000).toISOString()}`;
    const data = JSON.parse(await fetch(url));
    const quakes = (data.features || [])
      .filter(f => f.properties.mag >= 2.5) // Only notable ones
      .map(f => ({
        magnitude: f.properties.mag,
        place: f.properties.place,
        time: new Date(f.properties.time).toISOString(),
        distance: f.properties.place
      }));
    return { source: 'USGS', ok: quakes.length === 0, alerts: quakes };
  } catch (e) {
    return { source: 'USGS', ok: true, error: e.message, alerts: [] };
  }
}

// Air Quality - EPA AirNow (using their public widget endpoint)
async function checkAirQuality(lat, lon) {
  try {
    // Using Open-Meteo air quality API (free, no key)
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm10,pm2_5`;
    const data = JSON.parse(await fetch(url));
    const aqi = data.current?.us_aqi || 0;
    let level = 'Good';
    let concern = false;
    if (aqi > 150) { level = 'Unhealthy'; concern = true; }
    else if (aqi > 100) { level = 'Unhealthy for Sensitive Groups'; concern = true; }
    else if (aqi > 50) { level = 'Moderate'; }
    
    return { 
      source: 'AirQuality', 
      ok: !concern, 
      alerts: concern ? [{ aqi, level, pm25: data.current?.pm2_5 }] : [],
      current: { aqi, level }
    };
  } catch (e) {
    return { source: 'AirQuality', ok: true, error: e.message, alerts: [] };
  }
}

// Local News RSS - check local feeds for concerning keywords
async function checkLocalNews(lat, lon) {
  // Use feeds from config, with fallback
  const feeds = CONFIG.monitoring?.newsFeeds || [
    'https://www.king5.com/feeds/syndication/rss/news/local',
    'https://www.seattletimes.com/seattle-news/feed/'
  ];
  
  // Only immediate, actionable threats - not historical news
  const concerningKeywords = [
    'evacuate', 'evacuation order', 'shelter in place',
    'active shooter', 'shooting reported', 'shots fired',
    'wildfire', 'fire spreading', 'structure fire', 
    'flash flood', 'flood warning', 'flooding',
    'landslide', 'mudslide', 'road closed',
    'gas leak', 'hazmat', 'chemical spill',
    'police standoff', 'lockdown', 'manhunt',
    'amber alert', 'silver alert', 'emergency alert',
    'power outage', 'outages reported'
  ];
  
  // Words that indicate historical/not-immediate news - skip these
  const excludeKeywords = [
    'verdict', 'sentenced', 'convicted', 'trial', 'lawsuit', 'sued',
    'years ago', 'last year', 'memorial', 'anniversary',
    'investigation concludes', 'report finds', 'study shows'
  ];
  
  // Location keywords for relevance (from config)
  const locationKeywords = CONFIG.monitoring?.locationKeywords || ['seattle', 'king county'];
  
  const alerts = [];
  
  for (const feedUrl of feeds) {
    try {
      const xml = await fetch(feedUrl);
      // Simple regex parsing of RSS items (good enough for alerts)
      const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
      
      for (const item of items.slice(0, 15)) { // Check last 15 items per feed
        const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/i) || 
                       item.match(/<title>(.*?)<\/title>/i) || [])[1] || '';
        const desc = (item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/i) || 
                      item.match(/<description>(.*?)<\/description>/i) || [])[1] || '';
        const link = (item.match(/<link>(.*?)<\/link>/i) || [])[1] || '';
        const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/i) || [])[1] || '';
        
        const content = (title + ' ' + desc).toLowerCase();
        
        // Check if concerning AND local AND not historical
        const isConcerning = concerningKeywords.some(kw => content.includes(kw));
        const isHistorical = excludeKeywords.some(kw => content.includes(kw));
        const isLocal = locationKeywords.some(kw => content.includes(kw));
        
        // Check if recent (within 24h)
        const pubTime = new Date(pubDate).getTime();
        const isRecent = (Date.now() - pubTime) < 86400000;
        
        if (isConcerning && isLocal && isRecent && !isHistorical) {
          alerts.push({
            title: title.slice(0, 200),
            source: feedUrl.split('/')[2],
            link,
            age: Math.round((Date.now() - pubTime) / 3600000) + 'h ago'
          });
        }
      }
    } catch (e) {
      // Skip failed feeds silently
    }
  }
  
  // Dedupe by title similarity
  const seen = new Set();
  const unique = alerts.filter(a => {
    const key = a.title.slice(0, 50).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  return { source: 'LocalNews', ok: unique.length === 0, alerts: unique.slice(0, 5) };
}

// Brave Search for breaking news (fallback)
async function searchBreakingNews(lat, lon) {
  // This would need Brave API key, skip for now
  return { source: 'WebSearch', ok: true, alerts: [], skipped: true };
}

// Main safety check
async function runSafetyCheck() {
  const location = getLocation();
  if (!location || !location.lat || !location.lon) {
    return { error: 'No location data available', timestamp: new Date().toISOString() };
  }
  
  const { lat, lon } = location;
  const testOverride = getTestOverride();
  
  console.error(`Running safety check for ${lat}, ${lon}...`);
  
  let [nws, usgs, aqi, news] = await Promise.all([
    checkNWSAlerts(lat, lon),
    checkEarthquakes(lat, lon),
    checkAirQuality(lat, lon),
    checkLocalNews(lat, lon)
  ]);
  
  // Apply test overrides if present
  if (testOverride) {
    if (testOverride.nws) nws = testOverride.nws;
    if (testOverride.usgs) usgs = testOverride.usgs;
    if (testOverride.aqi) aqi = testOverride.aqi;
    if (testOverride.news) news = testOverride.news;
  }
  
  const allClear = nws.ok && usgs.ok && aqi.ok && news.ok;
  
  const result = {
    timestamp: new Date().toISOString(),
    location: { lat, lon, updatedAt: location.receivedAt },
    status: allClear ? 'ALL_CLEAR' : 'ALERTS_FOUND',
    checks: { nws, usgs, aqi, news }
  };
  
  // Write to timestamped log file
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const logFile = path.join(LOGS_DIR, `${timestamp}_safety.json`);
  
  const logEntry = {
    ...result,
    meta: {
      logFile,
      checksPerformed: {
        nws: `https://api.weather.gov/alerts/active?point=${lat},${lon}`,
        usgs: `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=${lat}&longitude=${lon}&maxradiuskm=100`,
        aqi: `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}`,
        news: 'king5.com, seattletimes.com, patch.com/redmond'
      }
    }
  };
  
  fs.writeFileSync(logFile, JSON.stringify(logEntry, null, 2));
  console.error(`📝 Log written: ${logFile}`);
  
  // Output JSON
  console.log(JSON.stringify(result, null, 2));
  
  return result;
}

runSafetyCheck().catch(e => {
  console.error('Safety check failed:', e);
  process.exit(1);
});
