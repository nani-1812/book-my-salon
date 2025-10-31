// C:\Users\HOME\OneDrive\Desktop\book my saloon\book my salon backend\server.js

// 1. IMPORTS AND SETUP
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const { Twilio } = require('twilio'); // Twilio SDK ని ఇక్కడ ఇంపోర్ట్ చేయండి

// Load environment variables FIRST
dotenv.config();

const app = express();

// 2. MIDDLEWARE (Must come BEFORE routes)
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files setup for uploads
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));


// ==========================================================
// Twilio Integration START
// ==========================================================

// Twilio credentials from .env
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_API_KEY_SID = process.env.TWILIO_API_KEY_SID;
const TWILIO_API_KEY_SECRET = process.env.TWILIO_API_KEY_SECRET;
const TWILIO_VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID;

let twilioVerifyService; // Define it here so it's accessible

// Validate Twilio credentials
if (!TWILIO_ACCOUNT_SID || !TWILIO_API_KEY_SID || !TWILIO_API_KEY_SECRET || !TWILIO_VERIFY_SERVICE_SID) {
    console.error('❌ Twilio credentials are not fully defined in .env file. Twilio features may not work.');
} else {
    try {
        const twilioClient = new Twilio(
            TWILIO_API_KEY_SID,
            TWILIO_API_KEY_SECRET,
            { accountSid: TWILIO_ACCOUNT_SID }
        );
        twilioVerifyService = twilioClient.verify.v2.services(TWILIO_VERIFY_SERVICE_SID);
        console.log('✅ Twilio client and Verify Service initialized.');
    } catch (error) {
        console.error('❌ Error initializing Twilio client:', error.message);
        // If Twilio initialization fails, ensure twilioVerifyService is null or undefined
        twilioVerifyService = null;
    }
}

// ==========================================================
// Twilio Integration END
// ==========================================================


// 3. SIMPLE TEST ROUTES (Sanity check)
app.get('/api/test', (req, res) =>
    res.json({ message: 'API is working!', status: 'success' })
);

// 4. IMPORT AND CONNECT ROUTES
console.log('📂 Loading API routes...');

// --- IMPORT MODELS ---
const OTP = require('./models/OTP'); // OTP మోడల్‌ను లోడ్ చేయండి
console.log('✅ OTP Model loaded.');

// --- REGULAR USER & PUBLIC ROUTES ---
// Twilio Verify Service ని AuthRoutes కు పంపండి
const authRoutes = require('./routes/Auth')(twilioVerifyService);
console.log('✅ AuthRoutes will receive twilioVerifyService.');

const serviceRoutes = require('./routes/Services');
const bookingRoutes = require('./routes/Bookingsroutes');
const publicSalonsRoutes = require('./routes/PublicSalons');

// --- SALON PARTNER ROUTES ---
// Twilio Verify Service ని SalonAuthRoutes కు పంపండి
const salonAuthRoutes = require('./routes/salonAuth')(twilioVerifyService);
console.log('✅ SalonAuthRoutes will receive twilioVerifyService.');

const salonRoutes = require('./routes/SalonRoutes');

// --- UPLOAD ROUTES ---
const uploadRoutes = require('./routes/uploadRoutes');


// Use routes with prefixes
app.use('/api/auth', authRoutes);
console.log('🔗 User Auth routes registered at /api/auth');

app.use('/api/services', serviceRoutes);
console.log('🔗 Service routes registered at /api/services');

app.use('/api/bookings', bookingRoutes);
console.log('🔗 Booking routes registered at /api/bookings');

// --- Salon specific routes ---
app.use('/api/salon/auth', salonAuthRoutes);
console.log('🔗 Salon Partner Auth routes registered at /api/salon/auth');

app.use('/api/salon', salonRoutes);
console.log('🔗 Salon Management routes registered at /api/salon');

app.use('/api/salons', publicSalonsRoutes);
console.log('🔗 Public Salon listing/details routes registered at /api/salons');

// --- Upload Routes ---
app.use('/api/uploads', uploadRoutes);
console.log('🔗 Upload routes registered at /api/uploads');


// 5. 404 HANDLER (Place AFTER all routes) - API రూట్‌లకు మాత్రమే
app.use((req, res) => {
    res.status(404).json({
        message: 'API Route not found',
        requestedUrl: req.originalUrl,
        method: req.method
    });
});

// 6. ERROR HANDLER
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err);
    res.status(500).json({
        message: 'Internal server error',
        error: err.message
    });
});

// 7. DATABASE CONNECTION AND SERVER START
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error('❌ MONGO_URI is not defined in .env file');
    process.exit(1);
}

if (!process.env.JWT_SECRET) {
    console.error('❌ JWT_SECRET is not defined in .env file');
    process.exit(1);
}

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('✅ Successfully connected to MongoDB!');

        // Start the server only after successful database connection
        app.listen(PORT, () => {
            console.log('');
            console.log('🚀 ========================================');
            console.log(`🚀 Book My Salon Backend API is running on port ${PORT}`);
            console.log('🚀 ========================================');
            console.log(`📍 Test API: http://localhost:${PORT}/api/test`);
            console.log(`📍 User Auth API: http://localhost:${PORT}/api/auth/`);
            console.log(`📍 Salon Partner Auth API: http://localhost:${PORT}/api/salon/auth/`);
            console.log(`📍 Salon Management API: http://localhost:${PORT}/api/salon/`);
            console.log(`📍 Public Salons API: http://localhost:${PORT}/api/salons/`);
            console.log(`📍 Image Upload API: http://localhost:${PORT}/api/uploads/salon-image`);
            console.log('🚀 ========================================');
            console.log('');
        });
    })
    .catch((error) => {
        console.error('❌ Error connecting to MongoDB:', error.message);
        process.exit(1);
    });