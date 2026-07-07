// src/models/User.ts
import mongoose, {
  Schema,
  model,
  models,
  Document,
  Model,
  Types,
} from "mongoose";

// 1. Define the TypeScript interface
export interface IUser extends Document {
  _id: Types.ObjectId;
  name?: string;
  email: string;
  password: string;
  role: "admin" | "team";
}

// 2. Define the schema using that interface
const UserSchema = new Schema<IUser>({
  name: { type: String },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ["admin", "team"],
    required: true,
  },
});

// 3. Export the typed model
export const User: Model<IUser> = models.User || model<IUser>("User", UserSchema);
