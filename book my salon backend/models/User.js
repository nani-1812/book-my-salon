const mongoose = require('mongoose');
const jwt = require('jsonwebtoken'); // generateAuthToken వాడుతుంటే ఇది కావాలి

const userSchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        required: [true, 'Phone number is required.'],
        unique: true,
        // ఫోన్ నంబర్ +91 తో మొదలై, ఆ తర్వాత 10 అంకెలు ఉండేలా ధృవీకరణ
        validate: {
            validator: function(v) {
                return /^\+91\d{10}$/.test(v); 
            },
            message: props => `${props.value} is not a valid Indian phone number (e.g., +919876543210)!`
        }
    },
    name: {
        type: String,
        required: false,
        default: function() {
            // ఒకవేళ పేరు ఇవ్వకపోతే, ఫోన్ నంబర్ చివరి 4 అంకెలతో ఒక డిఫాల్ట్ పేరు
            return `User${this.phoneNumber ? this.phoneNumber.slice(-4) : Math.random().toString(36).substring(7)}`;
        }
    },
    // OTP లాజిక్ కోసం మీరు OTP మోడల్‌ను ప్రత్యేకంగా ఉపయోగిస్తున్నందున,
    // ఈ OTP సంబంధిత ఫీల్డ్‌లు ఇక్కడ అవసరం లేదు.
    // అవి OTP మోడల్‌లో మాత్రమే ఉండటం ఉత్తమం.
    // otp: {
    //     type: String,
    //     required: false
    // },
    // otpExpires: {
    //     type: Date,
    //     required: false
    // },
    bookings: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking'
    }]
}, { timestamps: true });

// JWT టోకెన్ జనరేషన్ కోసం ఒక పద్ధతిని చేర్చండి.
// యూజర్ లాగిన్ అయిన తర్వాత ఒక టోకెన్‌ను అందించడానికి ఇది ఉపయోగపడుతుంది.
userSchema.methods.generateAuthToken = function() {
    // JWT_SECRET అనేది మీ .env ఫైల్‌లో ఉండాలి (ఉదా: process.env.JWT_SECRET)
    const token = jwt.sign({ _id: this._id, phoneNumber: this.phoneNumber, name: this.name, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    return token;
};

const User = mongoose.model('User', userSchema);

module.exports = User;