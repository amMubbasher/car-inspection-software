// types/next-auth.d.ts
import "next-auth";
import "next-auth/jwt";

// The token only identifies the user. Roles and permissions are always read
// from the database (see src/lib/rbac/server.ts), never trusted from the token.
declare module "next-auth" {
  interface Session {
    user: {
      _id: string;
      email: string;
      name?: string;
      /** Session version; must match the user's sessionVersion in the DB. */
      sv: number;
    };
  }

  interface User {
    _id: string;
    email: string;
    name?: string;
    sv: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    _id: string;
    email: string;
    name?: string;
    sv: number;
  }
}
