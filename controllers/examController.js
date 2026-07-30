// controllers/examController.js
import Exam from "../models/Exam.js";
import Result from "../models/Result.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import School from "../models/School.js";
import { computeGrade } from "../utils/grading.js";
import { logAction } from "../models/AuditLog.js";

// POST /api/exams  { name, academicYear, term, classes: [], components: [{name, weight, maxScore}] }
export const createExam = async (req, res) => {
  const { name, academicYear, term, classes, components } = req.body;
  const totalWeight = (components || []).reduce((s, c) => s + c.weight, 0);
  if (totalWeight !== 100) {
    return res.status(400).json({ message: `Component weights must total 100 (currently ${totalWeight})` });
  }

  const exam = await Exam.create({ name, academicYear, term, classes, components, status: "open" });
  await logAction({ actor: req.user, action: "EXAM_CREATED", targetType: "Exam", targetId: exam._id, details: { name }, req });
  res.status(201).json({ exam });
};

// GET /api/exams?classId=&academicYear=&term=
export const listExams = async (req, res) => {
  const filter = {};
  if (req.query.classId) filter.classes = req.query.classId;
  if (req.query.academicYear) filter.academicYear = req.query.academicYear;
  if (req.query.term) filter.term = req.query.term;
  const exams = await Exam.find(filter).populate("classes", "name").sort({ createdAt: -1 });
  res.json({ exams });
};

// GET /api/exams/my-classes — teacher's own assigned classes/subjects, for the result-entry picker
export const getMyTeachingAssignments = async (req, res) => {
  const teacher = await Teacher.findOne({ user: req.user._id })
    .populate("assignments.class", "name streams")
    .populate("assignments.subject", "name");
  if (!teacher) return res.status(404).json({ message: "Teacher profile not found" });
  res.json({ assignments: teacher.assignments, classTeacherOf: teacher.classTeacherOf });
};

// POST /api/exams/:examId/results  — bulk entry
// body: { classId, subjectId, entries: [{ studentId, scores: [{componentId, score}], comment }] }
export const enterResults = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) return res.status(404).json({ message: "Exam not found" });
    if (exam.status === "approved") {
      return res.status(400).json({ message: "This exam is already approved — results are locked" });
    }

    const { classId, subjectId, entries } = req.body;
    const school = await School.getConfig();

    const saved = [];
    for (const entry of entries) {
      const scores = entry.scores.map((s) => {
        const comp = exam.components.id(s.componentId);
        return { componentId: s.componentId, componentName: comp?.name, score: s.score, maxScore: comp?.maxScore || 100 };
      });

      let result = await Result.findOne({ exam: exam._id, student: entry.studentId, subject: subjectId });
      if (!result) {
        result = new Result({ exam: exam._id, student: entry.studentId, subject: subjectId, class: classId, enteredBy: req.user._id, scores: [] });
      }
      result.scores = scores;
      result.teacherComment = entry.comment;
      result.recalculate(exam.components);
      result.grade = computeGrade(result.totalPercentage, school.gradingSystem);
      await result.save();
      saved.push(result);
    }

    await logAction({ actor: req.user, action: "RESULTS_ENTERED", targetType: "Exam", targetId: exam._id, details: { classId, subjectId, count: saved.length }, req });
    res.json({ message: `${saved.length} results saved`, results: saved });
  } catch (err) {
    res.status(500).json({ message: "Failed to save results", error: err.message });
  }
};

// POST /api/exams/:examId/approve — admin/DOS approves, locks entry, computes class positions
export const approveExam = async (req, res) => {
  const exam = await Exam.findById(req.params.examId);
  if (!exam) return res.status(404).json({ message: "Exam not found" });

  // Compute class positions per subject
  for (const classId of exam.classes) {
    const results = await Result.find({ exam: exam._id, class: classId }).sort({ subject: 1 });
    const bySubject = {};
    for (const r of results) {
      const key = String(r.subject);
      if (!bySubject[key]) bySubject[key] = [];
      bySubject[key].push(r);
    }
    for (const subjResults of Object.values(bySubject)) {
      subjResults.sort((a, b) => b.totalPercentage - a.totalPercentage);
      for (let i = 0; i < subjResults.length; i++) {
        subjResults[i].classPosition = i + 1;
        await subjResults[i].save();
      }
    }
  }

  exam.status = "approved";
  exam.approvedBy = req.user._id;
  exam.approvedAt = new Date();
  await exam.save();

  await logAction({ actor: req.user, action: "EXAM_APPROVED", targetType: "Exam", targetId: exam._id, req });
  res.json({ message: "Exam approved and positions calculated", exam });
};

// GET /api/exams/:examId/student/:studentId — report card view (only if approved, unless staff)
export const getStudentReportCard = async (req, res) => {
  const exam = await Exam.findById(req.params.examId);
  if (!exam) return res.status(404).json({ message: "Exam not found" });

  const isStaff = ["admin", "teacher", "moderator"].includes(req.user.role);
  if (exam.status !== "approved" && !isStaff) {
    return res.status(403).json({ message: "Results are not yet published" });
  }

  const results = await Result.find({ exam: exam._id, student: req.params.studentId }).populate("subject", "name");
  const overallMean = results.length
    ? results.reduce((s, r) => s + r.totalPercentage, 0) / results.length
    : 0;

  res.json({ exam, results, overallMean: Math.round(overallMean * 100) / 100 });
};

// GET /api/exams/:examId/class/:classId — class list view with positions
export const getClassResults = async (req, res) => {
  const results = await Result.find({ exam: req.params.examId, class: req.params.classId })
    .populate("student", "firstName lastName admissionNumber")
    .populate("subject", "name");
  res.json({ results });
};

// GET /api/exams/performance/summary?academicYear=&term=
// Per-class average across approved exams only (draft/open results aren't final).
export const getClassPerformanceSummary = async (req, res) => {
  const { academicYear, term } = req.query;

  const examFilter = { status: "approved" };
  if (academicYear) examFilter.academicYear = academicYear;
  if (term) examFilter.term = term;

  const exams = await Exam.find(examFilter).sort({ createdAt: -1 });
  const examIds = exams.map((e) => e._id);

  const summary = await Result.aggregate([
    { $match: { exam: { $in: examIds } } },
    { $group: { _id: "$class", averagePercentage: { $avg: "$totalPercentage" }, resultsCount: { $sum: 1 } } },
  ]);

  const lastExamByClass = {};
  exams.forEach((e) => {
    e.classes.forEach((classId) => {
      const key = String(classId);
      if (!lastExamByClass[key]) lastExamByClass[key] = e.name; // exams sorted newest-first
    });
  });

  res.json({
    summary: summary.map((s) => ({
      classId: s._id,
      averagePercentage: Math.round(s.averagePercentage * 10) / 10,
      resultsCount: s.resultsCount,
      lastExamName: lastExamByClass[String(s._id)] || null,
    })),
  });
};
