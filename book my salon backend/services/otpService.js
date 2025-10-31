// C:\Users\HOME\OneDrive\Desktop\book my saloon\book my salon backend\services\otpService.js

const OTP = require('../models/OTP'); // మీ OTP మోడల్‌ను ఇక్కడ దిగుమతి చేసుకోండి

/**
 * 6-అంకెల OTP ని రూపొందిస్తుంది.
 * @returns {string} 6-అంకెల OTP స్ట్రింగ్‌గా.
 */
const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * ఇచ్చిన ఫోన్ నంబర్ మరియు మోడ్ కోసం OTP ని డేటాబేస్‌లో నిల్వ చేస్తుంది లేదా అప్‌డేట్ చేస్తుంది.
 * OTP 5 నిమిషాల తర్వాత గడువు ముగుస్తుంది.
 * @param {string} phoneNumber - OTP కోసం ఫోన్ నంబర్.
 * @param {string} otp - నిల్వ చేయాల్సిన OTP.
 * @param {string} mode - OTP యొక్క రకం (ఉదా. 'user-signup', 'salon-login').
 */
const storeOtp = async (phoneNumber, otp, mode) => {
    const startTime = Date.now(); // Start timer for performance measurement
    const expiryTime = Date.now() + 5 * 60 * 1000; // 5 minutes from now

    try {
        console.log(`[OTP Service] Starting storeOtp for ${phoneNumber} (${mode}).`);
        // phoneNumber మరియు mode రెండింటినీ ఉపయోగించి ఇప్పటికే ఉన్న OTP ని కనుగొని అప్‌డేట్ చేయండి
        let existingOtpEntry = await OTP.findOne({ phoneNumber, mode });

        if (existingOtpEntry) {
            existingOtpEntry.otp = otp;
            existingOtpEntry.expiresAt = new Date(expiryTime);
            await existingOtpEntry.save();
            console.log(`[OTP Service] Updated OTP ${otp} for ${phoneNumber} (${mode}) in DB. Expires at ${new Date(expiryTime).toLocaleTimeString()}.`);
        } else {
            const newOtpEntry = new OTP({
                phoneNumber,
                otp,
                mode, // mode ని ఇక్కడ సేవ్ చేయండి
                expiresAt: new Date(expiryTime)
            });
            await newOtpEntry.save();
            console.log(`[OTP Service] Stored new OTP ${otp} for ${phoneNumber} (${mode}) in DB. Expires at ${new Date(expiryTime).toLocaleTimeString()}.`);
        }
        const endTime = Date.now(); // End timer
        console.log(`[OTP Service] storeOtp for ${phoneNumber} (${mode}) completed in ${endTime - startTime}ms`);
    } catch (error) {
        console.error(`[OTP Service] Error storing OTP for ${phoneNumber} (${mode}):`, error.message);
        // డూప్లికేట్ కీ ఎర్రర్ (unique index violation) వంటి నిర్దిష్ట లోపాలను నిర్వహించండి
        if (error.code === 11000) { // MongoDB duplicate key error code
            console.warn(`[OTP Service] Attempted to store duplicate OTP for ${phoneNumber} (${mode}). It might be a race condition, attempting to update.`);
        }
        throw error; // కాల్ చేసే ఫంక్షన్‌కు ఎర్రర్‌ను తిరిగి ఇవ్వండి
    }
};

/**
 * ఇచ్చిన ఫోన్ నంబర్, OTP మరియు మోడ్ కోసం డేటాబేస్‌లో OTP ని ధృవీకరిస్తుంది.
 * విజయవంతమైన ధృవీకరణ తర్వాత లేదా గడువు ముగిసిన తర్వాత OTP ని తొలగిస్తుంది.
 * @param {string} phoneNumber - OTP కోసం ఫోన్ నంబర్.
 * @param {string} otp - ధృవీకరించాల్సిన OTP.
 * @param {string} mode - OTP యొక్క రకం.
 * @returns {boolean} OTP చెల్లుబాటు అయితే true, లేకపోతే false.
 */
const verifyOtp = async (phoneNumber, otp, mode) => {
    const startTime = Date.now(); // Start timer for performance measurement
    try {
        console.log(`[OTP Service] Starting verifyOtp for ${phoneNumber} (${mode}).`);
        const stored = await OTP.findOne({ phoneNumber, mode }); // phoneNumber మరియు mode రెండింటి ద్వారా కనుగొనండి

        if (!stored) {
            console.log(`[OTP Service] No OTP found for ${phoneNumber} (${mode}) in DB.`);
            const endTime = Date.now();
            console.log(`[OTP Service] verifyOtp for ${phoneNumber} (${mode}) completed in ${endTime - startTime}ms (No OTP found).`);
            return false;
        }
        
        // OTP గడువు ముగిసిందో లేదో తనిఖీ చేయండి
        if (Date.now() > stored.expiresAt.getTime()) {
            console.log(`[OTP Service] OTP for ${phoneNumber} (${mode}) expired in DB.`);
            await OTP.deleteOne({ phoneNumber, mode }); // గడువు ముగిసిన OTP ని తొలగించండి
            const endTime = Date.now();
            console.log(`[OTP Service] verifyOtp for ${phoneNumber} (${mode}) completed in ${endTime - startTime}ms (Expired OTP).`);
            return false;
        }

        // OTP సరిపోలిందో లేదో తనిఖీ చేయండి
        const isMatch = stored.otp === otp;
        if (isMatch) {
            console.log(`[OTP Service] OTP for ${phoneNumber} (${mode}) matched from DB.`);
            await OTP.deleteOne({ phoneNumber, mode }); // విజయవంతమైన ధృవీకరణ తర్వాత OTP ని తొలగించండి (సింగిల్-యూజ్ OTP)
        } else {
            console.log(`[OTP Service] OTP for ${phoneNumber} (${mode}) did not match. Provided: ${otp}, Stored: ${stored.otp}`);
        }
        const endTime = Date.now(); // End timer
        console.log(`[OTP Service] verifyOtp for ${phoneNumber} (${mode}) completed in ${endTime - startTime}ms`);
        return isMatch;
    } catch (error) {
        console.error(`[OTP Service] Error verifying OTP for ${phoneNumber} (${mode}):`, error.message);
        throw error;
    }
};

/**
 * ఇచ్చిన ఫోన్ నంబర్ మరియు మోడ్ కోసం డేటాబేస్ నుండి OTP ని మానవీయంగా తొలగిస్తుంది.
 * @param {string} phoneNumber - తొలగించాల్సిన OTP కోసం ఫోన్ నంబర్.
 * @param {string} mode - తొలగించాల్సిన OTP యొక్క రకం.
 */
const clearOtp = async (phoneNumber, mode) => {
    try {
        const result = await OTP.deleteOne({ phoneNumber, mode }); // phoneNumber మరియు mode రెండింటి ద్వారా తొలగించండి
        if (result.deletedCount > 0) {
            console.log(`[OTP Service] OTP for ${phoneNumber} (${mode}) manually cleared from DB.`);
        } else {
            console.log(`[OTP Service] No OTP found to clear for ${phoneNumber} (${mode}) in DB.`);
        }
    } catch (error) {
        console.error(`[OTP Service] Error clearing OTP for ${phoneNumber} (${mode}):`, error.message);
        throw error;
    }
};

module.exports = {
    generateOtp,
    storeOtp,
    verifyOtp,
    clearOtp
};