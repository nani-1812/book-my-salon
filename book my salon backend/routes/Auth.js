// C:\Users\HOME\OneDrive\Desktop\book my saloon\book my salon backend\routes\Auth.js

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
require('dotenv').config();

const User = require('../models/User');
// OTP Model ని ఇక్కడ ఉపయోగించము ఎందుకంటే Twilio Verify Service ను వాడుతున్నాము
// const OTP = require('../models/OTP'); 

// 6-అంకెల OTP ని జనరేట్ చేస్తుంది - Twilio వాడుతున్నప్పుడు ఇది అవసరం లేదు
// function generateOTP() {
//     return Math.floor(100000 + Math.random() * 900000).toString();
// }

// యూజర్ టోకెన్‌ను జనరేట్ చేయడానికి కొత్త సహాయక ఫంక్షన్
function generateUserToken(userId) {
    return jwt.sign({ userId: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

// Twilio Verify Service ని ఆర్గ్యుమెంట్ గా స్వీకరించడానికి module.exports ని మార్చండి
module.exports = (twilioVerifyService) => {

    // POST /api/auth/send-otp (యూజర్ సైన్అప్/లాగిన్ కోసం)
    router.post('/send-otp', async (req, res) => {
        try {
            const { phoneNumber, mode, fullName } = req.body;

            console.log('📨 User Send OTP request received:', { phoneNumber, mode, fullName });

            if (!phoneNumber || !mode) {
                return res.status(400).json({ success: false, message: 'Phone number and mode are required.' });
            }
            if (mode !== 'user-signup' && mode !== 'user-login') {
                return res.status(400).json({ success: false, message: 'Invalid mode for User OTP request. Use "user-signup" or "user-login".' });
            }

            const fullPhoneNumber = phoneNumber; // ఇది ఇప్పటికే +91 తో వస్తుందని అనుకుంటున్నాము

            // Optional: Twilio service అందుబాటులో ఉందో లేదో తనిఖీ చేయండి
            if (!twilioVerifyService) {
                console.warn('Twilio Verify Service not initialized for Auth. Cannot send OTP.');
                return res.status(500).json({ success: false, message: 'OTP service is currently unavailable. Please check server logs.' });
            }

            let existingUser = await User.findOne({ phoneNumber: fullPhoneNumber });

            if (mode === 'user-signup') {
                if (existingUser) {
                    return res.status(409).json({
                        success: false,
                        message: 'This phone number is already registered as a Customer. Please login.',
                        action: 'redirect_to_login'
                    });
                }
                // Twilio ద్వారా OTP పంపండి
                const verification = await twilioVerifyService.verifications.create({
                    to: fullPhoneNumber,
                    channel: 'sms',
                });
                console.log(`✅ USER SIGNUP OTP sent via Twilio for ${fullPhoneNumber}. Verification SID: ${verification.sid}`);
                return res.json({
                    success: true,
                    message: 'Customer OTP sent successfully.',
                    // _testOTP: otp // Twilio వాడుతున్నప్పుడు ఇది అవసరం లేదు
                });
            }

            if (mode === 'user-login') {
                if (!existingUser) {
                    return res.status(404).json({
                        success: false,
                        message: 'Customer account not registered. Please sign up first.',
                        action: 'redirect_to_register'
                    });
                }
                // Twilio ద్వారా OTP పంపండి
                const verification = await twilioVerifyService.verifications.create({
                    to: fullPhoneNumber,
                    channel: 'sms',
                });
                console.log(`✅ CUSTOMER LOGIN OTP sent via Twilio for ${fullPhoneNumber}. Verification SID: ${verification.sid}`);
                return res.json({
                    success: true,
                    message: 'Customer account detected. OTP sent.',
                    isPartner: false,
                    // _testOTP: otp // Twilio వాడుతున్నప్పుడు ఇది అవసరం లేదు
                });
            }

            return res.status(400).json({ success: false, message: 'Invalid or missing mode for OTP request.' });

        } catch (err) {
            console.error('❌ User Send OTP Error (Twilio):', err);
            let errorMessage = 'Failed to send OTP. Please check the phone number and try again.';
            if (err.status === 400 && err.code === 21211) {
                errorMessage = 'Invalid phone number format. Please ensure it includes the country code (e.g., +91).';
            } else if (err.status === 429) {
                errorMessage = 'Too many OTP requests. Please try again later.';
            }
            res.status(500).json({ success: false, message: errorMessage, twilioError: err.message });
        }
    });

    // POST /api/auth/verify-otp (యూజర్ సైన్అప్/లాగిన్ కోసం)
    router.post('/verify-otp', async (req, res) => {
        try {
            const { phoneNumber, otp, mode } = req.body;

            console.log('✅ User Verify OTP request received:', { phoneNumber, otp, mode });

            if (!phoneNumber || !otp || !mode) {
                return res.status(400).json({ success: false, message: 'Phone number, OTP, and mode are required.' });
            }
            if (mode !== 'user-signup' && mode !== 'user-login') {
                return res.status(400).json({ success: false, message: 'Invalid mode for User OTP verification. Use "user-signup" or "user-login".' });
            }

            const fullPhoneNumber = phoneNumber; // ఇది ఇప్పటికే +91 తో వస్తుందని అనుకుంటున్నాము

            // Optional: Twilio service అందుబాటులో ఉందో లేదో తనిఖీ చేయండి
            if (!twilioVerifyService) {
                console.warn('Twilio Verify Service not initialized for Auth. Cannot verify OTP.');
                return res.status(500).json({ success: false, message: 'OTP verification service is currently unavailable. Please check server logs.' });
            }

            // Twilio ద్వారా OTP ని వెరిఫై చేయండి
            const verificationCheck = await twilioVerifyService.verificationChecks.create({
                to: fullPhoneNumber,
                code: otp,
            });

            if (verificationCheck.status === 'approved') {
                console.log(`✅ User OTP verified for ${fullPhoneNumber} in mode: ${mode}`);

                if (mode === 'user-signup') {
                    let user = await User.findOne({ phoneNumber: fullPhoneNumber });
                    if (!user) {
                        const userName = req.body.name || `User ${phoneNumber.slice(-4)}`;
                        user = new User({ phoneNumber: fullPhoneNumber, name: userName });
                        await user.save();
                        console.log(`✅ New User account created: ${user.name} (${user.phoneNumber})`);
                    }
                    const token = generateUserToken(user._id);
                    return res.json({
                        success: true,
                        message: 'User account created and logged in successfully.',
                        token,
                        user: { _id: user._id, name: user.name, isPartner: false }
                    });
                }

                if (mode === 'user-login') {
                    const user = await User.findOne({ phoneNumber: fullPhoneNumber });
                    if (!user) {
                        // ఇది ఇక్కడ జరగకూడదు, send-otp లోనే చెక్ చేయాలి
                        return res.status(404).json({ success: false, message: 'Customer account not found after OTP verification.' });
                    }
                    const token = generateUserToken(user._id);
                    return res.json({
                        success: true,
                        message: 'Customer OTP verified and logged in successfully.',
                        token,
                        user: { _id: user._id, name: user.name, isPartner: false }
                    });
                }
            } else {
                console.log(`Step 2: OTP verification failed for ${fullPhoneNumber}. Twilio status: ${verificationCheck.status}`);
                return res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });
            }

            return res.status(400).json({ success: false, message: 'Invalid mode for OTP verification.' });

        } catch (err) {
            console.error('❌ User Verify OTP Error (Twilio):', err);
            let errorMessage = 'OTP verification failed. An unexpected error occurred.';
            if (err.status === 404 && err.code === 20404) {
                 errorMessage = 'OTP expired or incorrect. Please request a new one.';
            } else if (err.status === 400 && err.code === 20404) {
                errorMessage = 'Incorrect OTP. Please try again.';
            }
            res.status(500).json({ success: false, message: errorMessage, twilioError: err.message });
        }
    });

    // మీ పాత లాగిన్/రిజిస్ట్రేషన్ రూట్‌లు లేదా ఇతర యూజర్ రూట్‌లు ఇక్కడ కొనసాగవచ్చు
    // ఉదాహరణకు:
    // router.post('/register', async (req, res) => { ... });
    // router.post('/login', async (req, res) => { ... });

    return router;
};