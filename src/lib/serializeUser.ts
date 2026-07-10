export type SafeUser = {
  _id: string;
  name?: string;
  email: string;
  role: "admin" | "team";
};

export function serializeUser(user: {
  _id?: { toString(): string } | string;
  name?: string;
  email: string;
  role: "admin" | "team";
}): SafeUser {
  return {
    _id: typeof user._id === "string" ? user._id : user._id?.toString() ?? "",
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

export function serializeUsers<T extends Parameters<typeof serializeUser>[0]>(
  users: T[]
): SafeUser[] {
  return users.map((user) => serializeUser(user));
}
