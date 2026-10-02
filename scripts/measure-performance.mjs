import { chromium } from '@playwright/test';

const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    for (const locale of ['en', 'ar']) {
      for (const route of ['', '/shop']) {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        const started = performance.now();
        await page.goto(`http://localhost:3000/${locale}${route}`);
        await page.locator(route ? '.product-card' : '.hero h1').first().waitFor();
        const readyMs = Math.round(performance.now() - started);
        const domMs = await page.evaluate(() => Math.round(performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd));
        process.stdout.write(`${JSON.stringify({ width, locale, route: route || '/', readyMs, domMs })}\n`);
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
}
