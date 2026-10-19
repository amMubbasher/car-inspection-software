import { Types } from 'mongoose';
import { connectToDB } from '@/lib/db';
import { User } from '@/models/User';
import { Role } from '@/models/Role';
import {
  assertObjectId,
  audit,
  AuthError,
  can,
  requireAnyPermission,
  requirePermission,
  routeError,
} from '@/lib/rbac/server';
import { assertCanManageUser, assertNotSelf } from '@/lib/rbac/guards';
import {
  canAssignRole,
  countSuperAdmins,
  loadSafeUser,
  rolePermissions,
  toManagedTarget,
} from '@/lib/rbac/users';
import { SUPER_ADMIN_ROLE_KEY } from '@/lib/rbac/permissions';
import { updateUserSchema } from '@/lib/validations/userSchema';
import { BCRYPT_COST } from '@/lib/authOptions';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAnyPermission('users.edit', 'users.assign_roles');
    const { id } = await params;
    assertObjectId(id, 'User');
    await connectToDB();

    const parsed = updateUserSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? 'Validation failed' },
        { status: 400 }
      );
    }
    const body = parsed.data;

    const target = await loadSafeUser(id);
    if (!target) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }
    assertCanManageUser(actor, toManagedTarget(target));

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    const changesProfile =
      (body.name !== undefined && body.name !== (user.name ?? '')) ||
      (body.email !== undefined && body.email !== user.email) ||
      Boolean(body.password);
    if (changesProfile && !can(actor, 'users.edit')) {
      throw new AuthError(403, 'You do not have permission to edit users');
    }

    const before = { name: user.name, email: user.email, role: target.role?.key ?? null };
    let revokeSessions = false;

    if (body.name !== undefined) user.name = body.name;

    if (body.email !== undefined && body.email !== user.email) {
      const existing = await User.findOne({ email: body.email }).select('_id').lean();
      if (existing) {
        return NextResponse.json({ message: 'Email already in use' }, { status: 409 });
      }
      user.email = body.email;
    }

    let newRoleKey: string | null = null;
    if (body.roleId !== undefined && body.roleId !== target.role?._id) {
      if (!can(actor, 'users.assign_roles')) {
        throw new AuthError(403, 'You do not have permission to assign roles');
      }
      assertNotSelf(actor, id, 'You cannot change your own role');

      const role = await Role.findById(body.roleId).lean();
      if (!role) throw new AuthError(400, 'Role not found');
      if (!canAssignRole(actor, role)) {
        throw new AuthError(403, 'You cannot assign a role with more access than you have');
      }

      const becomesSuperAdmin = role.key === SUPER_ADMIN_ROLE_KEY;
      if (target.isSuperAdmin && !becomesSuperAdmin && (await countSuperAdmins()) <= 1) {
        throw new AuthError(400, 'Cannot demote the last super admin');
      }

      user.roleId = role._id;
      // Assigning a role copies its permissions; the user's set is independent afterwards.
      user.permissions = becomesSuperAdmin ? [] : rolePermissions(role);
      if (becomesSuperAdmin !== target.isSuperAdmin) revokeSessions = true;
      newRoleKey = role.key;
    }

    if (body.password) {
      user.password = await bcrypt.hash(body.password, BCRYPT_COST);
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
      revokeSessions = true;
    }

    if (revokeSessions) user.sessionVersion = (user.sessionVersion ?? 0) + 1;
    await user.save();

    await audit(actor, {
      action: 'user.update',
      targetType: 'user',
      targetId: user._id,
      before,
      after: {
        name: user.name,
        email: user.email,
        role: newRoleKey ?? before.role,
        passwordChanged: Boolean(body.password),
        ...(newRoleKey ? { permissions: user.permissions } : {}),
      },
    });

    return NextResponse.json(await loadSafeUser(id));
  } catch (error) {
    return routeError(error, 'Failed to update user');
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requirePermission('users.delete');
    const { id } = await params;
    assertObjectId(id, 'User');
    assertNotSelf(actor, id, 'You cannot delete your own account');

    await connectToDB();

    const target = await loadSafeUser(id);
    if (!target) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }
    assertCanManageUser(actor, toManagedTarget(target));

    if (target.isSuperAdmin && (await countSuperAdmins()) <= 1) {
      throw new AuthError(400, 'Cannot delete the last super admin');
    }

    await User.findByIdAndDelete(id);

    await audit(actor, {
      action: 'user.delete',
      targetType: 'user',
      targetId: new Types.ObjectId(id),
      before: { name: target.name, email: target.email, role: target.role?.key ?? null },
    });

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    return routeError(error, 'Failed to delete user');
  }
}
