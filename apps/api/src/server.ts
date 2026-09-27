import Fastify, { type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import argon2 from 'argon2';
import { createHmac, randomBytes } from 'node:crypto';
import { and, desc, eq, gte, ilike, inArray, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { catalogPageSchema, checkoutResultSchema, checkoutSchema, productDetailSchema, productInputSchema, quoteResultSchema, quoteSchema, variantInputSchema } from '@dara/shared';
import { db, pool } from './db.js';
import { auditEvents, categories, collections, emailPreviews, inventoryEvents, orderItems, orders, payments, productImages, products, promotions, sessions, stockMovements, users, variants } from './schema.js';
import { calculateTotals } from './pricing.js';
import { sendOrderEmail } from './email.js';

const app = Fastify({ logger: true, bodyLimit: 1024 * 1024 });
await app.register(cookie);
await app.register(cors, { origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000', credentials: true });
await app.register(rateLimit, { max: 600, timeWindow: '1 minute' });
await app.register(swagger, { openapi: { info: { title: 'Dara API', version: '1.0.0', description: 'Kuwait home goods demo API. Payments are simulated.' }, servers: [{ url: 'http://localhost:4000' }] } });
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) throw new Error('SESSION_SECRET is required in production');
const hash = (value: string) => createHmac('sha256', process.env.SESSION_SECRET ?? 'dara-local-development-secret').update(value).digest('hex');
const secureCookie = process.env.NODE_ENV === 'production';
const bodyObject = { type: 'object' } as const;
type Actor = { id: string; role: string; email: string; csrfToken: string };

async function actor(request: FastifyRequest): Promise<Actor | null> {
  const token = request.cookies.dara_session;
  if (!token) return null;
  const row = await db.select({ id: users.id, role: users.role, email: users.email, csrfToken: sessions.csrfToken }).from(sessions).innerJoin(users, eq(users.id, sessions.userId)).where(and(eq(sessions.tokenHash, hash(token)), gte(sessions.expiresAt, new Date()))).limit(1);
  return row[0] ?? null;
}
async function requireRole(request: FastifyRequest, roles: string[]) {
  const user = await actor(request);
  if (!user) throw Object.assign(new Error('Sign in required'), { statusCode: 401 });
  if (!roles.includes(user.role)) throw Object.assign(new Error('Permission denied'), { statusCode: 403 });
  return user;
}
function csrf(request: FastifyRequest, user?: Actor | null) {
  const origin = request.headers.origin;
  if (origin && origin !== (process.env.WEB_ORIGIN ?? 'http://localhost:3000')) throw Object.assign(new Error('Invalid origin'), { statusCode: 403 });
  const supplied = request.headers['x-csrf-token'];
  const expected = user?.csrfToken ?? request.cookies.dara_csrf;
  if (!expected || supplied !== expected) throw Object.assign(new Error('Invalid CSRF token'), { statusCode: 403 });
}
async function audit(actorId: string | null, action: string, subject: string, details: object = {}) { await db.insert(auditEvents).values({ actorId, action, subject, details }); }
function parse<T>(schema: z.ZodType<T>, value: unknown): T { const result = schema.safeParse(value); if (!result.success) throw Object.assign(new Error(z.prettifyError(result.error)), { statusCode: 400 }); return result.data; }
app.setErrorHandler((error, _request, reply) => { const failure = error as Error & { statusCode?: number }; const status = failure.statusCode && failure.statusCode >= 400 && failure.statusCode < 500 ? failure.statusCode : 500; if (status === 500) app.log.error(error); reply.status(status).send({ error: status === 500 ? 'Internal server error' : failure.message }); });

app.get('/health', async () => ({ ok: true }));
app.get('/openapi.json', async () => app.swagger());
app.get('/v1/auth/session', async (request, reply) => {
  const user = await actor(request);
  if (user) return { user: { id: user.id, email: user.email, role: user.role }, csrfToken: user.csrfToken };
  const token = request.cookies.dara_csrf ?? randomBytes(24).toString('hex');
  reply.setCookie('dara_csrf', token, { path: '/', sameSite: 'lax', secure: secureCookie, httpOnly: false, maxAge: 86400 });
  return { user: null, csrfToken: token };
});
app.post('/v1/auth/register', { schema: { body: bodyObject }, config: { rateLimit: { max: 8, timeWindow: '1 hour' } } }, async (request, reply) => {
  csrf(request);
  const data = parse(z.object({ email: z.email(), name: z.string().min(2).max(120), password: z.string().min(12).max(200) }), request.body);
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, data.email.toLowerCase())).limit(1);
  if (existing.length) return reply.status(409).send({ error: 'Email already registered' });
  const [user] = await db.insert(users).values({ email: data.email.toLowerCase(), name: data.name, passwordHash: await argon2.hash(data.password) }).returning();
  await createSession(user.id, reply);
  await audit(user.id, 'auth.register', user.id);
  return { user: { id: user.id, email: user.email, role: user.role } };
});
app.post('/v1/auth/login', { schema: { body: bodyObject }, config: { rateLimit: { max: 20, timeWindow: '15 minutes' } } }, async (request, reply) => {
  csrf(request);
  const data = parse(z.object({ email: z.email(), password: z.string() }), request.body);
  const [user] = await db.select().from(users).where(eq(users.email, data.email.toLowerCase())).limit(1);
  if (!user || !(await argon2.verify(user.passwordHash, data.password))) return reply.status(401).send({ error: 'Invalid credentials' });
  if (request.cookies.dara_session) await db.delete(sessions).where(eq(sessions.tokenHash, hash(request.cookies.dara_session)));
  await createSession(user.id, reply);
  await audit(user.id, 'auth.login', user.id);
  return { user: { id: user.id, email: user.email, role: user.role } };
});
async function createSession(userId: string, reply: any) {
  const token = randomBytes(32).toString('base64url');
  const csrfToken = randomBytes(24).toString('hex');
  await db.insert(sessions).values({ userId, tokenHash: hash(token), csrfToken, expiresAt: new Date(Date.now() + 7 * 86400000) });
  reply.setCookie('dara_session', token, { path: '/', sameSite: 'lax', secure: secureCookie, httpOnly: true, maxAge: 604800 });
  reply.setCookie('dara_csrf', csrfToken, { path: '/', sameSite: 'lax', secure: secureCookie, httpOnly: false, maxAge: 604800 });
}
app.post('/v1/auth/logout', async (request, reply) => { const user = await actor(request); csrf(request, user); if (request.cookies.dara_session) await db.delete(sessions).where(eq(sessions.tokenHash, hash(request.cookies.dara_session))); reply.clearCookie('dara_session', { path: '/' }); return { ok: true }; });

app.get('/v1/catalog/categories', async () => db.select().from(categories).orderBy(categories.nameEn));
app.get('/v1/catalog/collections', async () => db.select().from(collections).orderBy(collections.nameEn));
app.get('/v1/catalog/products', { schema: { querystring: { type: 'object', properties: { q: { type: 'string' }, category: { type: 'string' }, collection: { type: 'string' }, sort: { type: 'string' }, page: { type: 'string' }, featured: { type: 'string' } } } } }, async request => {
  const q = request.query as Record<string, string>;
  const page = Math.max(1, Math.min(1000, Number(q.page) || 1));
  const filters = [eq(products.active, true)];
  if (q.q) filters.push(or(ilike(products.nameEn, `%${q.q.slice(0, 80)}%`), ilike(products.nameAr, `%${q.q.slice(0, 80)}%`))!);
  if (q.category) filters.push(eq(categories.slug, q.category));
  if (q.collection) filters.push(eq(collections.slug, q.collection));
  if (q.featured === 'true') filters.push(eq(products.featured, true));
  const rows = await db.select({ id: products.id, slug: products.slug, nameEn: products.nameEn, nameAr: products.nameAr, descriptionEn: products.descriptionEn, descriptionAr: products.descriptionAr, imageUrl: products.imageUrl, featured: products.featured, category: categories.slug, collection: collections.slug, minPriceFils: sql<number>`min(${variants.priceFils})::int`, stock: sql<number>`sum(${variants.stock})::int` }).from(products).leftJoin(categories, eq(products.categoryId, categories.id)).leftJoin(collections, eq(products.collectionId, collections.id)).innerJoin(variants, and(eq(variants.productId, products.id), eq(variants.active, true))).where(and(...filters)).groupBy(products.id, categories.slug, collections.slug).orderBy(q.sort === 'price-asc' ? sql`min(${variants.priceFils}) asc` : q.sort === 'price-desc' ? sql`min(${variants.priceFils}) desc` : desc(products.featured), desc(products.createdAt)).limit(200).offset((page - 1) * 200);
  return catalogPageSchema.parse({ items: rows, page, hasMore: rows.length === 200 });
});
app.get('/v1/catalog/products/:slug', async (request, reply) => {
  const { slug } = request.params as { slug: string };
  const [product] = await db.select().from(products).where(and(eq(products.slug, slug), eq(products.active, true))).limit(1);
  if (!product) return reply.status(404).send({ error: 'Product not found' });
  return productDetailSchema.parse({ ...product, variants: await db.select().from(variants).where(and(eq(variants.productId, product.id), eq(variants.active, true))).orderBy(variants.sku), images: await db.select().from(productImages).where(eq(productImages.productId, product.id)).orderBy(productImages.position) });
});
async function quote(input: z.infer<typeof quoteSchema>, client: any = db, lock = false) {
  const requested = new Map(input.items.map(item => [item.variantId, item.quantity]));
  if (requested.size !== input.items.length) throw Object.assign(new Error('Duplicate cart item'), { statusCode: 400 });
  const query = client.select({ variantId: variants.id, productId: products.id, sku: variants.sku, labelEn: variants.labelEn, labelAr: variants.labelAr, priceFils: variants.priceFils, stock: variants.stock, nameEn: products.nameEn, nameAr: products.nameAr, imageUrl: products.imageUrl }).from(variants).innerJoin(products, eq(variants.productId, products.id)).where(and(inArray(variants.id, [...requested.keys()]), eq(variants.active, true), eq(products.active, true))).orderBy(variants.id);
  const rows: { variantId: string; productId: string; sku: string; labelEn: string; labelAr: string; priceFils: number; stock: number; nameEn: string; nameAr: string; imageUrl: string }[] = lock ? await query.for('update', { of: variants }) : await query;
  if (rows.length !== requested.size) throw Object.assign(new Error('A cart item is no longer available'), { statusCode: 409 });
  const lines = rows.map(row => ({ ...row, quantity: requested.get(row.variantId)! }));
  if (lines.some(line => line.stock < line.quantity)) throw Object.assign(new Error('Insufficient stock'), { statusCode: 409 });
  const now = new Date();
  const [promo] = input.promotionCode ? await client.select().from(promotions).where(and(eq(promotions.code, input.promotionCode.toUpperCase()), eq(promotions.active, true))).limit(1) : [];
  if (input.promotionCode && (!promo || (promo.startsAt && promo.startsAt > now) || (promo.endsAt && promo.endsAt < now))) throw Object.assign(new Error('Promotion code is not valid'), { statusCode: 400 });
  return { lines, promotionCode: promo?.code ?? null, ...calculateTotals(lines, promo?.percentOff ?? 0) };
}
app.post('/v1/cart/quote', { schema: { body: bodyObject } }, async request => quoteResultSchema.parse(await quote(parse(quoteSchema, request.body))));
app.post('/v1/checkout', { schema: { body: bodyObject }, config: { rateLimit: { max: 12, timeWindow: '15 minutes' } } }, async (request, reply) => {
  const user = await actor(request); csrf(request, user);
  const data = parse(checkoutSchema, request.body);
  const [prior] = await db.select().from(orders).where(eq(orders.idempotencyKey, data.idempotencyKey)).limit(1);
  if (prior) return reply.send(checkoutResultSchema.parse({ order: publicOrder(prior), reused: true }));
  const trackingToken = randomBytes(24).toString('base64url');
  let reused = false;
  try {
    const order = await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${data.idempotencyKey}))`);
      const [existing] = await tx.select().from(orders).where(eq(orders.idempotencyKey, data.idempotencyKey)).limit(1);
      if (existing) { reused = true; return existing; }
      const current = await quote(data, tx, true);
      const [created] = await tx.insert(orders).values({ orderNumber: `DR-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`, userId: user?.id ?? null, email: data.email.toLowerCase(), name: data.name, phone: data.phone, address: data.address, trackingTokenHash: hash(trackingToken), status: 'placed', subtotalFils: current.subtotalFils, discountFils: current.discountFils, deliveryFils: current.deliveryFils, totalFils: current.totalFils, promotionCode: current.promotionCode, idempotencyKey: data.idempotencyKey }).returning();
      for (const line of current.lines) {
        const [claimed] = await tx.update(variants).set({ stock: sql`${variants.stock} - ${line.quantity}` }).where(and(eq(variants.id, line.variantId), gte(variants.stock, line.quantity))).returning({ stock: variants.stock });
        if (!claimed) throw Object.assign(new Error('Stock changed during checkout'), { statusCode: 409 });
        await tx.insert(orderItems).values({ orderId: created.id, variantId: line.variantId, sku: line.sku, nameEn: line.nameEn, nameAr: line.nameAr, labelEn: line.labelEn, labelAr: line.labelAr, quantity: line.quantity, unitPriceFils: line.priceFils });
        await tx.insert(stockMovements).values({ variantId: line.variantId, delta: -line.quantity, reason: 'checkout', orderId: created.id, actorId: user?.id ?? null });
        await tx.insert(inventoryEvents).values({ variantId: line.variantId, stock: claimed.stock });
      }
      await tx.insert(payments).values({ orderId: created.id, amountFils: current.totalFils, provider: 'simulation', status: 'simulated_paid' });
      await tx.insert(auditEvents).values({ actorId: user?.id ?? null, action: 'order.placed', subject: created.id, details: { simulatedPayment: true } });
      return created;
    });
    if (!reused) void sendOrderEmail(order.email, order.orderNumber, order.totalFils).catch(error => app.log.error(error));
    if (reused) return reply.send(checkoutResultSchema.parse({ order: publicOrder(order), reused: true }));
    return reply.status(201).send(checkoutResultSchema.parse({ order: publicOrder(order), trackingToken, reused: false, paymentNotice: 'Simulated payment — no card charged' }));
  } catch (error: any) {
    if (error?.code === '23505') { const [existing] = await db.select().from(orders).where(eq(orders.idempotencyKey, data.idempotencyKey)).limit(1); if (existing) return checkoutResultSchema.parse({ order: publicOrder(existing), reused: true }); }
    throw error;
  }
});
app.get('/v1/orders/:id', async (request, reply) => {
  const user = await actor(request);
  const { id } = request.params as { id: string };
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return reply.status(404).send({ error: 'Order not found' });
  const token = (request.query as { token?: string }).token;
  if (!((user && (user.id === order.userId || user.role === 'admin' || user.role === 'fulfillment')) || (token && hash(token) === order.trackingTokenHash))) return reply.status(403).send({ error: 'Order access denied' });
  return { order: publicOrder(order), items: await db.select().from(orderItems).where(eq(orderItems.orderId, id)) };
});
function publicOrder<T extends { trackingTokenHash: string }>(order: T): Omit<T, 'trackingTokenHash'> { const { trackingTokenHash: _secret, ...safe } = order; return safe; }
app.get('/v1/orders', async request => { const user = await requireRole(request, ['customer', 'catalog', 'fulfillment', 'admin']); return (await db.select().from(orders).where(eq(orders.userId, user.id)).orderBy(desc(orders.createdAt)).limit(50)).map(publicOrder); });

app.get('/v1/admin/overview', async request => {
  const user = await requireRole(request, ['catalog', 'fulfillment', 'admin']);
  const [metrics] = await db.select({ orders: sql<number>`count(*)::int`, revenueFils: sql<number>`coalesce(sum(${orders.totalFils}),0)::int` }).from(orders).where(sql`${orders.status} <> 'cancelled'`);
  const [catalog] = await db.select({ products: sql<number>`count(*)::int` }).from(products);
  const [lowStock] = await db.select({ count: sql<number>`count(*)::int` }).from(variants).where(sql`${variants.stock} < 5`);
  return { ...(user.role === 'catalog' ? { orders: 0, revenueFils: 0 } : metrics), ...catalog, lowStock: lowStock.count, recentOrders: user.role === 'catalog' ? [] : (await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(8)).map(publicOrder) };
});
app.get('/v1/admin/products', async request => { await requireRole(request, ['catalog', 'admin']); return db.select({ id: products.id, slug: products.slug, nameEn: products.nameEn, nameAr: products.nameAr, descriptionEn: products.descriptionEn, descriptionAr: products.descriptionAr, imageUrl: products.imageUrl, featured: products.featured, category: categories.slug }).from(products).leftJoin(categories, eq(products.categoryId, categories.id)).orderBy(desc(products.createdAt)).limit(200); });
app.post('/v1/admin/products', { schema: { body: bodyObject } }, async request => {
  const user = await requireRole(request, ['catalog', 'admin']); csrf(request, user);
  const data = parse(productInputSchema, request.body);
  const [category] = await db.select().from(categories).where(eq(categories.slug, data.category)).limit(1);
  if (!category) throw Object.assign(new Error('Unknown category'), { statusCode: 400 });
  const [product] = await db.insert(products).values({ ...data, categoryId: category.id }).returning();
  await audit(user.id, 'product.create', product.id, data);
  return product;
});
app.patch('/v1/admin/products/:id', { schema: { body: bodyObject } }, async request => {
  const user = await requireRole(request, ['catalog', 'admin']); csrf(request, user);
  const data = parse(productInputSchema.partial(), request.body);
  const { category, ...fields } = data;
  const [categoryRow] = category ? await db.select().from(categories).where(eq(categories.slug, category)).limit(1) : [];
  if (category && !categoryRow) throw Object.assign(new Error('Unknown category'), { statusCode: 400 });
  const [product] = await db.update(products).set({ ...fields, ...(categoryRow ? { categoryId: categoryRow.id } : {}) }).where(eq(products.id, (request.params as { id: string }).id)).returning();
  if (!product) throw Object.assign(new Error('Product not found'), { statusCode: 404 });
  await audit(user.id, 'product.update', product.id, data);
  return product;
});
app.post('/v1/admin/products/:id/images', { schema: { body: bodyObject } }, async request => {
  const user = await requireRole(request, ['catalog', 'admin']); csrf(request, user);
  const data = parse(z.object({ url: z.url().or(z.string().startsWith('/')), altEn: z.string().min(2), altAr: z.string().min(2), position: z.number().int().min(0).default(0) }), request.body);
  const [image] = await db.insert(productImages).values({ ...data, productId: (request.params as { id: string }).id }).returning();
  await audit(user.id, 'product.image.add', image.id);
  return image;
});
app.delete('/v1/admin/images/:id', async request => {
  const user = await requireRole(request, ['catalog', 'admin']); csrf(request, user);
  const [image] = await db.delete(productImages).where(eq(productImages.id, (request.params as { id: string }).id)).returning();
  if (!image) throw Object.assign(new Error('Image not found'), { statusCode: 404 });
  await audit(user.id, 'product.image.delete', image.id, { productId: image.productId });
  return { ok: true };
});
app.post('/v1/admin/products/:id/variants', { schema: { body: bodyObject } }, async request => {
  const user = await requireRole(request, ['catalog', 'admin']); csrf(request, user);
  const data = parse(variantInputSchema, request.body);
  const [variant] = await db.insert(variants).values({ ...data, productId: (request.params as { id: string }).id }).returning();
  await audit(user.id, 'variant.create', variant.id);
  return variant;
});
app.patch('/v1/admin/variants/:id', { schema: { body: bodyObject } }, async request => {
  const user = await requireRole(request, ['catalog', 'admin']); csrf(request, user);
  const data = parse(variantInputSchema.omit({ stock: true }).partial(), request.body);
  const [variant] = await db.update(variants).set(data).where(eq(variants.id, (request.params as { id: string }).id)).returning();
  if (!variant) throw Object.assign(new Error('Variant not found'), { statusCode: 404 });
  await audit(user.id, 'variant.update', variant.id, data);
  return variant;
});
app.post('/v1/admin/inventory/adjust', { schema: { body: bodyObject } }, async request => {
  const user = await requireRole(request, ['catalog', 'admin']); csrf(request, user);
  const data = parse(z.object({ variantId: z.uuid(), delta: z.number().int().min(-10000).max(10000), reason: z.string().min(3).max(200) }), request.body);
  return db.transaction(async tx => {
    const [variant] = await tx.update(variants).set({ stock: sql`${variants.stock} + ${data.delta}` }).where(and(eq(variants.id, data.variantId), gte(variants.stock, -data.delta))).returning();
    if (!variant) throw Object.assign(new Error('Insufficient stock or unknown variant'), { statusCode: 409 });
    await tx.insert(stockMovements).values({ variantId: variant.id, delta: data.delta, reason: data.reason, actorId: user.id });
    await tx.insert(inventoryEvents).values({ variantId: variant.id, stock: variant.stock });
    await tx.insert(auditEvents).values({ actorId: user.id, action: 'inventory.adjust', subject: variant.id, details: data });
    return variant;
  });
});
app.get('/v1/admin/orders', async request => { await requireRole(request, ['fulfillment', 'admin']); return (await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(100)).map(publicOrder); });
app.patch('/v1/admin/orders/:id', { schema: { body: bodyObject } }, async request => {
  const user = await requireRole(request, ['fulfillment', 'admin']); csrf(request, user);
  const { status } = parse(z.object({ status: z.enum(['placed', 'packing', 'shipped', 'delivered', 'cancelled']) }), request.body);
  const orderId = (request.params as { id: string }).id;
  return db.transaction(async tx => {
    const [current] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
    if (!current) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
    if (current.status === 'cancelled' && status !== 'cancelled') throw Object.assign(new Error('Cancelled orders cannot be reopened'), { statusCode: 409 });
    if (status === 'cancelled' && !current.stockRestored) {
      const lines = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
      for (const line of lines) {
        const [variant] = await tx.update(variants).set({ stock: sql`${variants.stock} + ${line.quantity}` }).where(eq(variants.id, line.variantId)).returning();
        await tx.insert(stockMovements).values({ variantId: line.variantId, delta: line.quantity, reason: 'order_cancelled', orderId, actorId: user.id });
        await tx.insert(inventoryEvents).values({ variantId: line.variantId, stock: variant.stock });
      }
    }
    const [updated] = await tx.update(orders).set({ status, stockRestored: status === 'cancelled' ? true : current.stockRestored }).where(eq(orders.id, orderId)).returning();
    if (status === 'cancelled') await tx.update(payments).set({ status: 'simulated_refunded' }).where(eq(payments.orderId, orderId));
    await tx.insert(auditEvents).values({ actorId: user.id, action: 'order.status', subject: orderId, details: { from: current.status, to: status } });
    return publicOrder(updated);
  });
});
app.get('/v1/admin/promotions', async request => { await requireRole(request, ['admin']); return db.select().from(promotions); });
app.post('/v1/admin/promotions', { schema: { body: bodyObject } }, async request => { const user = await requireRole(request, ['admin']); csrf(request, user); const data = parse(z.object({ code: z.string().regex(/^[A-Z0-9_-]{3,40}$/), percentOff: z.number().int().min(1).max(80), active: z.boolean().default(true) }), request.body); const [promotion] = await db.insert(promotions).values(data).returning(); await audit(user.id, 'promotion.create', promotion.id, data); return promotion; });
app.get('/v1/admin/audit', async request => { await requireRole(request, ['admin']); return db.select().from(auditEvents).orderBy(desc(auditEvents.createdAt)).limit(100); });
app.get('/v1/admin/email-previews', async request => { await requireRole(request, ['admin']); return db.select().from(emailPreviews).orderBy(desc(emailPreviews.createdAt)).limit(30); });
app.get('/v1/admin/catalog.csv', async (request, reply) => {
  await requireRole(request, ['catalog', 'admin']);
  const rows = await db.select({ slug: products.slug, nameEn: products.nameEn, nameAr: products.nameAr, sku: variants.sku, labelEn: variants.labelEn, labelAr: variants.labelAr, priceFils: variants.priceFils, stock: variants.stock }).from(variants).innerJoin(products, eq(variants.productId, products.id));
  const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = ['slug,nameEn,nameAr,sku,labelEn,labelAr,priceFils,stock', ...rows.map(row => Object.values(row).map(escape).join(','))].join('\n');
  reply.header('content-type', 'text/csv; charset=utf-8').header('content-disposition', 'attachment; filename="dara-catalog.csv"');
  return csv;
});
app.post('/v1/admin/catalog/import', { schema: { body: bodyObject } }, async request => {
  const user = await requireRole(request, ['catalog', 'admin']); csrf(request, user);
  const { rows } = parse(z.object({ rows: z.array(z.object({ sku: z.string(), priceFils: z.number().int().min(0), stock: z.number().int().min(0) })).max(5000) }), request.body);
  let updated = 0;
  await db.transaction(async tx => { for (const row of rows) { const [variant] = await tx.update(variants).set({ priceFils: row.priceFils, stock: row.stock }).where(eq(variants.sku, row.sku)).returning(); if (variant) { updated++; await tx.insert(inventoryEvents).values({ variantId: variant.id, stock: variant.stock }); } } await tx.insert(auditEvents).values({ actorId: user.id, action: 'catalog.import', subject: 'variants', details: { submitted: rows.length, updated } }); });
  return { updated };
});
app.get('/v1/events/inventory', async (request, reply) => {
  reply.hijack();
  reply.raw.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'access-control-allow-origin': process.env.WEB_ORIGIN ?? 'http://localhost:3000', 'access-control-allow-credentials': 'true' });
  let cursor = typeof request.headers['last-event-id'] === 'string' ? request.headers['last-event-id'] : (request.query as { after?: string }).after;
  if (cursor && !z.uuid().safeParse(cursor).success) cursor = undefined;
  if (!cursor) {
    const [latest] = await db.select({ id: inventoryEvents.id }).from(inventoryEvents).orderBy(desc(inventoryEvents.createdAt), desc(inventoryEvents.id)).limit(1);
    cursor = latest?.id;
  }
  let busy = false;
  const tick = async () => { if (busy || reply.raw.destroyed) return; busy = true; try { const events = await db.select().from(inventoryEvents).where(cursor ? sql`(${inventoryEvents.createdAt}, ${inventoryEvents.id}) > (select created_at, id from inventory_events where id = ${cursor}::uuid)` : sql`true`).orderBy(inventoryEvents.createdAt, inventoryEvents.id).limit(100); for (const event of events) { reply.raw.write(`id: ${event.id}\nevent: inventory\ndata: ${JSON.stringify({ variantId: event.variantId, stock: event.stock })}\n\n`); cursor = event.id; } reply.raw.write(': keepalive\n\n'); } catch (error) { app.log.error(error); } finally { busy = false; } };
  await tick(); const interval = setInterval(tick, 3000); request.raw.on('close', () => clearInterval(interval));
});

const port = Number(process.env.API_PORT ?? 4000);
await app.listen({ port, host: '0.0.0.0' });
process.on('SIGTERM', async () => { await app.close(); await pool.end(); });
