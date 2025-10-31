// C:\Users\HOME\OneDrive\Desktop\book my saloon\book my salon backend\routes\salonAuth.js

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
require('dotenv').config();

// otpService ని ఇక్కడ ఉపయోగించము ఎందుకంటే Twilio Verify Service ను వాడుతున్నాము
// const otpService = require('../services/otpService'); 

const Salon = require('../models/Salon');
// generateSalonToken మరియు protectSalon మీ authMiddleware నుండి ఇంపోర్ట్ చేయండి
const { generateSalonToken, protectSalon } = require('../middleware/authMiddleware');

// Twilio Verify Service ని ఆర్గ్యుమెంట్ గా స్వీకరించడానికి module.exports ని మార్చండి
module.exports = (twilioVerifyService) => {

    // @route   POST api/salon/auth/send-otp
    // @desc    Send OTP to a salon's phone number for login or registration
    // @access  Public
    router.post('/send-otp', async (req, res) => {
        const { phoneNumber, mode, fullName } = req.body;

        console.log('📨 Salon Send OTP request received:', { phoneNumber, mode, fullName });

        if (!phoneNumber) {
            return res.status(400).json({ success: false, message: 'Phone number is required.' });
        }
        if (!mode) {
            return res.status(400).json({ success: false, message: 'OTP mode is required.' });
        }

        // Optional: Twilio service అందుబాటులో ఉందో లేదో తనిఖీ చేయండి
        if (!twilioVerifyService) {
            console.warn('Twilio Verify Service not initialized for SalonAuth. Cannot send OTP.');
            return res.status(500).json({ success: false, message: 'OTP service is currently unavailable. Please check server logs.' });
        }

        try {
            console.log(`[SalonAuth] Starting send-otp for ${phoneNumber} (Mode: ${mode})`);
            const existingSalon = await Salon.findOne({ phoneNumber });
            // const otp = otpService.generateOtp(); // OTP ని generate చేయండి - Twilio వాడుతున్నప్పుడు ఇది అవసరం లేదు

            if (mode === 'salon-signup') {
                if (existingSalon) {
                    console.log(`[SalonAuth] ${phoneNumber} already registered as salon. Redirecting to login.`);
                    return res.status(409).json({
                        success: false,
                        message: 'This phone number is already registered. Please login.',
                        action: 'redirect_to_salon_login'
                    });
                }
                // Twilio ద్వారా OTP పంపండి
                const verification = await twilioVerifyService.verifications.create({
                    to: phoneNumber, // phoneNumber ను నేరుగా ఉపయోగించండి
                    channel: 'sms',
                });
                console.log(`[SalonAuth] OTP sent for new salon signup via Twilio. Verification SID: ${verification.sid}`);
                return res.json({
                    success: true,
                    message: 'OTP sent successfully for signup!',
                    action: 'redirect_to_salon_otp_receiver',
                    phoneNumber: phoneNumber, // ఫ్రంటెండ్ ఉపయోగించడానికి
                    // _testOTP: otp // డెవలప్‌మెంట్ కోసం, ప్రొడక్షన్ లో దీన్ని తొలగించండి
                });

            } else if (mode === 'salon-login') {
                if (!existingSalon) {
                    console.log(`[SalonAuth] ${phoneNumber} not found as salon. Redirecting to register.`);
                    return res.status(404).json({
                        success: false,
                        message: 'No salon found with this phone number. Please register.',
                        action: 'redirect_to_salon_register'
                    });
                }
                // Twilio ద్వారా OTP పంపండి
                const verification = await twilioVerifyService.verifications.create({
                    to: phoneNumber, // phoneNumber ను నేరుగా ఉపయోగించండి
                    channel: 'sms',
                });
                console.log(`[SalonAuth] OTP sent for existing salon login via Twilio. Verification SID: ${verification.sid}`);
                return res.json({
                    success: true,
                    message: 'OTP sent successfully for login!',
                    action: 'redirect_to_salon_otp_receiver',
                    phoneNumber: phoneNumber, // ఫ్రంటెండ్ ఉపయోగించడానికి
                    // _testOTP: otp // డెవలప్‌మెంట్ కోసం
                });
            } else {
                return res.status(400).json({ success: false, message: 'Invalid OTP mode specified.' });
            }

        } catch (err) {
            console.error('Error in salonAuth send-otp (Twilio):', err);
            let errorMessage = 'Server error during OTP request. Please check phone number.';
            if (err.status === 400 && err.code === 21211) {
                errorMessage = 'Invalid phone number format. Please ensure it includes the country code (e.g., +91).';
            } else if (err.status === 429) {
                errorMessage = 'Too many OTP requests. Please try again later.';
            }
            res.status(500).json({ success: false, message: errorMessage, twilioError: err.message });
        }
    });

    // @route   POST api/salon/auth/verify-otp
    // @desc    Verify OTP and log in/register salon
    // @access  Public
    router.post('/verify-otp', async (req, res) => {
        const { phoneNumber, otp, mode, registrationPayload } = req.body;

        console.log('✅ Salon Verify OTP request received:', { phoneNumber, otp, mode });

        if (!phoneNumber || !otp || !mode) {
            return res.status(400).json({ success: false, message: 'Phone number, OTP, and mode are required.' });
        }
        if (mode !== 'salon-signup' && mode !== 'salon-login') {
            return res.status(400).json({ success: false, message: 'Invalid mode for Salon OTP verification. Use "salon-signup" or "salon-login".' });
        }

        // Optional: Twilio service అందుబాటులో ఉందో లేదో తనిఖీ చేయండి
        if (!twilioVerifyService) {
            console.warn('Twilio Verify Service not initialized for SalonAuth. Cannot verify OTP.');
            return res.status(500).json({ success: false, message: 'OTP verification service is currently unavailable. Please check server logs.' });
        }

        try {
            // Twilio ద్వారా OTP ని వెరిఫై చేయండి
            const verificationCheck = await twilioVerifyService.verificationChecks.create({
                to: phoneNumber,
                code: otp,
            });

            if (verificationCheck.status === 'approved') {
                console.log(`✅ Salon OTP verified for ${phoneNumber} in mode: ${mode}`);

                if (mode === 'salon-signup') {
                    if (!registrationPayload) {
                        return res.status(400).json({ success: false, message: 'Registration data is missing for salon signup.' });
                    }

                    let salon = await Salon.findOne({ phoneNumber: phoneNumber });
                    if (salon) {
                        console.warn(`Attempted to sign up existing salon ${phoneNumber}. Logging in instead.`);
                        // If by some chance the salon exists, just log them in
                    } else {
                        salon = new Salon({
                            salonName: registrationPayload.salonName,
                            ownerName: registrationPayload.ownerName,
                            phoneNumber: phoneNumber,
                            address: registrationPayload.address,
                            location: {
                                type: 'Point',
                                coordinates: [registrationPayload.longitude, registrationPayload.latitude]
                            },
                            services: registrationPayload.services,
                            salonImageUrl: registrationPayload.salonImageUrl || undefined
                            // isApproved: false // Default to false if not set in model
                        });
                        await salon.save();
                        console.log(`✅ New Salon account created: ${salon.salonName} (${salon.phoneNumber})`);
                    }

                    const token = generateSalonToken(salon._id);
                    return res.json({
                        success: true,
                        message: 'Salon registered and logged in successfully!',
                        token,
                        salon: { _id: salon._id, salonName: salon.salonName, isPartner: true, isApproved: salon.isApproved }
                    });
                }

                if (mode === 'salon-login') {
                    const salon = await Salon.findOne({ phoneNumber: phoneNumber });
                    if (!salon) {
                        return res.status(404).json({ success: false, message: 'Salon Partner account not found after OTP verification.' });
                    }
                    const token = generateSalonToken(salon._id);
                    return res.json({
                        success: true,
                        message: 'Salon Partner OTP verified and logged in successfully!',
                        token,
                        salon: { _id: salon._id, salonName: salon.salonName, isPartner: true, isApproved: salon.isApproved }
                    });
                }

            } else {
                console.log(`Step 1: OTP verification failed for ${phoneNumber}, mode: ${mode}. Twilio status: ${verificationCheck.status}`);
                return res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });
            }

            return res.status(400).json({ success: false, message: 'Invalid mode for OTP verification.' });

        } catch (err) {
            console.error('❌ Salon Verify OTP Error (Twilio):', err);
            let errorMessage = 'OTP verification failed. An unexpected error occurred.';
            if (err.status === 404 && err.code === 20404) {
                 errorMessage = 'OTP expired or incorrect. Please request a new one.';
            } else if (err.status === 400 && err.code === 20404) {
                errorMessage = 'Incorrect OTP. Please try again.';
            }
            res.status(500).json({ success: false, message: errorMessage, twilioError: err.message });
        }
    });


    // @route   GET api/salon/auth/me
    // @desc    Get logged in salon partner details
    // @access  Private
    router.get('/me', protectSalon, async (req, res) => {
        try {
            const salon = req.user;

            if (!salon) {
                return res.status(404).json({ success: false, message: 'Salon not found.' });
            }
            res.json({ success: true, salon: { _id: salon._id, salonName: salon.salonName, ownerName: salon.ownerName, phoneNumber: salon.phoneNumber, address: salon.address, services: salon.services, salonImageUrl: salon.salonImageUrl, createdAt: salon.createdAt, isApproved: salon.isApproved } });
        } catch (err) {
            console.error('Error in /me (salonAuth):', err.message);
            res.status(500).send('Server error.');
        }
    });

    return router;
};