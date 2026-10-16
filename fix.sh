#!/usr/bin/env bash
# Fix: wrap /welcome useSearchParams in Suspense
set -euo pipefail
[ -f "package.json" ] || { echo "Run from project root."; exit 1; }

say() { printf "\033[1;34m[CertWinX]\033[0m %s\n" "$*"; }

F="src/app/welcome/page.tsx"
[ -f "$F" ] || { echo "Missing $F"; exit 1; }

cp "$F" "$F.bak.$(date +%s)"

# Add Suspense import
if ! grep -q "from 'react'" "$F"; then
  echo "  no react import — unexpected, aborting"; exit 1
fi

# Ensure Suspense is imported from react
node - <<'NODE'
const fs = require('fs');
const file = 'src/app/welcome/page.tsx';
let src = fs.readFileSync(file, 'utf8');

// 1. Add Suspense to React import
src = src.replace(
  /import\s+\{\s*useEffect,\s*useState\s*\}\s+from\s+'react';/,
  "import { Suspense, useEffect, useState } from 'react';"
);

// 2. Rename default export to a named component
src = src.replace(
  /export\s+default\s+function\s+WelcomePage\s*\(/,
  'function WelcomeInner('
);

// 3. Append wrapper default export
src += `

export default function WelcomePage() {
  return (
    <Suspense
      fallback={
        <div className="welcome-shell">
          <div className="welcome-card">
            <div className="skeleton" style={{ height: 40, width: 200, margin: '0 auto 16px' }} />
            <div className="skeleton" style={{ height: 20, width: '80%', margin: '0 auto 12px' }} />
            <div className="skeleton" style={{ height: 20, width: '60%', margin: '0 auto' }} />
          </div>
        </div>
      }
    >
      <WelcomeInner />
    </Suspense>
  );
}
`;

fs.writeFileSync(file, src);
console.log('[patched] welcome/page.tsx');
NODE

say "✅ Done."
say ""
say "Rebuild locally first to verify:"
say "   npm run build"
say ""
say "Then commit & push:"
say "   git add . && git commit -m 'fix: wrap useSearchParams in Suspense on /welcome' && git push"