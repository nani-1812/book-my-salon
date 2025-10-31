const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Razorpay = require('razorpay');
const crypto = require('crypto'); // CRITICAL: Import Node.js built-in module for signature verification
const { protect } = require('../middleware/authMiddleware'); // <--- Authentication Middleware ను ఇంపోర్ట్ చేయండి (మీ ఫైల్ పాత్ సరిచూసుకోండి)

// Initialize Razorpay Instance (Unchanged)
const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// --- Helper function to calculate the dynamic commission rate (Business Logic) ---
function calculateCommissionRate(amount) {
    if (amount < 100) return 0.00; if (amount >= 100 && amount < 200) return 0.05;
    if (amount >= 200 && amount < 500) return 0.08; if (amount > 1000) return 0.15;
    if (amount >= 500 && amount <= 1000) {
        const minAmount = 500; const maxAmount = 1000; const minRate = 0.10; const maxRate = 0.13;
        const proportion = (amount - minAmount) / (maxAmount - minAmount);
        const commissionRate = minRate + (proportion * (maxRate - minRate));
        return Math.round(commissionRate * 10000) / 10000;
    }
    return 0.00;
}


// --- ROUTE 1: POST /api/bookings/request-booking (Initiates Approval Flow - UNCHANGED) ---
// Note: Ensure 'protect' middleware is added if this route requires a logged-in user
// router.post('/request-booking', protect, async (req, res) => { /* ... */ });
router.post('/request-booking', protect, async (req, res) => {
    // Placeholder - మీ ప్రస్తుత లాజిక్ ఇక్కడ ఉంటుంది
    try {
        const { salonId, services, date, time, totalPrice, paymentMethod } = req.body;
        const userId = req.user.id; // Get user ID from middleware

        // Validate input...

        const newBooking = new Booking({
            user: userId,
            salon: salonId,
            services: services, // Assuming services is an array of objects like [{ serviceId, name, price }]
            date: date,
            time: time,
            totalPrice: totalPrice,
            paymentMethod: paymentMethod,
            bookingStatus: paymentMethod === 'Online' ? 'PENDING_PAYMENT' : 'PENDING', // Example status logic
            paymentStatus: paymentMethod === 'Online' ? 'Pending' : 'Pending',
        });

        await newBooking.save();

        res.status(201).json({
            success: true,
            message: 'Booking request sent successfully. Awaiting confirmation or payment.',
            booking: newBooking
        });
    } catch (error) {
        console.error('Error requesting booking:', error);
        res.status(500).json({ success: false, message: 'Server error during booking request.' });
    }
});


// --- ROUTE 2: POST /api/bookings/create-payment-order/:bookingId (NEW: Creates Razorpay Order) ---
// Note: Ensure 'protect' middleware is added if this route requires a logged-in user
router.post('/create-payment-order/:bookingId', protect, async (req, res) => {
    // Placeholder - మీ ప్రస్తుత లాజిక్ ఇక్కడ ఉంటుంది
     const { bookingId } = req.params;
    try {
        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found.' });
        }
        if (booking.user.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Not authorized to pay for this booking.' });
        }
        if (booking.paymentStatus === 'Paid') {
            return res.status(400).json({ success: false, message: 'Booking already paid.' });
        }

        const options = {
            amount: booking.totalPrice * 100, // Amount in paise
            currency: "INR",
            receipt: booking._id.toString(), // Use booking ID as receipt
            payment_capture: 1 // Auto capture payment
        };

        const order = await razorpayInstance.orders.create(options);

        booking.razorpayOrderId = order.id;
        await booking.save();

        res.json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            key: process.env.RAZORPAY_KEY_ID // Send key ID to frontend
        });
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({ success: false, message: 'Server error creating payment order.' });
    }
});


