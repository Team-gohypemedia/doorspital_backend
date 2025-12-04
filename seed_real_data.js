const mongoose = require("mongoose");
require("dotenv").config();
const User = require("./src/features/auth/model/user_model");
const Doctor = require("./src/features/doctors/model/doctor_model");
const Appointment = require("./src/features/doctors/model/appointment_model");
const PharmacyOrder = require("./src/features/pharmacy/model/pharmacy_order_model");
const SupportTicket = require("./src/features/support/model/support_ticket_model");
const SystemSetting = require("./src/features/settings/model/system_setting_model");
const DoctorVerification = require("./src/features/doctors/model/doctor_verification_model");

const seedData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/doorspital");
        console.log("Connected to MongoDB");

        // Clear existing data (optional, be careful in prod)
        // await User.deleteMany({});
        // await Doctor.deleteMany({});
        // await Appointment.deleteMany({});
        // await PharmacyOrder.deleteMany({});
        // await SupportTicket.deleteMany({});
        // await SystemSetting.deleteMany({});

        // 1. Create Users
        const users = [];
        for (let i = 0; i < 10; i++) {
            const user = await User.create({
                userName: `User ${i}`,
                email: `user${i}@example.com`,
                password: "password123",
                role: "user",
                phoneNumber: `987654321${i}`,
            });
            users.push(user);
        }
        console.log("Created 10 Users");

        // 2. Create Doctors
        const doctors = [];
        for (let i = 0; i < 5; i++) {
            const user = await User.create({
                userName: `Dr. ${i}`,
                email: `doctor${i}@example.com`,
                password: "password123",
                role: "doctor",
                phoneNumber: `987654321${i}`,
            });

            const doctor = await Doctor.create({
                user: user._id,
                specialization: ["Cardiology", "Dermatology", "General"][i % 3],
                city: ["New York", "London", "Mumbai"][i % 3],
                experienceYears: 5 + i,
                consultationFee: 500 + (i * 100),
                isActive: true,
            });
            doctors.push(doctor);

            // Create Verification
            await DoctorVerification.create({
                doctor: doctor._id,
                status: i === 0 ? "pending" : "approved", // 1 pending, rest approved
                personalDetails: { fullName: user.userName, city: doctor.city, medicalSpecialization: doctor.specialization },
            });
        }
        console.log("Created 5 Doctors");

        // 3. Create Appointments (Revenue)
        for (let i = 0; i < 20; i++) {
            const doctor = doctors[i % doctors.length];
            const patient = users[i % users.length];

            await Appointment.create({
                patient: patient._id,
                doctor: doctor._id,
                startTime: new Date(Date.now() - (i * 86400000)), // Past dates
                endTime: new Date(Date.now() - (i * 86400000) + 1800000),
                status: "completed",
                fee: doctor.consultationFee, // Real fee
                mode: "online",
            });
        }
        console.log("Created 20 Completed Appointments");

        // 4. Create Support Tickets
        for (let i = 0; i < 5; i++) {
            await SupportTicket.create({
                user: users[i]._id,
                subject: `Issue with booking ${i}`,
                message: "I cannot see my appointment details.",
                status: "open",
                priority: "medium",
            });
        }
        console.log("Created 5 Open Support Tickets");

        // 5. Seed Settings
        const defaults = [
            { key: "slotDuration", value: 30, description: "Slot duration", category: "booking" },
            { key: "cancellationPolicy", value: "24h notice", description: "Cancellation", category: "booking" },
            { key: "platformFee", value: "15%", description: "Platform Fee", category: "payment" },
        ];
        for (const s of defaults) {
            await SystemSetting.findOneAndUpdate({ key: s.key }, s, { upsert: true });
        }
        console.log("Seeded System Settings");

        console.log("Database seeded successfully!");
        process.exit(0);
    } catch (err) {
        console.error("Seeding error:", err);
        process.exit(1);
    }
};

seedData();
