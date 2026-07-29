// models/Counter.js
import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // e.g. "admission-2026"
  seq: { type: Number, default: 0 },
});

counterSchema.statics.nextSequence = async function (key) {
  const counter = await this.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
};

export default mongoose.model("Counter", counterSchema);
