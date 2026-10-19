import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { exchangeCode, storeTokens, oauthClient } from '@/lib/gmail';
import { log, logError } from '@/lib/logger';
import { google } from 'googleapis';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');
  
  if (errorParam) return NextResponse.redirect(new URL(`/help?error=${encodeURIComponent(errorParam)}`, req.url));
  if (!code || !state) return NextResponse.redirect(new URL('/help?error=missing_code_or_state', req.url));
  
  const admin = createSupabaseAdmin();
  const { data: stateRow } = await admin.from('oauth_states').select('*').eq('state', state).maybeSingle();
  if (!stateRow) return NextResponse.redirect(new URL('/help?error=invalid_state', req.url));
  
  if (new Date(stateRow.expires_at).getTime() < Date.now()) {
    await admin.from('oauth_states').delete().eq('state', state); 
    return NextResponse.redirect(new URL('/help?error=expired_state', req.url)); 
  }
  await admin.from('oauth_states').delete().eq('state', state);
  
  try {
    const tokens = await exchangeCode(code); 
    if (!tokens.access_token) throw new Error('No access token in response');
    
    const client = oauthClient(); 
    client.setCredentials({ access_token: tokens.access_token });
    const oauth2 = google.oauth2({ version: 'v2', auth: client }); 
    const me = await oauth2.userinfo.get(); 
    const gEmail = me.data.email;
    
    if (!gEmail) throw new Error('No email in Google profile');

    // GLOBAL DUPLICATE CHECK (Check by email & provider, not user_id)
    const { data: existing } = await admin
      .from('sender_accounts')
      .select('*')
      .eq('provider', 'gmail')
      .eq('google_email', gEmail)
      .maybeSingle();

    let senderId: string;
    if (existing) { 
      // Update existing sender and re-assign to current user
      senderId = existing.id; 
      await admin.from('sender_accounts').update({ 
        user_id: stateRow.user_id,
        status: 'connected', 
        last_error: null, 
        paused: false, 
        updated_at: new Date().toISOString() 
      }).eq('id', senderId); 
    } else { 
      // Insert new
      const { data: created, error: insErr } = await admin.from('sender_accounts').insert({ 
        user_id: stateRow.user_id, 
        provider: 'gmail', 
        google_email: gEmail, 
        display_name: 'Startup India Certificate', 
        status: 'connected' 
      }).select('id').single(); 
      if (insErr || !created) throw insErr ?? new Error('insert failed'); 
      senderId = created.id; 
    }
    
    await storeTokens(senderId, { 
      access_token: tokens.access_token, 
      refresh_token: tokens.refresh_token ?? null, 
      expiry_date: tokens.expiry_date ?? null, 
      scope: tokens.scope ?? null 
    });
    
    log('oauth.connected', { userId: stateRow.user_id, senderId });
    return NextResponse.redirect(new URL('/welcome', req.url));
    
  } catch (e) { 
    logError('oauth.callback_failed', e); 
    return NextResponse.redirect(new URL(`/help?error=${encodeURIComponent(e instanceof Error ? e.message : 'callback_failed')}`, req.url)); 
  }
}
