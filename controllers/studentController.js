// controllers/studentController.js
import bcrypt from "bcryptjs";
import Student from "../models/Student.js";
import User from "../models/User.js";
import Class from "../models/Class.js";
import School from "../models/School.js";
import Dorm from "../models/Dorm.js";
import Counter from "../models/Counter.js";
import { generateAdmissionNumber } from "../utils/admissionNumber.js";
import { logAction } from "../models/AuditLog.js";

// Resolves gender + dorm for a new admission against the school's configured
// admissionSettings, so the same rules apply no matter which school this
// deployment serves (day school, all-boys, mixed boarding, etc).
async function resolveGenderAndDorm(school, body) {
  const { genderMode, dormMode } = school.admissionSettings || {};

  // ---- Gender ----
  let gender;
  if (genderMode === "allMale") gender = "male";
  else if (genderMode === "allFemale") gender = "female";
  else {
    if (!body.gender) throw { status: 400, message: "Gender is required for this school's admission settings" };
    gender = body.gender;
  }

  // ---- Dorm ----
  let dorm = null;
  if (dormMode === "single") {
    const soleDorm = await Dorm.findOne({ isActive: true }).sort({ createdAt: 1 });
    if (!soleDorm) {
      throw {
        status: 400,
        message: "No dorm has been set up yet — add the school's dorm in Admissions Settings first",
      };
    }
    dorm = soleDorm._id;
  } else if (dormMode === "multiple") {
    if (body.dormId) {
      const chosenDorm = await Dorm.findById(body.dormId);
      if (!chosenDorm || !chosenDorm.isActive) {
        throw { status: 400, message: "Selected dorm is invalid or inactive" };
      }
      if (chosenDorm.genderRestriction !== "any" && chosenDorm.genderRestriction !== gender) {
        throw { status: 400, message: `"${chosenDorm.name}" does not accept ${gender} students` };
      }
      dorm = chosenDorm._id;
    }
    // dormMode "multiple" with no dormId provided = day scholar, dorm stays null
  }
  // dormMode "none" -> dorm stays null regardless of anything sent

  return { gender, dorm };
}

// GET /api/students/next-admission-number?academicYear=2026
export const previewNextAdmissionNumber = async (req, res) => {
  try {
    const { academicYear } = req.query;
    if (!academicYear) return res.status(400).json({ message: "academicYear is required" });

    const school = await School.getConfig();
    const seq = await Counter.peekNextSequence(`admission-${academicYear}`);
    const admissionNumber = school.admissionNumberFormat.replace(
      /\{SEQ(?::(\d+))?\}|\{YEAR\}/g,
      (match, padLength) => {
        if (match === "{YEAR}") return academicYear;
        const pad = padLength ? parseInt(padLength, 10) : 0;
        return String(seq).padStart(pad, "0");
      }
    );
    res.json({ admissionNumber });
  } catch (err) {
    res.status(500).json({ message: "Failed to preview admission number", error: err.message });
  }
};

