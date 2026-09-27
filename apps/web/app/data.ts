export type Product = { id: string; slug: string; nameEn: string; nameAr: string; descriptionEn: string; descriptionAr: string; imageUrl: string; featured?: boolean; category?: string | null; collection?: string | null; minPriceFils: number; stock: number; variants?: Variant[]; images?: { url: string; altEn: string; altAr: string }[] };
export type Variant = { id: string; sku: string; labelEn: string; labelAr: string; priceFils: number; stock: number };
export type CartLine = { product: Product; variant: Variant; quantity: number };
export const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, { ...options, credentials: 'include', headers: { 'content-type': 'application/json', ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Something went wrong');
  return data as T;
}
export async function csrf(): Promise<string> { return (await api<{ csrfToken: string }>('/v1/auth/session')).csrfToken; }
export async function mutate<T>(path: string, method: string, body?: unknown): Promise<T> { return api<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { 'x-csrf-token': await csrf() } }); }
const pics = [
  'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?w=1000&q=85',
  'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1000&q=85',
  'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1000&q=85',
  'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=1000&q=85',
  'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=1000&q=85',
  'https://images.unsplash.com/photo-1618220179428-22790b461013?w=1000&q=85',
  'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=1000&q=85',
  'https://images.unsplash.com/photo-1615874694520-474822394e73?w=1000&q=85'
];
const names = [
  ['Safa Lounge Chair', 'كرسي صفا', 'living', 179000],
  ['Masa Table Lamp', 'مصباح ماسة', 'lighting', 59000],
  ['Dara Clay Vessel', 'مزهرية دارا الفخارية', 'decor', 34500],
  ['Linen Story Throw', 'غطاء لينن ستوري', 'textiles', 49000],
  ['Noura Side Table', 'طاولة نورة الجانبية', 'living', 89000],
  ['Tariq Serving Bowl', 'وعاء تقديم طارق', 'tableware', 22500],
  ['Sahara Cushion', 'وسادة الصحراء', 'textiles', 19000],
  ['Dawn Pendant', 'ثريا الفجر', 'lighting', 124000]
] as const;
export const previewProducts: Product[] = names.map(([nameEn, nameAr, category, minPriceFils], i) => ({ id: `preview-${i}`, slug: nameEn.toLowerCase().replaceAll(' ', '-'), nameEn, nameAr, category, minPriceFils, imageUrl: ({ 'Safa Lounge Chair': '/images/safa-chair.png', 'Masa Table Lamp': '/images/masa-lamp.png', 'Dara Clay Vessel': '/images/dara-vessel.png' } as Record<string, string>)[nameEn] ?? pics[i], descriptionEn: 'A considered piece for the everyday home, made with quiet form and warm natural materials.', descriptionAr: 'قطعة مدروسة للمنزل اليومي، تتميز بشكل هادئ وخامات طبيعية دافئة.', featured: true, stock: 12 }));
