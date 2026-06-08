import CredentialsProvider from "next-auth/providers/credentials";
import { User } from "@/models/User";
import { connectToDB } from "@/lib/db";
import bcrypt from "bcrypt";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      // @ts-expect-error - we're returning a custom user object
      async authorize(credentials) {
        await connectToDB();
        const user = await User.findOne({ email: credentials.email });
        if (!user) throw new Error("No user found");

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) throw new Error("Invalid password");

        return {
          _id: user._id.toString(), //  send _id explicitly
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token._id = user._id;
        token.role = user.role;
      }
      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user._id = token._id;
        session.user.role = token.role;
      }
      return session;
    },
  },

  session: { strategy: "jwt" as const },

  pages: {
    signIn: "/login",
  },

  secret: process.env.NEXTAUTH_SECRET,
};
