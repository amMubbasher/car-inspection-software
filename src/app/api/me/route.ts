import { requireUser, routeError } from '@/lib/rbac/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** The signed-in user's live role and effective permissions (used for UI gating only). */
export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json(
      {
        user: { _id: user.id, name: user.name, email: user.email },
        role: user.role,
        permissions: user.permissions,
        isSuperAdmin: user.isSuperAdmin,
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    return routeError(error, 'Failed to load session');
  }
}
