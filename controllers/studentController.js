// controllers/studentController.js
import bcrypt from "bcryptjs";
import Student from "../models/Student.js";
import User from "../models/User.js";
import Class from "../models/Class.js";
import School from "../models/School.js";
import { generateAdmissionNumber } from "../utils/admissionNumber.js";
import { logAction } from "../models/AuditLog.js";

// POST /api/students — single admission
export const admitStudent = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      dateOfBirth,
      gender,
      classId,
      stream,
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

    let admissionNumber = manualAdmissionNumber?.trim();
    if (admissionNumber) {
      const exists = await Student.findOne({ admissionNumber });
      if (exists) return res.status(409).json({ message: "Admission number already in use" });
    } else {
      const school = await School.getConfig();
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
    res.status(500).json({ message: "Admission failed", error: err.message });
  }
};

// GET /api/students?classId=&stream=&status=&search=
export const listStudents = async (req, res) => {
  const { classId, stream, status, search } = req.query;
  const filter = {};
  if (classId) filter.class = classId;
  if (stream) filter.stream = stream;
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
    .sort({ lastName: 1 })
    .limit(500);

  res.json({ students });
};

// GET /api/students/:id
export const getStudent = async (req, res) => {
  const student = await Student.findById(req.params.id).populate("class", "name level streams");
  if (!student) return res.status(404).json({ message: "Student not found" });
  res.json({ student });
};

// PATCH /api/students/:id
export const updateStudent = async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) return res.status(404).json({ message: "Student not found" });

  const allowed = ["firstName", "lastName", "dateOfBirth", "gender", "photoUrl", "status"];
  for (const field of allowed) {
    if (req.body[field] !== undefined) student[field] = req.body[field];
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
};

// POST /api/students/:id/promote  { newClassId, newStream, academicYear, action }
// action: "promoted" | "repeated" | "transferred"
export const changeStudentClass = async (req, res) => {
  const { newClassId, newStream, academicYear, action } = req.body;
  const student = await Student.findById(req.params.id);
  if (!student) return res.status(404).json({ message: "Student not found" });

  const newClass = await Class.findById(newClassId);
  if (!newClass) return res.status(400).json({ message: "Invalid class" });

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
