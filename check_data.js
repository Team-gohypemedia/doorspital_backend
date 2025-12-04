const mongoose = require('mongoose');
const Appointment = require('./src/features/doctors/model/appointment_model');
const Doctor = require('./src/features/doctors/model/doctor_model');
const User = require('./src/features/auth/model/user_model');
const fs = require('fs');
require('dotenv').config();

const log = (msg) => {
    console.log(msg);
    fs.appendFileSync('check_data.log', msg + '\n');
};

const checkData = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/doorspital');
        log('Connected to MongoDB');

        const completedAppointments = await Appointment.countDocuments({ status: 'completed' });
        log('Completed Appointments: ' + completedAppointments);

        const appointmentsWithFee = await Appointment.countDocuments({ status: 'completed', fee: { $exists: true } });
        log('Completed Appointments with Fee: ' + appointmentsWithFee);

        const doctors = await Doctor.countDocuments({ isActive: true });
        log('Active Doctors: ' + doctors);

        if (completedAppointments > 0) {
            const sample = await Appointment.findOne({ status: 'completed' }).populate('doctor');
            log('Sample Completed Appointment: ' + JSON.stringify(sample, null, 2));
        }

        // Run the aggregation manually to see what happens
        const byAppointments = await Appointment.aggregate([
            { $match: { status: 'completed' } },
            { $group: { _id: '$doctor', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: 'doctors',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'doctorInfo'
                }
            },
            { $unwind: '$doctorInfo' },
            {
                $lookup: {
                    from: 'users',
                    localField: 'doctorInfo.user',
                    foreignField: '_id',
                    as: 'userInfo'
                }
            },
            { $unwind: '$userInfo' },
            {
                $project: {
                    _id: 1,
                    fullName: '$userInfo.userName',
                    specialization: '$doctorInfo.specialization',
                    city: '$doctorInfo.city',
                    value: '$count'
                }
            }
        ]);
        log('Aggregation Result (byAppointments): ' + JSON.stringify(byAppointments, null, 2));

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        fs.appendFileSync('check_data.log', 'Error: ' + err + '\n');
        process.exit(1);
    }
};

checkData();
