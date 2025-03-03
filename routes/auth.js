import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import validator from "validator";
import User from "../models/user.js";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { authMiddleware } from "../middleware/auth.js";

dotenv.config(); // Load environment variables

const router = express.Router();


// Initialize Nodemailer transporter
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // Use SSL/TLS
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    tls: {
        rejectUnauthorized: false, // Do not fail on invalid certificates
    },
    debug: true, // Enable debugging
    logger: true, // Log to console
});

// Verify transporter configuration
transporter.verify((error, success) => {
    if (error) {
        console.error("SMTP configuration error:", error);
    } else {
        console.log("SMTP server is ready to send emails");
    }
});


// Helper function to send email
const sendEmail = async (to, subject, html) => {
    try {
        const info = await transporter.sendMail({
            from: `"Book Mart" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
        });
    } catch (error) {

        throw new Error("Failed to send email");
    }
};

// Helper function to generate JWT token
const generateToken = (user) => {
    return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
};

// Register route
router.post("/register", async (req, res, next) => {
    try {
        const { username, email, password } = req.body;

        // Validate required fields
        if (!username) return res.status(400).json({ message: "Username is required" });
        if (!email) return res.status(400).json({ message: "Email is required" });
        if (!password) return res.status(400).json({ message: "Password is required" });

        // Validate email format
        if (!validator.isEmail(email)) {
            return res.status(400).json({ message: "Invalid email format" });
        }

        // Check if email already exists
        const existingEmail = await User.findOne({ email });
        if (existingEmail) {
            return res.status(400).json({
                message: existingEmail.accountVerified
                    ? "Email already exists and is verified"
                    : "Email exists but is not verified. Please verify your account or use a different email.",
            });
        }

        // Check registration attempts within last 24 hours
        const registrationAttempts = await User.countDocuments({
            email,
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        });

        if (registrationAttempts >= 3) {
            return res.status(400).json({ message: "Maximum registration attempts reached. Please try again later." });
        }

        // Hash password and generate verification code
        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationCode = Math.floor(100000 + Math.random() * 900000);
        const verificationCodeExpire = new Date(Date.now() + 10 * 60 * 1000); // 10-minute expiry

        const user = new User({
            username,
            email,
            password: hashedPassword,
            verificationCode,
            verificationCodeExpire,
        });

        await user.save();

        try {
            // Email template
            const htmlTemplate = `
                <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                    <h2 style="color: #4CAF50; text-align: center;">Welcome to Our Service!</h2>
                    <p>Hello,</p>
                    <p>Thank you for registering with us. To complete your registration, please use the verification code below:</p>
                    <div style="background: #f4f4f4; padding: 10px; text-align: center; border-radius: 4px; margin: 20px 0;">
                        <h1 style="margin: 0; font-size: 32px; color: #4CAF50;">${verificationCode}</h1>
                    </div>
                    <p>This code will expire at <strong>${verificationCodeExpire.toLocaleString("en-US", {
                hour: "numeric",
                minute: "numeric",
                hour12: true,
            })}</strong>. If you did not request this code, please ignore this email.</p>
                    <p>Best regards,</p>
                    <p><strong>Book Mart</strong></p>
                    <p style="text-align: center; margin-top: 20px;">
                        <a href="https://yourwebsite.com" style="color: #4CAF50; text-decoration: none;">Visit Our Website</a>
                    </p>
                </div>
            `;

            await sendEmail(email, "Your Verification Code", htmlTemplate);

        } catch (error) {
            await User.deleteOne({ _id: user._id });
            return res.status(500).json({ message: "Error sending verification code. Please try again." });
        }

        res.status(201).json({ message: "User registered successfully. Please check your email for the verification code." });

    } catch (error) {

        res.status(500).json({ message: "Internal server error" });
    }
});

// Verify route
router.post("/verify", async (req, res, next) => {
    try {
        const { email, verificationCode } = req.body;

        // Validate input
        if (!email || !verificationCode) {
            return res.status(400).json({ message: "Email and verification code are required" });
        }

        // Find user
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Check if already verified
        if (user.accountVerified) {
            return res.status(400).json({ message: "Account is already verified" });
        }

        // Validate verification code
        if (user.verificationCode !== Number.parseInt(verificationCode)) {
            return res.status(400).json({ message: "Invalid verification code" });
        }

        // Check if code is expired
        if (user.verificationCodeExpire < new Date()) {
            return res.status(400).json({ message: "Verification code has expired" });
        }

        // Mark account as verified and clear verification code
        user.accountVerified = true;
        user.verificationCode = undefined;
        user.verificationCodeExpire = undefined;
        await user.save();

        // Generate token
        // const token = generateToken(user);

        // Send token as a cookie
        // res.cookie("token", token, {
        //     httpOnly: true, // Prevent client-side JavaScript from accessing the cookie
        //     secure: process.env.NODE_ENV === "production", // Send cookie only over HTTPS in production
        //     maxAge: 3600000, // Cookie expires in 1 hour (in milliseconds)
        //     sameSite: "strict", // Prevent CSRF attacks
        // });

        // Send success response
        res.status(200).json({ message: "Account verified successfully" });
    } catch (error) {
        next(error);
    }
});

// Login rout
router.post("/login", async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Validate password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Check if account is verified
        if (!user.accountVerified) {
            return res.status(401).json({ message: "Please verify your account" });
        }

        // Generate token
        const token = generateToken(user);

        // Send token as a cookie
        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 3600000,
            sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
        });

        // Send success response
        res.status(200).json({ message: "Logged in successfully" });
    } catch (error) {
        next(error);
    }
});



// Forgot password route
router.post("/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;

        // Check if email is provided
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(20).toString("hex");

        // Hash the token and save it in the database
        user.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
        user.resetPasswordExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        await user.save();

        // Generate reset URL
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

        // Send email with reset link
        const htmlTemplate = `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                <h2 style="color:rgb(15, 235, 22); text-align: center;">Password Reset Request</h2>
                <p>Hello,</p>
                <p>You are receiving this because you (or someone else) have requested the reset of the password for your account.</p>
                <p>Please click on the following link, or paste it into your browser to complete the process:</p>
                <div style="background:rgba(19, 18, 7, 0.62); padding: 10px; text-align: center; border-radius: 4px; margin: 20px 0;">
                    <a href="${resetUrl}" style="color:rgb(19, 219, 25); text-decoration: none;">Reset Password</a>
                </div>
                <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
                <p>Best regards,</p>
                <p><strong>Book Mart</strong></p>
            </div>
        `;

        await transporter.sendMail({
            from: `"Book Mart" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "LMS - Password Reset Request",
            html: htmlTemplate,
        });

        res.json({ message: "Password reset email sent" });
    } catch (error) {
        console.error("Error in forgot password:", error);
        res.status(500).json({ message: "An error occurred. Please try again." });
    }
});

