import { Faq } from '@/components/landing/Faq';
import { FeatureBento } from '@/components/landing/FeatureBento';
import { FinalCta } from '@/components/landing/FinalCta';
import { Hero } from '@/components/landing/Hero';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { PromptTicker } from '@/components/landing/PromptTicker';
import { Scope } from '@/components/landing/Scope';
import { SiteFooter } from '@/components/landing/SiteFooter';
import { SiteHeader } from '@/components/landing/SiteHeader';

export default function LandingPage() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main">
        <Hero />
        <PromptTicker />
        <HowItWorks />
        <FeatureBento />
        <Scope />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
