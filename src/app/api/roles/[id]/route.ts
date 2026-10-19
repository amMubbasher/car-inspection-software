import { connectToDB } from '@/lib/db';
import { Role } from '@/models/Role';
import { User } from '@/models/User';
import {
  assertObjectId,
  audit,
  AuthError,
  invalidateRoleCache,
  requirePermission,
  routeError,
} from '@/lib/rbac/server';
import { assertCanGrant } from '@/lib/rbac/guards';
import { rolePermissions, toSafeRole } from '@/lib/rbac/users';
import { SUPER_ADMIN_ROLE_KEY } from '@/lib/rbac/permissions';
import { updateRoleSchema } from '@/lib/validations/roleSchema';
import { NextResponse } from 'next/server';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requirePermission('roles.edit');
    const { id } = await params;
    assertObjectId(id, 'Role');
    await connectToDB();

    const parsed = updateRoleSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? 'Validation failed' },
        { status: 400 }
      );
    }
    const body = parsed.data;

    const role = await Role.findById(id);
    if (!role) throw new AuthError(404, 'Role not found');
    if (role.key === SUPER_ADMIN_ROLE_KEY) {
      throw new AuthError(403, 'The super admin role cannot be changed');
    }

    // Both the current and the new permission set must be within the actor's own access.
    const before = {
      name: role.name,
      description: role.description,
      permissions: rolePermissions(role),
    };
    assertCanGrant(actor, before.permissions);
    if (body.permissions) assertCanGrant(actor, body.permissions);

    if (body.name !== undefined && body.name !== role.name) {
      const nameTaken = await Role.findOne({ name: body.name, _id: { $ne: role._id } })
        .collation({ locale: 'en', strength: 2 })
        .select('_id')
        .lean();
      if (nameTaken) throw new AuthError(409, 'A role with this name already exists');
      role.name = body.name;
    }
    if (body.description !== undefined) role.description = body.description;
    // Users who already have this role keep their copied permissions (copy semantics).
    if (body.permissions) role.permissions = body.permissions;
    await role.save();
    invalidateRoleCache();

    await audit(actor, {
      action: 'role.update',
      targetType: 'role',
      targetId: role._id,
      before,
      after: { name: role.name, description: role.description, permissions: role.permissions },
    });

    const userCount = await User.countDocuments({ roleId: role._id });
    return NextResponse.json(toSafeRole(role.toObject(), actor, userCount));
  } catch (error) {
    return routeError(error, 'Failed to update role');
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requirePermission('roles.delete');
    const { id } = await params;
    assertObjectId(id, 'Role');
    await connectToDB();

    const role = await Role.findById(id).lean();
    if (!role) throw new AuthError(404, 'Role not found');
    if (role.isSystem) throw new AuthError(400, 'System roles cannot be deleted');
    assertCanGrant(actor, rolePermissions(role));

    const userCount = await User.countDocuments({ roleId: role._id });
    if (userCount > 0) {
      throw new AuthError(
        409,
        `This role is assigned to ${userCount} user${userCount === 1 ? '' : 's'}. Reassign them first.`
      );
    }

    await Role.deleteOne({ _id: role._id });
    invalidateRoleCache();

    await audit(actor, {
      action: 'role.delete',
      targetType: 'role',
      targetId: role._id,
      before: { key: role.key, name: role.name, permissions: role.permissions },
    });

    return NextResponse.json({ message: 'Role deleted successfully' });
  } catch (error) {
    return routeError(error, 'Failed to delete role');
  }
}
