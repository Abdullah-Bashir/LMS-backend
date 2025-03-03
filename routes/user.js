import express from "express"
import { authMiddleware, adminMiddleware } from "../middleware/auth.js"
import User from "../models/user.js"
import { sendEmail } from "../utils/email.js"; // Utility to send emails
import { generateToken } from "../utils/token.js"; // Utility to generate tokens
import dotenv from "dotenv";
import bcrypt from "bcrypt"
import upload from "../middleware/upload.js";

dotenv.config(); // Load environment variables

const router = express.Router()


router.get("/profile", authMiddleware, async (req, res, next) => {
    try {
        res.json(req.user)
    } catch (error) {
        next(error)
    }
})

// Admin only route
router.get("/all", authMiddleware, adminMiddleware, async (req, res, next) => {
    try {
        const users = await User.find({ accountVerified: true }).select("-password")
        res.json(users)
    } catch (error) {
        next(error)
    }
})

router.post("/set-password", async (req, res) => {
    const { token, newPassword, confirmPassword } = req.body;

    try {
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ message: "Passwords do not match." });
        }

        // Find the user by the temporary token (stored in resetPasswordToken)
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpire: { $gt: Date.now() }, // Check if the token is not expired
        });

        if (!user) {
            return res.status(400).json({ message: "Invalid or expired token." });
        }

        // Hash the new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update the user's password and clear the reset token
        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        user.accountVerified = true; // Mark the user as verified

        await user.save();

        res.status(200).json({ message: "Password set successfully. You can now login." });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

// Register Admin Route
router.post("/admin/register", authMiddleware, adminMiddleware, upload.single("avatar"), async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Check if admin already exists
        const existingAdmin = await User.findOne({ email, role: "admin" });
        if (existingAdmin) {
            return res.status(400).json({ message: "Admin with this email already exists" });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Avatar handling (Cloudinary)
        let avatar = null;
        if (req.file) {
            avatar = {
                public_id: req.file.filename, // Cloudinary public_id
                url: req.file.path // Cloudinary secure URL
            };
        }

        // Create new admin
        const newAdmin = await User.create({
            username,
            email,
            password: hashedPassword,
            role: "admin",
            accountVerified: true, // Admins are verified by default
            avatar
        });

        res.status(201).json({ message: "Admin registered successfully", admin: newAdmin });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// Not in use
router.post("/add-user", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { username, email } = req.body;

        // Check if the user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists." });
        }

        // Create a new user with a temporary password
        const tempPassword = generateToken(); // Generate a random token
        const newUser = new User({
            username,
            email,
            password: tempPassword, // Temporary password
            resetPasswordToken: tempPassword, // Store the token
            resetPasswordExpire: new Date(Date.now() + 3600000),
            accountVerified: false,
        });

        console.log(newUser);

        // Try saving the new user
        try {
            await newUser.save();
        } catch (saveError) {
            console.error("Error saving user:", saveError);
            return res.status(500).json({ message: "Error saving user", error: saveError.message });
        }

        console.log(newUser)

        // Try sending the email
        try {
            const setPasswordLink = `http://localhost:3000/setpassword?token=${tempPassword}`;
            await sendEmail(email, "Set Your Password", setPasswordLink);
        } catch (emailError) {
            console.error("Error sending email:", emailError);
            return res.status(500).json({ message: "Error sending email", error: emailError.message });
        }

        res.status(201).json({ message: "User added successfully. Email sent." });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
});



export default router;

