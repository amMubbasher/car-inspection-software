import { Types } from 'mongoose';
import { connectToDB } from '@/lib/db';
import { User } from '@/models/User';
import {
  assertObjectId,
  audit,
  AuthError,
  requirePermission,
  routeError,
} from '@/lib/rbac/server';
import {
  assertCanGrant,
  assertCanManageUser,
  assertNotSelf,
  permissionDiff,
} from '@/lib/rbac/guards';
import { loadSafeUser, toManagedTarget } from '@/lib/rbac/users';
import { userPermissionsSchema } from '@/lib/validations/userSchema';
import { NextResponse } from 'next/server';

/** Replaces a user's individual permission list (role-copied + extras). */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requirePermission('users.manage_permissions');
    const { id } = await params;
    assertObjectId(id, 'User');
    assertNotSelf(actor, id, 'You cannot change your own permissions');

    await connectToDB();

    const parsed = userPermissionsSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? 'Validation failed' },
        { status: 400 }
      );
    }

    const target = await loadSafeUser(id);
    if (!target) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }
    assertCanManageUser(actor, toManagedTarget(target));
    if (target.isSuperAdmin) {
      throw new AuthError(400, 'A super admin always has every permission');
    }

    const next = parsed.data.permissions;
    const changed = permissionDiff(target.permissions, next);
    assertCanGrant(actor, changed);

    if (changed.length > 0) {
      await User.updateOne({ _id: id }, { $set: { permissions: next } });
      await audit(actor, {
        action: 'user.permissions',
        targetType: 'user',
        targetId: new Types.ObjectId(id),
        before: target.permissions,
        after: next,
      });
    }

    return NextResponse.json(await loadSafeUser(id));
  } catch (error) {
    return routeError(error, 'Failed to update permissions');
  }
}
