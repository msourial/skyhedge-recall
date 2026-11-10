import type { Metadata } from 'next';
import { Barlow_Condensed, IBM_Plex_Mono, Inter } from 'next/font/google';
import './style.css';
const inter = Inter({ subsets: ['latin'], variable: '--font-body' });
const barlow = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-heading',
});
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-data' });
export const metadata: Metadata = {
  title: 'SkyHedge Recall',
  description: 'The rain forecaster that remembers who was right.',
};
/** Render the document shell with body, heading and data font families. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${barlow.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
