// C:\Users\HOME\OneDrive\Desktop\book my saloon\book my salon backend\middleware\authMiddleware.js

const jwt = require('jsonwebtoken');
require('dotenv').config(); 

const User = require('../models/User'); // మీ యూజర్ మోడల్ మార్గాన్ని సరిచూడండి
const Salon = require('../models/Salon'); // మీ సలోన్ మోడల్ మార్గాన్ని సరిచూడండి

// --- Helper Functions for Token Generation ---

// యూజర్ల కోసం JWT టోకెన్ జనరేట్ చేయండి
const generateUserToken = (id) => {
    return jwt.sign({ id, isUser: true }, process.env.JWT_SECRET, {
        expiresIn: '1d', // Token expires in 1 day for user
    });
};

// సలోన్ భాగస్వాముల కోసం JWT టోకెన్ జనరేట్ చేయండి
const generateSalonToken = (id) => {
    return jwt.sign({ id, isPartner: true }, process.env.JWT_SECRET, {
        expiresIn: '1d', // Token expires in 1 day for partner
    });
};

// --- Middleware for User Protection ---
const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            if (!decoded.isUser) { // Ensure it's a user token
                console.warn('Attempt to use non-user token on user protected route.');
                return res.status(401).json({ success: false, message: 'Not authorized, invalid token for user.' });
            }

            req.user = await User.findById(decoded.id).select('-password'); // డేటాబేస్ నుండి యూజర్ వివరాలను పొందండి

            if (!req.user) {
                console.warn(`User with ID ${decoded.id} not found.`);
                return res.status(401).json({ success: false, message: 'Not authorized, user not found.' });
            }
            next();
        } catch (error) {
            console.error('❌ User Token Error:', error.message);
            res.status(401).json({ success: false, message: 'Not authorized, user token failed.' });
        }
    } else {
        res.status(401).json({ success: false, message: 'Not authorized, no user token provided.' });
    }
};

// --- Middleware for Salon Protection ---
const protectSalon = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            if (!decoded.isPartner) { // Ensure it's a partner token
                console.warn('Attempt to use non-partner token on salon protected route.');
                return res.status(401).json({ success: false, message: 'Not authorized, invalid token for salon partner.' });
            }

            req.user = await Salon.findById(decoded.id).select('-password'); // డేటాబేస్ నుండి సలోన్ వివరాలను పొందండి
            
            if (!req.user) {
                console.warn(`Salon partner with ID ${decoded.id} not found.`);
                return res.status(401).json({ success: false, message: 'Not authorized, salon partner not found.' });
            }
            next();
        } catch (error) {
            console.error('❌ Salon Token Error:', error.message);
            res.status(401).json({ success: false, message: 'Not authorized, salon partner token failed.' });
        }
    } else {
        res.status(401).json({ success: false, message: 'Not authorized, no salon partner token provided.' });
    }
};

module.exports = { protect, protectSalon, generateUserToken, generateSalonToken };