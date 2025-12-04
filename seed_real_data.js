const mongoose = require("mongoose");
require("dotenv").config();
const User = require("./src/features/auth/model/user_model");
const Doctor = require("./src/features/doctors/model/doctor_model");
const Appointment = require("./src/features/doctors/model/appointment_model");
const PharmacyOrder = require("./src/features/pharmacy/model/pharmacy_order_model");
const SupportTicket = require("./src/features/support/model/support_ticket_model");
const SystemSetting = require("./src/features/settings/model/system_setting_model");
const DoctorVerification = require("./src/features/doctors/model/doctor_verification_model");

const fs = require('fs');
const log = (msg) => {
    console.log(msg);
    fs.appendFileSync('seed_log.txt', msg + '\n');
};

const seedData = async () => {
    try {
        await mongoose.connect(process.env.MONGODB || "mongodb://localhost:27017/doorspital");
        log("Connected to MongoDB");

        // Clear existing data (optional, be careful in prod)
        await User.deleteMany({});
        await Doctor.deleteMany({});
        await Appointment.deleteMany({});
        await PharmacyOrder.deleteMany({});
        await SupportTicket.deleteMany({});
        await SystemSetting.deleteMany({});

        // 1. Create Users (Patients)
        const users = [];
        const patientNames = ["John Doe", "Jane Smith", "Alice Johnson", "Bob Brown", "Charlie Davis", "Diana Evans", "Evan Foster", "Fiona Green", "George Harris", "Hannah White"];
        for (let i = 0; i < 10; i++) {
            const user = await User.create({
                userName: patientNames[i],
                email: `patient${i}@example.com`,
                password: "password123",
                role: "user",
                phoneNumber: `987654321${i}`,
            });
            users.push(user);
        }
        log("Created 10 Users");

        // 2. Create Doctors
        const doctors = [];
        const doctorProfiles = [
            { name: "Dr. Sarah Wilson", special: "Cardiology", city: "New York", fee: 1500 },
            { name: "Dr. Rajesh Kumar", special: "Dermatology", city: "Mumbai", fee: 1200 },
            { name: "Dr. Emily Chen", special: "Pediatrics", city: "London", fee: 1000 },
            { name: "Dr. Michael Ross", special: "Neurology", city: "New York", fee: 2000 },
            { name: "Dr. Linda Martinez", special: "General", city: "Los Angeles", fee: 800 }
        ];

        for (let i = 0; i < 5; i++) {
            const profile = doctorProfiles[i];
            const user = await User.create({
                userName: profile.name,
                email: `doctor${i}@example.com`,
                password: "password123",
                role: "doctor",
                phoneNumber: `987654321${i}`,
            });

            const doctor = await Doctor.create({
                user: user._id,
                specialization: profile.special,
                city: profile.city,
                experienceYears: 5 + i,
                consultationFee: profile.fee,
                isActive: true,
            });
            doctors.push(doctor);

            // Create Verification
            await DoctorVerification.create({
                doctor: doctor._id,
                status: "approved",
                personalDetails: {
                    fullName: user.userName,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    medicalSpecialization: doctor.specialization,
                    yearsOfExperience: doctor.experienceYears,
                    clinicHospitalName: "City Hospital",
                    clinicAddress: "123 Main St",
                    state: "State",
                    city: doctor.city
                },
                qualifications: {
                    mbbsCertificate: { filename: "mbbs.pdf", path: "/uploads/dummy.pdf" }
                },
                registration: {
                    registrationNumber: "REG12345",
                    councilName: "MCI",
                    issueDate: new Date(),
                    registrationCertificate: { filename: "reg.pdf", path: "/uploads/dummy.pdf" }
                },
                identity: {
                    documentType: "Aadhaar Card",
                    governmentId: { filename: "id.pdf", path: "/uploads/dummy.pdf" }
                },
                selfieVerification: {
                    selfie: { filename: "selfie.jpg", path: "/uploads/dummy.jpg" }
                }
            });
        }
        log("Created 5 Doctors");

        // 3. Create Appointments (Revenue)
        // Create more appointments to make revenue look significant
        // Distribute unevenly to show ranking differences
        const appointmentsPerDoctor = [15, 12, 10, 8, 5]; // Dr 0 gets 15, Dr 4 gets 5

        for (let i = 0; i < 5; i++) {
            const doctor = doctors[i];
            const count = appointmentsPerDoctor[i];

            for (let j = 0; j < count; j++) {
                const patient = users[j % users.length];
                await Appointment.create({
                    patient: patient._id,
                    doctor: doctor._id,
                    startTime: new Date(Date.now() - (j * 86400000)), // Past dates
                    endTime: new Date(Date.now() - (j * 86400000) + 1800000),
                    status: "completed",
                    fee: doctor.consultationFee,
                    mode: "online",
                });
            }
        }
        log("Created 50 Completed Appointments");

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
        log("Created 5 Open Support Tickets");

        // 5. Seed Settings
        const defaults = [
            { key: "slotDuration", value: 30, description: "Slot duration", category: "booking" },
            { key: "cancellationPolicy", value: "24h notice", description: "Cancellation", category: "booking" },
            { key: "platformFee", value: "15%", description: "Platform Fee", category: "payment" },
        ];
        for (const s of defaults) {
            await SystemSetting.findOneAndUpdate({ key: s.key }, s, { upsert: true });
        }
        log("Seeded System Settings");

        log("Database seeded successfully!");
        process.exit(0);
    } catch (err) {
        console.error("Seeding error:", err);
        fs.appendFileSync('seed_log.txt', "Seeding error: " + err + '\n');
        process.exit(1);
    }
};

seedData();
