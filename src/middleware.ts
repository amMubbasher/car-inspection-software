// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/login')) {
    if (token) {
      const dest =
        token.role === 'admin' ? '/admin/dashboard' : '/team/dashboard';
      return NextResponse.redirect(new URL(dest, req.url));
    }
    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (pathname.startsWith('/admin') && token.role !== 'admin') {
    const isTeamEditJob =
      token.role === 'team' &&
      /^\/admin\/dashboard\/edit-job\/[^/]+$/.test(pathname);
    if (!isTeamEditJob) {
      if (token.role === 'team') {
        return NextResponse.redirect(new URL('/team/dashboard', req.url));
      }
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  if (pathname.startsWith('/team') && token.role !== 'team') {
    if (token.role === 'admin') {
      return NextResponse.redirect(new URL('/admin/dashboard', req.url));
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

// Match routes you want middleware to run on
export const config = {
  matcher: ['/admin/:path*', '/team/:path*', '/login', '/api/auth/:path*'],
};
