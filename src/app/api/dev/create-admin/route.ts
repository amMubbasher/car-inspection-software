// import { NextResponse } from 'next/server';
// import bcrypt from 'bcryptjs';
// import {connectToDB} from '@/lib/db';
// import{ User} from '@/models/User';

// export async function GET() {
//   try {
//     await connectToDB();

//     const existingAdmin = await User.findOne({ email: 'caradmin@example.com' });
//     if (existingAdmin) {
//       return NextResponse.json(
//         { message: 'Admin user already exists.' },
//         { status: 400 }
//       );
//     }

//     const hashedPassword = await bcrypt.hash('admin123', 10);

//     const newAdmin = await User.create({
//       name: 'Admin',
//       email: 'caradmin@example.com',
//       password: hashedPassword,
//       role: 'admin',
//     });

//     return NextResponse.json(
//       { message: 'Admin created successfully.', user: newAdmin },
//       { status: 201 }
//     );
//   } catch (error: unknown) {
//   console.error('Error creating admin:', error);

//   const errMessage =
//     error instanceof Error ? error.message : 'Unknown error';

//   return NextResponse.json(
//     { message: 'Error creating admin', error: errMessage },
//     { status: 500 }
//   );
// }

// }

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectToDB } from '@/lib/db';
import { User } from '@/models/User';

export async function GET() {
  try {
    await connectToDB();

    // Change to your real email
    const existingAdmin = await User.findOne({ email: 'car.inspection.garage@gmail.com' });
    if (existingAdmin) {
      return NextResponse.json(
        { message: 'Admin user already exists.' },
        { status: 400 }
      );
    }

    // Change to your real password
    const hashedPassword = await bcrypt.hash('car.inspection-120', 10);

    const newAdmin = await User.create({
      name: 'Admin',
      email: 'car.inspection.garage@gmail.com',
      password: hashedPassword,
      role: 'admin',
    });

    return NextResponse.json(
      { message: 'Admin created successfully.', user: newAdmin },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('Error creating admin:', error);

    const errMessage =
      error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      { message: 'Error creating admin', error: errMessage },
      { status: 500 }
    );
  }
}
