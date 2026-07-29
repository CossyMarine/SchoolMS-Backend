// controllers/academicController.js
import Class from "../models/Class.js";
import Subject from "../models/Subject.js";
import School from "../models/School.js";
import { logAction } from "../models/AuditLog.js";

/* ---------------- CLASSES ---------------- */

// POST /api/classes  { name, level, streams: [], order }
export const createClass = async (req, res) => {
  try {
    const { name, level, streams, order } = req.body;
    if (!name || !level) return res.status(400).json({ message: "Name and level are required" });

    const exists = await Class.findOne({ name: name.trim() });
    if (exists) return res.status(409).json({ message: "A class with this name already exists" });

    const classDoc = await Class.create({
      name: name.trim(),
      level,
      streams: (streams || []).map((s) => s.trim()).filter(Boolean),
      order: order ?? 0,
    });

    await logAction({ actor: req.user, action: "CLASS_CREATED", targetType: "Class", targetId: classDoc._id, details: { name, level }, req });
    res.status(201).json({ class: classDoc });
  } catch (err) {
    res.status(500).json({ message: "Failed to create class", error: err.message });
  }
};

// GET /api/classes?level=
export const listClasses = async (req, res) => {
  const filter = {};
  if (req.query.level) filter.level = req.query.level;
  const classes = await Class.find(filter).sort({ order: 1, name: 1 });
  res.json({ classes });
};

// PATCH /api/classes/:id
export const updateClass = async (req, res) => {
  const { name, level, streams, order } = req.body;
  const classDoc = await Class.findById(req.params.id);
  if (!classDoc) return res.status(404).json({ message: "Class not found" });

  if (name) classDoc.name = name.trim();
  if (level) classDoc.level = level;
  if (streams) classDoc.streams = streams.map((s) => s.trim()).filter(Boolean);
  if (order !== undefined) classDoc.order = order;
  await classDoc.save();

  await logAction({ actor: req.user, action: "CLASS_UPDATED", targetType: "Class", targetId: classDoc._id, details: req.body, req });
  res.json({ class: classDoc });
};

// DELETE /api/classes/:id — blocked if students are enrolled
export const deleteClass = async (req, res) => {
  const Student = (await import("../models/Student.js")).default;
  const inUse = await Student.exists({ class: req.params.id, status: "active" });
  if (inUse) {
    return res.status(409).json({ message: "Cannot delete a class with active students enrolled" });
  }
  const classDoc = await Class.findByIdAndDelete(req.params.id);
  if (!classDoc) return res.status(404).json({ message: "Class not found" });

  await logAction({ actor: req.user, action: "CLASS_DELETED", targetType: "Class", targetId: classDoc._id, details: { name: classDoc.name }, req });
  res.json({ message: "Class deleted" });
};

/* ---------------- SUBJECTS ---------------- */

// POST /api/subjects  { name, code, levels: [], isCore }
export const createSubject = async (req, res) => {
  const { name, code, levels, isCore } = req.body;
  if (!name) return res.status(400).json({ message: "Subject name is required" });

  const subject = await Subject.create({
    name: name.trim(),
    code: code?.trim(),
    levels: levels || [],
    isCore: isCore !== false,
  });

  await logAction({ actor: req.user, action: "SUBJECT_CREATED", targetType: "Subject", targetId: subject._id, details: { name }, req });
  res.status(201).json({ subject });
};

// GET /api/subjects?level=
export const listSubjects = async (req, res) => {
  const filter = {};
  if (req.query.level) filter.levels = req.query.level;
  const subjects = await Subject.find(filter).sort({ name: 1 });
  res.json({ subjects });
};

export const updateSubject = async (req, res) => {
  const subject = await Subject.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!subject) return res.status(404).json({ message: "Subject not found" });
  res.json({ subject });
};

export const deleteSubject = async (req, res) => {
  const subject = await Subject.findByIdAndDelete(req.params.id);
  if (!subject) return res.status(404).json({ message: "Subject not found" });
  res.json({ message: "Subject deleted" });
};

/* ---------------- SCHOOL CONFIG (fee types, academic years/terms) ---------------- */

// GET /api/school-config
export const getSchoolConfig = async (req, res) => {
  const school = await School.getConfig();
  res.json({ school });
};

// PATCH /api/school-config
export const updateSchoolConfig = async (req, res) => {
  const school = await School.getConfig();
  const allowed = [
    "name", "schoolType", "logoUrl", "motto", "vision", "mission",
    "address", "phone", "email", "admissionNumberFormat", "gradingSystem",
  ];
  for (const field of allowed) {
    if (req.body[field] !== undefined) school[field] = req.body[field];
  }
  await school.save();

  await logAction({ actor: req.user, action: "SCHOOL_CONFIG_UPDATED", targetType: "School", targetId: school._id, details: req.body, req });
  res.json({ school });
};

// POST /api/school-config/fee-types  { name, code, isRecurringPerTerm, appliesTo }
export const addFeeType = async (req, res) => {
  const school = await School.getConfig();
  school.feeTypes.push(req.body);
  await school.save();

  await logAction({ actor: req.user, action: "FEE_TYPE_ADDED", targetType: "School", targetId: school._id, details: req.body, req });
  res.status(201).json({ feeTypes: school.feeTypes });
};

// POST /api/school-config/academic-years  { year, terms: [{name, startDate, endDate}] }
export const addAcademicYear = async (req, res) => {
  const school = await School.getConfig();
  const { year, terms } = req.body;
  if (school.academicYears.some((y) => y.year === year)) {
    return res.status(409).json({ message: "Academic year already exists" });
  }
  school.academicYears.push({ year, terms: terms || [] });
  await school.save();
  res.status(201).json({ academicYears: school.academicYears });
};

// PATCH /api/school-config/academic-years/:yearId/set-current
export const setCurrentTerm = async (req, res) => {
  const school = await School.getConfig();
  const { yearId } = req.params;
  school.academicYears.forEach((y) => (y.isCurrent = String(y._id) === yearId));
  await school.save();
  res.json({ academicYears: school.academicYears });
};
