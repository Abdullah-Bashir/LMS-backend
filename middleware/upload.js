import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,  // Use the Cloudinary instance
    params: {
        folder: "avatars",  // Cloudinary folder where images are stored
        allowed_formats: ["jpg", "jpeg", "png", "gif", "bmp", "tiff", "webp", "svg"],  // More formats added
    },
});

const upload = multer({ storage });

export default upload;
