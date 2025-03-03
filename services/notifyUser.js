import cron from "node-cron";
import nodemailer from "nodemailer";
import BookBorrow from "../models/borrow.js";
import User from "../models/user.js";
import dotenv from "dotenv";

dotenv.config(); // Load environment variables

// Email transporter setup
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465, // or 587 for TLS
    secure: true, // Use `false` if using port 587
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Function to send email
const sendEmail = (email, bookTitle) => {
    const mailOptions = {
        from: `"Book Mart" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Reminder: Return Your Borrowed Book",
        text: `Dear User, please return the book "${bookTitle}" by tomorrow. You have only one day left. Thank you!`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log("Error sending email:", error);
        } else {
            console.log("Email sent:", info.response);
        }
    });
};

// Function to start the cron job
const startNotificationCron = () => {
    cron.schedule("*/30 * * * *", async () => {
        console.log("Checking for due books...");
        const now = new Date();
        const oneDayLater = new Date(now.setDate(now.getDate() + 1));

        try {
            // Find borrows due in one day, not yet notified, and not returned
            const borrows = await BookBorrow.find({
                dueDate: { $lte: oneDayLater },
                notified: false,
                returned: false,
            }).populate("bookId userId");

            for (const borrow of borrows) {
                const user = await User.findById(borrow.userId);
                if (user) {
                    // Send email reminder
                    sendEmail(user.email, borrow.bookId.title);

                    // Update the notified status to true
                    borrow.notified = true;
                    await borrow.save();
                }
            }
        } catch (error) {
            console.error("Error in cron job:", error);
        }
    });

    console.log("Notification cron job started..."); // first line that will be seen in terminal (to see activation)
};

export default startNotificationCron;
