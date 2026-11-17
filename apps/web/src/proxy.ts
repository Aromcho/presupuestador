import { NextResponse, type NextRequest } from 'next/server';

/** Chequeo optimista: sin cookie de sesión, el panel manda al login (la API valida de verdad) */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname !== '/login' && !req.cookies.has('gc_session')) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!api|uploads|_next|brand|favicon.ico).*)'] };
