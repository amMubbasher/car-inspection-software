
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
    odometer: { type: Number },
    engineNumber: { type: String },
    inspectionType: { 
      type: String, 
      enum: ["Chassis inspection", "Paint inspection", "Paint and chassis inspection", "OBD inspection", "360 inspection", "Auction Comprehensive Inspection"]
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "rejected"],
      default: "pending",
    },
    inspectionTabs: [InspectionTabSchema],
    rejectionNote: String,
  },
  { timestamps: true }
);

export const Job = models.Job || mongoose.model("Job", JobSchema);