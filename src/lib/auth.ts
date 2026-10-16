import { redirect } from 'next/navigation';
import { createSupabaseServer } from './supabase/server';
export async function requireUser() {
  const sb = createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');
  return user;
}
