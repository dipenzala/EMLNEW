import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import AppLayoutClient from '@/components/AppLayoutClient';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Anonymous (guest) users must save their workspace before entering the app.
  if ((user as any).is_anonymous) {
    redirect('/welcome?force=1');
  }
  return <AppLayoutClient email={user.email}>{children}</AppLayoutClient>;
}
