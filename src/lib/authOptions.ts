import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import { User } from "@/models/User";
import { connectToDB } from "@/lib/db";
import bcrypt from "bcryptjs";

export const BCRYPT_COST = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = "$2b$12$z9ZPlCNoJVT9kJq5SA4Sg.FB3IycKdXWb4MP/.WProlJO91DNoyOC";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        if (credentials.password.length > 200) return null;

        await connectToDB();
        const email = credentials.email.trim().toLowerCase();
        // Explicit inclusion (not "+password") so the hash is always returned, even by a
        // model compiled from an older schema that is still cached in a running dev server.
        const user = await User.findOne({ email }).select({
          password: 1,
          name: 1,
          email: 1,
          sessionVersion: 1,
          failedLoginAttempts: 1,
          lockUntil: 1,
        });
        if (!user?.password) {
          await bcrypt.compare(credentials.password, DUMMY_HASH);
          return null;
        }

        if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          const attempts = (user.failedLoginAttempts ?? 0) + 1;
          await User.updateOne(
            { _id: user._id },
            attempts >= MAX_FAILED_ATTEMPTS
              ? { failedLoginAttempts: 0, lockUntil: new Date(Date.now() + LOCK_DURATION_MS) }
              : { failedLoginAttempts: attempts }
          );
          return null;
        }

        if (user.failedLoginAttempts || user.lockUntil) {
          await User.updateOne(
            { _id: user._id },
            { failedLoginAttempts: 0, lockUntil: null }
          );
        }

        return {
          id: user._id.toString(),
          _id: user._id.toString(),
          email: user.email,
          name: user.name?.trim() || "",
          sv: user.sessionVersion ?? 0,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token._id = user._id;
        token.email = user.email;
        token.name = user.name || "";
        token.sv = user.sv;
      }
      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user._id = token._id;
        session.user.sv = token.sv;
        if (token.email) session.user.email = token.email;
        session.user.name = token.name || "";
      }
      return session;
    },
  },

  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },

  pages: {
    signIn: "/login",
  },

  secret: process.env.NEXTAUTH_SECRET,
};
