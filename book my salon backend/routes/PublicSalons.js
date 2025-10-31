// routes/PublicSalons.js

const express = require('express');
const router = express.Router(); // Create a new router object

// --- Import the Salon Model ---
const Salon = require('../models/Salon'); // <-- కీలకమైన మార్పు

// --- Helper functions for distance calculation ---
function toRad(value) {
    return value * Math.PI / 180;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

// --- Route 1: GET /api/salons (List Salons with Filters) ---
router.get('/', async (req, res) => {
    try {
        let query = {}; // MongoDB query object
        const { lat, lon, search, service, sort } = req.query;

        // Filtering Logic
        if (search) {
            const searchTermLower = search.toLowerCase();
            query.$or = [
                { salonName: { $regex: searchTermLower, $options: 'i' } }, // 'name' నుండి 'salonName' కు మార్చబడింది
                { 'services.name': { $regex: searchTermLower, $options: 'i' } } // 'services.serviceName' నుండి 'services.name' కు మార్చబడింది
            ];
        }
        if (service) {
            const serviceFilterLower = service.toLowerCase();
            query['services.name'] = { $regex: serviceFilterLower, $options: 'i' }; // 'services.serviceName' నుండి 'services.name' కు మార్చబడింది
        }

        let salons = await Salon.find(query).lean(); // .lean() for faster query results

        // Add distance calculation if lat/lon are provided
        if (lat && lon) {
            const userLat = parseFloat(lat);
            const userLon = parseFloat(lon);
            if (!isNaN(userLat) && !isNaN(userLon)) {
                salons.forEach(s => {
                    // Assuming s.location.coordinates is [longitude, latitude]
                    if (s.location && s.location.coordinates && s.location.coordinates.length === 2) {
                        s.distance = calculateDistance(userLat, userLon, s.location.coordinates[1], s.location.coordinates[0]);
                    } else {
                        s.distance = Infinity; // If location data is missing, put it at the end
                    }
                });
            }
        }

        // Sorting Logic
        if (sort) {
            if (sort === 'rating') {
                salons.sort((a, b) => (b.rating || 0) - (a.rating || 0));
            } else if (sort === 'distance' && lat && lon) {
                salons.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
            }
        }

        // Clean up data for listing
        const responseSalons = salons.map(s => ({
            id: s._id,
            name: s.salonName, // <--- 's.name' నుండి 's.salonName' కు మార్చబడింది
            address: s.address,
            // rating: s.rating,
            // reviews: s.reviews,
            services: s.services && s.services.length > 0 ? s.services.map(svc => svc.name).join(', ') : '', // <--- 'svc.serviceName' నుండి 'svc.name' కు మార్చబడింది + సురక్షిత తనిఖీ
            imageUrl: s.salonImageUrl,
            distance: s.distance ? parseFloat(s.distance.toFixed(2)) : undefined
        }));

        res.json(responseSalons);
    } catch (error) {
        console.error('Error fetching salons:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// --- Route 2: GET /api/salons/:id (Fetch Single Salon Details) ---
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const salon = await Salon.findById(id).lean();

        if (!salon) {
            return res.status(404).json({ message: 'Salon not found' });
        }

        res.json({
            id: salon._id,
            name: salon.salonName, // <--- 'salon.name' నుండి 'salon.salonName' కు మార్చబడింది
            address: salon.address,
            // rating: salon.rating,
            // reviews: salon.reviews,
            imageUrl: salon.salonImageUrl,
            description: salon.description || 'No description available.',
            services: salon.services, // Return detailed services array as is from model
            latitude: salon.location ? salon.location.coordinates[1] : undefined, // Assuming [lon, lat]
            longitude: salon.location ? salon.location.coordinates[0] : undefined
        });

    } catch (error) {
        console.error(`Error fetching salon details for ${req.params.id}:`, error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

module.exports = router;