import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const locale of ['en', 'ar'] as const) {
  test(`${locale} accessibility and responsive page health`, async ({ page }) => {
    for (const route of ['', '/shop', '/admin']) {
      await page.goto(`/${locale}${route}`);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `horizontal overflow on /${locale}${route}`).toBeLessThanOrEqual(1);
      const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(scan.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => ({ id: v.id, targets: v.nodes.map(node => node.target.join(' ')) })), `axe violations on /${locale}${route}`).toEqual([]);
    }
    if (process.env.SEED_ADMIN_PASSWORD) {
      await page.locator('.admin-login-card input[type="email"]').fill(process.env.SEED_ADMIN_EMAIL ?? 'admin@dara.local');
      await page.locator('.admin-login-card input[type="password"]').fill(process.env.SEED_ADMIN_PASSWORD);
      await page.locator('.admin-login-card button.button').click();
      await expect(page.locator('.metric-grid')).toBeVisible();
      const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(scan.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => ({ id: v.id, targets: v.nodes.map(node => node.target.join(' ')) })), `axe violations on /${locale}/admin overview`).toEqual([]);
      if (page.viewportSize()!.width < 850) await page.locator('.admin-menu').click();
      await page.locator('.admin-sidebar nav button').filter({ hasText: locale === 'ar' ? 'المنتجات' : 'Catalog' }).click();
      await expect(page.locator('.table-product').first()).toBeVisible();
      const catalogScan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(catalogScan.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => ({ id: v.id, targets: v.nodes.map(node => node.target.join(' ')) })), `axe violations on /${locale}/admin catalog`).toEqual([]);
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/${locale}`);
    const duration = await page.locator('.button').first().evaluate(element => getComputedStyle(element).transitionDuration);
    expect(duration).toBe('1e-05s');
  });
}
