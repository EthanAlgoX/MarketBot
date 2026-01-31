#!/usr/bin/env node
/**
 * chart.mjs - Generate chart images from data using Vega-Lite
 * 
 * Usage:
 *   node chart.mjs --type line --data '[{"x":"10:00","y":25},{"x":"10:30","y":31}]' --output chart.png
 *   node chart.mjs --spec spec.json --output chart.png
 *   echo '{"type":"line","data":[...]}' | node chart.mjs --output chart.png
 * 
 * Options:
 *   --type       Chart type: line, bar, area, point (default: line)
 *   --data       JSON array of data points
 *   --spec       Path to full Vega-Lite spec JSON file
 *   --output     Output file path (default: chart.png)
 *   --title      Chart title
 *   --width      Chart width (default: 600)
 *   --height     Chart height (default: 300)
 *   --x-field    X axis field name (default: x)
 *   --y-field    Y axis field name (default: y)
 *   --x-title    X axis title
 *   --y-title    Y axis title
 *   --color      Line/bar color (default: #e63946)
 *   --y-domain   Y axis domain as "min,max" (e.g., "0,100")
 *   --svg        Output SVG instead of PNG
 */

import * as vega from 'vega';
import * as vegaLite from 'vega-lite';
import sharp from 'sharp';
import { writeFileSync, readFileSync } from 'fs';

// Parse CLI args
function parseArgs(args) {
  const opts = {
    type: 'line',
    output: 'chart.png',
    width: 600,
    height: 300,
    xField: 'x',
    yField: 'y',
    color: '#e63946',
    svg: false,
    showChange: false,
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    
    switch (arg) {
      case '--type': opts.type = next; i++; break;
      case '--data': opts.data = JSON.parse(next); i++; break;
      case '--spec': opts.specFile = next; i++; break;
      case '--output': opts.output = next; i++; break;
      case '--title': opts.title = next; i++; break;
      case '--width': opts.width = parseInt(next); i++; break;
      case '--height': opts.height = parseInt(next); i++; break;
      case '--x-field': opts.xField = next; i++; break;
      case '--y-field': opts.yField = next; i++; break;
      case '--x-title': opts.xTitle = next; i++; break;
      case '--y-title': opts.yTitle = next; i++; break;
      case '--color': opts.color = next; i++; break;
      case '--y-domain': opts.yDomain = next.split(',').map(Number); i++; break;
      case '--svg': opts.svg = true; break;
      case '--show-change': opts.showChange = true; break;
      case '--annotation': opts.annotation = next; i++; break;
      case '--focus-change': opts.focusChange = true; break;
      case '--focus-recent': opts.focusRecent = parseInt(next) || 4; i++; break;
      case '--dark': opts.dark = true; break;
      case '--show-values': opts.showValues = true; break;
    }
  }
  
  return opts;
}

// Read from stdin if no data provided
async function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('readable', () => {
      let chunk;
      while ((chunk = process.stdin.read()) !== null) {
        data += chunk;
      }
    });
    process.stdin.on('end', () => resolve(data));
    // Timeout for non-piped usage
    setTimeout(() => resolve(''), 100);
  });
}

