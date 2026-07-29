// models/Student.js
import mongoose from "mongoose";

const studentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // optional — only if student has own login
    admissionNumber: { type: String, required: true, unique: true, trim: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    dateOfBirth: Date,
    gender: { type: String, enum: ["male", "female"] },

    class: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
    stream: { type: String, trim: true }, // e.g. "East" — matches a stream name on the Class doc

    action: { type: String, enum: ["enrolled", "promoted", "repeated", "transferred", "graduated"] },
    
    // Boarding assignment — null/undefined for day scholars or day-only schools
    dorm: { type: mongoose.Schema.Types.ObjectId, ref: "Dorm", default: null },

    // Informational tag only — "Class President", "Head Girl", etc. Never grants
    // any system permission; purely a label shown on the student's profile.
    displayRole: { type: String, trim: true, default: "" },

    guardians: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // parent login, if created
        name: String,
        relationship: String, // "Mother", "Father", "Guardian"
        phone: String,
        email: String,
        isPrimaryContact: { type: Boolean, default: false },
      },
    ],

    photoUrl: String, // Cloudinary

    status: {
      type: String,
      enum: ["active", "transferred", "graduated", "suspended", "archived"],
      default: "active",
    },

    admissionDate: { type: Date, default: Date.now },
    enrolledAcademicYear: String, // year string, matches School.academicYears[].year

    // history of class changes (promotions/repeats/transfers) for audit
    classHistory: [
      {
        class: { type: mongoose.Schema.Types.ObjectId, ref: "Class" },
        stream: String,
        academicYear: String,
        action: { type: String, enum: ["enrolled", "promoted", "repeated", "transferred"] },
        date: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

studentSchema.index({ admissionNumber: 1 });
studentSchema.index({ class: 1, stream: 1 });
studentSchema.index({ dorm: 1 });

export default mongoose.model("Student", studentSchema);
