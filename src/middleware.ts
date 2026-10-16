import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED = [
  '/dashboard','/quick-send','/senders','/contacts','/campaigns',
  '/templates','/analytics','/suppression','/activity','/settings','/help'
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PROTECTED.some((p) => pathname.startsWith(p))) {
    const hasSession = req.cookies.getAll().some(
      (c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
    );
    if (!hasSession) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*','/quick-send/:path*','/senders/:path*','/contacts/:path*',
    '/campaigns/:path*','/templates/:path*','/analytics/:path*','/suppression/:path*',
    '/activity/:path*','/settings/:path*','/help/:path*'
  ]
};
