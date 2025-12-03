const mongoose = require("mongoose");
const fs = require('fs');
require('dotenv').config();
const Doctor = require("./src/features/doctors/model/doctor_model");
const User = require("./src/features/auth/model/user_model");

const log = (msg) => {
    console.log(msg);
    fs.appendFileSync('verification_result.txt', msg + '\n');
};

const connectDB = async () => {
    try {
        const mongoUri = (process.env.MONGODB || '').trim().replace(/^["']|["']$/g, '');
        await mongoose.connect(mongoUri);
        log("MongoDB Connected");
    } catch (error) {
        log("DB Connection Error: " + error);
        process.exit(1);
    }
};

const verifyDoctors = async () => {
    await connectDB();

    try {
        const doctors = await Doctor.find().populate("user", "userName email");
        log(`Found ${doctors.length} doctors.`);

        doctors.forEach(doc => {
            log("---------------------------------------------------");
            log(`Doctor ID: ${doc._id}`);
            if (doc.user) {
                log(`Linked User ID: ${doc.user._id}`);
                log(`User Name: ${doc.user.userName}`);
                log(`User Email: ${doc.user.email}`);
            } else {
                log("WARNING: No linked user found (doc.user is null/undefined)");
            }
        });

    } catch (error) {
        log("Verification Error: " + error);
    } finally {
        mongoose.connection.close();
    }
};

verifyDoctors();
