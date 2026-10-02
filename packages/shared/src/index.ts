import { z } from 'zod';

export const localeSchema = z.enum(['en', 'ar']);
export type Locale = z.infer<typeof localeSchema>;
export const roleSchema = z.enum(['customer', 'catalog', 'fulfillment', 'admin']);
export type Role = z.infer<typeof roleSchema>;
export const cartItemSchema = z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1).max(50) });
export const quoteSchema = z.object({ items: z.array(cartItemSchema).min(1).max(50), promotionCode: z.string().trim().max(40).optional() });
export const checkoutSchema = quoteSchema.extend({ email: z.email(), name: z.string().trim().min(2).max(120), phone: z.string().trim().min(7).max(30), address: z.string().trim().min(10).max(500), idempotencyKey: z.string().uuid() });
export const productInputSchema = z.object({ slug: z.string().regex(/^[a-z0-9-]+$/), nameEn: z.string().min(2).max(160), nameAr: z.string().min(2).max(160), descriptionEn: z.string().max(2000), descriptionAr: z.string().max(2000), category: z.string().min(2).max(80), imageUrl: z.url().or(z.string().startsWith('/')), featured: z.boolean().default(false) });
export const variantInputSchema = z.object({ sku: z.string().min(3).max(80), labelEn: z.string().min(2).max(80), labelAr: z.string().min(2).max(80), priceFils: z.number().int().min(0), stock: z.number().int().min(0) });
export const catalogCardSchema = z.object({ id: z.uuid(), slug: z.string(), nameEn: z.string(), nameAr: z.string(), descriptionEn: z.string(), descriptionAr: z.string(), imageUrl: z.string(), featured: z.boolean(), category: z.string().nullable(), collection: z.string().nullable(), minPriceFils: z.number().int().nonnegative(), stock: z.number().int().nonnegative() }).passthrough();
export const catalogPageSchema = z.object({ items: z.array(catalogCardSchema), page: z.number().int().positive(), hasMore: z.boolean() });
export const productDetailSchema = z.object({ id: z.uuid(), slug: z.string(), nameEn: z.string(), nameAr: z.string(), variants: z.array(z.object({ id: z.uuid(), sku: z.string(), labelEn: z.string(), labelAr: z.string(), priceFils: z.number().int().nonnegative(), stock: z.number().int().nonnegative() }).passthrough()), images: z.array(z.object({ id: z.uuid(), url: z.string(), altEn: z.string(), altAr: z.string() }).passthrough()) }).passthrough();
export const quoteResultSchema = z.object({ lines: z.array(z.object({ variantId: z.uuid(), priceFils: z.number().int().nonnegative(), quantity: z.number().int().positive(), stock: z.number().int().nonnegative() }).passthrough()), promotionCode: z.string().nullable(), subtotalFils: z.number().int().nonnegative(), discountFils: z.number().int().nonnegative(), deliveryFils: z.number().int().nonnegative(), totalFils: z.number().int().nonnegative() }).passthrough();
export const checkoutResultSchema = z.object({ order: z.object({ id: z.uuid(), orderNumber: z.string(), status: z.string(), totalFils: z.number().int().nonnegative() }).passthrough(), reused: z.boolean(), trackingToken: z.string().optional(), paymentNotice: z.string().optional() });
export type CartItem = z.infer<typeof cartItemSchema>;
export const money = (fils: number, locale: Locale = 'en') => `${(fils / 1000).toFixed(3)} ${locale === 'ar' ? 'د.ك' : 'KWD'}`;
export const tokens = { limestone: '#f4f0e7', ivory: '#faf8f2', olive: '#333b2b', clay: '#8e4935', ink: '#292b25', muted: '#61675a' } as const;
