import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const baseURL = process.env.TEST_WEB_URL ?? 'http://localhost:3000';
const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@dara.local';
const adminPassword = process.env.SEED_ADMIN_PASSWORD;
if (!adminPassword) throw new Error('Set SEED_ADMIN_PASSWORD to capture the admin pages.');

const root = new URL('../docs/screenshots/', import.meta.url);
const browser = await chromium.launch();
const desktopNames = [
  ['home', 'Home'], ['shop', 'Shop'], ['collection', 'Collection'],
  ['product', 'Product detail'], ['favorites', 'Favorites'], ['cart', 'Cart'],
  ['checkout', 'Checkout'], ['order', 'Order tracking'], ['story', 'Our story'],
  ['account', 'Account'], ['admin-login', 'Admin sign in'],
  ['admin-overview', 'Admin overview'], ['admin-catalog', 'Admin catalog'],
  ['admin-product-editor', 'Admin product editor'], ['admin-inventory', 'Admin inventory'],
  ['admin-orders', 'Admin orders'], ['admin-promotions', 'Admin promotions'],
  ['admin-audit', 'Admin audit history']
];
const mobileNames = [
  ['home', 'Home'], ['shop', 'Shop'], ['product', 'Product detail'],
  ['cart', 'Cart'], ['checkout', 'Checkout'], ['admin-overview', 'Admin overview']
];

async function capture(page, locale, name, mobile = false) {
  const folder = new URL(`./${locale}${mobile ? '-mobile' : ''}/`, root);
  await mkdir(folder, { recursive: true });
  await page.waitForTimeout(250);
  await page.screenshot({ path: new URL(`${name}.png`, folder).pathname, animations: 'disabled' });
  process.stdout.write(`${locale}${mobile ? ' mobile' : ''}: ${name}\n`);
}

async function visit(page, path, visible) {
  await page.goto(`${baseURL}${path}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator(visible).first()).toBeVisible();
}

async function admin(page, locale, mobile = false) {
  await visit(page, `/${locale}/admin`, '.admin-login-card');
  if (!mobile) await capture(page, locale, 'admin-login');
  await page.locator('.admin-login-card input[type="email"]').fill(adminEmail);
  await page.locator('.admin-login-card input[type="password"]').fill(adminPassword);
  await page.locator('.admin-login-card button.button').click();
  await expect(page.locator('.metric-grid')).toBeVisible();
  const signInNotice = page.locator('.form-success button');
  if (await signInNotice.isVisible()) await signInNotice.click();
  await capture(page, locale, 'admin-overview', mobile);
  if (mobile) return;

  const nav = page.locator('.admin-sidebar nav button');
  await nav.nth(1).click();
  await expect(page.locator('.table-product').first()).toBeVisible();
  await capture(page, locale, 'admin-catalog');
  await page.locator('.admin-search input').fill('Safa');
  await page.locator('.table-action').first().click();
  await expect(page.locator('.admin-drawer')).toBeVisible();
  await capture(page, locale, 'admin-product-editor');
  await page.locator('.drawer-header button').click();
  for (const [index, name] of [[2, 'admin-inventory'], [3, 'admin-orders'], [4, 'admin-promotions'], [5, 'admin-audit']]) {
    await nav.nth(index).click();
    await expect(page.locator('.admin-heading h1')).toBeVisible();
    await capture(page, locale, name);
  }
}

async function storefront(locale) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await visit(page, `/${locale}`, '.hero h1');
  await capture(page, locale, 'home');
  await visit(page, `/${locale}/shop`, '.product-card');
  await capture(page, locale, 'shop');
  await visit(page, `/${locale}/shop?collection=the-slow-room`, '.product-card');
  await expect(page.locator('.collection-filter select')).toHaveValue('the-slow-room');
  await capture(page, locale, 'collection');
  await visit(page, `/${locale}/product/safa-lounge-chair`, '.detail-content h1');
  await capture(page, locale, 'product');
  await page.locator('.save-detail').click();
  await page.locator('.add-to-bag').click();
  await visit(page, `/${locale}/favorites`, '.product-card');
  await capture(page, locale, 'favorites');
  await visit(page, `/${locale}/cart`, '.cart-line');
  await capture(page, locale, 'cart');
  await visit(page, `/${locale}/checkout`, '.checkout-form');
  await page.locator('.checkout-form input').nth(0).fill('Dara Screenshot');
  await page.locator('.checkout-form input').nth(1).fill(`screenshot-${locale}-${Date.now()}@example.test`);
  await page.locator('.checkout-form input').nth(2).fill('55501234');
  await page.locator('.checkout-form textarea').fill('Block 3, Street 12, Kuwait City');
  await capture(page, locale, 'checkout');
  await page.locator('.checkout-form button.button').click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/order/`));
  await expect(page.locator('.order-box strong')).toContainText('DR-');
  await capture(page, locale, 'order');
  await visit(page, `/${locale}/story`, '.story-hero h1');
  await capture(page, locale, 'story');
  await visit(page, `/${locale}/account`, '.account-panel');
  await capture(page, locale, 'account');
  await admin(page, locale);
  await context.close();
}

async function mobile(locale) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await visit(page, `/${locale}`, '.hero h1');
  await capture(page, locale, 'home', true);
  await visit(page, `/${locale}/shop`, '.product-card');
  await capture(page, locale, 'shop', true);
  await visit(page, `/${locale}/product/safa-lounge-chair`, '.detail-content h1');
  await capture(page, locale, 'product', true);
  await page.locator('.add-to-bag').click();
  await visit(page, `/${locale}/cart`, '.cart-line');
  await capture(page, locale, 'cart', true);
  await visit(page, `/${locale}/checkout`, '.checkout-form');
  await page.locator('.checkout-form input').nth(0).fill('Dara Screenshot');
  await page.locator('.checkout-form input').nth(1).fill(`mobile-${locale}@example.test`);
  await page.locator('.checkout-form input').nth(2).fill('55501234');
  await page.locator('.checkout-form textarea').fill('Block 3, Street 12, Kuwait City');
  await capture(page, locale, 'checkout', true);
  await admin(page, locale, true);
  await context.close();
}

try {
  for (const locale of ['en', 'ar']) await storefront(locale);
  for (const locale of ['en', 'ar']) await mobile(locale);
  const rows = desktopNames.map(([name, label]) => `| ${label} | [![${label} in English](./en/${name}.png)](./en/${name}.png) | [![${label} in Arabic](./ar/${name}.png)](./ar/${name}.png) |`).join('\n');
  const mobileRows = mobileNames.map(([name, label]) => `| ${label} | [![${label} on mobile in English](./en-mobile/${name}.png)](./en-mobile/${name}.png) | [![${label} on mobile in Arabic](./ar-mobile/${name}.png)](./ar-mobile/${name}.png) |`).join('\n');
  await writeFile(new URL('./README.md', root), `# Dara screenshots\n\nCaptured from the running local storefront and seeded API at 1440 × 900 on desktop and 390 × 844 on mobile. The order screens use simulated payments. Product detail and collection screenshots show representative routes.\n\n## Desktop pages\n\n| Page | English | Arabic |\n| --- | --- | --- |\n${rows}\n\n## Mobile views\n\n| Page | English | Arabic |\n| --- | --- | --- |\n${mobileRows}\n`);
} finally {
  await browser.close();
}
