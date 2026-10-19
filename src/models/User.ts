// src/models/User.ts
import { Schema, model, models, Document, Model, Types } from "mongoose";
import { isPermission } from "@/lib/rbac/permissions";

// 1. Define the TypeScript interface
export interface IUser extends Document {
  _id: Types.ObjectId;
  name?: string;
  email: string;
  password: string;
  roleId?: Types.ObjectId | null;
  permissions: string[];
  sessionVersion: number;
  failedLoginAttempts: number;
  lockUntil?: Date | null;
  /** Legacy "admin" | "team" value, removed by scripts/seed-rbac.ts. */
  role?: string;
}

// 2. Define the schema using that interface
const UserSchema = new Schema<IUser>({
  name: { type: String },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  roleId: { type: Schema.Types.ObjectId, ref: "Role", default: null, index: true },
  permissions: {
    type: [String],
    default: [],
    validate: {
      validator: (values: string[]) => values.every(isPermission),
      message: "Unknown permission",
    },
  },
  sessionVersion: { type: Number, default: 0 },
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null },
  role: { type: String },
});

// 3. Export the typed model
export const User: Model<IUser> = models.User || model<IUser>("User", UserSchema);
