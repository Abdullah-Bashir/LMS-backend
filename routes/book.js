import express from "express";
import Book from "../models/book.js";
import { adminMiddleware, authMiddleware } from "../middleware/auth.js";

const router = express.Router();

// Create a new book
router.post("/", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const book = new Book(req.body);
        await book.save();
        res.status(201).json({ book, message: "book added successfully" });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Get all books
router.get("/all", authMiddleware, async (req, res) => {
    try {
        const books = await Book.find();
        res.json(books);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete a book by ID
router.delete("/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const book = await Book.findByIdAndDelete(req.params.id);
        if (!book) return res.status(404).json({ message: "Book not found" });
        res.json({ message: "Book deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});



// Update a book by ID
router.put("/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const book = await Book.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!book) return res.status(404).json({ message: "Book not found" });
        res.json(book);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get a single book by ID
router.get("/:id", async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ message: "Book not found" });
        res.json(book);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});



export default router;
