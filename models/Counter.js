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

// Read-only peek at what the *next* sequence value will be, without
// incrementing anything — used to preview an admission number in the UI.
counterSchema.statics.peekNextSequence = async function (key) {
  const counter = await this.findOne({ key });
  return (counter?.seq || 0) + 1;
};

export default mongoose.model("Counter", counterSchema);
