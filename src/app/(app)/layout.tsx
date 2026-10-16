import { requireUser } from '@/lib/auth';
import AppLayoutClient from '@/components/AppLayoutClient';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <AppLayoutClient email={user.email}>{children}</AppLayoutClient>;
}
