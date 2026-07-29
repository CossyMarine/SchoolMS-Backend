// utils/resolveRecipients.js
// Turns a filter object into a concrete list of { userId, phone, email, fullName } recipients.
import Student from "../models/Student.js";
import User from "../models/User.js";
import FeeInvoice from "../models/FeeInvoice.js";

export async function resolveRecipients(filter) {
  const { audience, classId, stream, feeBalanceMin, feeBalanceMax, userIds } = filter;

  if (audience === "individual") {
    const users = await User.find({ _id: { $in: userIds } });
    return users.map(toRecipient);
  }

  if (audience === "teachers") {
    const users = await User.find({ role: "teacher", isActive: true });
    return users.map(toRecipient);
  }

  if (audience === "all") {
    const users = await User.find({ isActive: true });
    return users.map(toRecipient);
  }

  // "students", "class", "fee-balance" all resolve through the Student collection
  const studentFilter = { status: "active" };
  if (classId) studentFilter.class = classId;
  if (stream) studentFilter.stream = stream;

  let students = await Student.find(studentFilter).populate("guardians.user", "fullName phone email isActive");

  if (audience === "fee-balance") {
    const invoices = await FeeInvoice.find({ status: "open" });
    const balanceByStudent = new Map();
    for (const inv of invoices) {
      balanceByStudent.set(String(inv.student), (balanceByStudent.get(String(inv.student)) || 0) + inv.balance);
    }
    students = students.filter((s) => {
      const bal = balanceByStudent.get(String(s._id)) || 0;
      if (feeBalanceMin !== undefined && bal < feeBalanceMin) return false;
      if (feeBalanceMax !== undefined && bal > feeBalanceMax) return false;
      return true;
    });
  }

  // "students" audience = notify the student's own login if present, else fall through to parent
  // "class"/"fee-balance" default to parents, since that's who pays fees / needs notices
  const recipients = [];
  for (const s of students) {
    if (audience === "students" && s.user) {
      const u = await User.findById(s.user);
      if (u?.isActive) recipients.push(toRecipient(u));
      continue;
    }
    for (const g of s.guardians) {
      if (g.isPrimaryContact || s.guardians.length === 1) {
        recipients.push({
          userId: g.user?._id,
          phone: g.phone,
          email: g.email,
          fullName: g.name,
        });
      }
    }
  }
  return recipients;
}

function toRecipient(user) {
  return { userId: user._id, phone: user.phone, email: user.email, fullName: user.fullName };
}
