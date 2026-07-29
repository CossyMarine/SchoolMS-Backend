// controllers/libraryController.js
import Book from "../models/Book.js";
import BookIssue from "../models/BookIssue.js";
import { logAction } from "../models/AuditLog.js";
import { v4 as uuidv4 } from "uuid";

/* ---------------- BOOK CATALOG ---------------- */

// POST /api/library/books
export const addBook = async (req, res) => {
  const { title, author, isbn, bookNumber, category, totalCopies, coverImageUrl } = req.body;
  if (!title || !bookNumber) return res.status(400).json({ message: "Title and book number are required" });

  const exists = await Book.findOne({ bookNumber });
  if (exists) return res.status(409).json({ message: "Book number already in use" });

  const book = await Book.create({
    title, author, isbn, bookNumber, category, coverImageUrl,
    totalCopies: totalCopies || 1,
    availableCopies: totalCopies || 1,
  });

  await logAction({ actor: req.user, action: "BOOK_ADDED", targetType: "Book", targetId: book._id, details: { title }, req });
  res.status(201).json({ book });
};

// GET /api/library/books?search=&category=
export const listBooks = async (req, res) => {
  const filter = { status: "active" };
  if (req.query.category) filter.category = req.query.category;
  if (req.query.search) filter.$text = { $search: req.query.search };
  const books = await Book.find(filter).sort({ title: 1 }).limit(200);
  res.json({ books });
};

export const updateBook = async (req, res) => {
  const book = await Book.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!book) return res.status(404).json({ message: "Book not found" });
  res.json({ book });
};

/* ---------------- ISSUE / RETURN ---------------- */

// POST /api/library/issue
// body: { bookId, borrowerType, borrowerIds: [], dueDate }
// Supports issuing to a single student/teacher OR a whole class at once (batch)
export const issueBook = async (req, res) => {
  try {
    const { bookId, borrowerType, borrowerIds, dueDate } = req.body;
    if (!bookId || !borrowerType || !borrowerIds?.length || !dueDate) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ message: "Book not found" });
    if (book.availableCopies < borrowerIds.length) {
      return res.status(400).json({ message: `Only ${book.availableCopies} copies available` });
    }

    const batchId = borrowerIds.length > 1 ? uuidv4() : undefined;

    const issues = await BookIssue.insertMany(
      borrowerIds.map((borrowerId) => ({
        book: bookId,
        borrowerType,
        borrower: borrowerId,
        batchId,
        issuedBy: req.user._id,
        dueDate,
      }))
    );

    book.availableCopies -= borrowerIds.length;
    await book.save();

    await logAction({ actor: req.user, action: "BOOK_ISSUED", targetType: "Book", targetId: book._id, details: { title: book.title, count: borrowerIds.length }, req });
    res.status(201).json({ issues });
  } catch (err) {
    res.status(500).json({ message: "Failed to issue book", error: err.message });
  }
};

// PATCH /api/library/issue/:id/return
// body: { condition: "good"|"damaged"|"lost", fineAmount }
export const returnBook = async (req, res) => {
  const { condition, fineAmount } = req.body;
  const issue = await BookIssue.findById(req.params.id);
  if (!issue) return res.status(404).json({ message: "Issue record not found" });
  if (issue.status !== "issued") return res.status(400).json({ message: "This copy was already returned" });

  issue.status = condition === "lost" ? "lost" : condition === "damaged" ? "damaged" : "returned";
  issue.condition = condition || "good";
  issue.returnedDate = new Date();
  issue.fineAmount = fineAmount || 0;
  await issue.save();

  // Only good/damaged copies go back into circulation — lost copies reduce total stock
  const book = await Book.findById(issue.book);
  if (condition === "lost") {
    book.totalCopies = Math.max(0, book.totalCopies - 1);
  } else {
    book.availableCopies += 1;
  }
  await book.save();

  await logAction({ actor: req.user, action: "BOOK_RETURNED", targetType: "BookIssue", targetId: issue._id, details: { condition, fineAmount }, req });
  res.json({ issue });
};

// GET /api/library/outstanding — everything currently checked out, overdue first
export const listOutstanding = async (req, res) => {
  const issues = await BookIssue.find({ status: "issued" })
    .populate("book", "title bookNumber")
    .populate("borrower")
    .sort({ dueDate: 1 });

  const today = new Date();
  const withOverdueFlag = issues.map((i) => ({
    ...i.toObject(),
    isOverdue: i.dueDate < today,
  }));

  res.json({ issues: withOverdueFlag });
};

// GET /api/library/borrower/:borrowerType/:borrowerId — a student/teacher's borrowing record
export const getBorrowerHistory = async (req, res) => {
  const { borrowerType, borrowerId } = req.params;
  const issues = await BookIssue.find({ borrowerType, borrower: borrowerId })
    .populate("book", "title bookNumber")
    .sort({ issuedDate: -1 });
  res.json({ issues });
};
