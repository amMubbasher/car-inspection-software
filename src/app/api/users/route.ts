import { connectToDB } from '@/lib/db';
import { User } from '@/models/User';
import { isAuthorized } from '@/lib/auth';
import { apiError } from '@/lib/apiError';
import { serializeUsers } from '@/lib/serializeUser';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const isAdmin = await isAuthorized('admin');
    if (!isAdmin) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    await connectToDB();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim() ?? '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '10', 10));

    const query: Record<string, unknown> = {};
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ name: regex }, { email: regex }];
    }

    const skip = (page - 1) * limit;
    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select('-password')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return NextResponse.json({
      users: serializeUsers(users),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    return apiError(error, 'Failed to fetch users');
  }
}

export async function POST(req: Request) {
  try {
    const isAdmin = await isAuthorized('admin');
    if (!isAdmin) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    await connectToDB();
    const body = await req.json();
    const name = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    const role = body.role;

    if (!name || !email || !password || !role) {
      return NextResponse.json({ message: 'All fields required' }, { status: 400 });
    }

    if (!['admin', 'team'].includes(role)) {
      return NextResponse.json({ message: 'Invalid role' }, { status: 400 });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ message: 'User already exists' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({
      name,
      email,
      password: hashedPassword,
      role,
    });

    return NextResponse.json({ message: 'User created successfully' }, { status: 201 });
  } catch (error) {
    return apiError(error, 'Failed to create user');
  }
}
