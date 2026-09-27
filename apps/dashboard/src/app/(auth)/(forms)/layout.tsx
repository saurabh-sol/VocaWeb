import { AuthScreen } from '@/components/auth/AuthScreen';

/**
 * Sign in and sign up share one screen. Keeping it in the layout means it stays mounted
 * while the route changes, so the two halves can slide across and swap sides.
 */
export default function AuthFormsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthScreen />
      {children}
    </>
  );
}
