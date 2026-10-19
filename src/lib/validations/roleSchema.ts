import { z } from "zod";
import { permissionListSchema } from "@/lib/validations/userSchema";

export const createRoleSchema = z.strictObject({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(50, "Name is too long"),
  description: z.string().trim().max(200, "Description is too long").optional().default(""),
  permissions: permissionListSchema,
});

export const updateRoleSchema = z.strictObject({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(50, "Name is too long").optional(),
  description: z.string().trim().max(200, "Description is too long").optional(),
  permissions: permissionListSchema.optional(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
