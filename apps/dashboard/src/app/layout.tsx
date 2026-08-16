import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-serif' });

const siteDescription = 'Build websites with your voice — powered by Vocaweb AI';
const siteIcon = '/vocaweb-icon.png';

export const metadata: Metadata = {
  title: 'Vocaweb',
  description: siteDescription,
  ...(process.env.NEXT_PUBLIC_APP_URL
    ? { metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL) }
    : {}),
  icons: {
    icon: siteIcon,
    shortcut: siteIcon,
    apple: siteIcon,
  },
  openGraph: {
    title: 'Vocaweb',
    description: siteDescription,
    type: 'website',
    siteName: 'Vocaweb',
    images: [
      {
        url: siteIcon,
        width: 781,
        height: 780,
        alt: 'Vocaweb logo',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'Vocaweb',
    description: siteDescription,
    images: [siteIcon],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${playfair.variable} font-sans min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased selection:bg-[var(--primary)] selection:text-[var(--primary-foreground)]`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
