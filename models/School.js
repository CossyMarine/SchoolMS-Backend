// models/School.js
// Singleton config document — one per deployed database (one school per instance).
import mongoose from "mongoose";

const feeTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // "Tuition", "Transport", "RIM Papers"
    code: { type: String, trim: true, uppercase: true }, // short code for receipts
    isRecurringPerTerm: { type: Boolean, default: true },
    appliesTo: {
      type: String,
      enum: ["all", "class", "stream", "individual"],
      default: "all",
    },
  },
  { _id: true, timestamps: false }
);

const termSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // "Term 1"
    startDate: Date,
    endDate: Date,
  },
  { _id: true }
);

const academicYearSchema = new mongoose.Schema(
  {
    year: { type: String, required: true }, // "2026"
    terms: [termSchema],
    isCurrent: { type: Boolean, default: false },
  },
  { _id: true }
);

// Admission-time defaults — fully configurable per school, since one deployment
// might be a day school with no dorms, another a mixed boarding school, etc.
const admissionSettingsSchema = new mongoose.Schema(
  {
    // "askEachTime" -> admin picks male/female per student
    // "allMale" / "allFemale" -> every admitted student is set to that gender automatically
    genderMode: {
      type: String,
      enum: ["askEachTime", "allMale", "allFemale"],
      default: "askEachTime",
    },
    // "none" -> no dorm assignment at all (day schools)
    // "single" -> school has exactly one dorm, auto-assigned, no picker shown
    // "multiple" -> admin picks from the Dorms list
    dormMode: {
      type: String,
      enum: ["none", "single", "multiple"],
      default: "none",
    },
  },
  { _id: false }
);

const schoolSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    schoolType: {
      type: [String],
      enum: ["primary", "jss", "secondary", "academy"],
      default: [],
    },
    logoUrl: String,
    motto: String,
    vision: String,
    mission: String,
    address: String,
    phone: String,
    email: String,

    // Academic structure — fully configurable, never hardcoded
    academicYears: [academicYearSchema],
    feeTypes: [feeTypeSchema],

    // Admission number format, e.g. "ADM-{YEAR}-{SEQ:3}"
    admissionNumberFormat: { type: String, default: "ADM-{YEAR}-{SEQ}" },

    admissionSettings: { type: admissionSettingsSchema, default: () => ({}) },

    gradingSystem: {
      type: String,
      enum: ["cbc", "percentage", "custom"],
      default: "percentage",
    },

    // public landing page content
    landingPage: {
      heroTagline: String,
      announcements: [
        {
          title: String,
          body: String,
          category: String,
          postedAt: { type: Date, default: Date.now },
        },
      ],
      galleryImages: [String], // Cloudinary URLs
    },

    setupCompleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Enforce a true singleton — never allow a second School doc
schoolSchema.statics.getConfig = async function () {
  let school = await this.findOne();
  if (!school) school = await this.create({ name: "My School" });
  return school;
};

export default mongoose.model("School", schoolSchema);
