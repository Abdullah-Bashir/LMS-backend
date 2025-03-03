import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js";
import bookRoutes from "./routes/book.js"
import borrowRoutes from "./routes/borrow.js"
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();
dotenv.config();

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Adjust based on your traffic
    message: "Too many requests from this IP, please try again later.",
});

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000', // Use environment variable for flexibility
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(limiter);

// Routes
app.get("/", (req, res) => {
    res.send("Welcome to the LMS Backend!");
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/book", bookRoutes);
app.use("/api/borrow", borrowRoutes)

// Error handling middleware
app.use(errorHandler);

// MongoDB connection
mongoose.set("strictQuery", false);
mongoose
    .connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(async () => {
        console.log("Connected to MongoDB");

        // Import and start the cron job
        const { default: startNotificationCron } = await import("./services/notifyUser.js");
        startNotificationCron(); // Call the function to start the job

        const { default: removeUnverifiedUsers } = await import("./services/removeUnverifiedAccounts.js");
        removeUnverifiedUsers(); // Call the function to start user deletion cron job
    })
    .catch((err) => console.error("MongoDB connection error:", err));



// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});