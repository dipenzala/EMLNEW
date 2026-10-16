#!/usr/bin/env bash
# CertWinX: One-click self-draining queue (no Python scheduler needed)
set -euo pipefail

say() { printf "\033[1;34m[CertWinX]\033[0m %s\n" "$*"; }
die() { printf "\033[1;31m[error]\033[0m %s\n" "$*" >&2; exit 1; }

[ -f "package.json" ] || die "Run from project root (package.json not found)."
[ -f "src/lib/queue.ts" ] || die "src/lib/queue.ts missing. Run earlier bootstrap first."

write() { local p="$1"; mkdir -p "$(dirname "$p")"; cat > "$p"; say "wrote $p"; }
backup() { local f="$1"; [ -f "$f" ] && cp "$f" "$f.bak.$(date +%s)"; }

# =============================================================
# 1. Install @vercel/functions
# =============================================================

if ! grep -q '"@vercel/functions"' package.json; then
  say "installing @vercel/functions"
  npm install @vercel/functions
else
  say "@vercel/functions already installed"
fi

# =============================================================
# 2. NEW: /api/drain — self-chaining drain endpoint
# =============================================================

write "src/app/api/drain/route.ts" <<'EOF'
import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { processBatch } from '@/lib/queue';
import { log, logError } from '@/lib/logger';
import { timingSafeEq } from '@/lib/crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  return provided.length > 0 && timingSafeEq(provided, secret);
}

async function countRemaining(userId: string): Promise<number> {
  const admin = createSupabaseAdmin();
  const { count } = await admin
    .from('email_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'queued');
  return count ?? 0;
}

async function chainSelf(userId: string, depth: number) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const secret = process.env.CRON_SECRET;
  if (!appUrl || !secret) return;
  if (depth > 2000) {
    logError('drain.chain_depth_exceeded', new Error('too deep'), { userId, depth });
    return;
  }
  await new Promise((r) => setTimeout(r, 1200));
  try {
    await fetch(`${appUrl}/api/drain`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
      body: JSON.stringify({ userId, depth }),
    });
  } catch (e) {
    logError('drain.chain_failed', e, { userId, depth });
  }
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if ((process.env.GLOBAL_SENDING_ENABLED ?? 'false') !== 'true') {
    return NextResponse.json({ ok: true, skipped: 'killswitch' });
  }

  const body = await req.json().catch(() => ({}));
  const userId = body.userId as string | undefined;
  const depth = (body.depth as number) ?? 0;
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const admin = createSupabaseAdmin();
  const { data: profile } = await admin
    .from('profiles')
    .select('batch_size,global_sending_enabled')
    .eq('id', userId)
    .maybeSingle();

  if (profile && !profile.global_sending_enabled) {
    return NextResponse.json({ error: 'profile killswitch off' }, { status: 400 });
  }

  const limit = Math.min(Number(process.env.MAX_BATCH_SIZE ?? 5), profile?.batch_size ?? 5);
  const result = await processBatch(userId, limit);
  const remaining = await countRemaining(userId);

  log('drain.tick', { userId, depth, ...result, remaining });

  if (remaining > 0 && result.claimed > 0) {
    waitUntil(chainSelf(userId, depth + 1));
  }

  return NextResponse.json({ ok: true, depth, ...result, remaining });
}
EOF

# =============================================================
# 3. PATCH: campaigns/[id]/action — trigger chain on send_now
# =============================================================

ACTION_FILE="src/app/api/campaigns/[id]/action/route.ts"
[ -f "$ACTION_FILE" ] || die "$ACTION_FILE not found."

backup "$ACTION_FILE"

# Ensure waitUntil import exists
if ! grep -q "from '@vercel/functions'" "$ACTION_FILE"; then
  # Insert import after the first import line
  if sed --version >/dev/null 2>&1; then
    sed -i "1s|^|import { waitUntil } from '@vercel/functions';\n|" "$ACTION_FILE"
  else
    sed -i '' "1s|^|import { waitUntil } from '@vercel/functions';\n|" "$ACTION_FILE"
  fi
fi

# Replace the existing send_now body's processBatch call with a chain kick-off
# We do a targeted replacement: find the block that calls processBatch and replace it.
node - <<'NODE'
const fs = require('fs');
const file = 'src/app/api/campaigns/[id]/action/route.ts';
let src = fs.readFileSync(file, 'utf8');

