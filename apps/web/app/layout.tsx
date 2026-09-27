import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Dara | Objects for living', description: 'Considered home goods for everyday rituals in Kuwait.' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
