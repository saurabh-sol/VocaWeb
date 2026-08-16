'use client';

import dynamic from 'next/dynamic';
import { ThemeProvider } from '@/components/ThemeProvider';
import { VoiceProvider } from '@/components/voice/VoiceProvider';

const PrivyWrapper = dynamic(() => import('@/components/PrivyWrapper'), { ssr: false });

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyWrapper>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
        <VoiceProvider>
          {children}
        </VoiceProvider>
      </ThemeProvider>
    </PrivyWrapper>
  );
}
