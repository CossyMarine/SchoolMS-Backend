// controllers/dormController.js
import Dorm from "../models/Dorm.js";
import Student from "../models/Student.js";
import { logAction } from "../models/AuditLog.js";

// POST /api/dorms  { name, genderRestriction, capacity }
export const createDorm = async (req, res) => {
  try {
    const { name, genderRestriction, capacity } = req.body;
    if (!name) return res.status(400).json({ message: "Dorm name is required" });

    const exists = await Dorm.findOne({ name: name.trim() });
    if (exists) return res.status(409).json({ message: "A dorm with this name already exists" });

    const dorm = await Dorm.create({
      name: name.trim(),
      genderRestriction: genderRestriction || "any",
      capacity: capacity || 0,
    });

    await logAction({ actor: req.user, action: "DORM_CREATED", targetType: "Dorm", targetId: dorm._id, details: { name }, req });
    res.status(201).json({ dorm });
  } catch (err) {
    res.status(500).json({ message: "Failed to create dorm", error: err.message });
  }
};

// GET /api/dorms — includes a live occupant count per dorm
export const listDorms = async (req, res) => {
  const dorms = await Dorm.find().sort({ name: 1 });
  const withCounts = await Promise.all(
    dorms.map(async (d) => {
      const occupantCount = await Student.countDocuments({ dorm: d._id, status: "active" });
      return { ...d.toObject(), occupantCount };
    })
  );
  res.json({ dorms: withCounts });
};

// PATCH /api/dorms/:id
export const updateDorm = async (req, res) => {
  const { name, genderRestriction, capacity, isActive } = req.body;
  const dorm = await Dorm.findById(req.params.id);
  if (!dorm) return res.status(404).json({ message: "Dorm not found" });

  if (name) dorm.name = name.trim();
  if (genderRestriction) dorm.genderRestriction = genderRestriction;
  if (capacity !== undefined) dorm.capacity = capacity;
  if (isActive !== undefined) dorm.isActive = isActive;
  await dorm.save();

  await logAction({ actor: req.user, action: "DORM_UPDATED", targetType: "Dorm", targetId: dorm._id, details: req.body, req });
  res.json({ dorm });
};

// DELETE /api/dorms/:id — blocked if active students are assigned
export const deleteDorm = async (req, res) => {
  const inUse = await Student.exists({ dorm: req.params.id, status: "active" });
  if (inUse) return res.status(409).json({ message: "Cannot delete a dorm with active students assigned" });

  const dorm = await Dorm.findByIdAndDelete(req.params.id);
  if (!dorm) return res.status(404).json({ message: "Dorm not found" });

  await logAction({ actor: req.user, action: "DORM_DELETED", targetType: "Dorm", targetId: dorm._id, details: { name: dorm.name }, req });
  res.json({ message: "Dorm deleted" });
};
