'use client';

import { useCallback, useMemo } from 'react';
import { useAuth, useClerk, useUser } from '@clerk/nextjs';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  imageUrl: string | null;
  initial: string;
}

/** One place the app reads the signed-in user and the API bearer token from. */
export function useAuthSession() {
  const { isLoaded, isSignedIn, getToken: clerkGetToken } = useAuth();
  const { user: clerkUser } = useUser();
  const { signOut: clerkSignOut } = useClerk();

  const getToken = useCallback(
    async (options?: { skipCache?: boolean }) => (await clerkGetToken(options)) ?? null,
    [clerkGetToken],
  );

  const signOut = useCallback(async () => {
    await clerkSignOut({ redirectUrl: '/' });
  }, [clerkSignOut]);

  const user = useMemo<SessionUser | null>(() => {
    if (!clerkUser) return null;
    const email = clerkUser.primaryEmailAddress?.emailAddress ?? '';
    const name =
      clerkUser.fullName?.trim() ||
      clerkUser.username ||
      (email ? email.split('@')[0] : 'VocaWeb user');
    return {
      id: clerkUser.id,
      name,
      email,
      imageUrl: clerkUser.hasImage ? clerkUser.imageUrl : null,
      initial: name.charAt(0).toUpperCase(),
    };
  }, [clerkUser]);

  return {
    isLoaded,
    isSignedIn: Boolean(isSignedIn),
    user,
    getToken,
    signOut,
  };
}
