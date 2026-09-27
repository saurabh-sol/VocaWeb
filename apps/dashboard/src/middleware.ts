import { NextResponse } from 'next/server';
import { clerkMiddleware } from '@clerk/nextjs/server';
import { APP_HOME, SIGN_IN_PATH, SIGN_UP_PATH } from '@/lib/routes';

/**
 * Sends signed-out visitors to our own sign-in page and remembers where they were going.
 * This is a convenience redirect; the app layout is what actually enforces access.
 */
export default clerkMiddleware(
  async (auth, request) => {
    const { pathname, search } = request.nextUrl;
    if (pathname !== APP_HOME && !pathname.startsWith(`${APP_HOME}/`)) return;

    const { userId } = await auth();
    if (userId) return;

    const signIn = new URL(SIGN_IN_PATH, request.url);
    signIn.searchParams.set('redirect_url', `${pathname}${search}`);
    return NextResponse.redirect(signIn);
  },
  { signInUrl: SIGN_IN_PATH, signUpUrl: SIGN_UP_PATH },
);

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
