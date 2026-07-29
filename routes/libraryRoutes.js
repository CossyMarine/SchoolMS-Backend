// routes/libraryRoutes.js
import express from "express";
import { protect, authorize, checkPermission } from "../Middlewares/auth.js";
import {
  addBook, listBooks, updateBook,
  issueBook, returnBook, listOutstanding, getBorrowerHistory,
} from "../controllers/libraryController.js";

const router = express.Router();
router.use(protect);

router.get("/books", listBooks);
router.post("/books", authorize("admin", "librarian", "moderator"), checkPermission("library"), addBook);
router.patch("/books/:id", authorize("admin", "librarian", "moderator"), checkPermission("library"), updateBook);

router.post("/issue", authorize("admin", "librarian", "moderator"), checkPermission("library"), issueBook);
router.patch("/issue/:id/return", authorize("admin", "librarian", "moderator"), checkPermission("library"), returnBook);
router.get("/outstanding", authorize("admin", "librarian", "moderator"), checkPermission("library"), listOutstanding);
router.get("/borrower/:borrowerType/:borrowerId", getBorrowerHistory);

export default router;
