// types/next-auth.d.ts
import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      _id: string; //  renamed from id to _id for consistency
      email: string;
      name?: string;
      role: "admin" | "team";
    };
  }

  interface User {
    _id: string;
    email: string;
    name?: string;
    role: "admin" | "team";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    _id: string;
    email: string;
    name?: string;
    role: "admin" | "team";
  }
}
