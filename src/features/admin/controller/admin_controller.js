const mongoose = require('mongoose');
const User = require('../../auth/model/user_model');
const Doctor = require('../../doctors/model/doctor_model');
const DoctorVerification = require('../../doctors/model/doctor_verification_model');
const DoctorAvailability = require('../../doctors/model/doctor_availability_model');
const Appointment = require('../../doctors/model/appointment_model');
const PharmacyProduct = require('../../pharmacy/model/pharmacy_product_model');
const PharmacyOrder = require('../../pharmacy/model/pharmacy_order_model');
const Notification = require('../../notifications/model/notification_model');
const ChatRoom = require('../../chat/model/chat_room_model');
const ChatMessage = require('../../chat/model/chat_message_model');
const Conversation = require('../../chat/model/conversation_model');
const HealthArticle = require('../../health_article/model/health_artical_model');
const DoctorTimeOff = require('../../doctors/model/doctor_time_off_model');
const SupportTicket = require('../../support/model/support_ticket_model');
const SystemSetting = require('../../settings/model/system_setting_model');
const { seedDefaultSettings } = require('../../settings/controller/settings_controller');

// ============================================================================
// DASHBOARD & STATISTICS
// ============================================================================

const getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalDoctors,
      totalPatients,
      totalAdmins,
      totalAppointments,
      confirmedAppointments,
      completedAppointments,
      cancelledAppointments,
      totalProducts,
      totalOrders,
      deliveredOrders,
      pendingDoctorVerifications,
      approvedDoctorVerifications,
      rejectedDoctorVerifications,
      totalNotifications,
      totalChatRooms,
      totalHealthArticles,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'doctor' }),
      User.countDocuments({ role: 'user' }),
      User.countDocuments({ role: 'admin' }),
      Appointment.countDocuments(),
      Appointment.countDocuments({ status: 'confirmed' }),
      Appointment.countDocuments({ status: 'completed' }),
      Appointment.countDocuments({ status: 'cancelled' }),
      PharmacyProduct.countDocuments(),
      PharmacyOrder.countDocuments(),
      PharmacyOrder.countDocuments({ status: 'delivered' }),
      DoctorVerification.countDocuments({ status: 'pending' }),
      DoctorVerification.countDocuments({ status: 'approved' }),
      DoctorVerification.countDocuments({ status: 'rejected' }),
      Notification.countDocuments(),
      ChatRoom.countDocuments(),
      HealthArticle.countDocuments(),
    ]);

    // Revenue Aggregation
    const [pharmacyRevenue] = await PharmacyOrder.aggregate([
      { $match: { status: 'delivered' } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);

    const [appointmentRevenue] = await Appointment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$fee' } } }
    ]);

    // Trend Aggregation (Last 7 Days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const trendData = await Appointment.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Fill in missing days
    const trend = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dateStr = d.toISOString().split('T')[0];
      const found = trendData.find(t => t._id === dateStr);
      trend.push({
        date: dateStr,
        count: found ? found.count : 0
      });
    }

    const revenue = {
      amount: (pharmacyRevenue?.total || 0) + (appointmentRevenue?.total || 0),
      completedOrders: deliveredOrders,
    };

    // Fetch Real Settings (Seed if empty)
    let settings = await SystemSetting.find({});
    if (settings.length === 0) {
      await seedDefaultSettings();
      settings = await SystemSetting.find({});
    }

    // Fetch Real Support Queue
    const supportQueueCount = await SupportTicket.countDocuments({ status: 'open' });

    const featureFlags = [
      { name: 'New UI', enabled: true, description: 'Enable the new dashboard UI' },
      { name: 'Beta Features', enabled: false, description: 'Access to beta features' },
    ];

    const systemHealth = {
      mongodb: {
        status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        readyState: mongoose.connection.readyState,
      },
    };

    return res.status(200).json({
      success: true,
      data: {
        totals: {
          users: totalPatients, // Frontend expects 'users' to be patients count usually, or total users
          bookings: totalAppointments + totalOrders,
          orders: totalOrders,
          appointments: totalAppointments,
        },
        revenue,
        verifications: {
          pendingDoctors: pendingDoctorVerifications,
          pendingPharmacies: 0, // Add pharmacy verification count if available
        },
        trend,
        supportQueue: supportQueueCount,
        settings,
        featureFlags,
        systemHealth,
      },
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getTopDoctors = async (req, res) => {
  try {
    // 1. Top by Appointments
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
          value: '$count' // Generic field for UI
        }
      }
    ]);
    console.log('Top Doctors by Appointments:', JSON.stringify(byAppointments, null, 2));

    // 2. Top by Revenue
    const byRevenue = await Appointment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: '$doctor', totalRevenue: { $sum: '$fee' } } },
      { $sort: { totalRevenue: -1 } },
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
          value: '$totalRevenue' // Generic field for UI
        }
      }
    ]);
    console.log('Top Doctors by Revenue:', JSON.stringify(byRevenue, null, 2));

    return res.status(200).json({
      success: true,
      data: {
        byAppointments,
        byRevenue
      },
    });
  } catch (err) {
    console.error('Get top doctors error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ============================================================================
// USER MANAGEMENT
// ============================================================================

const getAllUsers = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const role = req.query.role; // Optional: 'user', 'doctor', 'admin'
    const search = req.query.search; // Optional: search by email or userName

    const filter = {};
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter).select('-password').skip(skip).limit(limit).sort({ createdAt: -1 }).lean(),
      User.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: users,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Get all users error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid userId' });
    }

    const user = await User.findById(userId).select('-password').lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    return res.status(200).json({ success: true, data: user });
  } catch (err) {
    console.error('Get user by id error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid userId' });
    }

    const validRoles = ['user', 'doctor', 'admin'];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    const user = await User.findByIdAndUpdate(userId, { role }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    return res.status(200).json({ success: true, message: 'Role updated', data: user });
  } catch (err) {
    console.error('Update user role error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid userId' });
    }

    const user = await User.findByIdAndDelete(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    return res.status(200).json({ success: true, message: 'User deleted' });
  } catch (err) {
    console.error('Delete user error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ============================================================================
// DOCTOR MANAGEMENT
// ============================================================================

const getAllDoctors = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const specialization = req.query.specialization;
    const city = req.query.city;

    const filter = {};
    if (specialization) filter.specialization = { $regex: specialization, $options: 'i' };
    if (city) filter.city = { $regex: city, $options: 'i' };

    const [doctors, total] = await Promise.all([
      Doctor.find(filter).populate('user', 'email userName phoneNumber').skip(skip).limit(limit).sort({ createdAt: -1 }).lean(),
      Doctor.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: doctors,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Get all doctors error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getDoctorById = async (req, res) => {
  try {
    const { doctorId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ success: false, message: 'Invalid doctorId' });
    }

    const doctor = await Doctor.findById(doctorId).populate('user', 'email userName phoneNumber').lean();
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

    // Get additional info
    const [verification, availability, appointments] = await Promise.all([
      DoctorVerification.findOne({ doctor: doctorId }).lean(),
      DoctorAvailability.find({ doctor: doctorId }).lean(),
      Appointment.find({ doctor: doctorId }).lean(),
    ]);

    return res.status(200).json({
      success: true,
      data: { doctor, verification, availability, appointmentCount: appointments.length },
    });
  } catch (err) {
    console.error('Get doctor by id error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const toggleDoctorStatus = async (req, res) => {
  try {
    const { doctorId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ success: false, message: 'Invalid doctorId' });
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

    doctor.isActive = !doctor.isActive;
    await doctor.save();

    return res.status(200).json({ success: true, message: 'Doctor status updated', data: doctor });
  } catch (err) {
    console.error('Toggle doctor status error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const updateDoctorDetails = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { specialization, city, experienceYears, consultationFee, isActive, userName, email } = req.body;

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ success: false, message: 'Invalid doctorId' });
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

    // Update Doctor fields
    if (specialization !== undefined) doctor.specialization = specialization;
    if (city !== undefined) doctor.city = city;
    if (experienceYears !== undefined) doctor.experienceYears = experienceYears;
    if (consultationFee !== undefined) doctor.consultationFee = consultationFee;
    if (typeof isActive === 'boolean') doctor.isActive = isActive;

    await doctor.save();

    // Update User fields if provided
    if (userName || email) {
      const userUpdate = {};
      if (userName) userUpdate.userName = userName;
      if (email) userUpdate.email = email;
      await User.findByIdAndUpdate(doctor.user, userUpdate);
    }

    return res.status(200).json({ success: true, message: 'Doctor updated successfully', data: doctor });
  } catch (err) {
    console.error('Update doctor error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ============================================================================
// DOCTOR VERIFICATION MANAGEMENT
// ============================================================================

const getAllVerifications = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const status = req.query.status; // 'pending', 'approved', 'rejected', 'under_review'

    const filter = {};
    if (status) filter.status = status;

    const [verifications, total] = await Promise.all([
      DoctorVerification.find(filter).populate('doctor', 'specialization city').populate('reviewedBy', 'email userName').skip(skip).limit(limit).sort({ createdAt: -1 }).lean(),
      DoctorVerification.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: verifications,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Get all verifications error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const updateVerificationStatus = async (req, res) => {
  try {
    const { verificationId } = req.params;
    const { status, adminNotes } = req.body;
    const adminId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(verificationId)) {
      return res.status(400).json({ success: false, message: 'Invalid verificationId' });
    }

    const validStatuses = ['pending', 'under_review', 'approved', 'rejected'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const verification = await DoctorVerification.findByIdAndUpdate(
      verificationId,
      {
        status,
        adminNotes: adminNotes || '',
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
      { new: true }
    );

    if (!verification) return res.status(404).json({ success: false, message: 'Verification not found' });

    return res.status(200).json({ success: true, message: 'Verification status updated', data: verification });
  } catch (err) {
    console.error('Update verification status error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ============================================================================
// APPOINTMENT MANAGEMENT
// ============================================================================

const getAllAppointments = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const status = req.query.status;
    const mode = req.query.mode;

    const filter = {};
    if (status) filter.status = status;
    if (mode) filter.mode = mode;

    const [appointments, total] = await Promise.all([
      Appointment.find(filter)
        .populate('patient', 'userName email')
        .populate({
          path: 'doctor',
          select: 'specialization',
          populate: {
            path: 'user',
            select: 'userName email'
          }
        })
        .skip(skip)
        .limit(limit)
        .sort({ startTime: -1 })
        .lean(),
      Appointment.countDocuments(filter),
    ]);

    console.log('Fetched Appointments:', JSON.stringify(appointments, null, 2));

    return res.status(200).json({
      success: true,
      data: appointments,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Get all appointments error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const updateAppointmentStatus = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ success: false, message: 'Invalid appointmentId' });
    }

    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const appointment = await Appointment.findByIdAndUpdate(appointmentId, { status }, { new: true });
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });

    return res.status(200).json({ success: true, message: 'Appointment updated', data: appointment });
  } catch (err) {
    console.error('Update appointment status error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const deleteAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ success: false, message: 'Invalid appointmentId' });
    }

    const appointment = await Appointment.findByIdAndDelete(appointmentId);
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });

    return res.status(200).json({ success: true, message: 'Appointment deleted' });
  } catch (err) {
    console.error('Delete appointment error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ============================================================================
// PHARMACY MANAGEMENT
// ============================================================================

const getAllPharmacies = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const search = req.query.search;
    const status = req.query.status;

    const matchStage = {};
    if (status) matchStage.status = status;
    if (search) {
      matchStage.$or = [
        { storeName: { $regex: search, $options: 'i' } },
        { ownerName: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const aggregationPipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: '$userInfo' },
      {
        $lookup: {
          from: 'pharmacyproducts',
          localField: '_id',
          foreignField: 'pharmacy',
          as: 'products'
        }
      },
      {
        $lookup: {
          from: 'pharmacyorders',
          localField: '_id',
          foreignField: 'pharmacy',
          as: 'orders'
        }
      },
      {
        $project: {
          _id: 1,
          storeName: 1,
          ownerName: 1,
          phoneNumber: 1,
          drugLicenseNumber: 1,
          status: 1,
          createdAt: 1,
          email: '$userInfo.email',
          userName: '$userInfo.userName',
          productCount: { $size: '$products' },
          orderCount: { $size: '$orders' },
          address: 1
        }
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit }
    ];

    const [pharmacies, total] = await Promise.all([
      require('../../pharmacy/model/pharmacy_model').aggregate(aggregationPipeline),
      require('../../pharmacy/model/pharmacy_model').countDocuments(matchStage)
    ]);

    return res.status(200).json({
      success: true,
      data: pharmacies,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Get all pharmacies error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getPharmacyById = async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(pharmacyId)) {
      return res.status(400).json({ success: false, message: 'Invalid pharmacyId' });
    }

    const Pharmacy = require('../../pharmacy/model/pharmacy_model');
    const pharmacy = await Pharmacy.findById(pharmacyId).populate('user', 'email userName phoneNumber').lean();
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: 'Pharmacy not found' });
    }

    const [products, orders] = await Promise.all([
      PharmacyProduct.find({ pharmacy: pharmacyId, isDeleted: false }).lean(),
      PharmacyOrder.find({ pharmacy: pharmacyId }).populate('user', 'userName email').sort({ createdAt: -1 }).lean()
    ]);

    return res.status(200).json({
      success: true,
      data: {
        pharmacy,
        products,
        orders,
        stats: {
          totalProducts: products.length,
          totalOrders: orders.length,
          totalRevenue: orders.reduce((sum, order) => sum + (order.total || 0), 0)
        }
      }
    });
  } catch (err) {
    console.error('Get pharmacy details error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getAllPharmacyProducts = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const status = req.query.status;
    const search = req.query.search;

    const filter = { isDeleted: false };
    if (status) filter.status = status;
    if (search) filter.name = { $regex: search, $options: 'i' };

    const [products, total] = await Promise.all([
      PharmacyProduct.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }).lean(),
      PharmacyProduct.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: products,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Get all pharmacy products error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getAllPharmacyOrders = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const status = req.query.status;

    const filter = {};
    if (status) filter.status = status;

    const [orders, total] = await Promise.all([
      PharmacyOrder.find(filter)
        .populate('user', 'userName email phoneNumber')
        .populate('pharmacy', 'storeName ownerName phoneNumber')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
      PharmacyOrder.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: orders,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Get all pharmacy orders error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getPharmacyOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid orderId' });
    }

    const PharmacyOrder = require('../../pharmacy/model/pharmacy_order_model');
    const order = await PharmacyOrder.findById(orderId)
      .populate('user', 'userName email phoneNumber address')
      .populate('pharmacy', 'storeName ownerName phoneNumber address email')
      .lean();

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    return res.status(200).json({ success: true, data: order });
  } catch (err) {
    console.error('Get pharmacy order details error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const updatePharmacyOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid orderId' });
    }

    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const order = await PharmacyOrder.findByIdAndUpdate(orderId, { status }, { new: true });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    return res.status(200).json({ success: true, message: 'Order status updated', data: order });
  } catch (err) {
    console.error('Update order status error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const deletePharmacyOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid orderId' });
    }

    const order = await PharmacyOrder.findByIdAndDelete(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    return res.status(200).json({ success: true, message: 'Order deleted successfully' });
  } catch (err) {
    console.error('Delete pharmacy order error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ============================================================================
// NOTIFICATIONS MANAGEMENT
// ============================================================================

const getAllNotifications = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      Notification.find().populate('user', 'userName email').skip(skip).limit(limit).sort({ createdAt: -1 }).lean(),
      Notification.countDocuments(),
    ]);

    return res.status(200).json({
      success: true,
      data: notifications,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Get all notifications error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({ success: false, message: 'Invalid notificationId' });
    }

    const notification = await Notification.findByIdAndDelete(notificationId);
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });

    return res.status(200).json({ success: true, message: 'Notification deleted' });
  } catch (err) {
    console.error('Delete notification error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ============================================================================
// CHAT MANAGEMENT
// ============================================================================

const getAllChatRooms = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const [rooms, total] = await Promise.all([
      ChatRoom.find().populate('patient', 'userName email').populate('doctor', 'specialization').populate('doctorUser', 'userName email').skip(skip).limit(limit).sort({ createdAt: -1 }).lean(),
      ChatRoom.countDocuments(),
    ]);

    return res.status(200).json({
      success: true,
      data: rooms,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Get all chat rooms error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getAllConversations = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const [conversations, total] = await Promise.all([
      Conversation.find().skip(skip).limit(limit).sort({ updatedAt: -1 }).lean(),
      Conversation.countDocuments(),
    ]);

    return res.status(200).json({
      success: true,
      data: conversations,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Get all conversations error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ============================================================================
// HEALTH ARTICLES MANAGEMENT
// ============================================================================

const getAllHealthArticles = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const [articles, total] = await Promise.all([
      HealthArticle.find().skip(skip).limit(limit).sort({ createdAt: -1 }).lean(),
      HealthArticle.countDocuments(),
    ]);

    return res.status(200).json({
      success: true,
      data: articles,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Get all health articles error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getHealthArticleById = async (req, res) => {
  try {
    const { articleId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(articleId)) {
      return res.status(400).json({ success: false, message: 'Invalid articleId' });
    }

    const article = await HealthArticle.findById(articleId).populate('author', 'userName email').lean();
    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }

    return res.status(200).json({ success: true, data: article });
  } catch (err) {
    console.error('Get health article error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const updateHealthArticle = async (req, res) => {
  try {
    const { articleId } = req.params;
    const { title, image, date, time, description } = req.body;

    if (!mongoose.Types.ObjectId.isValid(articleId)) {
      return res.status(400).json({ success: false, message: 'Invalid articleId' });
    }

    const article = await HealthArticle.findById(articleId);
    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }

    if (title) article.title = title;
    if (image) article.image = image;
    if (date) article.date = date;
    if (time) article.time = time;
    if (description) article.description = description;

    await article.save();

    return res.status(200).json({ success: true, message: 'Article updated', data: article });
  } catch (err) {
    console.error('Update health article error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ============================================================================
// BULK OPERATIONS
// ============================================================================

const bulkDeleteUsers = async (req, res) => {
  try {
    const { userIds } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, message: 'userIds array is required' });
    }

    const result = await User.deleteMany({ _id: { $in: userIds } });
    return res.status(200).json({ success: true, message: `Deleted ${result.deletedCount} users` });
  } catch (err) {
    console.error('Bulk delete users error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const bulkUpdateAppointmentStatus = async (req, res) => {
  try {
    const { appointmentIds, status } = req.body;
    if (!Array.isArray(appointmentIds) || appointmentIds.length === 0) {
      return res.status(400).json({ success: false, message: 'appointmentIds array is required' });
    }

    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const result = await Appointment.updateMany({ _id: { $in: appointmentIds } }, { status });
    return res.status(200).json({ success: true, message: `Updated ${result.modifiedCount} appointments` });
  } catch (err) {
    console.error('Bulk update appointments error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = {
  getDashboardStats,
  getTopDoctors,
  getAllUsers,
  getUserById,
  updateUserRole,
  deleteUser,
  getAllDoctors,
  getDoctorById,
  toggleDoctorStatus,
  updateDoctorDetails,
  getAllVerifications,
  updateVerificationStatus,
  getAllAppointments,
  updateAppointmentStatus,
  deleteAppointment,
  getAllPharmacyProducts,
  getAllPharmacyOrders,
  getPharmacyOrderById,
  updatePharmacyOrderStatus,
  deletePharmacyOrder,
  getAllNotifications,
  deleteNotification,
  getAllChatRooms,
  getAllConversations,
  getAllPharmacies,
  getPharmacyById,
  getAllHealthArticles,
  getHealthArticleById,
  updateHealthArticle,
  bulkDeleteUsers,
  bulkUpdateAppointmentStatus,
};
