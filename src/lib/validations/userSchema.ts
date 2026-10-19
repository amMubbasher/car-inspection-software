import { z } from "zod";
import { ALL_PERMISSIONS, normalizePermissions } from "@/lib/rbac/permissions";

export const PASSWORD_MIN_LENGTH = 8;

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(200, "Password is too long");

export const permissionListSchema = z
  .array(z.enum(ALL_PERMISSIONS, { message: "Unknown permission" }))
  .max(ALL_PERMISSIONS.length * 2)
  .transform((values) => normalizePermissions(values));

// Strict objects reject unknown keys, so fields like `permissions` or `isSuperAdmin`
// can never be smuggled into an endpoint that isn't meant to change them.
export const createUserSchema = z.strictObject({
  name: z.string().trim().min(1, "All fields required").max(100),
  email: z.string().trim().toLowerCase().min(1, "All fields required").email("Invalid email").max(254),
  password: passwordSchema,
  roleId: objectId.optional(),
});

export const updateUserSchema = z.strictObject({
  name: z.string().trim().min(1, "Name is required").max(100).optional(),
  email: z.string().trim().toLowerCase().min(1, "Email is required").email("Invalid email").max(254).optional(),
  roleId: objectId.optional(),
  password: z
    .string()
    .optional()
    .refine((value) => !value || value.length >= PASSWORD_MIN_LENGTH, {
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    })
    .refine((value) => !value || value.length <= 200, { message: "Password is too long" }),
});

export const userPermissionsSchema = z.strictObject({
  permissions: permissionListSchema,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
