#!/usr/bin/env bash
# CertWinX: add permanent Delete button to campaigns list
set -euo pipefail
[ -f "package.json" ] || { echo "Run from project root."; exit 1; }

say() { printf "\033[1;34m[CertWinX]\033[0m %s\n" "$*"; }
backup() { local f="$1"; [ -f "$f" ] && cp "$f" "$f.bak.$(date +%s)"; }

# =============================================================
# 1. API: add DELETE handler to /api/campaigns/[id]
# =============================================================

backup "src/app/api/campaigns/[id]/route.ts"

node - <<'NODE'
const fs = require('fs');
const file = 'src/app/api/campaigns/[id]/route.ts';
let src = fs.readFileSync(file, 'utf8');

if (src.includes('export async function DELETE')) {
  console.log('[skip] DELETE already exists');
  process.exit(0);
}

// Add DELETE handler at end of file
src += `

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const admin = createSupabaseAdmin();

  // Confirm ownership
  const { data: owned } = await admin
    .from('campaigns')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!owned) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // Cascade will remove email_jobs (FK on delete cascade)
  const { error } = await admin.from('campaigns').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
`;

// Ensure createSupabaseAdmin is imported
if (!src.includes('createSupabaseAdmin')) {
  src = src.replace(
    /import\s+\{\s*createSupabaseServer\s*\}\s+from\s+'@\/lib\/supabase\/server';/,
    "import { createSupabaseServer, createSupabaseAdmin } from '@/lib/supabase/server';"
  );
}

fs.writeFileSync(file, src);
console.log('[patched] campaign [id] route — DELETE added');
NODE

say "patched src/app/api/campaigns/[id]/route.ts"

# =============================================================
# 2. UI: add Delete button to campaigns list page
# =============================================================

backup "src/app/(app)/campaigns/page.tsx"

node - <<'NODE'
const fs = require('fs');
const file = 'src/app/(app)/campaigns/page.tsx';
let src = fs.readFileSync(file, 'utf8');

// 1. Add delete helper after archive()
if (!src.includes('async function del(')) {
  const anchor = `  async function archive(id: string) {
    const r = await fetch(\`/api/campaigns/\${id}/action\`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'archive' }) });
    if (r.ok) { push('Archived'); load(); } else push('Failed');
  }`;

  const replacement = anchor + `

  async function del(id: string, name: string) {
    if (!confirm(\`Permanently delete "\${name}"?\\n\\nThis removes the campaign AND all its queued/sent jobs. Cannot be undone.\`)) return;
    const r = await fetch(\`/api/campaigns/\${id}\`, { method: 'DELETE' });
    if (r.ok) { push('Deleted'); load(); }
    else { const j = await r.json().catch(() => ({})); push(j.error || 'Delete failed'); }
  }`;

  if (src.includes(anchor)) {
    src = src.replace(anchor, replacement);
    console.log('[patched] del() helper added');
  } else {
    console.log('[warn] archive() anchor not found');
  }
}

// 2. Add Delete button in table cell
const oldBtns = `                    <button className="btn btn-sm" onClick={() => duplicate(c.id)}>Duplicate</button>
                    <button className="btn btn-sm btn-danger" onClick={() => archive(c.id)}>Archive</button>`;

const newBtns = `                    <button className="btn btn-sm" onClick={() => duplicate(c.id)}>Duplicate</button>
                    <button className="btn btn-sm" onClick={() => archive(c.id)}>Archive</button>
                    <button className="btn btn-sm btn-danger" onClick={() => del(c.id, c.name)}>Delete</button>`;

if (src.includes(oldBtns)) {
  src = src.replace(oldBtns, newBtns);
  console.log('[patched] Delete button added to row');
} else {
  console.log('[warn] row buttons pattern not found');
}

fs.writeFileSync(file, src);
NODE

say "patched src/app/(app)/campaigns/page.tsx"

say ""
say "✅ Done."
say ""
say "Test locally:"
say "   npm run dev"
say "   → /campaigns → 'Delete' button dikhega"
say ""
say "Then push:"
say "   git add . && git commit -m 'add delete button to campaigns' && git push"