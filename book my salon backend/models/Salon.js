// C:\Users\HOME\OneDrive\Desktop\book my saloon\book my salon backend\models\Salon.js

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config(); // .env ఫైల్ నుండి పర్యావరణ వేరియబుల్స్ లోడ్ చేయడానికి

const salonSchema = new mongoose.Schema({
    salonName: { // సెలూన్ పేరు
        type: String,
        required: true,
        trim: true
    },
    ownerName: { // సెలూన్ యజమాని పేరు
        type: String,
        required: true,
        trim: true
    },
    phoneNumber: { // సెలూన్ ఫోన్ నంబర్ (భారతదేశానికి +91 ఫార్మాట్)
        type: String,
        required: true,
        unique: true, // ప్రతి సెలూన్‌కు ఒక ప్రత్యేకమైన ఫోన్ నంబర్ ఉండాలి
        trim: true,
        match: /^\+91[0-9]{10}$/ // +91 తో ప్రారంభమై 10 అంకెలు ఉండాలి
    },
    address: { // సెలూన్ పూర్తి చిరునామా
        type: String,
        required: true,
        trim: true
    },
    location: { // మ్యాప్‌లో సెలూన్ స్థానం కోసం GeoJSON పాయింట్
        type: {
            type: String,
            enum: ['Point'], // GeoJSON పాయింట్ కోసం తప్పనిసరి
            default: 'Point',
            required: true
        },
        coordinates: { // లాంగిట్యూడ్, లాటిట్యూడ్ [ఉదా: [78.4867, 17.3850]]
            type: [Number], 
            required: true,
            validate: { // కోఆర్డినేట్‌లు రెండు నంబర్‌ల శ్రేణి అని నిర్ధారించుకోండి
                validator: function(v) {
                    return v && v.length === 2;
                },
                message: 'Coordinates must be an array of two numbers [longitude, latitude].'
            }
        }
    },
    services: [ // సెలూన్ అందించే సేవలు
        {
            name: { // సేవ పేరు (ఉదా: హెయిర్‌కట్)
                type: String,
                required: true,
                trim: true
            },
            price: { // సేవ ధర
                type: Number,
                required: true,
                min: 0 // ధర సున్నా లేదా అంతకంటే ఎక్కువ ఉండాలి
            }
        }
    ],
    salonImageUrl: { // సెలూన్ ప్రధాన చిత్రం కోసం URL
        type: String,
        default: 'https://via.placeholder.com/400x300?text=Salon+Image' // డిఫాల్ట్ ప్లేస్‌హోల్డర్ చిత్రం
    },
    status: { // సెలూన్ ప్రస్తుత స్థితి
        type: String,
        enum: ['Unverified', 'Verified', 'Active', 'Suspended'],
        default: 'Unverified' // అడ్మిన్ ద్వారా ధృవీకరించబడే వరకు డిఫాల్ట్ 'Unverified'
    },
    timings: { // సెలూన్ పని వేళలు
        open: { type: String, default: '09:00 AM' },
        close: { type: String, default: '09:00 PM' }
    },
    bookings: [{ // ఈ సెలూన్‌కు సంబంధించిన బుకింగ్‌ల శ్రేణి
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking' // 'Booking' మోడల్‌కు రిఫరెన్స్
    }]
}, { 
    timestamps: true // createdAt మరియు updatedAt ఫీల్డ్‌లను స్వయంచాలకంగా జోడించడానికి
}); 

// JWT authentication token ని generate చేయడానికి పద్ధతి
salonSchema.methods.generateAuthToken = function() {
    const token = jwt.sign(
        { 
            _id: this._id, // సెలూన్ ID
            phoneNumber: this.phoneNumber, 
            name: this.salonName, // టోకెన్‌లో సెలూన్ పేరును చేర్చండి
            isPartner: true // ఇది సెలూన్ పార్టనర్ అని సూచించడానికి
        }, 
        process.env.JWT_SECRET, // రహస్య కీని పర్యావరణ వేరియబుల్స్ నుండి తీసుకోండి
        { 
            expiresIn: '1d' // టోకెన్ ఒక రోజు తర్వాత గడువు ముగుస్తుంది
        }
    );
    return token;
};

// జియోస్పేషియల్ క్వెరీల కోసం 'location' ఫీల్డ్‌లో 2dsphere ఇండెక్స్‌ను సృష్టించండి
salonSchema.index({ location: '2dsphere' });

const Salon = mongoose.model('Salon', salonSchema);

module.exports = Salon;