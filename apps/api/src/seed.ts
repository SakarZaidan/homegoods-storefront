import argon2 from 'argon2';
import { db, pool } from './db.js';
import { categories, collections, productImages, products, promotions, users, variants } from './schema.js';

const categoryData = [
  { slug: 'living', nameEn: 'Living', nameAr: 'غرفة المعيشة' },
  { slug: 'lighting', nameEn: 'Lighting', nameAr: 'الإضاءة' },
  { slug: 'tableware', nameEn: 'Tableware', nameAr: 'أدوات المائدة' },
  { slug: 'textiles', nameEn: 'Textiles', nameAr: 'المنسوجات' },
  { slug: 'decor', nameEn: 'Objects & décor', nameAr: 'القطع والديكور' }
];
const collectionData = [
  { slug: 'the-slow-room', nameEn: 'The Slow Room', nameAr: 'الغرفة الهادئة', descriptionEn: 'Pieces for unhurried moments.', descriptionAr: 'قطع للحظات على مهل.' },
  { slug: 'after-the-sun', nameEn: 'After the Sun', nameAr: 'بعد الغروب', descriptionEn: 'A softer way to live with light.', descriptionAr: 'طريقة أكثر دفئاً للعيش مع الضوء.' },
  { slug: 'daily-rituals', nameEn: 'Daily Rituals', nameAr: 'طقوس يومية', descriptionEn: 'Everyday things, considered.', descriptionAr: 'تفاصيل يومية تستحق الاهتمام.' }
];
const images = [
  'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?w=1000&q=85',
  'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1000&q=85',
  'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1000&q=85',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1000&q=85',
  'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=1000&q=85',
  'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=1000&q=85',
  'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=1000&q=85',
  'https://images.unsplash.com/photo-1618220179428-22790b461013?w=1000&q=85',
  'https://images.unsplash.com/photo-1540574163026-643ea20ade25?w=1000&q=85',
  'https://images.unsplash.com/photo-1615874694520-474822394e73?w=1000&q=85',
  'https://images.unsplash.com/photo-1583845112203-29329902332e?w=1000&q=85',
  'https://images.unsplash.com/photo-1615874959474-d609969a20ed?w=1000&q=85'
];
const families: Record<string, { en: string; ar: string; base: number }[]> = {
  living: [
    { en: 'Safa Lounge Chair', ar: 'كرسي صفا', base: 179000 }, { en: 'Noura Side Table', ar: 'طاولة نورة الجانبية', base: 89000 }, { en: 'Jade Coffee Table', ar: 'طاولة جايد للقهوة', base: 225000 }, { en: 'Rimal Console', ar: 'طاولة رمال', base: 148000 }, { en: 'Mira Ottoman', ar: 'مسند ميرا', base: 72000 },
    { en: 'Wadi Bench', ar: 'مقعد وادي', base: 132000 }, { en: 'Dune Nesting Tables', ar: 'طاولات كثبان المتداخلة', base: 119000 }, { en: 'Ayla Shelf', ar: 'رف آيلا', base: 98000 }, { en: 'Tala Mirror', ar: 'مرآة تالا', base: 109000 }, { en: 'Noor Stool', ar: 'مقعد نور', base: 45000 }
  ],
  lighting: [
    { en: 'Masa Table Lamp', ar: 'مصباح ماسة', base: 59000 }, { en: 'Dawn Pendant', ar: 'ثريا الفجر', base: 124000 }, { en: 'Hala Floor Lamp', ar: 'مصباح هالة الأرضي', base: 97000 }, { en: 'Sundown Sconce', ar: 'مصباح الغروب الجداري', base: 49000 }, { en: 'Aria Lantern', ar: 'فانوس آريا', base: 38000 },
    { en: 'Amber Glow Lamp', ar: 'مصباح الوهج الكهرماني', base: 68000 }, { en: 'Lina Dome Pendant', ar: 'ثريا قبة لينا', base: 112000 }, { en: 'Sila Desk Light', ar: 'مصباح سيلا المكتبي', base: 51000 }, { en: 'Arc Reading Lamp', ar: 'مصباح آرك للقراءة', base: 75000 }, { en: 'Basin Wall Light', ar: 'مصباح باسين الجداري', base: 44000 }
  ],
  tableware: [
    { en: 'Tariq Serving Bowl', ar: 'وعاء تقديم طارق', base: 22500 }, { en: 'Sama Dinner Plates', ar: 'أطباق سما', base: 29500 }, { en: 'Oasis Tea Set', ar: 'طقم شاي الواحة', base: 42000 }, { en: 'Dalia Carafe', ar: 'إبريق داليا', base: 26000 }, { en: 'Pebble Breakfast Set', ar: 'طقم إفطار بيبل', base: 32500 },
    { en: 'Haze Espresso Cups', ar: 'أكواب هاز للإسبريسو', base: 18000 }, { en: 'Stoneware Platter', ar: 'طبق تقديم حجري', base: 34500 }, { en: 'Morrow Salad Bowl', ar: 'وعاء سلطة مورو', base: 27500 }, { en: 'Palm Glassware', ar: 'أكواب بالم الزجاجية', base: 24000 }, { en: 'Nile Dessert Plates', ar: 'أطباق حلوى نايل', base: 22000 }
  ],
  textiles: [
    { en: 'Linen Story Throw', ar: 'غطاء لينن ستوري', base: 49000 }, { en: 'Sahara Cushion', ar: 'وسادة الصحراء', base: 19000 }, { en: 'Olive Weave Rug', ar: 'سجادة النسج الزيتوني', base: 155000 }, { en: 'Cloud Cotton Duvet', ar: 'لحاف كلاود القطني', base: 86000 }, { en: 'Dune Linen Curtains', ar: 'ستائر كثبان الكتانية', base: 98000 },
    { en: 'Terrace Table Runner', ar: 'مفرش طاولة تيراس', base: 16000 }, { en: 'Mira Bath Towels', ar: 'مناشف ميرا', base: 22000 }, { en: 'Soft Hour Pillow', ar: 'وسادة سوفت آور', base: 24000 }, { en: 'Coast Cotton Blanket', ar: 'بطانية كوست القطنية', base: 62000 }, { en: 'Sundial Floor Cushion', ar: 'وسادة سنديال الأرضية', base: 41000 }
  ],
  decor: [
    { en: 'Dara Clay Vessel', ar: 'مزهرية دارا الفخارية', base: 34500 }, { en: 'Rihla Incense Holder', ar: 'حامل بخور رحلة', base: 22000 }, { en: 'Terra Sculpture', ar: 'منحوتة تيرا', base: 58000 }, { en: 'Quiet Form Vase', ar: 'مزهرية كوايت فورم', base: 31000 }, { en: 'Woven Palm Basket', ar: 'سلة سعف منسوجة', base: 28500 },
    { en: 'Limestone Bookends', ar: 'مساند كتب من الحجر الجيري', base: 39500 }, { en: 'Aria Candle', ar: 'شمعة آريا', base: 14000 }, { en: 'Sands Photo Frame', ar: 'إطار صور ساندز', base: 18500 }, { en: 'Crescent Tray', ar: 'صينية الهلال', base: 27500 }, { en: 'Nura Glass Vase', ar: 'مزهرية نورا الزجاجية', base: 32500 }
  ]
};
const moods = [
  { en: 'Natural', ar: 'طبيعي' }, { en: 'Stone', ar: 'حجري' }, { en: 'Olive', ar: 'زيتوني' }, { en: 'Clay', ar: 'طيني' }, { en: 'Sand', ar: 'رملي' }
];
const sizes = [
  { en: 'Small', ar: 'صغير', multiplier: 0.8 }, { en: 'Medium', ar: 'متوسط', multiplier: 1 }, { en: 'Large', ar: 'كبير', multiplier: 1.25 }, { en: 'Extra large', ar: 'كبير جداً', multiplier: 1.55 }
];
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const catalog = await db.select().from(categories);
if (catalog.length) { console.log('Seed already present; leaving existing data intact'); await pool.end(); process.exit(0); }
const insertedCategories = await db.insert(categories).values(categoryData).returning();
const insertedCollections = await db.insert(collections).values(collectionData).returning();
let productCount = 0;
let skuCount = 0;
for (const [categoryIndex, category] of insertedCategories.entries()) {
  const entries = families[category.slug];
  for (let i = 0; i < 25; i++) {
    const family = entries[i % entries.length];
    const edition = Math.floor(i / entries.length);
    const editionEn = ['',' Atelier',' Edition III'][edition];
    const editionAr = ['',' أتيليه',' الإصدار الثالث'][edition];
    const nameEn = `${family.en}${editionEn}`;
    const nameAr = `${family.ar}${editionAr}`;
    const imageUrl = ({ 'Safa Lounge Chair': '/images/safa-chair.png', 'Masa Table Lamp': '/images/masa-lamp.png', 'Dara Clay Vessel': '/images/dara-vessel.png' } as Record<string, string>)[nameEn] ?? images[(categoryIndex * 3 + i) % images.length];
    const [product] = await db.insert(products).values({ slug: slugify(nameEn), nameEn, nameAr, descriptionEn: `A considered piece for the everyday home. The ${nameEn} brings warm materials, quiet form, and lasting utility to your space.`, descriptionAr: `قطعة مدروسة للمنزل اليومي. يضيف ${nameAr} خامات دافئة وشكلاً هادئاً وعملياً إلى مساحتك.`, categoryId: category.id, collectionId: insertedCollections[(categoryIndex + i) % insertedCollections.length].id, imageUrl, featured: edition === 0 && i < 3 }).returning();
    await db.insert(productImages).values({ productId: product.id, url: imageUrl, altEn: nameEn, altAr: nameAr, position: 0 });
    const values = moods.flatMap((mood, moodIndex) => sizes.map((size, sizeIndex) => ({ productId: product.id, sku: `DR-${String(categoryIndex + 1).padStart(2, '0')}-${String(i + 1).padStart(3, '0')}-${moodIndex + 1}${sizeIndex + 1}`, labelEn: `${mood.en} / ${size.en}`, labelAr: `${mood.ar} / ${size.ar}`, priceFils: Math.round(family.base * size.multiplier / 250) * 250, stock: 4 + ((i * 7 + moodIndex * 3 + sizeIndex) % 24) })));
    await db.insert(variants).values(values);
    productCount++; skuCount += values.length;
  }
}
await db.insert(promotions).values({ code: 'WELCOME10', percentOff: 10, active: true });
const adminPassword = process.env.SEED_ADMIN_PASSWORD;
if (adminPassword) await db.insert(users).values({ email: process.env.SEED_ADMIN_EMAIL ?? 'admin@dara.local', name: 'Dara Admin', passwordHash: await argon2.hash(adminPassword), role: 'admin' });
await pool.end();
console.log(`Seeded ${productCount} products and ${skuCount} SKUs. ${adminPassword ? 'Admin created.' : 'Set SEED_ADMIN_PASSWORD to create an admin.'}`);
