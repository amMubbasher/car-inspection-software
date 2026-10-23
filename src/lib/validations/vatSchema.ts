import { z } from "zod";

const name = z.string().trim().min(2, "Name must be at least 2 characters").max(120, "Name is too long");
const registrationNumber = z
  .string()
  .trim()
  .min(1, "VAT registration number is required")
  .max(50, "VAT registration number is too long");
const percentage = z.coerce
  .number("Enter a VAT percentage")
  .min(0, "VAT percentage can't be negative")
  .max(100, "VAT percentage can't be more than 100");

export const createVatSchema = z.strictObject({
  name,
  registrationNumber,
  percentage,
  isActive: z.boolean().optional().default(false),
});

export const updateVatSchema = z.strictObject({
  name: name.optional(),
  registrationNumber: registrationNumber.optional(),
  percentage: percentage.optional(),
  isActive: z.boolean().optional(),
});

export type CreateVatInput = z.infer<typeof createVatSchema>;
export type UpdateVatInput = z.infer<typeof updateVatSchema>;
