import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const args = new Set(process.argv.slice(2));
const baseUrl = process.env.PREVIEW_BASE_URL || 'http://localhost:3000';
const headed = args.has('--headed');
const screenshotsOnly = args.has('--screenshots-only');
const outputDir = path.resolve('artifacts', 'screenshots');

const pages = [
  { name: 'index', path: '/', activeText: '資料來源' },
  { name: 'dashboard', path: '/dashboard.html', activeText: '戰情儀表板' },
  { name: 'strategy-guide', path: '/strategy-guide.html', activeText: '策略智庫' },
  { name: 'compare', path: '/compare.html', activeText: null },
];

const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 375, height: 900 },
];

function pageUrl(route) {
  return new URL(route, baseUrl).toString();
}

async function checkPage(page, config, viewport) {
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => {
    pageErrors.push(error.message);
  });

  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(pageUrl(config.path), { waitUntil: 'networkidle', timeout: 45000 });

  const nav = page.locator('#global-nav');
  await nav.waitFor({ state: 'visible', timeout: 10000 });

  const navBox = await nav.boundingBox();
  if (!navBox || navBox.y > 2) {
    throw new Error(`${config.name}: #global-nav is not pinned at the top`);
  }

  if (config.activeText) {
    const active = page.locator('#global-nav .active', { hasText: config.activeText });
    if ((await active.count()) === 0) {
      throw new Error(`${config.name}: active nav item not found: ${config.activeText}`);
    }
  }

  const screenshotPath = path.join(outputDir, `${config.name}-${viewport.name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  if (!screenshotsOnly && (consoleErrors.length || pageErrors.length)) {
    throw new Error([
      `${config.name}: console/page errors detected`,
      ...consoleErrors.map(error => `console: ${error}`),
      ...pageErrors.map(error => `pageerror: ${error}`),
    ].join('\n'));
  }

  return {
    page: config.name,
    viewport: viewport.name,
    url: pageUrl(config.path),
    screenshot: screenshotPath,
    consoleErrors,
    pageErrors,
  };
}

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: !headed });
const results = [];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    for (const config of pages) {
      const page = await context.newPage();
      try {
        const result = await checkPage(page, config, viewport);
        results.push({ ...result, status: 'passed' });
        console.log(`PASS ${config.name} ${viewport.name}`);
      } catch (error) {
        results.push({
          page: config.name,
          viewport: viewport.name,
          url: pageUrl(config.path),
          status: 'failed',
          error: error.message,
        });
        console.error(`FAIL ${config.name} ${viewport.name}`);
        console.error(error.message);
        if (!screenshotsOnly) process.exitCode = 1;
      } finally {
        await page.close();
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}

await writeFile(
  path.resolve('artifacts', 'smoke-summary.json'),
  JSON.stringify({ baseUrl, generatedAt: new Date().toISOString(), results }, null, 2),
  'utf8',
);

if (process.exitCode) {
  process.exit(process.exitCode);
}
