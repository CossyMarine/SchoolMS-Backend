// utils/admissionNumber.js
import Counter from "../models/Counter.js";

// Builds an admission number from the school's configured format string.
// Supported tokens: {YEAR}, {SEQ}, {SEQ:3} (zero-padded to 3 digits)
export async function generateAdmissionNumber(school, academicYear) {
  const seq = await Counter.nextSequence(`admission-${academicYear}`);

  return school.admissionNumberFormat.replace(
    /\{SEQ(?::(\d+))?\}|\{YEAR\}/g,
    (match, padLength) => {
      if (match === "{YEAR}") return academicYear;
      const pad = padLength ? parseInt(padLength, 10) : 0;
      return String(seq).padStart(pad, "0");
    }
  );
}
