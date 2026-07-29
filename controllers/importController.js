// controllers/importController.js
import ExcelJS from "exceljs";
import bcrypt from "bcryptjs";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import User from "../models/User.js";
import Class from "../models/Class.js";

// Expected columns for student import sheet:
// admissionNumber | firstName | lastName | dateOfBirth | gender | className | stream | guardianName | guardianPhone

// POST /api/import/students  (multipart file upload, field name "file")
export const importStudents = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const sheet = workbook.worksheets[0];

    const classes = await Class.find();
    const classByName = new Map(classes.map((c) => [c.name.toLowerCase(), c]));
    const existingAdmissionNumbers = new Set(
      (await Student.find({}, "admissionNumber")).map((s) => s.admissionNumber)
    );

    const errors = [];
    const validRows = [];
    const seenInFile = new Set();

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // header row

      const admissionNumber = String(row.getCell(1).value || "").trim();
      const firstName = String(row.getCell(2).value || "").trim();
      const lastName = String(row.getCell(3).value || "").trim();
      const dateOfBirth = row.getCell(4).value;
      const gender = String(row.getCell(5).value || "").trim().toLowerCase();
      const className = String(row.getCell(6).value || "").trim();
      const stream = String(row.getCell(7).value || "").trim();
      const guardianName = String(row.getCell(8).value || "").trim();
      const guardianPhone = String(row.getCell(9).value || "").trim();

      const rowErrors = [];
      if (!admissionNumber) rowErrors.push("Missing admission number");
      if (!firstName || !lastName) rowErrors.push("Missing first/last name");
      if (!className) rowErrors.push("Missing class");

      if (admissionNumber && existingAdmissionNumbers.has(admissionNumber)) {
        rowErrors.push(`Duplicate admission number in database: ${admissionNumber}`);
      }
      if (admissionNumber && seenInFile.has(admissionNumber)) {
        rowErrors.push(`Duplicate admission number within file: ${admissionNumber}`);
      }
      seenInFile.add(admissionNumber);

      const classDoc = classByName.get(className.toLowerCase());
      if (className && !classDoc) {
        rowErrors.push(`Invalid class: "${className}" does not exist — create it first`);
      }
      if (classDoc && stream && !classDoc.streams.includes(stream)) {
        rowErrors.push(`Invalid stream "${stream}" for class "${className}"`);
      }

      if (rowErrors.length) {
        errors.push({ row: rowNumber, admissionNumber, errors: rowErrors });
      } else {
        validRows.push({
          admissionNumber,
          firstName,
          lastName,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
          gender: ["male", "female"].includes(gender) ? gender : undefined,
          class: classDoc._id,
          stream,
          guardians: guardianName
            ? [{ name: guardianName, phone: guardianPhone, relationship: "Guardian", isPrimaryContact: true }]
            : [],
          status: "active",
          classHistory: [{ class: classDoc._id, stream, action: "enrolled" }],
        });
      }
    });

    // Dry-run mode: return validation results without saving, so the admin can review first
    if (req.query.dryRun === "true") {
      return res.json({
        totalRows: validRows.length + errors.length,
        validCount: validRows.length,
        errorCount: errors.length,
        errors,
      });
    }

    if (validRows.length === 0) {
      return res.status(400).json({ message: "No valid rows to import", errors });
    }

    const inserted = await Student.insertMany(validRows, { ordered: false });

    res.json({
      message: `Imported ${inserted.length} students`,
      importedCount: inserted.length,
      errorCount: errors.length,
      errors, // still return skipped rows so admin can fix and re-upload just those
    });
  } catch (err) {
    res.status(500).json({ message: "Import failed", error: err.message });
  }
};

// POST /api/import/teachers — same dry-run/validate/insert pattern
// Columns: staffId | fullName | email | phone
export const importTeachers = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const sheet = workbook.worksheets[0];

    const existingStaffIds = new Set((await Teacher.find({}, "staffId")).map((t) => t.staffId));
    const existingEmails = new Set((await User.find({}, "email")).map((u) => u.email));

    const errors = [];
    const validRows = [];
    const seenStaffIds = new Set();

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const staffId = String(row.getCell(1).value || "").trim();
      const fullName = String(row.getCell(2).value || "").trim();
      const email = String(row.getCell(3).value || "").trim().toLowerCase();
      const phone = String(row.getCell(4).value || "").trim();

      const rowErrors = [];
      if (!staffId) rowErrors.push("Missing staff ID");
      if (!fullName) rowErrors.push("Missing full name");
      if (staffId && (existingStaffIds.has(staffId) || seenStaffIds.has(staffId))) {
        rowErrors.push(`Duplicate staff ID: ${staffId}`);
      }
      if (email && existingEmails.has(email)) {
        rowErrors.push(`Email already registered: ${email}`);
      }
      seenStaffIds.add(staffId);

      if (rowErrors.length) {
        errors.push({ row: rowNumber, staffId, errors: rowErrors });
      } else {
        validRows.push({ staffId, fullName, email, phone });
      }
    });

    if (req.query.dryRun === "true") {
      return res.json({
        totalRows: validRows.length + errors.length,
        validCount: validRows.length,
        errorCount: errors.length,
        errors,
      });
    }

    const createdTeachers = [];
    for (const row of validRows) {
      const tempPassword = Math.random().toString(36).slice(-8);
      const user = await User.create({
        fullName: row.fullName,
        email: row.email || undefined,
        phone: row.phone || undefined,
        password: await bcrypt.hash(tempPassword, 10),
        role: "teacher",
      });
      const teacher = await Teacher.create({ user: user._id, staffId: row.staffId, assignments: [] });
      createdTeachers.push(teacher);
      // TODO: send tempPassword via messaging module once built
    }

    res.json({
      message: `Imported ${createdTeachers.length} teachers`,
      importedCount: createdTeachers.length,
      errorCount: errors.length,
      errors,
    });
  } catch (err) {
    res.status(500).json({ message: "Import failed", error: err.message });
  }
};
