// src/lib/auth.ts
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

export async function getAuthSession() {
  return await getServerSession(authOptions);
}

export {
  getCurrentUser,
  requireUser,
  requirePermission,
  requireAnyPermission,
  can,
  canAny,
} from '@/lib/rbac/server';
