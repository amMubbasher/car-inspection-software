// middleware.ts
// Edge runtime: no database access here, so this only handles authentication and CSRF.
// Authorization (permissions) is enforced per route/page in src/lib/rbac/server.ts.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const NO_STORE = { 'Cache-Control': 'no-store' };
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isSameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  // Browsers always send Origin on cross-site mutating requests; same-origin requests
  // without it (older browsers, server-to-server) are still protected by SameSite cookies.
  if (!origin) return true;
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/api')) {
    if (MUTATING_METHODS.has(req.method) && !isSameOrigin(req)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Cross-origin request blocked' },
        { status: 403, headers: NO_STORE }
      );
    }

    if (pathname.startsWith('/api/auth')) {
      return NextResponse.next();
    }

    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?._id) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Unauthorized' },
        { status: 401, headers: NO_STORE }
      );
    }

    const isDirectVisit =
      req.headers.get('sec-fetch-dest') === 'document' ||
      req.headers.get('sec-fetch-mode') === 'navigate';
    if (isDirectVisit && !pathname.startsWith('/api/pdf')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Unauthorized' },
        { status: 401, headers: NO_STORE }
      );
    }

    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (pathname.startsWith('/login')) {
    // `expired` means the server rejected this token (revoked / migrated); let the
    // login page clear it instead of bouncing back to the dashboard.
    if (token?._id && !req.nextUrl.searchParams.has('expired')) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    return NextResponse.next();
  }

  if (!token?._id) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

// Match routes you want middleware to run on
export const config = {
  matcher: ['/dashboard/:path*', '/login', '/api/:path*'],
};
