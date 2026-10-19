import { connectToDB } from '@/lib/db';
import { Role } from '@/models/Role';
import { User } from '@/models/User';
import {
  audit,
  AuthError,
  invalidateRoleCache,
  requireAnyPermission,
  requirePermission,
  routeError,
} from '@/lib/rbac/server';
import { assertCanGrant } from '@/lib/rbac/guards';
import { toSafeRole } from '@/lib/rbac/users';
import { SYSTEM_ROLES } from '@/lib/rbac/permissions';
import { createRoleSchema } from '@/lib/validations/roleSchema';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SYSTEM_ORDER = SYSTEM_ROLES.map((role) => role.key);

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'role'
  );
}

export async function GET() {
  try {
    const actor = await requireAnyPermission('roles.view', 'users.assign_roles');
    await connectToDB();

    const [roles, counts] = await Promise.all([
      Role.find().lean(),
      User.aggregate<{ _id: unknown; count: number }>([
        { $match: { roleId: { $ne: null } } },
        { $group: { _id: '$roleId', count: { $sum: 1 } } },
      ]),
    ]);
    const countByRole = new Map(counts.map((row) => [String(row._id), row.count]));

    const rank = (key: string) => {
      const index = SYSTEM_ORDER.indexOf(key);
      return index === -1 ? SYSTEM_ORDER.length : index;
    };
    roles.sort((a, b) => rank(a.key) - rank(b.key) || a.name.localeCompare(b.name));

    return NextResponse.json(
      {
        roles: roles.map((role) =>
          toSafeRole(role, actor, countByRole.get(role._id.toString()) ?? 0)
        ),
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    return routeError(error, 'Failed to fetch roles');
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requirePermission('roles.create');
    await connectToDB();

    const parsed = createRoleSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? 'Validation failed' },
        { status: 400 }
      );
    }
    const { name, description, permissions } = parsed.data;
    assertCanGrant(actor, permissions);

    const nameTaken = await Role.findOne({ name })
      .collation({ locale: 'en', strength: 2 })
      .select('_id')
      .lean();
    if (nameTaken) throw new AuthError(409, 'A role with this name already exists');

    // Keys are unique and never reuse a system key.
    const base = slugify(name);
    let key = base;
    for (let n = 2; SYSTEM_ORDER.includes(key) || (await Role.exists({ key })); n += 1) {
      key = `${base}-${n}`;
    }

    const role = await Role.create({ key, name, description, permissions, isSystem: false });
    invalidateRoleCache();

    await audit(actor, {
      action: 'role.create',
      targetType: 'role',
      targetId: role._id,
      after: { key, name, description, permissions },
    });

    return NextResponse.json(toSafeRole(role.toObject(), actor, 0), { status: 201 });
  } catch (error) {
    return routeError(error, 'Failed to create role');
  }
}
