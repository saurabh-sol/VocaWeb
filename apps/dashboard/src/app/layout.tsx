import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, Inter, Space_Grotesk } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { APP_HOME, SIGN_IN_PATH, SIGN_UP_PATH } from '@/lib/routes';
import { Providers } from './providers';
import './globals.css';

/** Clerk's own widgets (account menu, profile) read the same tokens as the rest of the app. */
const clerkAppearance = {
  variables: {
    colorPrimary: 'var(--vw-ink)',
    colorPrimaryForeground: 'var(--vw-paper)',
    colorBackground: 'var(--vw-paper)',
    colorForeground: 'var(--vw-ink)',
    colorMuted: 'var(--vw-wash)',
    colorMutedForeground: 'var(--vw-dim)',
    colorInput: 'var(--vw-paper)',
    colorInputForeground: 'var(--vw-ink)',
    colorBorder: 'var(--vw-soft)',
    colorRing: 'var(--vw-brand)',
    colorDanger: 'var(--vw-bad)',
    colorSuccess: 'var(--vw-ok)',
    colorWarning: 'var(--vw-warn)',
    fontFamily: 'var(--font-inter), system-ui, sans-serif',
    fontFamilyButtons: 'var(--font-inter), system-ui, sans-serif',
    borderRadius: '8px',
  },
};

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const grotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-grotesk',
  display: 'swap',
});
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
});

const siteTitle = 'VocaWeb - Build websites by talking or typing';
const siteDescription =
  'Describe a website in chat or out loud. VocaWeb plans it, writes the code, shows a live preview and publishes it to the web.';

export const metadata: Metadata = {
  title: {
    default: siteTitle,
    template: '%s - VocaWeb',
  },
  description: siteDescription,
  applicationName: 'VocaWeb',
  ...(process.env.NEXT_PUBLIC_APP_URL
    ? { metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL) }
    : {}),
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    type: 'website',
    siteName: 'VocaWeb',
  },
  twitter: {
    card: 'summary_large_image',
    title: siteTitle,
    description: siteDescription,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f1ea' },
    { media: '(prefers-color-scheme: dark)', color: '#0e0e0c' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Font variables sit on <html> so the theme tokens that reference them resolve at the root.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${grotesk.variable} ${plexMono.variable}`}
    >
      <body className="min-h-[100dvh] font-sans antialiased">
        <ClerkProvider
          appearance={clerkAppearance}
          signInUrl={SIGN_IN_PATH}
          signUpUrl={SIGN_UP_PATH}
          signInFallbackRedirectUrl={APP_HOME}
          signUpFallbackRedirectUrl={APP_HOME}
          afterSignOutUrl="/"
        >
          <Providers>{children}</Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
