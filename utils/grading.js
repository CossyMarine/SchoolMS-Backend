// utils/grading.js
export function computeGrade(percentage, gradingSystem) {
  if (gradingSystem === "cbc") {
    if (percentage >= 80) return "EE (Exceeding)";
    if (percentage >= 60) return "ME (Meeting)";
    if (percentage >= 40) return "AE (Approaching)";
    return "BE (Below)";
  }
  // default: percentage-based letter grades
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B";
  if (percentage >= 60) return "C";
  if (percentage >= 50) return "D";
  return "E";
}
