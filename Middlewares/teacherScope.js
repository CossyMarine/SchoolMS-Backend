// Middlewares/teacherScope.js
// Confirms a teacher is actually assigned to the class+subject they're
// trying to enter results for. Admins/moderators with "results" permission bypass this.
import Teacher from "../models/Teacher.js";

export const requireSubjectAssignment = async (req, res, next) => {
  if (req.user.role === "admin") return next();
  if (req.user.role === "moderator" && req.user.permissions?.results) return next();

  if (req.user.role !== "teacher") {
    return res.status(403).json({ message: "Only teachers can enter results" });
  }

  const { classId, subjectId } = req.body;
  const teacher = await Teacher.findOne({ user: req.user._id });
  if (!teacher) return res.status(403).json({ message: "Teacher profile not found" });

  const isAssigned = teacher.assignments.some(
    (a) => String(a.class) === String(classId) && String(a.subject) === String(subjectId)
  );
  if (!isAssigned) {
    return res.status(403).json({ message: "You are not assigned to this class/subject" });
  }

  req.teacherProfile = teacher;
  next();
};
