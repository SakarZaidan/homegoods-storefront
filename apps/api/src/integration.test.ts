import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';

const base = process.env.TEST_API_URL;
const suite = base ? describe : describe.skip;
function client() {
  const cookies = new Map<string, string>();
  let token = '';
  const request = async (path: string, method = 'GET', body?: unknown) => {
    const response = await fetch(`${base}${path}`, { method, headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(cookies.size ? { cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; ') } : {}), ...(method === 'GET' ? {} : { 'x-csrf-token': token }) }, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const header of response.headers.getSetCookie()) { const [name, value] = header.split(';')[0].split('='); cookies.set(name, value); }
    const data = response.headers.get('content-type')?.includes('text/csv') ? await response.text() : await response.json();
    if (path === '/v1/auth/session') token = data.csrfToken;
    return { status: response.status, data };
  };
  return { request };
}

suite('live API, PostgreSQL and role contracts', () => {
  it('enforces roles, claims stock once and restores it once', async () => {
    const guest = client();
    const admin = client();
    await guest.request('/v1/auth/session');
    await admin.request('/v1/auth/session');
    const forbidden = await guest.request('/v1/admin/overview');
    expect(forbidden.status).toBe(401);
    const login = await admin.request('/v1/auth/login', 'POST', { email: process.env.SEED_ADMIN_EMAIL ?? 'admin@dara.local', password: process.env.SEED_ADMIN_PASSWORD });
    expect(login.status).toBe(200);
    await admin.request('/v1/auth/session');
    const product = await guest.request('/v1/catalog/products/safa-lounge-chair');
    expect(product.status).toBe(200);
    const variant = product.data.variants[0];
    const adjust = async (delta: number) => admin.request('/v1/admin/inventory/adjust', 'POST', { variantId: variant.id, delta, reason: 'integration verification' });
    expect((await adjust(1 - variant.stock)).status).toBe(200);
    const payload = { items: [{ variantId: variant.id, quantity: 1 }], email: `guest-${randomUUID()}@example.test`, name: 'Test Customer', phone: '55501234', address: 'Block 3, Street 12, Kuwait City' };
    const [first, second] = await Promise.all([guest.request('/v1/checkout', 'POST', { ...payload, idempotencyKey: randomUUID() }), guest.request('/v1/checkout', 'POST', { ...payload, idempotencyKey: randomUUID() })]);
    expect([first.status, second.status].sort()).toEqual([201, 409]);
    const winner = first.status === 201 ? first : second;
    const orderId = winner.data.order.id;
    expect(winner.data.paymentNotice).toContain('Simulated');
    expect(winner.data.trackingToken).toBeTruthy();
    expect((await guest.request(`/v1/orders/${orderId}`)).status).toBe(403);
    expect((await guest.request(`/v1/orders/${orderId}?token=${winner.data.trackingToken}`)).status).toBe(200);
    const cancelled = await admin.request(`/v1/admin/orders/${orderId}`, 'PATCH', { status: 'cancelled' });
    expect(cancelled.status).toBe(200);
    expect((await admin.request(`/v1/admin/orders/${orderId}`, 'PATCH', { status: 'cancelled' })).status).toBe(200);
    const restored = await guest.request('/v1/catalog/products/safa-lounge-chair');
    expect(restored.data.variants.find((v: any) => v.id === variant.id).stock).toBe(1);
    expect((await adjust(variant.stock - 1)).status).toBe(200);
    const audit = await admin.request('/v1/admin/audit');
    expect(audit.data.some((event: any) => event.action === 'order.status')).toBe(true);
  }, 30000);
  it('returns the same order for a repeated idempotency key', async () => {
    const guest = client(); await guest.request('/v1/auth/session');
    const product = await guest.request('/v1/catalog/products/dara-clay-vessel');
    const variant = product.data.variants[0];
    const key = randomUUID();
    const payload = { items: [{ variantId: variant.id, quantity: 1 }], email: `guest-${randomUUID()}@example.test`, name: 'Test Customer', phone: '55501234', address: 'Block 3, Street 12, Kuwait City', idempotencyKey: key };
    const first = await guest.request('/v1/checkout', 'POST', payload);
    const second = await guest.request('/v1/checkout', 'POST', payload);
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.data.reused).toBe(true);
    expect(second.data.order.id).toBe(first.data.order.id);
  }, 30000);
  it('enforces catalog roles and supports product, variant, image, CSV and promotion workflows', async () => {
    const customer = client(); await customer.request('/v1/auth/session');
    const registration = await customer.request('/v1/auth/register', 'POST', { email: `customer-${randomUUID()}@example.test`, name: 'Test Customer', password: 'StrongPassword123!' });
    expect(registration.status).toBe(200);
    await customer.request('/v1/auth/session');
    expect((await customer.request('/v1/admin/products')).status).toBe(403);
    const admin = client(); await admin.request('/v1/auth/session');
    expect((await admin.request('/v1/auth/login', 'POST', { email: process.env.SEED_ADMIN_EMAIL ?? 'admin@dara.local', password: process.env.SEED_ADMIN_PASSWORD })).status).toBe(200);
    await admin.request('/v1/auth/session');
    const slug = `studio-test-${randomUUID().slice(0, 8)}`;
    const product = await admin.request('/v1/admin/products', 'POST', { slug, nameEn: 'Studio Test Vase', nameAr: 'مزهرية تجربة الاستوديو', descriptionEn: 'Catalog workflow test piece.', descriptionAr: 'قطعة لاختبار عمل الكتالوج.', category: 'decor', imageUrl: '/images/dara-vessel.png', featured: false });
    expect(product.status).toBe(200);
    const variant = await admin.request(`/v1/admin/products/${product.data.id}/variants`, 'POST', { sku: `SKU-${slug}`, labelEn: 'Natural / Medium', labelAr: 'طبيعي / متوسط', priceFils: 12000, stock: 8 });
    expect(variant.status).toBe(200);
    expect((await admin.request(`/v1/admin/variants/${variant.data.id}`, 'PATCH', { priceFils: 12500 })).status).toBe(200);
    const image = await admin.request(`/v1/admin/products/${product.data.id}/images`, 'POST', { url: '/images/dara-vessel.png', altEn: 'Studio test vase', altAr: 'مزهرية التجربة', position: 1 });
    expect(image.status).toBe(200);
    expect((await admin.request(`/v1/admin/images/${image.data.id}`, 'DELETE')).status).toBe(200);
    const imported = await admin.request('/v1/admin/catalog/import', 'POST', { rows: [{ sku: variant.data.sku, priceFils: 13000, stock: 6 }] });
    expect(imported.data.updated).toBe(1);
    const quote = await customer.request('/v1/cart/quote', 'POST', { items: [{ variantId: variant.data.id, quantity: 1 }] });
    expect(quote.data.totalFils).toBe(16000);
    const csv = await admin.request('/v1/admin/catalog.csv');
    expect(csv.status).toBe(200);
    expect(csv.data).toContain(variant.data.sku);
    const promotion = await admin.request('/v1/admin/promotions', 'POST', { code: `TEST${randomUUID().slice(0, 8).toUpperCase()}`, percentOff: 15, active: true });
    expect(promotion.status).toBe(200);
    expect((await customer.request('/v1/admin/promotions')).status).toBe(403);
  }, 30000);
});
