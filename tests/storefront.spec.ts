import { test, expect } from '@playwright/test';

for (const locale of ['en', 'ar'] as const) {
  test(`${locale} shopping, checkout and tracking`, async ({ page }) => {
    await page.goto(`/${locale}`);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    await expect(page.locator('.hero h1')).toBeVisible();
    await page.goto(`/${locale}/shop`);
    await expect(page.locator('.product-card').first()).toBeVisible();
    await page.getByRole('textbox', { name: locale === 'ar' ? 'بحث' : 'Search' }).last().fill('Safa');
    await expect(page.locator('.product-card')).toHaveCount(3);
    await page.locator('.product-card').filter({ has: page.getByRole('heading', { name: locale === 'ar' ? 'كرسي صفا' : 'Safa Lounge Chair', exact: true }) }).locator('a').first().click();
    await expect(page.locator('.detail-content h1')).toContainText(locale === 'ar' ? 'صفا' : 'Safa');
    await page.locator('.add-to-bag').click();
    await page.goto(`/${locale}/cart`);
    await expect(page.locator('.cart-line')).toHaveCount(1);
    await page.goto(`/${locale}/checkout`);
    await page.locator('.checkout-form input').nth(0).fill('Dara Tester');
    await page.locator('.checkout-form input').nth(1).fill(`guest-${crypto.randomUUID()}@example.test`);
    await page.locator('.checkout-form input').nth(2).fill('55501234');
    await page.locator('.checkout-form textarea').fill('Block 3, Street 12, Kuwait City');
    await page.locator('.checkout-form button[type="submit"], .checkout-form button.button').last().click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/order/`));
    await expect(page.locator('.order-box strong')).toContainText('DR-');
  });

  test(`${locale} catalog filters, favorites and admin`, async ({ page }) => {
    await page.goto(`/${locale}/shop?collection=the-slow-room`);
    await expect(page.locator('.collection-filter select')).toHaveValue('the-slow-room');
    await expect(page.locator('.product-card').first()).toBeVisible();
    await page.locator('.product-card .save-button').first().click();
    await page.goto(`/${locale}/favorites`);
    await expect(page.locator('.product-card')).toHaveCount(1);
    await page.goto(`/${locale}/admin`);
    await expect(page.locator('.admin-login-card')).toBeVisible();
    await page.locator('.admin-login-card input[type="email"]').fill(process.env.SEED_ADMIN_EMAIL ?? 'admin@dara.local');
    await page.locator('.admin-login-card input[type="password"]').fill(process.env.SEED_ADMIN_PASSWORD ?? 'DaraAdmin12345');
    await page.locator('.admin-login-card button.button').click();
    await expect(page.locator('.metric-grid')).toBeVisible();
    if (page.viewportSize()!.width < 850) await page.locator('.admin-menu').click();
    await page.locator('.admin-sidebar nav button').filter({ hasText: locale === 'ar' ? 'المنتجات' : 'Catalog' }).click();
    await expect(page.locator('.table-product').first()).toBeVisible();
    await page.locator('.admin-search input').fill('Safa');
    await expect(page.locator('.table-product').first()).toBeVisible();
    await page.locator('.table-action').first().click();
    await expect(page.locator('.admin-drawer')).toBeVisible();
    await expect(page.locator('.variant-list>div')).toHaveCount(20);
  });
}
