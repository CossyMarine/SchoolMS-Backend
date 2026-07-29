// controllers/feeController.js
import mongoose from "mongoose";
import FeeInvoice from "../models/FeeInvoice.js";
import Payment from "../models/Payment.js";
import Student from "../models/Student.js";
import School from "../models/School.js";
import { generateReceiptNumber } from "../utils/receiptNumber.js";
import { logAction } from "../models/AuditLog.js";

// POST /api/fees/generate-invoices  { classId, academicYear, term, feeTypeIds: [] }
// Creates/updates invoices for every active student in a class for the given term.
export const generateInvoicesForClass = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { classId, academicYear, term, feeTypeIds } = req.body;
    const school = await School.getConfig();
    const feeTypes = school.feeTypes.filter((ft) => feeTypeIds.includes(String(ft._id)));
    if (!feeTypes.length) return res.status(400).json({ message: "No valid fee types selected" });

    const students = await Student.find({ class: classId, status: "active" });

    let created = 0, updated = 0;

    await session.withTransaction(async () => {
      for (const student of students) {
        let invoice = await FeeInvoice.findOne({ student: student._id, academicYear, term }).session(session);

        if (!invoice) {
          invoice = new FeeInvoice({ student: student._id, academicYear, term, lineItems: [] });
        }

        for (const ft of feeTypes) {
          const alreadyHas = invoice.lineItems.some((li) => String(li.feeTypeId) === String(ft._id));
          if (!alreadyHas) {
            invoice.lineItems.push({ feeTypeId: ft._id, name: ft.name, amountExpected: req.body.amounts?.[ft._id] || 0 });
          }
        }
        invoice.recalculate();
        await invoice.save({ session });
        invoice.isNew ? created++ : updated++;
      }
    });

    await logAction({ actor: req.user, action: "INVOICES_GENERATED", targetType: "Class", targetId: classId, details: { academicYear, term, studentCount: students.length }, req });
    res.json({ message: `Invoices processed for ${students.length} students` });
  } catch (err) {
    res.status(500).json({ message: "Failed to generate invoices", error: err.message });
  } finally {
    session.endSession();
  }
};

// GET /api/fees/student/:studentId — full statement across all terms
export const getStudentStatement = async (req, res) => {
  const invoices = await FeeInvoice.find({ student: req.params.studentId }).sort({ academicYear: 1, term: 1 });
  const payments = await Payment.find({ student: req.params.studentId, status: "completed" }).sort({ createdAt: -1 });
  res.json({ invoices, payments });
};

// POST /api/fees/payments — record a payment, transactionally, with allocation across open invoices (oldest first)
export const recordPayment = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { studentId, amount, method, reference } = req.body;
    if (!studentId || !amount || amount <= 0) {
      return res.status(400).json({ message: "Valid student and amount are required" });
    }

    let remaining = amount;
    const allocations = [];

    await session.withTransaction(async () => {
      const openInvoices = await FeeInvoice.find({ student: studentId, status: "open" })
        .sort({ academicYear: 1, term: 1 })
        .session(session);

      for (const invoice of openInvoices) {
        if (remaining <= 0) break;
        for (const li of invoice.lineItems) {
          if (remaining <= 0) break;
          const owed = li.amountExpected - li.amountPaid;
          if (owed <= 0) continue;

          const applied = Math.min(owed, remaining);
          li.amountPaid += applied;
          remaining -= applied;
          allocations.push({ invoice: invoice._id, lineItemId: li._id, amount: applied });
        }
        invoice.recalculate();
        await invoice.save({ session });
      }

      const receiptNumber = await generateReceiptNumber();

      const [payment] = await Payment.create(
        [
          {
            receiptNumber,
            student: studentId,
            amount,
            method,
            reference,
            allocations,
            recordedBy: req.user._id,
          },
        ],
        { session }
      );

      await logAction({
        actor: req.user,
        action: "FEE_PAYMENT_RECORDED",
        targetType: "Payment",
        targetId: payment._id,
        details: { receiptNumber, amount, method, unallocated: remaining },
        req,
      });

      res.status(201).json({
        payment,
        unallocatedBalance: remaining, // e.g. student overpaid — no open invoice to apply it to yet
      });
    });
  } catch (err) {
    res.status(500).json({ message: "Payment failed — no changes were saved", error: err.message });
  } finally {
    session.endSession();
  }
};

// POST /api/fees/payments/:id/reverse  { reason }
// Never deletes — reverses the allocation and marks the payment, preserving full audit trail.
export const reversePayment = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ message: "A reason is required to reverse a payment" });

    await session.withTransaction(async () => {
      const payment = await Payment.findById(req.params.id).session(session);
      if (!payment) throw new Error("Payment not found");
      if (payment.status === "reversed") throw new Error("Payment already reversed");

      for (const alloc of payment.allocations) {
        const invoice = await FeeInvoice.findById(alloc.invoice).session(session);
        if (!invoice) continue;
        const li = invoice.lineItems.id(alloc.lineItemId);
        if (li) li.amountPaid -= alloc.amount;
        invoice.recalculate();
        await invoice.save({ session });
      }

      payment.status = "reversed";
      payment.reversal = { reversedBy: req.user._id, reversedAt: new Date(), reason };
      await payment.save({ session });

      await logAction({
        actor: req.user,
        action: "FEE_PAYMENT_REVERSED",
        targetType: "Payment",
        targetId: payment._id,
        details: { receiptNumber: payment.receiptNumber, reason },
        req,
      });

      res.json({ message: "Payment reversed", payment });
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  } finally {
    session.endSession();
  }
};

// GET /api/fees/summary-by-class?academicYear=&term=
// Real aggregation instead of N client-side calls — one query, grouped server-side.
export const getFeeSummaryByClass = async (req, res) => {
  const { academicYear, term } = req.query;
  const match = {};
  if (academicYear) match.academicYear = academicYear;
  if (term) match.term = term;

  const summary = await FeeInvoice.aggregate([
    { $match: match },
    {
      $lookup: {
        from: "students",
        localField: "student",
        foreignField: "_id",
        as: "studentDoc",
      },
    },
    { $unwind: "$studentDoc" },
    {
      $group: {
        _id: "$studentDoc.class",
        collected: { $sum: "$totalPaid" },
        arrears: { $sum: "$balance" },
      },
    },
    {
      $lookup: {
        from: "classes",
        localField: "_id",
        foreignField: "_id",
        as: "classDoc",
      },
    },
    { $unwind: "$classDoc" },
    {
      $project: {
        _id: 0,
        name: "$classDoc.name",
        order: "$classDoc.order",
        collected: 1,
        arrears: 1,
      },
    },
    { $sort: { order: 1 } },
  ]);

  res.json({ summary });
};
