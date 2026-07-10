import { z } from "zod";

const userRoleSchema = z.enum(["admin", "team"], {
  message: "Invalid role",
});

export const createUserSchema = z.object({
  name: z.string().trim().min(1, "All fields required"),
  email: z.string().trim().toLowerCase().min(1, "All fields required"),
  password: z
    .string()
    .min(1, "All fields required")
    .min(6, "Password must be at least 6 characters"),
  role: userRoleSchema,
});

export const updateUserSchema = z.object({
  name: z.string().trim().optional(),
  email: z.string().trim().toLowerCase().min(1, "Email is required"),
  role: userRoleSchema,
  password: z
    .string()
    .optional()
    .refine((value) => !value || value.length >= 6, {
      message: "Password must be at least 6 characters",
    }),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
