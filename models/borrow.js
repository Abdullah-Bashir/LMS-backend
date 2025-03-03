import mongoose from "mongoose";

const bookBorrowSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    price: { type: Number, required: true },
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: true },

    borrowedDate: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },

    // Instead of making returnedDate required, set a default of null
    returned: { type: Boolean, default: false },
    returnedDate: { type: Date, default: null },

    // Use Number and Boolean (capitalized) for types
    fine: { type: Number, default: 0 },
    notified: { type: Boolean, default: false }

}, { timestamps: true });

const BookBorrow = mongoose.model("Borrow", bookBorrowSchema);

export default BookBorrow;
