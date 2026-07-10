import { connectToDB } from '@/lib/db';
import { User } from '@/models/User';
import { getAuthSession, isAuthorized } from '@/lib/auth';
import { apiError } from '@/lib/apiError';
import { serializeUser } from '@/lib/serializeUser';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAdmin = await isAuthorized('admin');
    if (!isAdmin) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    await connectToDB();
    const body = await req.json();

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    if (body.name !== undefined) {
      user.name = String(body.name).trim();
    }

    if (body.email !== undefined) {
      const email = String(body.email).trim().toLowerCase();
      if (!email) {
        return NextResponse.json({ message: 'Email is required' }, { status: 400 });
      }
      if (email !== user.email) {
        const existing = await User.findOne({ email });
        if (existing) {
          return NextResponse.json({ message: 'Email already in use' }, { status: 409 });
        }
        user.email = email;
      }
    }

    if (body.role !== undefined) {
      if (!['admin', 'team'].includes(body.role)) {
        return NextResponse.json({ message: 'Invalid role' }, { status: 400 });
      }
      user.role = body.role;
    }

    if (body.password !== undefined && String(body.password).length > 0) {
      const password = String(body.password);
      if (password.length < 6) {
        return NextResponse.json(
          { message: 'Password must be at least 6 characters' },
          { status: 400 }
        );
      }
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();

    return NextResponse.json(serializeUser(user));
  } catch (error) {
    return apiError(error, 'Failed to update user');
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAdmin = await isAuthorized('admin');
    if (!isAdmin) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    const session = await getAuthSession();
    const { id } = await params;

    if (session?.user?._id === id) {
      return NextResponse.json(
        { message: 'You cannot delete your own account' },
        { status: 400 }
      );
    }

    await connectToDB();

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    if (user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return NextResponse.json(
          { message: 'Cannot delete the last admin account' },
          { status: 400 }
        );
      }
    }

    await User.findByIdAndDelete(id);

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    return apiError(error, 'Failed to delete user');
  }
}
