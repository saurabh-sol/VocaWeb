import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { AppShell } from '@/components/app/AppShell';
import { SIGN_IN_PATH } from '@/lib/routes';

/** Everything under /app needs a signed-in user; the check lives next to what it protects. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect(SIGN_IN_PATH);

  return <AppShell>{children}</AppShell>;
}
