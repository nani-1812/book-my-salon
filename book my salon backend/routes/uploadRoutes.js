// C:\Users\HOME\OneDrive\Desktop\book my saloon\book my salon backend\routes\uploadRoutes.js

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs'); 

const router = express.Router();

const uploadDir = path.join(__dirname, '../public/uploads');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log(`Created upload directory: ${uploadDir}`);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir); 
    },
    filename: (req, file, cb) => {
        cb(null, `salon-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error("Error: Image upload only (jpeg, jpg, png, gif)"), false);
    }
});

router.post('/salon-image', upload.single('salonImage'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image file provided for upload.' });
        }
        const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        console.log(`✅ Image uploaded: ${imageUrl}`);
        res.json({ success: true, message: 'Image uploaded successfully.', imageUrl: imageUrl });
    } catch (error) {
        console.error('❌ Error during image upload:', error);
        res.status(500).json({ success: false, message: 'Image upload failed.', error: error.message });
    }
});

module.exports = router;