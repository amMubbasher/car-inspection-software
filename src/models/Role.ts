// src/models/Role.ts
import { Schema, model, models, Document, Model, Types } from "mongoose";
import { isPermission } from "@/lib/rbac/permissions";

export interface IRole extends Document {
  _id: Types.ObjectId;
  key: string;
  name: string;
  description?: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RoleSchema = new Schema<IRole>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      lowercase: true,
      trim: true,
    },
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true, default: "" },
    permissions: {
      type: [String],
      default: [],
      validate: {
        validator: (values: string[]) => values.every(isPermission),
        message: "Unknown permission",
      },
    },
    isSystem: { type: Boolean, default: false, immutable: true },
  },
  { timestamps: true }
);

export const Role: Model<IRole> = models.Role || model<IRole>("Role", RoleSchema);
