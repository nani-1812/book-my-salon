// C:\Users\HOME\OneDrive\Desktop\book my saloon\book my salon backend\routes\SalonRoutes.js

const express = require('express');
const router = express.Router();
const Salon = require('../models/Salon'); 
const { protectSalon, generateSalonToken } = require('../middleware/authMiddleware'); 
const path = require('path');

// @route   POST /api/salon/register
// @desc    Register a new salon partner
// @access  Public
router.post('/register', async (req, res) => { 
    try {
        const {
            salonName,
            ownerName,
            phoneNumber, // Will already be in +91XXXXXXXXXX format from frontend
            address,
            services,    // This will be a JSON string from frontend
            salonImageUrl, // This will be a URL string or empty
            latitude,
            longitude
        } = req.body;

        console.log('📦 Salon registration payload received:', req.body);

        // --- Server-side Validation ---
        if (!salonName || !ownerName || !phoneNumber || !address || !services || latitude === undefined || longitude === undefined) {
            return res.status(400).json({ success: false, message: 'All required fields must be provided.' });
        }
        if (!/^\+91[0-9]{10}$/.test(phoneNumber)) { // Validate full phone number format
            return res.status(400).json({ success: false, message: 'Invalid phone number format. Must be +91 followed by 10 digits.' });
        }
        
        // Check if phone number is already registered (Crucial for preventing duplicate registrations)
        const salonExists = await Salon.findOne({ phoneNumber });
        if (salonExists) {
            return res.status(409).json({ success: false, message: 'This phone number is already registered. Please log in.', action: 'redirect_to_login' });
        }

        // Parse services JSON string from the frontend
        let parsedServices;
        try {
            parsedServices = JSON.parse(services);
        } catch (jsonError) {
            console.error('Error parsing services JSON:', jsonError);
            return res.status(400).json({ success: false, message: 'Invalid services data format (must be a valid JSON array string).' });
        }

        // Services data validation
        let validatedServices = [];
        if (!Array.isArray(parsedServices) || parsedServices.length === 0) {
            return res.status(400).json({ success: false, message: 'Services must be a non-empty array.' });
        }
        for (const service of parsedServices) {
            if (!service.name || !service.price || typeof service.name !== 'string' || typeof service.price !== 'number' || service.price < 50) { // Added min price check
                return res.status(400).json({ success: false, message: 'Each service must have a valid name (string) and a price (number, min ₹50).' });
            }
            validatedServices.push({ name: service.name.trim(), price: parseFloat(service.price) });
        }
        
        // Determine salonImageUrl: use provided URL, or default if not provided/empty
        const finalSalonImageUrl = salonImageUrl && salonImageUrl.trim() !== '' 
                                   ? salonImageUrl.trim() 
                                   : '/uploads/default-salon.jpg'; // Path to your default image in public/uploads

        // Latitude and Longitude validation
        const parsedLatitude = parseFloat(latitude);
        const parsedLongitude = parseFloat(longitude);
        if (isNaN(parsedLatitude) || isNaN(parsedLongitude)) {
            return res.status(400).json({ success: false, message: 'Invalid latitude or longitude. They must be numbers.' });
        }

        // Create new salon
        const salon = await Salon.create({
            salonName,
            ownerName,
            phoneNumber,
            address,
            services: validatedServices, // Use the parsed and validated services
            salonImageUrl: finalSalonImageUrl, // Use the determined image URL
            location: {
                type: 'Point',
                coordinates: [parsedLongitude, parsedLatitude] // MongoDB expects [longitude, latitude]
            }
        });

        if (salon) {
            // Once registered and validated, generate token for immediate login
            const token = generateSalonToken(salon._id);

            res.status(201).json({
                success: true,
                message: 'Salon registered successfully. You are now logged in.',
                token,
                partner: { // Returning partner details as 'partner'
                    _id: salon._id,
                    name: salon.salonName, 
                    ownerName: salon.ownerName,
                    phoneNumber: salon.phoneNumber,
                    address: salon.address,
                    salonImageUrl: salon.salonImageUrl,
                    services: salon.services,
                    location: salon.location 
                }
            });
        } else {
            res.status(400).json({ success: false, message: 'Invalid salon data received.' });
        }

    } catch (error) {
        console.error('❌ Error in salon registration:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, message: messages.join(', ') });
        }
        res.status(500).json({ success: false, message: 'Server error during registration.', error: error.message });
    }
});


// @route   GET /api/salon/dashboard/:id
// @desc    Get salon dashboard data
// @access  Private (Salon-only)
router.get('/dashboard/:id', protectSalon, async (req, res) => {
    try {
        const salonId = req.params.id;

        // Verify that the salon ID from the JWT token matches the ID in the URL.
        // The `protectSalon` middleware places the decoded salon info into `req.user`.
        if (!req.user || req.user._id.toString() !== salonId) {
            console.warn(`Attempt to access unauthorized salon dashboard data. Token ID: ${req.user ? req.user._id : 'N/A'}, Requested ID: ${salonId}`);
            return res.status(403).json({ success: false, message: 'Unauthorized access to dashboard data. Token mismatch.' });
        }

        const salon = await Salon.findById(salonId).select('-password'); // Exclude sensitive password data
        
        if (!salon) {
            return res.status(404).json({ success: false, message: 'Salon not found.' });
        }

        res.json({
            success: true,
            message: 'Dashboard data loaded successfully.',
            salon: salon,
            dashboardData: { // Example data, you can replace with real aggregated data
                totalAppointmentsToday: 5,
                revenueThisMonth: 12500,
                pendingRequests: 2
            }
        });

    } catch (error) {
        console.error('❌ Error fetching salon dashboard data:', error);
        res.status(500).json({ success: false, message: 'Failed to load dashboard data. Please try again later.', error: error.message });
    }
});

module.exports = router;