// Build Vega-Lite spec from options
function buildSpec(opts) {
  // Theme colors
  const theme = opts.dark ? {
    bg: '#1a1a2e',
    text: '#e0e0e0',
    grid: '#333355',
    accent: opts.color || '#ff6b6b',
    positive: '#4ade80',
    negative: '#f87171',
  } : {
    bg: '#ffffff',
    text: '#333333',
    grid: '#e0e0e0',
    accent: opts.color || '#e63946',
    positive: '#22c55e',
    negative: '#ef4444',
  };
  
  const markConfig = {
    line: { type: 'line', point: true, color: theme.accent, strokeWidth: 2 },
    bar: { type: 'bar', color: theme.accent },
    area: { type: 'area', color: theme.accent, opacity: 0.7, line: { color: theme.accent } },
    point: { type: 'point', color: theme.accent, size: 100 },
  };
  
  // Calculate change if requested
  let changeText = opts.annotation || null;
  if (opts.showChange && opts.data && opts.data.length >= 2) {
    const first = opts.data[0][opts.yField];
    const last = opts.data[opts.data.length - 1][opts.yField];
    const change = last - first;
    const sign = change >= 0 ? '+' : '';
    changeText = `${sign}${change.toFixed(1)}%`;
  }
  
  // Focus on recent data points only
  if (opts.focusRecent && opts.data && opts.data.length > opts.focusRecent) {
    opts.data = opts.data.slice(-opts.focusRecent);
  }
  
  // Focus Y-axis on change (2x scale of the data range)
  if (opts.focusChange && opts.data && opts.data.length >= 2) {
    const values = opts.data.map(d => d[opts.yField]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const padding = range * 0.5; // 50% padding on each side = 2x total range
    const yMin = Math.max(0, Math.floor(min - padding));
    const yMax = Math.ceil(max + padding);
    opts.yDomain = [yMin, yMax];
  }
  
  // Base layer - the main chart
  const mainLayer = {
    mark: markConfig[opts.type] || markConfig.line,
    encoding: {
      x: {
        field: opts.xField,
        type: 'ordinal',
        title: opts.xTitle || opts.xField,
        axis: { labelAngle: -45 }
      },
      y: {
        field: opts.yField,
        type: 'quantitative',
        title: opts.yTitle || opts.yField,
      }
    }
  };
  
  if (opts.yDomain) {
    mainLayer.encoding.y.scale = { domain: opts.yDomain };
  }
  
  const layers = [mainLayer];
  
  // Add change annotation on the last point
  if (changeText && opts.data && opts.data.length >= 1) {
    const lastPoint = opts.data[opts.data.length - 1];
    const isNegative = changeText.startsWith('-');
    
    layers.push({
      mark: {
        type: 'text',
        align: 'left',
        dx: 8,
        dy: -8,
        fontSize: 18,
        fontWeight: 'bold',
        color: isNegative ? theme.positive : theme.negative  // Green for negative (good), red for positive (bad for risk)
      },
      encoding: {
        x: { datum: lastPoint[opts.xField] },
        y: { datum: lastPoint[opts.yField] },
        text: { value: changeText }
      }
    });
  }
  
  // Add value labels at peak points (min and max)
  if (opts.showValues && opts.data && opts.data.length >= 2) {
    const values = opts.data.map(d => d[opts.yField]);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const minPoint = opts.data.find(d => d[opts.yField] === minVal);
    const maxPoint = opts.data.find(d => d[opts.yField] === maxVal);
    
    // Max point label (above)
    if (maxPoint) {
      layers.push({
        mark: {
          type: 'text',
          align: 'center',
          dy: -12,
          fontSize: 13,
          fontWeight: 'bold',
          color: theme.text
        },
        encoding: {
          x: { datum: maxPoint[opts.xField] },
          y: { datum: maxPoint[opts.yField] },
          text: { value: `${maxVal}` }
        }
      });
    }
    
    // Min point label (below) - only if different from max
    if (minPoint && minVal !== maxVal) {
      layers.push({
        mark: {
          type: 'text',
          align: 'center',
          dy: 16,
          fontSize: 13,
          fontWeight: 'bold',
          color: theme.text
        },
        encoding: {
          x: { datum: minPoint[opts.xField] },
          y: { datum: minPoint[opts.yField] },
          text: { value: `${minVal}` }
        }
      });
    }
  }
  
  const spec = {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: opts.width,
    height: opts.height,
    background: theme.bg,
    padding: { left: 10, right: 30, top: 10, bottom: 10 },
    data: { values: opts.data },
    layer: layers,
    config: {
      font: 'Helvetica, Arial, sans-serif',
      title: { fontSize: 16, fontWeight: 'bold', color: theme.text },
      axis: { 
        labelFontSize: 11, 
        titleFontSize: 13, 
        gridColor: theme.grid,
        labelColor: theme.text,
        titleColor: theme.text,
        domainColor: theme.grid
      },
      view: { stroke: null }
    }
  };
  
  if (opts.title) {
    spec.title = { text: opts.title, anchor: 'start', color: theme.text };
  }
  
  return spec;
}

// Main
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  
  let spec;
  
  if (opts.specFile) {
    // Load full spec from file
    spec = JSON.parse(readFileSync(opts.specFile, 'utf8'));
  } else if (opts.data) {
    // Build spec from options
    spec = buildSpec(opts);
  } else {
    // Try stdin
    const stdin = await readStdin();
    if (stdin.trim()) {
      const input = JSON.parse(stdin);
      if (input.$schema) {
        // Full spec via stdin
        spec = input;
      } else if (Array.isArray(input)) {
        // Just data array
        opts.data = input;
        spec = buildSpec(opts);
      } else if (input.data) {
        // Simplified format: {type, data, title, ...}
        Object.assign(opts, input);
        if (typeof opts.data === 'string') opts.data = JSON.parse(opts.data);
        spec = buildSpec(opts);
      }
    }
  }
  
  if (!spec || !spec.data?.values?.length) {
    console.error('Error: No data provided. Use --data, --spec, or pipe JSON to stdin.');
    process.exit(1);
  }
  
  // Compile Vega-Lite to Vega
  const vgSpec = vegaLite.compile(spec).spec;
  const view = new vega.View(vega.parse(vgSpec), { renderer: 'none' });
  
  await view.initialize();
  
  // Generate SVG
  const svg = await view.toSVG();
  
  if (opts.svg || opts.output.endsWith('.svg')) {
    writeFileSync(opts.output, svg);
    console.log(`SVG saved to ${opts.output}`);
  } else {
    // Convert SVG to PNG using sharp
    const pngBuffer = await sharp(Buffer.from(svg))
      .png()
      .toBuffer();
    
    writeFileSync(opts.output, pngBuffer);
    console.log(`Chart saved to ${opts.output}`);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