// reset password
router.put("/reset-password/:token", async (req, res) => {
    try {
        const { token: resetToken } = req.params; // Rename `token` to `resetToken`
        const { newPassword, confirmPassword } = req.body;

        // Validate input
        if (!newPassword || !confirmPassword) {
            return res.status(400).json({ message: "Both password fields are required" });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ message: "Passwords do not match" });
        }

        // Hash the token for comparison
        const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex"); // Use `resetToken`

        // Find user with valid token
        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: "Invalid or expired token" });
        }

        // Update password and clear reset fields
        user.password = await bcrypt.hash(newPassword, 10);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        // Generate a new JWT
        const jwtToken = generateToken(user); // Use `jwtToken` instead of `token`

        // Set JWT in a cookie
        res.cookie("token", jwtToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 3600000, // 1 hour
            sameSite: "strict",
        });

        // Send success response
        res.json({ message: "Password reset successfully" });
    } catch (error) {

        res.status(500).json({ message: error.message || "An error occurred. Please try again." });
    }
});

router.get('/validate-token', authMiddleware, (req, res) => {
    // If authMiddleware passes, the token is valid
    res.json({
        valid: true,
        user: {
            id: req.user._id,
            email: req.user.email,
            role: req.user.role // Add any other user details you need
        }
    });
});

router.post('/logout', authMiddleware, (req, res) => {
    res.clearCookie('token'); // Clear the cookie
    res.json({ message: 'Logged out successfully' });
});

// Update password
router.put("/update-password", authMiddleware, async (req, res) => {
    try {
        const { oldPassword, newPassword, confirmPassword } = req.body;
        const userId = req.user.id; // Assuming user ID is available from authentication middleware

        // Validate input
        if (!oldPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({ message: "All fields are required" });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ message: "Passwords do not match" });
        }

        // Find user by ID
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Check old password
        const isMatch = await bcrypt.compare(oldPassword, user.password);

        if (!isMatch) {
            return res.status(400).json({ message: "Incorrect old password" });
        }

        // Hash new password and update
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.json({ message: "Password updated successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message || "An error occurred. Please try again." });
    }
});


export default router;