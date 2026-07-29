// controllers/promotionController.js
// Never runs automatically by date — admin triggers it once the school decides
// the academic year is over. Follows Class.promotesTo / Class.isGraduating.
import Class from "../models/Class.js";
import Student from "../models/Student.js";
import School from "../models/School.js";
import { logAction } from "../models/AuditLog.js";

// GET /api/promotions/preview — shows what a run would do, changes nothing
export const previewPromotion = async (req, res) => {
  const classes = await Class.find({ $or: [{ promotesTo: { $ne: null } }, { isGraduating: true }] })
    .populate("promotesTo", "name level")
    .sort({ order: 1 });

  const preview = await Promise.all(
    classes.map(async (c) => ({
      classId: c._id,
      className: c.name,
      activeCount: await Student.countDocuments({ class: c._id, status: "active" }),
      outcome: c.isGraduating ? "graduates" : "promotes",
      target: c.promotesTo ? c.promotesTo.name : null,
    }))
  );

  const unmappedClassCount = await Class.countDocuments({ promotesTo: null, isGraduating: false });
  res.json({ preview, unmappedClassCount });
};

// POST /api/promotions/run
// body: { fromAcademicYear, toAcademicYear, streamMapping }
// streamMapping: { "<classId>": { "<oldStreamName>": "<newStreamNameOnTargetClass>" } }
// Omit an entry to keep the same stream name on the target class.
export const runPromotion = async (req, res) => {
  try {
    const { fromAcademicYear, toAcademicYear, streamMapping = {} } = req.body;
    if (!toAcademicYear) return res.status(400).json({ message: "toAcademicYear is required" });

    const classes = await Class.find({ $or: [{ promotesTo: { $ne: null } }, { isGraduating: true }] });
    const results = [];

    for (const cls of classes) {
      if (cls.isGraduating) {
        const r = await Student.updateMany(
          { class: cls._id, status: "active" },
          {
            $set: { status: "graduated" },
            $push: { classHistory: { class: cls._id, academicYear: toAcademicYear, action: "graduated" } },
          }
        );
        results.push({ classId: cls._id, className: cls.name, outcome: "graduated", studentsMoved: r.modifiedCount });
        continue;
      }

      const mapForClass = streamMapping[String(cls._id)] || {};
      const streamsInUse = cls.streams.length ? cls.streams.map((s) => s.name) : [""];
      let movedTotal = 0;

      for (const oldStream of streamsInUse) {
        const newStream = mapForClass[oldStream] !== undefined ? mapForClass[oldStream] : oldStream;

        const filter = oldStream
          ? { class: cls._id, stream: oldStream, status: "active" }
          : { class: cls._id, status: "active", $or: [{ stream: { $exists: false } }, { stream: null }, { stream: "" }] };

        const setFields = { class: cls.promotesTo, enrolledAcademicYear: toAcademicYear };
        if (newStream) setFields.stream = newStream;
        const update = {
          $set: setFields,
          $push: { classHistory: { class: cls.promotesTo, stream: newStream || undefined, academicYear: toAcademicYear, action: "promoted" } },
        };
        if (!newStream) update.$unset = { stream: "" };

        const r = await Student.updateMany(filter, update);
        movedTotal += r.modifiedCount;
      }
      results.push({ classId: cls._id, className: cls.name, outcome: "promoted", studentsMoved: movedTotal });
    }

    const school = await School.getConfig();
    if (school.academicYears.some((y) => y.year === toAcademicYear)) {
      school.academicYears.forEach((y) => (y.isCurrent = y.year === toAcademicYear));
      await school.save();
    }

    await logAction({ actor: req.user, action: "PROMOTION_RUN", targetType: "School", targetId: school._id, details: { fromAcademicYear, toAcademicYear, results }, req });
    res.json({ results });
  } catch (err) {
    res.status(500).json({ message: "Promotion run failed", error: err.message });
  }
};
