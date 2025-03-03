import mongoose from "mongoose";

const bookSchema = new mongoose.Schema({
    title: { type: String, required: true },
    author: { type: String, required: true },
    description: { type: String, required: true },

    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    availability: { type: Boolean, default: true },

    createdAt: { type: Date, default: Date.now }
});

const Book = mongoose.model("Book", bookSchema);

export default Book;
