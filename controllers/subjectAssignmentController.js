// controllers/subjectAssignmentController.js
import ClassSubject from "../models/ClassSubject.js";
import StudentSubject from "../models/StudentSubject.js";
import Student from "../models/Student.js";
import { logAction } from "../models/AuditLog.js";

/* ---------------- CLASS SUBJECT SETTINGS (curriculum) ---------------- */

// POST /api/class-subjects  { classId, subjectId, isCompulsory }
export const assignSubjectToClass = async (req, res) => {
  try {
    const { classId, subjectId, isCompulsory } = req.body;
    if (!classId || !subjectId) return res.status(400).json({ message: "classId and subjectId are required" });

    const doc = await ClassSubject.findOneAndUpdate(
      { class: classId, subject: subjectId },
      { isCompulsory: isCompulsory !== false },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    await logAction({ actor: req.user, action: "CLASS_SUBJECT_ASSIGNED", targetType: "Class", targetId: classId, details: { subjectId, isCompulsory }, req });
    res.status(201).json({ classSubject: doc });
  } catch (err) {
    res.status(500).json({ message: "Failed to assign subject", error: err.message });
  }
};

// GET /api/class-subjects?classId=
export const listClassSubjects = async (req, res) => {
  const filter = {};
  if (req.query.classId) filter.class = req.query.classId;
  const rows = await ClassSubject.find(filter).populate("subject", "name code isCore");
  res.json({
    compulsory: rows.filter((r) => r.isCompulsory),
    optional: rows.filter((r) => !r.isCompulsory),
  });
};

// DELETE /api/class-subjects/:id
export const removeClassSubject = async (req, res) => {
  const doc = await ClassSubject.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ message: "Assignment not found" });
  await StudentSubject.deleteMany({ subject: doc.subject }); // clean up any picks students made for it
  res.json({ message: "Removed" });
};

/* ---------------- STUDENT ELECTIVES ---------------- */

// GET /api/students/:id/subjects — compulsory (auto, from class) + chosen electives
export const getStudentSubjects = async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) return res.status(404).json({ message: "Student not found" });

  const classSubjects = await ClassSubject.find({ class: student.class }).populate("subject", "name code isCore");
  const compulsory = classSubjects.filter((r) => r.isCompulsory).map((r) => r.subject);
  const optionalOffered = classSubjects.filter((r) => !r.isCompulsory).map((r) => r.subject);

  const picks = await StudentSubject.find({ student: student._id }).populate("subject", "name code isCore");

  res.json({
    compulsory,
    optionalOffered,
    electives: picks.map((p) => ({ ...p.subject.toObject(), academicYear: p.academicYear })),
  });
};

// POST /api/students/:id/electives  { subjectId, academicYear }
export const addStudentElective = async (req, res) => {
  try {
    const { subjectId, academicYear } = req.body;
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    const offered = await ClassSubject.findOne({ class: student.class, subject: subjectId, isCompulsory: false });
    if (!offered) return res.status(400).json({ message: "That subject isn't optional for this student's class" });

    const pick = await StudentSubject.create({ student: student._id, subject: subjectId, academicYear });
    await logAction({ actor: req.user, action: "STUDENT_ELECTIVE_ADDED", targetType: "Student", targetId: student._id, details: { subjectId, academicYear }, req });
    res.status(201).json({ elective: pick });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "Already picked for this year" });
    res.status(500).json({ message: "Failed to add elective", error: err.message });
  }
};

// DELETE /api/students/:id/electives/:subjectId?academicYear=
export const removeStudentElective = async (req, res) => {
  await StudentSubject.findOneAndDelete({
    student: req.params.id,
    subject: req.params.subjectId,
    academicYear: req.query.academicYear,
  });
  res.json({ message: "Removed" });
};
