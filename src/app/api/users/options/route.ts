import { connectToDB } from '@/lib/db';
import { User } from '@/models/User';
import { requireAnyPermission, routeError } from '@/lib/rbac/server';
import type { UserOption } from '@/lib/serializeUser';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Lightweight user list (id, name, email) for filters and report pickers. */
export async function GET() {
  try {
    await requireAnyPermission('jobs.filter_by_user', 'reports.export');
    await connectToDB();
    const users = await User.find().select('name email').sort({ name: 1 }).limit(1000).lean();
    const options: UserOption[] = users.map((user) => ({
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
    }));
    return NextResponse.json(
      { users: options },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    return routeError(error, 'Failed to fetch users');
  }
}
