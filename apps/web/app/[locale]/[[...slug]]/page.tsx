import { notFound } from 'next/navigation';
import DaraApp from '../../DaraApp';
export default async function Page({ params }: { params: Promise<{ locale: string; slug?: string[] }> }) {
  const { locale, slug = [] } = await params;
  if (locale !== 'en' && locale !== 'ar') notFound();
  return <DaraApp locale={locale} path={slug} />;
}