// --- ROUTE 3: POST /api/bookings/verify-payment/:bookingId (CRITICAL: Signature Verification) ---
// Note: Ensure 'protect' middleware is added if this route requires a logged-in user
router.post('/verify-payment/:bookingId', protect, async (req, res) => {
    const { bookingId } = req.params;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    try {
        const booking = await Booking.findById(bookingId);

        if (!booking || booking.razorpayOrderId !== razorpay_order_id) {
            return res.status(404).json({ success: false, message: 'Booking or Order ID mismatch.' });
        }
        // Optional: Check if booking user matches logged-in user
        if (booking.user.toString() !== req.user.id) {
             return res.status(403).json({ success: false, message: 'Not authorized for this booking.' });
        }

        const generated_signature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                                          .update(razorpay_order_id + "|" + razorpay_payment_id)
                                          .digest('hex');

        if (generated_signature !== razorpay_signature) {
            return res.status(400).json({ success: false, message: 'Payment verification failed: Invalid Signature.' });
        }

        booking.paymentStatus = 'Paid';
        booking.bookingStatus = 'CONFIRMED'; // Or 'SCHEDULED' based on your flow
        booking.razorpayPaymentId = razorpay_payment_id;

        await booking.save();

        console.log(`\n✅ PAYMENT VERIFIED & CONFIRMED: Booking ${bookingId}. Payment ID: ${razorpay_payment_id}`);

        res.json({
            success: true,
            message: 'Payment verified and appointment confirmed.',
            bookingId: booking._id
        });

    } catch (error) {
        console.error('❌ Signature Verification Error:', error);
        res.status(500).json({ success: false, message: 'Server error during payment verification.' });
    }
});


// --- ROUTE 4: POST /api/bookings/final-payment/:bookingId (COD/Awaiting Service Flow) ---
// This route might be for COD confirmation or similar, ensure it's protected
router.post('/final-payment/:bookingId', protect, async (req, res) => {
    // Placeholder - మీ ప్రస్తుత లాజిక్ ఇక్కడ ఉంటుంది
     const { bookingId } = req.params;
     try {
         const booking = await Booking.findById(bookingId);
         if (!booking) {
             return res.status(404).json({ success: false, message: 'Booking not found.' });
         }
         // Add logic here, e.g., if paymentMethod is COD, update status upon confirmation
         if (booking.paymentMethod === 'Cash on Service' && booking.paymentStatus === 'Pending') {
             booking.paymentStatus = 'Paid'; // Or 'Paid on Service'
             booking.bookingStatus = 'COMPLETED'; // Assuming this confirms completion
             await booking.save();
             return res.json({ success: true, message: 'Payment status updated for Cash on Service.' });
         }
         res.status(400).json({ success: false, message: 'Invalid operation for this booking.' });
     } catch (error) {
         console.error('Error updating final payment status:', error);
         res.status(500).json({ success: false, message: 'Server error updating payment status.' });
     }
});


// --- ROUTE 5: PUT /api/bookings/status/:bookingId (Salon Owner Action - Approve/Decline) ---
// This should likely use salon-specific authentication middleware
// router.put('/status/:bookingId', protectSalon, async (req, res) => { ... });
router.put('/status/:bookingId', async (req, res) => {
    // Placeholder - మీ ప్రస్తుత లాజిక్ ఇక్కడ ఉంటుంది
    // Add authentication/authorization to ensure only the salon owner can change status
    const { bookingId } = req.params;
    const { status } = req.body; // e.g., 'CONFIRMED', 'CANCELLED'

    try {
        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found.' });
        }
        // Add authorization check here (e.g., check if logged-in user owns the salon)

        booking.bookingStatus = status.toUpperCase(); // Update status
        // Potentially update payment status too, e.g., if cancelled
        if (status.toUpperCase() === 'CANCELLED') {
             booking.paymentStatus = 'Cancelled'; // Or handle refunds if paid online
        }
        await booking.save();
        res.json({ success: true, message: `Booking status updated to ${status}.` });
    } catch (error) {
        console.error('Error updating booking status:', error);
        res.status(500).json({ success: false, message: 'Server error updating booking status.' });
    }
});


// --- ROUTE 6: GET /api/bookings/salon/:salonId (Fetch Bookings for Dashboard) ---
// This should likely use salon-specific authentication middleware
// router.get('/salon/:salonId', protectSalon, async (req, res) => { ... });
router.get('/salon/:salonId', async (req, res) => {
    // Placeholder - మీ ప్రస్తుత లాజిక్ ఇక్కడ ఉంటుంది
    // Add authentication/authorization to ensure only the salon owner can view bookings
     const { salonId } = req.params;
     try {
         // Add authorization check here

         const bookings = await Booking.find({ salon: salonId })
             .populate('user', 'name phoneNumber') // Populate user details
             .sort({ date: -1, time: -1 }); // Sort by date descending
         res.json({ success: true, bookings });
     } catch (error) {
         console.error('Error fetching salon bookings:', error);
         res.status(500).json({ success: false, message: 'Server error fetching salon bookings.' });
     }
});