// POST /api/students — single admission
export const admitStudent = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      dateOfBirth,
      classId,
      stream,
      displayRole,
      admissionNumber: manualAdmissionNumber, // optional — school's own numbering
      academicYear,
      guardians, // [{ name, relationship, phone, email, isPrimaryContact, createLogin }]
    } = req.body;

    if (!firstName || !lastName || !classId || !academicYear) {
      return res.status(400).json({ message: "Missing required admission fields" });
    }

    const classDoc = await Class.findById(classId);
    if (!classDoc) return res.status(400).json({ message: "Invalid class" });
    if (stream && !classDoc.streams.includes(stream)) {
      return res.status(400).json({ message: `Stream "${stream}" does not exist on ${classDoc.name}` });
    }
    if (classDoc.streams.length > 0 && !stream) {
      return res.status(400).json({ message: `${classDoc.name} has streams — a stream must be selected` });
    }

    const school = await School.getConfig();
    const { gender, dorm } = await resolveGenderAndDorm(school, req.body);

    let admissionNumber = manualAdmissionNumber?.trim();
    if (admissionNumber) {
      const exists = await Student.findOne({ admissionNumber });
      if (exists) return res.status(409).json({ message: "Admission number already in use" });
    } else {
      admissionNumber = await generateAdmissionNumber(school, academicYear);
    }

    // Optionally create parent logins for guardians
    const guardianDocs = [];
    for (const g of guardians || []) {
      let parentUser = null;
      if (g.createLogin && (g.email || g.phone)) {
        const tempPassword = Math.random().toString(36).slice(-8);
        parentUser = await User.create({
          fullName: g.name,
          email: g.email?.toLowerCase(),
          phone: g.phone,
          password: await bcrypt.hash(tempPassword, 10),
          role: "parent",
        });
        // TODO: send tempPassword to guardian via SMS/email once messaging module exists
      }
      guardianDocs.push({
        user: parentUser?._id,
        name: g.name,
        relationship: g.relationship,
        phone: g.phone,
        email: g.email,
        isPrimaryContact: !!g.isPrimaryContact,
      });
    }

    const student = await Student.create({
      admissionNumber,
      firstName,
      lastName,
      dateOfBirth,
      gender,
      class: classId,
      stream,
      dorm,
      displayRole: displayRole?.trim() || "",
      guardians: guardianDocs,
      enrolledAcademicYear: academicYear,
      classHistory: [{ class: classId, stream, academicYear, action: "enrolled" }],
    });

    await logAction({
      actor: req.user,
      action: "STUDENT_ADMITTED",
      targetType: "Student",
      targetId: student._id,
      details: { admissionNumber, class: classDoc.name },
      req,
    });

    res.status(201).json({ student });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ message: err.message || "Admission failed", error: err.error });
  }
};

// GET /api/students?classId=&stream=&status=&search=&gender=&dormId=
export const listStudents = async (req, res) => {
  const { classId, stream, status, search, gender, dormId } = req.query;
  const filter = {};
  if (classId) filter.class = classId;
  if (stream) filter.stream = stream;
  if (gender) filter.gender = gender;
  if (dormId) filter.dorm = dormId;
  filter.status = status || "active";
  if (search) {
    filter.$or = [
      { firstName: new RegExp(search, "i") },
      { lastName: new RegExp(search, "i") },
      { admissionNumber: new RegExp(search, "i") },
    ];
  }

  const students = await Student.find(filter)
    .populate("class", "name level")
    .populate("dorm", "name")
    .sort({ lastName: 1 })
    .limit(500);

  res.json({ students });
};

// GET /api/students/:id
export const getStudent = async (req, res) => {
  const student = await Student.findById(req.params.id)
    .populate("class", "name level streams")
    .populate("dorm", "name genderRestriction");
  if (!student) return res.status(404).json({ message: "Student not found" });
  res.json({ student });
};

// PATCH /api/students/:id — core fields, dorm re-assignment, display role
export const updateStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    const allowed = ["firstName", "lastName", "dateOfBirth", "gender", "photoUrl", "status", "displayRole"];
    for (const field of allowed) {
      if (req.body[field] !== undefined) student[field] = req.body[field];
    }

    if (req.body.dormId !== undefined) {
      const school = await School.getConfig();
      const dormMode = school.admissionSettings?.dormMode || "none";
      if (dormMode === "none") {
        student.dorm = null;
      } else if (!req.body.dormId) {
        student.dorm = null; // explicitly cleared — day scholar
      } else {
        const chosenDorm = await Dorm.findById(req.body.dormId);
        if (!chosenDorm || !chosenDorm.isActive) {
          return res.status(400).json({ message: "Selected dorm is invalid or inactive" });
        }
        if (chosenDorm.genderRestriction !== "any" && chosenDorm.genderRestriction !== student.gender) {
          return res.status(400).json({ message: `"${chosenDorm.name}" does not accept ${student.gender} students` });
        }
        student.dorm = chosenDorm._id;
      }
    }

    await student.save();

    await logAction({
      actor: req.user,
      action: "STUDENT_UPDATED",
      targetType: "Student",
      targetId: student._id,
      details: req.body,
      req,
    });

    res.json({ student });
  } catch (err) {
    res.status(500).json({ message: "Update failed", error: err.message });
  }
};

