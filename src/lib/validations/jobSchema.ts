import { z } from "zod";
import { PAYMENT_METHOD_VALUES } from "@/config/paymentMethods";

export const paymentMethodSchema = z.enum(
  PAYMENT_METHOD_VALUES as [string, ...string[]],
  "Select a valid payment method"
);
export const PAYMENT_METHOD_REQUIRED = "Select a payment method when the price is more than 0";

export const subIssueSchema = z.object({
  key: z.string(),
  label: z.string(),
  severity: z.enum(["minor", "major", "ok"]),
  comment: z.string().optional(),
  // images: z.array(z.string()).optional(),
});

export const inspectionTabSchema = z.object({
  key: z.string(),
  label: z.string(),
  subIssues: z.array(subIssueSchema),
});

export const jobSchema = z.object({
  carNumber: z.string().min(1, "Car number is required"),
  customerName: z.string().min(1).optional(),
  customerPhone: z.string().trim().optional(),
  engineNumber: z.string().optional(),
  odometer: z.number().optional(),
  inspectionType: z.enum(["Chassis inspection", "Paint inspection", "Paint and chassis inspection", "OBD inspection", "360 inspection", "Comprehensive Inspection"]).optional(),
  inspectionTabs: z.array(inspectionTabSchema),
  price: z.coerce.number().min(0).optional().default(0),
  paymentMethod: paymentMethodSchema.nullable().optional(),
  status: z.enum(["pending", "in_progress", "completed", "rejected"]).optional(),
});

const optionalNumber = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().min(0).optional()
);

/** Fields an editor may change. customerName and createdBy are fixed at creation. */
export const jobEditSchema = z.strictObject({
  carNumber: z.string().trim().min(1, "Car number is required").max(50).optional(),
  customerPhone: z.string().trim().max(50).optional(),
  engineNumber: z.string().trim().max(100).nullable().optional(),
  odometer: optionalNumber,
  inspectionType: jobSchema.shape.inspectionType,
  price: optionalNumber,
  paymentMethod: paymentMethodSchema.nullable().optional(),
  inspectionTabs: z.array(inspectionTabSchema).max(100).optional(),
  // Review fields (need jobs.review)
  status: z.enum(["accepted", "rejected"]).optional(),
  rejectionNote: z.string().trim().max(1000).optional(),
});
