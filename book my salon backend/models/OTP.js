// C:\Users\HOME\OneDrive\Desktop\book my saloon\book my salon backend\models\OTP.js

const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        required: true,
    },
    otp: {
        type: String,
        required: true
    },
    mode: { // Defines the type of OTP: 'user-signup', 'user-login', 'salon-signup', 'salon-login'
        type: String,
        required: true
    },
    createdAt: { // Timestamp when the OTP was created
        type: Date,
        default: Date.now,
    },
    expiresAt: { // Timestamp when the OTP expires
        type: Date,
        required: true,
        index: { expires: 0 } // Creates a MongoDB TTL index, which automatically deletes the record after its expiration time.
    }
}, { timestamps: true }); // Automatically adds 'createdAt' and 'updatedAt' fields

// Create a compound index to ensure that the combination of 'phoneNumber' and 'mode' is unique.
// This means a user can have a 'user-login' OTP and a 'salon-signup' OTP simultaneously,
// but only one of each type at any given time for a specific phone number.
otpSchema.index({ phoneNumber: 1, mode: 1 }, { unique: true });

module.exports = mongoose.model('OTP', otpSchema);