// PATCH /api/students/:id/guardians  { guardians: [...] } — full replace
export const updateGuardians = async (req, res) => {
  try {
    const { guardians } = req.body;
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    const guardianDocs = [];
    for (const g of guardians || []) {
      let userId = g.user || null;
      if (!userId && g.createLogin && (g.email || g.phone)) {
        const tempPassword = Math.random().toString(36).slice(-8);
        const parentUser = await User.create({
          fullName: g.name,
          email: g.email?.toLowerCase(),
          phone: g.phone,
          password: await bcrypt.hash(tempPassword, 10),
          role: "parent",
        });
        userId = parentUser._id;
      }
      guardianDocs.push({
        user: userId,
        name: g.name,
        relationship: g.relationship,
        phone: g.phone,
        email: g.email,
        isPrimaryContact: !!g.isPrimaryContact,
      });
    }

    student.guardians = guardianDocs;
    await student.save();

    await logAction({
      actor: req.user,
      action: "STUDENT_GUARDIANS_UPDATED",
      targetType: "Student",
      targetId: student._id,
      details: { count: guardianDocs.length },
      req,
    });

    res.json({ student });
  } catch (err) {
    res.status(500).json({ message: "Failed to update guardians", error: err.message });
  }
};

// POST /api/students/:id/promote  { newClassId, newStream, academicYear, action }
// action: "promoted" | "repeated" | "transferred"
export const changeStudentClass = async (req, res) => {
  const { newClassId, newStream, academicYear, action } = req.body;
  const student = await Student.findById(req.params.id);
  if (!student) return res.status(404).json({ message: "Student not found" });

  const newClass = await Class.findById(newClassId);
  if (!newClass) return res.status(400).json({ message: "Invalid class" });
  if (newClass.streams.length > 0 && !newStream) {
    return res.status(400).json({ message: `${newClass.name} has streams — a stream must be selected` });
  }

  student.class = newClassId;
  student.stream = newStream;
  student.classHistory.push({
    class: newClassId,
    stream: newStream,
    academicYear,
    action: action || "promoted",
  });
  await student.save();

  await logAction({
    actor: req.user,
    action: `STUDENT_${(action || "promoted").toUpperCase()}`,
    targetType: "Student",
    targetId: student._id,
    details: { newClass: newClass.name, newStream },
    req,
  });

  res.json({ student });
};

// PATCH /api/students/:id/archive  { status: "transferred"|"graduated"|"suspended"|"archived" }
export const archiveStudent = async (req, res) => {
  const { status } = req.body;
  const student = await Student.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true }
  );
  if (!student) return res.status(404).json({ message: "Student not found" });

  await logAction({
    actor: req.user,
    action: "STUDENT_ARCHIVED",
    targetType: "Student",
    targetId: student._id,
    details: { status },
    req,
  });

  res.json({ student });
};

// GET /api/students/me — student sees own record, parent sees linked children
export const getMyStudentRecords = async (req, res) => {
  if (req.user.role === "student") {
    const student = await Student.findOne({ user: req.user._id }).populate("class", "name streams level");
    if (!student) return res.status(404).json({ message: "No student record linked to this account" });
    return res.json({ students: [student] });
  }

  if (req.user.role === "parent") {
    const students = await Student.find({ "guardians.user": req.user._id }).populate("class", "name streams level");
    return res.json({ students });
  }

  return res.status(403).json({ message: "Not applicable for this role" });
};
