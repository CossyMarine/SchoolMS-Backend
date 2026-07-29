// controllers/attendanceController.js
import Attendance from "../models/Attendance.js";
import { logAction } from "../models/AuditLog.js";

// POST /api/attendance  { classId, stream, date, records: [{studentId, status}] }
export const recordAttendance = async (req, res) => {
  const { classId, stream, date, records } = req.body;
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);

  let attendance = await Attendance.findOne({ class: classId, stream, date: day });
  if (!attendance) {
    attendance = new Attendance({ class: classId, stream, date: day, recordedBy: req.user._id, records: [] });
  }
  attendance.records = records.map((r) => ({ student: r.studentId, status: r.status }));
  attendance.recordedBy = req.user._id;
  await attendance.save();

  await logAction({ actor: req.user, action: "ATTENDANCE_RECORDED", targetType: "Attendance", targetId: attendance._id, details: { classId, date, count: records.length }, req });
  res.json({ attendance });
};

// GET /api/attendance?classId=&stream=&date=
export const getAttendanceForDay = async (req, res) => {
  const { classId, stream, date } = req.query;
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const attendance = await Attendance.findOne({ class: classId, stream, date: day });
  res.json({ attendance });
};

// GET /api/attendance/student/:studentId/summary?academicYear=
export const getStudentAttendanceSummary = async (req, res) => {
  const records = await Attendance.find({ "records.student": req.params.studentId });
  let present = 0, total = 0;
  for (const day of records) {
    const rec = day.records.find((r) => String(r.student) === req.params.studentId);
    if (rec) {
      total++;
      if (rec.status === "present" || rec.status === "late") present++;
    }
  }
  res.json({ totalDays: total, presentDays: present, percentage: total ? Math.round((present / total) * 100) : 0 });
};
