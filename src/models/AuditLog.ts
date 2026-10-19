// src/models/AuditLog.ts
import { Schema, model, models, Model, Types } from "mongoose";

export interface IAuditLog {
  actorId: Types.ObjectId;
  action: string;
  targetType: "user" | "role" | "job";
  targetId?: Types.ObjectId | null;
  before?: unknown;
  after?: unknown;
  ip?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: { type: String, required: true },
    targetType: { type: String, enum: ["user", "role", "job"], required: true },
    targetId: { type: Schema.Types.ObjectId, default: null, index: true },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    ip: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const AuditLog: Model<IAuditLog> =
  models.AuditLog || model<IAuditLog>("AuditLog", AuditLogSchema);
