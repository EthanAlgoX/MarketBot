/**
 * Self-Check: Monitor threats to the Mac mini (Sid Alto's physical home)
 * 
 * Checks:
 * 1. System health (disk, memory)
 * 2. Environmental threats at my location (weather, earthquakes, power outages)
 * 3. Network/connectivity
 */

const fs = require('fs');
const https = require('https');
const { execSync } = require('child_process');
const path = require('path');

const MY_LOCATION_FILE = path.join(__dirname, 'my-location.json');

function fetch(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'SidAlto-SelfCheck/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// System health checks
function checkSystemHealth() {
  const alerts = [];
  
  try {
    // Memory pressure
    const memOutput = execSync('memory_pressure 2>&1 | grep "free percentage"', { encoding: 'utf8' });
    const memMatch = memOutput.match(/(\d+)%/);
    const memFree = memMatch ? parseInt(memMatch[1]) : 100;
    if (memFree < 20) {
      alerts.push({ type: 'memory', severity: 'critical', message: `Memory critically low: ${memFree}% free` });
    } else if (memFree < 40) {
      alerts.push({ type: 'memory', severity: 'warning', message: `Memory getting low: ${memFree}% free` });
    }
  } catch (e) {}
  
  try {
    // Disk space
    const dfOutput = execSync('df -h / | tail -1', { encoding: 'utf8' });
    const dfMatch = dfOutput.match(/(\d+)%/);
    const diskUsed = dfMatch ? parseInt(dfMatch[1]) : 0;
    if (diskUsed > 95) {
      alerts.push({ type: 'disk', severity: 'critical', message: `Disk almost full: ${diskUsed}% used` });
    } else if (diskUsed > 85) {
      alerts.push({ type: 'disk', severity: 'warning', message: `Disk getting full: ${diskUsed}% used` });
    }
  } catch (e) {}
  
  try {
    // CPU temperature (Mac-specific)
    // Note: This may not work on all Macs without additional tools
    const tempOutput = execSync('sudo powermetrics --samplers smc -i1 -n1 2>/dev/null | grep -i "CPU die temperature" || echo "temp: 50"', { encoding: 'utf8' });
    const tempMatch = tempOutput.match(/(\d+\.?\d*)/);
    const temp = tempMatch ? parseFloat(tempMatch[1]) : 50;
    if (temp > 95) {
      alerts.push({ type: 'temperature', severity: 'critical', message: `CPU overheating: ${temp}°C` });
    } else if (temp > 85) {
      alerts.push({ type: 'temperature', severity: 'warning', message: `CPU running hot: ${temp}°C` });
    }
  } catch (e) {}
  
  try {
    // Uptime - if very long, might need restart
    const uptimeOutput = execSync('uptime', { encoding: 'utf8' });
    const daysMatch = uptimeOutput.match(/up (\d+) days/);
    const days = daysMatch ? parseInt(daysMatch[1]) : 0;
    if (days > 30) {
      alerts.push({ type: 'uptime', severity: 'info', message: `System has been up ${days} days - consider a restart soon` });
    }
  } catch (e) {}
  
  return { source: 'System', ok: alerts.filter(a => a.severity !== 'info').length === 0, alerts };
}

// Environmental threats at my location
async function checkEnvironmentalThreats(lat, lon) {
  const alerts = [];
  
  // NWS Weather Alerts
  try {
    const nwsData = JSON.parse(await fetch(`https://api.weather.gov/alerts/active?point=${lat},${lon}`));
    for (const feature of (nwsData.features || [])) {
      const props = feature.properties;
      if (['Extreme', 'Severe'].includes(props.severity)) {
        alerts.push({
          type: 'weather',
          severity: props.severity.toLowerCase(),
          message: props.headline || props.event
        });
      }
    }
  } catch (e) {}
  
  // USGS Earthquakes (significant ones nearby)
  try {
    const quakeData = JSON.parse(await fetch(
      `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=${lat}&longitude=${lon}&maxradiuskm=50&starttime=${new Date(Date.now() - 3600000).toISOString()}&minmagnitude=4`
    ));
    for (const feature of (quakeData.features || [])) {
      alerts.push({
        type: 'earthquake',
        severity: feature.properties.mag >= 5 ? 'critical' : 'warning',
        message: `M${feature.properties.mag} earthquake: ${feature.properties.place}`
      });
    }
  } catch (e) {}
  
  // Power outage check - PSE (Puget Sound Energy) area
  // This is harder to automate without scraping, but we can check local news
  
  return { source: 'Environmental', ok: alerts.length === 0, alerts };
}

// Network connectivity check
async function checkConnectivity() {
  const alerts = [];
  
  try {
    // Check if Tailscale is connected
    const tsOutput = execSync('tailscale status --json 2>/dev/null || echo "{}"', { encoding: 'utf8' });
    const tsData = JSON.parse(tsOutput);
    if (tsData.BackendState && tsData.BackendState !== 'Running') {
      alerts.push({ type: 'network', severity: 'warning', message: `Tailscale not running: ${tsData.BackendState}` });
    }
  } catch (e) {}
  
  try {
    // Check internet connectivity
    await fetch('https://api.weather.gov/');
  } catch (e) {
    alerts.push({ type: 'network', severity: 'critical', message: 'Internet connectivity issues detected' });
  }
  
  return { source: 'Network', ok: alerts.length === 0, alerts };
}

async function runSelfCheck() {
  let myLocation;
  try {
    myLocation = JSON.parse(fs.readFileSync(MY_LOCATION_FILE, 'utf8'));
  } catch (e) {
    return { error: 'No location configured for self', timestamp: new Date().toISOString() };
  }
  
  const { lat, lon } = myLocation;
  
  console.error(`Running self-check for Mac mini at ${lat}, ${lon}...`);
  
  const [system, environment, network] = await Promise.all([
    checkSystemHealth(),
    checkEnvironmentalThreats(lat, lon),
    checkConnectivity()
  ]);
  
  const allClear = system.ok && environment.ok && network.ok;
  const criticalAlerts = [
    ...system.alerts.filter(a => a.severity === 'critical'),
    ...environment.alerts.filter(a => a.severity === 'critical'),
    ...network.alerts.filter(a => a.severity === 'critical')
  ];
  
  const result = {
    timestamp: new Date().toISOString(),
    location: myLocation,
    status: criticalAlerts.length > 0 ? 'CRITICAL' : (allClear ? 'ALL_CLEAR' : 'WARNINGS'),
    checks: { system, environment, network }
  };
  
  console.log(JSON.stringify(result, null, 2));
  
  return result;
}

runSelfCheck().catch(e => {
  console.error('Self-check failed:', e);
  process.exit(1);
});