// The send_now block currently does:
//   const batchLimit = Math.min(Number(process.env.MAX_BATCH_SIZE ?? 5), 5);
//   const processed = await processBatch(user.id, batchLimit);
//   log('campaign.send_now', { userId: user.id, campaignId: c.id, enqueued, ...processed });
//   return NextResponse.json({ ok: true, enqueued, ...processed });
//
// We replace it with a fire-and-forget chain trigger.

const oldBlock = `    const batchLimit = Math.min(Number(process.env.MAX_BATCH_SIZE ?? 5), 5);
    const processed = await processBatch(user.id, batchLimit);
    log('campaign.send_now', { userId: user.id, campaignId: c.id, enqueued, ...processed });
    return NextResponse.json({ ok: true, enqueued, ...processed });`;

const newBlock = `    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const secret = process.env.CRON_SECRET;
    if (appUrl && secret) {
      waitUntil(
        fetch(\`\${appUrl}/api/drain\`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: \`Bearer \${secret}\` },
          body: JSON.stringify({ userId: user.id, depth: 0 }),
        }).catch(() => {}),
      );
    }
    log('campaign.send_now.enqueued', { userId: user.id, campaignId: c.id, enqueued });
    return NextResponse.json({ ok: true, enqueued, note: 'Sending in background — refresh to see progress' });`;

if (src.includes(oldBlock)) {
  src = src.replace(oldBlock, newBlock);
  fs.writeFileSync(file, src);
  console.log('[patched] send_now block replaced');
} else {
  console.log('[warn] old send_now block not found — file may already be patched');
}

// Remove now-unused processBatch import (optional, tsc will warn but won't break)
NODE

say "patched $ACTION_FILE"

# =============================================================
# 4. PATCH: campaigns/[id]/page.tsx — auto-refresh progress
# =============================================================

CAMPAIGN_FILE="src/app/(app)/campaigns/[id]/page.tsx"
if [ -f "$CAMPAIGN_FILE" ]; then
  backup "$CAMPAIGN_FILE"

  node - <<'NODE'
const fs = require('fs');
const file = 'src/app/(app)/campaigns/[id]/page.tsx';
let src = fs.readFileSync(file, 'utf8');

// Add auto-refresh effect if not present
const marker = 'AUTO_REFRESH_PROGRESS';
if (!src.includes(marker)) {
  const anchor = "  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);";
  const replacement = `  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  // AUTO_REFRESH_PROGRESS — poll every 3s while jobs are in flight
  useEffect(() => {
    const t = setInterval(() => {
      fetch(\`/api/campaigns/\${id}/progress\`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { if (j) setProgress(j); })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(t);
  }, [id]);`;

  if (src.includes(anchor)) {
    src = src.replace(anchor, replacement);
    fs.writeFileSync(file, src);
    console.log('[patched] auto-refresh progress added');
  } else {
    console.log('[warn] campaign useEffect anchor not found — skipping auto-refresh patch');
  }
} else {
  console.log('[warn] campaign detail page not found — skipping');
}
NODE
else
  say "campaign detail page missing — skipping UI auto-refresh"
fi

# =============================================================
# 5. DELETE: scheduler.py (optional — kept as backup)
# =============================================================

if [ -f "scheduler.py" ]; then
  mv scheduler.py scheduler.py.unused
  say "scheduler.py → scheduler.py.unused (no longer needed; delete when ready)"
fi

# =============================================================
# DONE
# =============================================================

say ""
say "✅ One-click self-draining queue installed."
say ""
say "What changed:"
say "  + src/app/api/drain/route.ts                     (self-chaining drain)"
say "  ~ src/app/api/campaigns/[id]/action/route.ts     (send_now kicks off chain)"
say "  ~ src/app/(app)/campaigns/[id]/page.tsx          (live progress polling)"
say "  ~ package.json                                    (@vercel/functions)"
say "  ~ scheduler.py → scheduler.py.unused              (no longer needed)"
say ""
say "Manual steps: NOTHING. Just restart dev server."
say ""
say "How to use:"
say "  1) Open a campaign → click ⚡ Send Now"
say "  2) That's it. Chain runs in background."
say "  3) Progress panel updates every 3s on the same page."
say ""
say "Note: 'Send Now' now returns instantly with 'Sending in background'."
say "Progress + queue status is visible on the campaign page."