import { connectToDB } from '@/lib/db';
import { User } from '@/models/User';
import { Role } from '@/models/Role';
import { audit, AuthError, can, requirePermission, routeError } from '@/lib/rbac/server';
import { canAssignRole, rolePermissions, toSafeUser, USER_PUBLIC_FIELDS } from '@/lib/rbac/users';
import { DEFAULT_ROLE_KEY, SUPER_ADMIN_ROLE_KEY } from '@/lib/rbac/permissions';
import { createUserSchema } from '@/lib/validations/userSchema';
import { BCRYPT_COST } from '@/lib/authOptions';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const actor = await requirePermission('users.view');
    await connectToDB();

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get('search') ?? '').trim().slice(0, 100);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10) || 10));

    const query: Record<string, unknown> = {};
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ name: regex }, { email: regex }];
    }

    const skip = (page - 1) * limit;
    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select(USER_PUBLIC_FIELDS)
      .populate('roleId', 'key name')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return NextResponse.json(
      {
        users: users.map((user) => toSafeUser(user, actor)),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    return routeError(error, 'Failed to fetch users');
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requirePermission('users.create');
    await connectToDB();

    const parsed = createUserSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? 'Validation failed' },
        { status: 400 }
      );
    }
    const { name, email, password, roleId } = parsed.data;

    if (roleId && !can(actor, 'users.assign_roles')) {
      throw new AuthError(403, 'You do not have permission to assign roles');
    }
    const role = roleId
      ? await Role.findById(roleId).lean()
      : await Role.findOne({ key: DEFAULT_ROLE_KEY }).lean();
    if (!role) throw new AuthError(400, 'Role not found');
    if (!canAssignRole(actor, role)) {
      throw new AuthError(403, 'You cannot assign a role with more access than you have');
    }

    const existingUser = await User.findOne({ email }).select('_id').lean();
    if (existingUser) {
      return NextResponse.json({ message: 'User already exists' }, { status: 409 });
    }

    const permissions = role.key === SUPER_ADMIN_ROLE_KEY ? [] : rolePermissions(role);
    const created = await User.create({
      name,
      email,
      password: await bcrypt.hash(password, BCRYPT_COST),
      roleId: role._id,
      permissions,
    });

    await audit(actor, {
      action: 'user.create',
      targetType: 'user',
      targetId: created._id,
      after: { name, email, role: role.key, permissions },
    });

    return NextResponse.json({ message: 'User created successfully' }, { status: 201 });
  } catch (error) {
    return routeError(error, 'Failed to create user');
  }
}
