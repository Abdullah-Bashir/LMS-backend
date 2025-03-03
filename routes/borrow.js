import express from "express";
import BookBorrow from "../models/borrow.js"; // Your Borrow model
import User from "../models/user.js";             // User model for updating borrowedBooks array
import Book from "../models/book.js";
import { adminMiddleware, authMiddleware } from "../middleware/auth.js";

const router = express.Router();

/**
 * @route   POST /borrow/lend
 * @desc    Admin lends a book to a user
 * @access  Admin only
 */
router.post("/lend/:bookId", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { email } = req.body;
        const { bookId } = req.params;

        // 1️⃣ Find the user
        const user = await User.findOne({ email, accountVerified: true });
        if (!user) return res.status(404).json({ message: "User not found" });

        if (user.role === "admin") {
            return res.status(403).json({ message: "Admins cannot borrow books" });
        }

        // 2️⃣ Find the book
        const book = await Book.findById(bookId);
        if (!book) return res.status(404).json({ message: "Book not found" });

        if (book.quantity <= 0) {
            return res.status(400).json({ message: "Book is out of stock" });
        }

        // 3️⃣ Check if the user already borrowed this book
        const existingBorrow = await BookBorrow.findOne({ userId: user._id, bookId, returned: false });
        if (existingBorrow) {
            return res.status(400).json({ message: "User already has this book borrowed" });
        }

        // 4️⃣ Decrease book quantity & update availability
        book.quantity -= 1;
        book.available = book.quantity > 0;
        await book.save();

        // 5️⃣ Create a new borrow record
        const newBorrow = await BookBorrow.create({
            userId: user._id,
            price: book.price,
            bookId,
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Due in 7 days
            returned: false
        });

        // 6️⃣ Add the borrow reference to the user
        await User.findByIdAndUpdate(user._id, { $push: { borrowedBooks: newBorrow._id } });

        // 7️⃣ Return updated user with populated borrowedBooks
        const updatedUser = await User.findById(user._id).populate({
            path: "borrowedBooks",
            select: "borrowedDate dueDate returned",
            populate: { path: "bookId", select: "title author price" }
        });

        res.status(201).json({
            message: "Book borrowed successfully",
            borrow: newBorrow,
            user: updatedUser
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// returning a book
router.post("/return/:bookId", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { email } = req.body;
        const { bookId } = req.params;

        // 1️⃣ Find the user
        const user = await User.findOne({ email, accountVerified: true });
        if (!user) return res.status(404).json({ message: "User not found" });

        // 2️⃣ Find the borrow record
        const borrowRecord = await BookBorrow.findOne({ userId: user._id, bookId, returned: false });
        if (!borrowRecord) {
            return res.status(400).json({ message: "No active borrow record found for this book" });
        }

        // 3️⃣ Mark book as returned & calculate fine (if applicable)
        const dueDate = new Date(borrowRecord.dueDate);
        const returnDate = new Date();
        let fine = 0;

        if (returnDate > dueDate) {
            const lateDays = Math.ceil((returnDate - dueDate) / (1000 * 60 * 60 * 24)); // Convert ms to days
            fine = lateDays * 5; // Assuming $5 fine per late day
        }

        borrowRecord.returned = true;
        borrowRecord.returnedDate = returnDate;
        borrowRecord.fine = fine;
        await borrowRecord.save();

        // 4️⃣ Increase book quantity
        await Book.findByIdAndUpdate(bookId, { $inc: { quantity: 1, available: 1 } });


        // 6️⃣ Return updated user with populated borrowedBooks
        const updatedUser = await User.findById(user._id).populate({
            path: "borrowedBooks",
            select: "borrowedDate dueDate returned",
            populate: { path: "bookId", select: "title author price" }
        });

        res.status(200).json({
            message: "Book returned successfully",
            borrow: borrowRecord,
            fine,
            user: updatedUser
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get("/admin/borrowed-books", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const borrowedBooks = await BookBorrow.find({})
            .populate("userId", "username email")
            .populate("bookId", "title author price");

        res.status(200).json({ borrowedBooks });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// getting my borrowed Books
router.get("/my-borrowed-books", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate({
            path: "borrowedBooks",
            select: "borrowedDate dueDate returned fine",
            populate: { path: "bookId", select: "title author price" }
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        res.status(200).json({ borrowedBooks: user.borrowedBooks });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

export default router;