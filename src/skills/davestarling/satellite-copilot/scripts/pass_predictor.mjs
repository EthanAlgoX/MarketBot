#!/usr/bin/env node
// Generic satellite pass predictor using satellite.js
//
// Inputs:
//  --norad <id>
//  --lat <deg> --lon <deg> [--height-m <m>]
//  --min-el <deg>
//  --look-ahead-min <minutes>
//
// Output: JSONL passes (includes az/el at start/end for manual alignment)

import fetch from 'node-fetch';
import * as sat from 'satellite.js';

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
    out[key] = val;
  }
  return out;
}

async function fetchTle(norad, timeoutMs = 5000) {
  const url = `https://tle.ivanstanojevic.me/api/tle/${norad}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'clawdbot-radio-copilot/1.0' } });
    if (!res.ok) throw new Error(`TLE fetch failed: ${res.status}`);
    const j = await res.json();
    if (!j?.line1?.startsWith('1 ') || !j?.line2?.startsWith('2 ')) throw new Error('Invalid TLE JSON');
    return { name: j.name || String(norad), line1: j.line1, line2: j.line2, date: j.date };
  } finally {
    clearTimeout(t);
  }
}

function topo(satrec, date, latDeg, lonDeg, heightM) {
  const pv = sat.propagate(satrec, date);
  if (!pv.position) return null;
  const gmst = sat.gstime(date);
  const positionEcf = sat.eciToEcf(pv.position, gmst);
  const observerGd = {
    latitude: sat.degreesToRadians(latDeg),
    longitude: sat.degreesToRadians(lonDeg),
    height: (heightM || 0) / 1000.0,
  };
  const look = sat.ecfToLookAngles(observerGd, positionEcf);
  return {
    azDeg: sat.radiansToDegrees(look.azimuth),
    elDeg: sat.radiansToDegrees(look.elevation),
    rangeKm: look.rangeSat,
  };
}

function findPasses(satrec, lat, lon, heightM, startDate, minutes, minElDeg, stepSec = 10) {
  const endMs = startDate.getTime() + minutes * 60 * 1000;
  const passes = [];
  let inPass = false;
  let pass = null;

  for (let t = startDate.getTime(); t <= endMs; t += stepSec * 1000) {
    const d = new Date(t);
    const st = topo(satrec, d, lat, lon, heightM);
    if (!st) continue;
    const above = st.elDeg >= minElDeg;

    if (above && !inPass) {
      inPass = true;
      pass = { start: d, max: d, end: d, maxEl: st.elDeg, maxAz: st.azDeg };
    }

    if (above && inPass && pass) {
      pass.end = d;
      if (st.elDeg > pass.maxEl) {
        pass.maxEl = st.elDeg;
        pass.max = d;
        pass.maxAz = st.azDeg;
      }
    }

    if (!above && inPass && pass) {
      passes.push(pass);
      inPass = false;
      pass = null;
    }
  }

  return passes;
}

function iso(d) {
  return d.toISOString();
}

async function main() {
  const args = parseArgs(process.argv);
  const norad = parseInt(args['norad'], 10);
  const lat = parseFloat(args['lat']);
  const lon = parseFloat(args['lon']);
  const heightM = parseFloat(args['height-m'] ?? '0');
  const minEl = parseFloat(args['min-el'] ?? '20');
  const lookAhead = parseFloat(args['look-ahead-min'] ?? '180');

  if (!norad || Number.isNaN(lat) || Number.isNaN(lon)) {
    console.error('Missing --norad/--lat/--lon');
    process.exit(2);
  }

  const tle = await fetchTle(norad);
  const satrec = sat.twoline2satrec(tle.line1, tle.line2);
  const inclinationDeg = sat.radiansToDegrees(satrec.inclo);

  const now = new Date();
  const passes = findPasses(satrec, lat, lon, heightM, now, lookAhead, minEl, 10);

  for (const p of passes) {
    const aos = topo(satrec, p.start, lat, lon, heightM);
    const los = topo(satrec, p.end, lat, lon, heightM);
    const max = topo(satrec, p.max, lat, lon, heightM);

    process.stdout.write(
      JSON.stringify({
        kind: 'sat-pass',
        norad,
        name: tle.name,
        passStart: iso(p.start),
        passMax: iso(p.max),
        passEnd: iso(p.end),
        maxElevationDeg: Math.round(p.maxEl * 10) / 10,
        maxAzimuthDeg: Math.round(p.maxAz * 10) / 10,
        minElevationDeg: minEl,
        inclinationDeg: Math.round(inclinationDeg * 10) / 10,
        aosAzDeg: aos ? Math.round(aos.azDeg * 10) / 10 : null,
        aosElDeg: aos ? Math.round(aos.elDeg * 10) / 10 : null,
        losAzDeg: los ? Math.round(los.azDeg * 10) / 10 : null,
        losElDeg: los ? Math.round(los.elDeg * 10) / 10 : null,
        maxAzDeg: max ? Math.round(max.azDeg * 10) / 10 : null,
        maxElDeg: max ? Math.round(max.elDeg * 10) / 10 : null,
        tleDate: tle.date,
      }) + '\n'
    );
  }
}

main().catch((e) => {
  // Treat transient network/TLE failures as non-fatal for cron runs.
  const msg = String(e?.message || e || '');
  if (msg.includes('TLE fetch failed') || msg.includes('aborted') || msg.includes('AbortError')) {
    process.exit(0);
  }
  console.error(e?.stack || String(e));
  process.exit(1);
});
