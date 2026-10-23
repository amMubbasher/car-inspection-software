// src/models/Vat.ts
import { Schema, model, models, Model, Types } from "mongoose";

export interface IVat {
  _id: Types.ObjectId;
  /** Legal name registered for VAT, printed on receipts. */
  name: string;
  registrationNumber: string;
  /** Rate in percent, e.g. 5 for 5%. Job prices already include it. */
  percentage: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const VatSchema = new Schema<IVat>(
  {
    name: { type: String, required: true, trim: true },
    registrationNumber: { type: String, required: true, trim: true },
    percentage: { type: Number, required: true, min: 0, max: 100 },
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// At most one active VAT record.
VatSchema.index(
  { isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

export const Vat: Model<IVat> = models.Vat || model<IVat>("Vat", VatSchema);
