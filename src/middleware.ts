// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  const { pathname } = req.nextUrl;

  // Public routes
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // No token? Redirect to login
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Admin routes only
  if (pathname.startsWith('/admin') && token.role !== 'admin') {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Team routes only
  if (pathname.startsWith('/team') && token.role !== 'team') {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

// Match routes you want middleware to run on
export const config = {
  matcher: ['/admin/:path*', '/team/:path*', '/login', '/api/auth/:path*'],
};
