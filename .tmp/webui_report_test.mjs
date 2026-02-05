import os from 'node:os';

const URL = 'http://localhost:3002/?token=test-token';
const PROMPT = '分析黄金行情，给出完整报告';

if (!process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE) {
  if (os.platform() === 'darwin' && os.arch() === 'arm64') {
    const major = Number.parseInt(os.release().split('.')[0] || '15', 10);
    const macMajor = Number.isNaN(major) ? 15 : Math.min(major - 9, 15);
    process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE = `mac${macMajor}-arm64`;
  }
}

const { chromium } = await import('playwright');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const main = async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let updateCount = 0;

  page.on('console', (msg) => {
    if (['error', 'warning'].includes(msg.type())) {
      console.log(`[console:${msg.type()}] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => console.log(`[pageerror] ${String(err)}`));
  page.on('websocket', (ws) => {
    console.log(`[ws] opened ${ws.url()}`);
    ws.on('close', () => console.log(`[ws] closed ${ws.url()}`));
    ws.on('framesent', (frame) => {
      if (typeof frame.payload === 'string' && frame.payload.includes('"method":"connect"')) {
        try {
          const payload = JSON.parse(frame.payload);
          const token = payload?.params?.auth?.token;
          console.log(`[ws] connect token=${token ? token : 'none'}`);
        } catch {
          console.log('[ws] sent connect');
        }
      }
    });
    ws.on('framereceived', (frame) => {
      if (typeof frame.payload === 'string' && frame.payload.includes('executor.update')) {
        updateCount += 1;
        try {
          const parsed = JSON.parse(frame.payload);
          const payload = parsed?.payload;
          const status = payload?.status;
          if (status === 'COMPLETED' || status === 'FAILED') {
            console.log('[ws] executor.update', {
              actionId: payload?.actionId,
              status,
              hasOutput: payload?.output !== undefined,
              outputKeys: payload?.output && typeof payload.output === 'object' ? Object.keys(payload.output) : null,
              error: payload?.error
            });
          }
        } catch {
          console.log('[ws] received executor.update');
        }
      }
    });
  });

  await page.goto(URL, { waitUntil: 'networkidle' });
  const title = await page.title();
  console.log(`[page] title=${title}`);

  const input = page.getByPlaceholder('Direct MarketBot intelligence...');
  await input.waitFor({ timeout: 15000 });
  await input.fill(PROMPT);
  await page.getByRole('button', { name: 'Run' }).click();

  await page.waitForSelector('.trace-card', { timeout: 20000 });

  const start = Date.now();
  while (Date.now() - start < 180000) {
    const spinning = await page.locator('.trace-dot svg.animate-spin').count();
    if (spinning === 0) break;
    await sleep(1000);
  }

  const steps = page.locator('.trace-card');
  const stepCount = await steps.count();

  const outputs = page.locator('text=Output');
  const outputCount = await outputs.count();
  const outputTexts = [];
  for (let i = 0; i < outputCount; i += 1) {
    try {
      const block = outputs.nth(i).locator('xpath=../..//pre').first();
      const text = await block.innerText();
      outputTexts.push(text);
    } catch {
      outputTexts.push('');
    }
  }

  const longestOutput = outputTexts.reduce((max, text) => Math.max(max, text.length), 0);
  const containsReportKeyword = outputTexts.some((text) =>
    ['报告', '总结', '趋势', '支撑', '阻力', '技术'].some((keyword) => text.includes(keyword))
  );

  let interactionOk = false;
  if (stepCount >= 2) {
    const first = steps.nth(0);
    const second = steps.nth(1);
    await second.click();
    await sleep(500);
    const classFirst = (await first.getAttribute('class')) ?? '';
    const classSecond = (await second.getAttribute('class')) ?? '';
    interactionOk = classSecond.includes('opacity-100') || classFirst.includes('opacity-40');
  }

  const completedIcons = await page.locator(".trace-dot svg[data-lucide='check-circle-2']").count();
  const spinningLeft = await page.locator('.trace-dot svg.animate-spin').count();
  const endSignalDetected = spinningLeft === 0 && completedIcons > 0;

  console.log('RESULTS');
  console.log(`updates_received=${updateCount}`);
  console.log(`step_count=${stepCount}`);
  console.log(`output_blocks=${outputCount}`);
  console.log(`longest_output_len=${longestOutput}`);
  console.log(`output_has_report_keywords=${containsReportKeyword}`);
  console.log(`card_interaction_ok=${interactionOk}`);
  console.log(`end_signal_detected=${endSignalDetected}`);

  await page.screenshot({ path: '/tmp/webui_report_test.png', fullPage: true });
  await browser.close();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
