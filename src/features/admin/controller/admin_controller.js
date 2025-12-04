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

    // Mock revenue data (replace with real aggregation if available)
    const revenue = {
      amount: totalOrders * 150 + completedAppointments * 500, // Dummy calculation
      completedOrders: deliveredOrders,
    };

    // Mock settings and feature flags (replace with real DB fetch if available)
    const settings = [
      { key: 'slotDuration', value: 30 },
      { key: 'cancellationPolicy', value: '24h notice' },
      { key: 'refundWindow', value: '7 days' },
      { key: 'platformFee', value: '10%' },
      { key: 'taxSettings', value: 'GST 18%' },
    ];

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
        supportQueue: 5, // Mock support queue count
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
    const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 20);

    // Fetch doctors and populate user details
    const doctors = await Doctor.find({ isActive: true })
      .populate('user', 'userName email')
      .limit(limit)
      .lean();

    // For each doctor, count their completed appointments
    const topDoctorsWithStats = await Promise.all(
      doctors.map(async (doctor) => {
        const appointmentCount = await Appointment.countDocuments({
          doctor: doctor._id,
          status: 'completed',
        });

        return {
          _id: doctor._id,
          fullName: doctor.user?.userName || 'Unknown Doctor',
          specialization: doctor.specialization,
          city: doctor.city,
          appointments: appointmentCount,
        };
      })
    );

    // Sort by appointment count descending
    topDoctorsWithStats.sort((a, b) => b.appointments - a.appointments);

    return res.status(200).json({
      success: true,
      data: topDoctorsWithStats,
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
      PharmacyOrder.find(filter).populate('user', 'userName email phoneNumber').skip(skip).limit(limit).sort({ createdAt: -1 }).lean(),
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
  updatePharmacyOrderStatus,
  deletePharmacyOrder,
  getAllNotifications,
  deleteNotification,
  getAllChatRooms,
  getAllConversations,
  getAllHealthArticles,
  bulkDeleteUsers,
  bulkUpdateAppointmentStatus,
};