// --- ROUTE 7: GET /api/bookings/my-appointments (Fetch Bookings for logged-in USER) --- <--- కొత్తగా జోడించబడినది
router.get('/my-appointments', protect, async (req, res) => {
    try {
        const userId = req.user.id; // Authentication middleware నుండి యూజర్ ID పొందండి

        // ఫిల్టర్ మరియు సార్టింగ్ కోసం Query Parameters పొందండి
        const { status, sort } = req.query;

        // ఫిల్టర్ ఆబ్జెక్ట్
        const filter = { user: userId };
        if (status) {
            // Ensure status matching is case-insensitive if needed
            filter.bookingStatus = { $regex: new RegExp(`^${status}$`, 'i') };
        }

        // సార్టింగ్ ఆబ్జెక్ట్
        let sortOptions = {};
        if (sort === 'date-asc') {
            sortOptions = { date: 1, time: 1 }; // పాతవి ముందు
        } else {
            sortOptions = { date: -1, time: -1 }; // కొత్తవి ముందు (default)
        }

        // డేటాబేస్ నుండి బుకింగ్స్ పొందండి
        const bookings = await Booking.find(filter)
            .populate('salon', 'salonName address') // సెలూన్ పేరు మరియు చిరునామా పొందండి
            // .populate('services.serviceId', 'name price') // అవసరమైతే సర్వీస్ వివరాలను పొందండి
            .sort(sortOptions);

        // Fetch salon details separately if needed for full info (more efficient than deep populate sometimes)
        // Or ensure your Booking model saves salonName and salonAddress denormalized

        // ఫ్రంటెండ్ కు అనుకూలంగా ఉండేలా డేటాను ఫార్మాట్ చేయండి (Optional)
        const formattedBookings = bookings.map(booking => {
             // If salon is populated correctly, use its name and address
             const salonName = booking.salon ? booking.salon.salonName : 'Salon Not Found';
             const salonAddress = booking.salon ? booking.salon.address : 'Address Not Available';

             return {
                 _id: booking._id,
                 salonId: booking.salon ? booking.salon._id : null,
                 salonName: salonName,
                 salonAddress: salonAddress,
                 services: booking.services, // Send back the services array/object as stored
                 date: booking.date,
                 time: booking.time,
                 totalPrice: booking.totalPrice,
                 paymentMethod: booking.paymentMethod,
                 status: booking.bookingStatus, // Send back the status as stored
                 paymentStatus: booking.paymentStatus,
                 createdAt: booking.createdAt
             };
         });

        res.json({ success: true, bookings: formattedBookings });

    } catch (error) {
        console.error('❌ Error fetching user appointments:', error);
        res.status(500).json({ success: false, message: 'Server error fetching your appointments.' });
    }
});

// --- ROUTE 8: PATCH /api/bookings/:bookingId/cancel (User cancels their own booking) --- <--- కొత్తగా జోడించబడినది
router.patch('/:bookingId/cancel', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const { bookingId } = req.params;

        const booking = await Booking.findOne({ _id: bookingId, user: userId });

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found or you are not authorized to cancel it.' });
        }

        // Check if the booking is cancellable (e.g., must be 'SCHEDULED' or 'CONFIRMED')
        if (booking.bookingStatus !== 'SCHEDULED' && booking.bookingStatus !== 'CONFIRMED' && booking.bookingStatus !== 'PENDING') {
            return res.status(400).json({ success: false, message: `Cannot cancel appointment with status: ${booking.bookingStatus}` });
        }

        // Update status
        booking.bookingStatus = 'CANCELLED';
        // Handle payment status/refunds if necessary (e.g., if paymentStatus was 'Paid')
        if (booking.paymentStatus === 'Paid') {
            // TODO: Initiate refund process via Razorpay if applicable
            // For now, just mark payment as cancelled or refunded needed
            booking.paymentStatus = 'Cancelled'; // Or 'Refund Pending'
        } else {
             booking.paymentStatus = 'Cancelled';
        }


        await booking.save();

        console.log(`✅ Appointment Cancelled by User: Booking ${bookingId}`);
        res.json({ success: true, message: 'Appointment cancelled successfully.', booking });

    } catch (error) {
        console.error('❌ Error cancelling appointment:', error);
        res.status(500).json({ success: false, message: 'Server error cancelling appointment.' });
    }
});


module.exports = router;