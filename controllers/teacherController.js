// controllers/teacherController.js
import Teacher from "../models/Teacher.js";

// GET /api/teachers — lightweight list for pickers (class-teacher assignment, etc.)
export const listTeachers = async (req, res) => {
  const teachers = await Teacher.find({ isActive: true })
    .populate("user", "fullName email")
    .select("staffId user classTeacherOf");
  res.json({ teachers });
};
