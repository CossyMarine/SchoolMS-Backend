// controllers/academicController.js
import Class from "../models/Class.js";
import Subject from "../models/Subject.js";
import Teacher from "../models/Teacher.js";
import Student from "../models/Student.js";
import School from "../models/School.js";
import { logAction } from "../models/AuditLog.js";

/* ---------------- CLASSES ---------------- */

// accepts streams as ["East","West"] or [{name, capacity}]
function normalizeStreams(streams) {
  if (!Array.isArray(streams)) return [];
  return streams
    .map((s) =>
      typeof s === "string"
        ? { name: s.trim(), capacity: null }
        : { name: s.name?.trim(), capacity: s.capacity ?? null }
    )
    .filter((s) => s.name);
}

// POST /api/classes  { name, level, streams, capacity, order, promotesTo, isGraduating }
export const createClass = async (req, res) => {
  try {
    const { name, level, streams, capacity, order, promotesTo, isGraduating } = req.body;
    if (!name || !level) return res.status(400).json({ message: "Name and level are required" });

    const exists = await Class.findOne({ name: name.trim() });
    if (exists) return res.status(409).json({ message: "A class with this name already exists" });

    if (promotesTo && isGraduating) {
      return res.status(400).json({ message: "A class can't both promote and be graduating" });
    }

    const classDoc = await Class.create({
      name: name.trim(),
      level,
      streams: normalizeStreams(streams),
      capacity: capacity ?? null,
      order: order ?? 0,
      promotesTo: promotesTo || null,
      isGraduating: !!isGraduating,
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
  const classes = await Class.find(filter).sort({ order: 1, name: 1 }).populate("promotesTo", "name level");
  res.json({ classes });
};

// PATCH /api/classes/:id
export const updateClass = async (req, res) => {
  try {
    const { name, level, streams, capacity, order, promotesTo, isGraduating } = req.body;
    const classDoc = await Class.findById(req.params.id);
    if (!classDoc) return res.status(404).json({ message: "Class not found" });

    if (name) classDoc.name = name.trim();
    if (level) classDoc.level = level;
    if (streams) classDoc.streams = normalizeStreams(streams);
    if (capacity !== undefined) classDoc.capacity = capacity;
    if (order !== undefined) classDoc.order = order;

    const nextGraduating = isGraduating !== undefined ? !!isGraduating : classDoc.isGraduating;
    const nextPromotesTo = promotesTo !== undefined ? promotesTo || null : classDoc.promotesTo;
    if (nextPromotesTo && nextGraduating) {
      return res.status(400).json({ message: "A class can't both promote and be graduating" });
    }
    if (nextPromotesTo && String(nextPromotesTo) === String(classDoc._id)) {
      return res.status(400).json({ message: "A class can't promote into itself" });
    }
    classDoc.isGraduating = nextGraduating;
    classDoc.promotesTo = nextPromotesTo;

    await classDoc.save();

    await logAction({ actor: req.user, action: "CLASS_UPDATED", targetType: "Class", targetId: classDoc._id, details: req.body, req });
    res.json({ class: classDoc });
  } catch (err) {
    res.status(500).json({ message: "Failed to update class", error: err.message });
  }
};

// DELETE /api/classes/:id — blocked if students are enrolled
export const deleteClass = async (req, res) => {
  const inUse = await Student.exists({ class: req.params.id, status: "active" });
  if (inUse) {
    return res.status(409).json({ message: "Cannot delete a class with active students enrolled" });
  }
  const classDoc = await Class.findByIdAndDelete(req.params.id);
  if (!classDoc) return res.status(404).json({ message: "Class not found" });

  await logAction({ actor: req.user, action: "CLASS_DELETED", targetType: "Class", targetId: classDoc._id, details: { name: classDoc.name }, req });
  res.json({ message: "Class deleted" });
};

/* ---------------- CLASS TEACHERS (Teacher.classTeacherOf is the source of truth) ---------------- */

// GET /api/classes/:id/teachers — one row per stream (or one row for an unstreamed class)
export const getClassTeachers = async (req, res) => {
  const classDoc = await Class.findById(req.params.id);
  if (!classDoc) return res.status(404).json({ message: "Class not found" });

  const teachers = await Teacher.find({ "classTeacherOf.class": classDoc._id }).populate("user", "fullName email");

  const streamNames = classDoc.streams.length ? classDoc.streams.map((s) => s.name) : [""];
  const rows = streamNames.map((streamName) => ({
    stream: streamName,
    teacher: teachers.find((t) => (t.classTeacherOf.stream || "") === streamName) || null,
  }));

  res.json({ rows });
};

// PATCH /api/classes/:id/class-teacher  { teacherId, stream }
// stream must be "" for an unstreamed class, or match one of classDoc.streams[].name
export const setClassTeacher = async (req, res) => {
  const { teacherId, stream } = req.body;
  const classDoc = await Class.findById(req.params.id);
  if (!classDoc) return res.status(404).json({ message: "Class not found" });

  const validStream = classDoc.streams.length ? classDoc.streams.some((s) => s.name === stream) : !stream;
  if (!validStream) return res.status(400).json({ message: "That stream doesn't exist on this class" });

  // clear whoever currently holds this class + stream
  await Teacher.updateMany(
    { "classTeacherOf.class": classDoc._id, "classTeacherOf.stream": stream || "" },
    { $set: { classTeacherOf: { class: null, stream: "" } } }
  );

  if (!teacherId) return res.json({ teacher: null });

  const teacher = await Teacher.findByIdAndUpdate(
    teacherId,
    { classTeacherOf: { class: classDoc._id, stream: stream || "" } },
    { new: true }
  ).populate("user", "fullName email");

  await logAction({ actor: req.user, action: "CLASS_TEACHER_SET", targetType: "Class", targetId: classDoc._id, details: { teacherId, stream }, req });
  res.json({ teacher });
};

/* ---------------- STREAM REBALANCING ---------------- */

// POST /api/classes/:id/rebalance-streams  { streams: [{name, capacity}] }
// Replaces the class's stream list and redistributes currently-enrolled active
// students evenly (round-robin, ordered by admission number for a stable split).
export const rebalanceStreams = async (req, res) => {
  try {
    const classDoc = await Class.findById(req.params.id);
    if (!classDoc) return res.status(404).json({ message: "Class not found" });

    const newStreams = normalizeStreams(req.body.streams);
    if (newStreams.length === 0) {
      return res.status(400).json({ message: "Provide at least one stream to rebalance into" });
    }

    const students = await Student.find({ class: classDoc._id, status: "active" }).sort({ admissionNumber: 1 });

    const buckets = newStreams.map(() => []);
    students.forEach((student, i) => buckets[i % newStreams.length].push(student._id));

    const bulkOps = buckets
      .map((studentIds, i) => ({
        updateMany: { filter: { _id: { $in: studentIds } }, update: { $set: { stream: newStreams[i].name } } },
      }))
      .filter((op) => op.updateMany.filter._id.$in.length);
    if (bulkOps.length) await Student.bulkWrite(bulkOps);

    classDoc.streams = newStreams;
    await classDoc.save();

    await logAction({
      actor: req.user,
      action: "CLASS_STREAMS_REBALANCED",
      targetType: "Class",
      targetId: classDoc._id,
      details: { newStreams: newStreams.map((s) => s.name), studentsMoved: students.length },
      req,
    });

    res.json({
      class: classDoc,
      distribution: newStreams.map((s, i) => ({ stream: s.name, count: buckets[i].length })),
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to rebalance streams", error: err.message });
  }
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

/* ---------------- SCHOOL CONFIG (fee types, academic years/terms, admission settings) ---------------- */

export const getSchoolConfig = async (req, res) => {
  const school = await School.getConfig();
  res.json({ school });
};

export const updateSchoolConfig = async (req, res) => {
  const school = await School.getConfig();
  const allowed = [
    "name", "schoolType", "logoUrl", "motto", "vision", "mission",
    "address", "phone", "email", "admissionNumberFormat", "gradingSystem",
  ];
  for (const field of allowed) {
    if (req.body[field] !== undefined) school[field] = req.body[field];
  }

  if (req.body.admissionSettings && typeof req.body.admissionSettings === "object") {
    const current = school.admissionSettings?.toObject ? school.admissionSettings.toObject() : school.admissionSettings || {};
    school.admissionSettings = { ...current, ...req.body.admissionSettings };
  }

  await school.save();

  await logAction({ actor: req.user, action: "SCHOOL_CONFIG_UPDATED", targetType: "School", targetId: school._id, details: req.body, req });
  res.json({ school });
};

export const addFeeType = async (req, res) => {
  const school = await School.getConfig();
  school.feeTypes.push(req.body);
  await school.save();

  await logAction({ actor: req.user, action: "FEE_TYPE_ADDED", targetType: "School", targetId: school._id, details: req.body, req });
  res.status(201).json({ feeTypes: school.feeTypes });
};

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

export const setCurrentTerm = async (req, res) => {
  const school = await School.getConfig();
  const { yearId } = req.params;
  school.academicYears.forEach((y) => (y.isCurrent = String(y._id) === yearId));
  await school.save();
  res.json({ academicYears: school.academicYears });
};

export const getPublicSchoolInfo = async (req, res) => {
  const school = await School.getConfig();
  res.json({
    name: school.name,
    motto: school.motto,
    schoolType: school.schoolType,
    logoUrl: school.logoUrl,
    address: school.address,
    phone: school.phone,
    email: school.email,
    landingPage: school.landingPage,
  });
};
