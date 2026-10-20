
import mongoose, { Schema, models } from "mongoose";

const SubIssueSchema = new Schema({
  key: String,
  label: String,
  severity: { type: String, enum: ["minor", "major", "ok"] },
  comment: String,
  // images: [String], 
});

const InspectionTabSchema = new Schema({
  key: String,
  label: String,
  subIssues: [SubIssueSchema],
});

const JobSchema = new Schema(
  {
    jobCount: { type: Number, required: true, unique: true },
    carNumber: { type: String, required: true },
    customerName: { type: String, required: true },
    customerPhone: { type: String, trim: true },
    odometer: { type: Number },
    engineNumber: { type: String },
    inspectionType: { 
      type: String, 
      enum: ["Chassis inspection", "Paint inspection", "Paint and chassis inspection", "OBD inspection", "360 inspection", "Comprehensive Inspection"]
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "accepted", "rejected"],
      default: "pending",
    },
    inspectionTabs: [InspectionTabSchema],
    rejectionNote: String,
    price: { type: Number, default: 0, min: 0 },
    // Allowed values live in src/config/paymentMethods.json and are checked by the API,
    // so removing an option later never invalidates old jobs.
    paymentMethod: { type: String, trim: true, default: null },
  },
  { timestamps: true }
);

if (models.Job) {
  delete models.Job;
}

export const Job = mongoose.model("Job", JobSchema);