'use client';

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';
import { BrandMark } from '@/components/ui/brand';
import { APP_HOME } from '@/lib/routes';

/** Google and GitHub send the browser back here; Clerk finishes the session and moves on. */
export default function SsoCallbackPage() {
  return (
    <main className="grid min-h-[100dvh] place-items-center px-5">
      <div className="flex flex-col items-center gap-5 text-center">
        <BrandMark size={44} className="animate-[vw-blink_1.4s_ease-in-out_infinite]" />
        <p className="font-mono text-[13px] text-dim" role="status">
          Signing you in
        </p>
        <AuthenticateWithRedirectCallback
          signInFallbackRedirectUrl={APP_HOME}
          signUpFallbackRedirectUrl={APP_HOME}
        />
        <div id="clerk-captcha" />
      </div>
    </main>
  );
}
