// src/app/api/users/route.ts
import { connectToDB } from '@/lib/db';
import { User } from '@/models/User';
import { isAuthorized } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const isAdmin = await isAuthorized('admin');
  if (!isAdmin) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  try {
    await connectToDB();
    const { name, email, password, role } = await req.json();

    if (!name || !email || !password || !role) {
      return NextResponse.json({ message: 'All fields required' }, { status: 400 });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ message: 'User already exists' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role,
    });

    await newUser.save();

    return NextResponse.json({ message: 'User created successfully' }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
