/**
 * Location Webhook Server
 * Receives location updates from OwnTracks, iOS Shortcuts, or other sources.
 * 
 * Configuration via environment variables:
 *   PORT - Server port (default: 18800)
 *   SECRET_KEY - API key for authentication (default: auto-generated)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 18800;
const SECRET_KEY = process.env.SECRET_KEY || crypto.randomBytes(16).toString('hex');
const LOCATION_FILE = path.join(__dirname, 'location.json');

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  
  // Health check
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  // Get current location
  if (req.method === 'GET' && url.pathname === '/location') {
    const key = url.searchParams.get('key');
    if (key !== SECRET_KEY) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }

    try {
      const data = fs.readFileSync(LOCATION_FILE, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    } catch (e) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'no location data' }));
    }
    return;
  }

  // Update location
  if (req.method === 'POST' && url.pathname === '/location') {
    const key = url.searchParams.get('key');
    if (key !== SECRET_KEY) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log('Received data:', JSON.stringify(data));
        
        // Skip non-location messages (OwnTracks sends dumps, waypoints, etc.)
        if (data._type && data._type !== 'location') {
          console.log(`Skipping non-location message type: ${data._type}`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, skipped: data._type }));
          return;
        }
        
        const location = {
          lat: data.lat || data.Lat || data.latitude || data.Latitude,
          lon: data.lon || data.Lon || data.longitude || data.Longitude,
          accuracy: data.acc || data.accuracy,
          altitude: data.alt || data.altitude,
          battery: data.batt,
          timestamp: data.tst ? new Date(data.tst * 1000).toISOString() : (data.timestamp || new Date().toISOString()),
          receivedAt: new Date().toISOString()
        };

        fs.writeFileSync(LOCATION_FILE, JSON.stringify(location, null, 2));
        
        console.log(`[${location.receivedAt}] Location updated: ${location.lat}, ${location.lon}`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, location }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid json', message: e.message }));
      }
    });
    return;
  }

  // 404 for everything else
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Location webhook listening on http://0.0.0.0:${PORT}`);
  console.log(`Secret key: ${SECRET_KEY}`);
  console.log('');
  console.log('Endpoints:');
  console.log(`  POST /location?key=${SECRET_KEY}  - Update location`);
  console.log(`  GET  /location?key=${SECRET_KEY}  - Get current location`);
  console.log('  GET  /health                      - Health check');
});
