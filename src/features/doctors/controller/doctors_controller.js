const Doctor = require("../model/doctor_model");
const User = require("../../auth/model/user_model");
const { Validator } = require("node-input-validator");
const bcrypt = require("bcryptjs");
const { getWeeklyAvailability } = require("../services/availabilityService");

const doctorSignUp = async (req, res) => {
  try {

   console.log(req.body);

    // 1️⃣ Define validation rules
    const v = new Validator(
      req.body || {},
      {
        name: "required",
        email: "required",
        password: "required",
        specialization: "required",
        experienceYears: "integer",
        consultationFee: "numeric",
        city: "string",
        timeZone: "string",
      },
    
    );

    const matched = await v.validate();

    // 2️⃣ If validation fails
    if (!matched) {
      return res.status(422).json({
        success: false,
        message: "Validation failed",
        errors: v.errors,
      });
    }

    const { name, email, password, specialization, experienceYears, consultationFee, city, timeZone } = req.body;

    // Check if user with this email already exists
    const existingUser = await User.findOne({ email: email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Hash password
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Create user account for authentication
    const user = await User.create({
      userName: name || email,
      email: email,
      password: hashedPassword,
      role: "doctor",
    });

    // Create doctor profile
    const doctor = await Doctor.create({
      user: user._id,
      specialization,
      experienceYears,
      consultationFee,
      city,
      timeZone: timeZone || "Asia/Kolkata",
    });

    // Respond
    res.status(201).json({
      success: true,
      message: "Doctor registered successfully",
      data: {
        doctorId: doctor._id,
        userId: user._id,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("Doctor register error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * GET /api/doctors/my-doctor-id
 * Get doctorId for the logged-in user (by email)
 * Requires authentication
 */
const getMyDoctorId = async (req, res) => {
  try {
    const userId = req.user._id;
    const userEmail = req.user.email; // From auth middleware

    // Fast path: doctor profile linked via user reference
    const doctorProfile = await Doctor.findOne({ user: userId }).lean();
    if (doctorProfile) {
      return res.status(200).json({
        success: true,
        data: {
          doctorId: doctorProfile._id,
          email: userEmail,
          verificationStatus: "linked",
        },
      });
    }

    // Method 1: Find doctor by checking verification records
    const DoctorVerification = require("../model/doctor_verification_model");
    const verification = await DoctorVerification.findOne({
      "personalDetails.email": userEmail,
    }).populate("doctor");

    if (verification && verification.doctor) {
      return res.status(200).json({
        success: true,
        data: {
          doctorId: verification.doctor._id || verification.doctor,
          email: userEmail,
          verificationStatus: verification.status,
        },
      });
    }

    // Method 2: If no verification yet, try to find any doctor (for new doctors)
    // This is a fallback - ideally doctors should have verification
    const allDoctors = await Doctor.find({}).lean();
    
    // Since we can't directly link User to Doctor by email in the current schema,
    // we'll return a helpful message
    return res.status(404).json({
      success: false,
      message: "Doctor profile not found. Please ensure you have completed doctor registration and verification.",
      hint: "If you just signed up, use the doctorId from the sign-up response. Or complete verification first.",
    });
  } catch (error) {
    console.error("Get my doctor ID error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const topDoctors = async (req, res, next) => {
  try {

    console.log(req.body);
    
    const { specialization, city, page = 1, limit = 10 } = req.query;
    const filter = { isActive: true };
    if (specialization) filter.specialization = specialization;
    if (city) filter.city = city;

    const skip = (Number(page) - 1) * Number(limit);
    const [data, total] = await Promise.all([
      Doctor.find(filter)
        .skip(skip)
        .limit(Number(limit))
        .populate({ path: "user", select: "userName email" })
        .lean(),
      Doctor.countDocuments(filter),
    ]);

    // Add doctorName field for frontend convenience
    const enrichedData = data.map(doctor => ({
      ...doctor,
      doctorName: doctor.user?.userName || "Unknown Doctor",
      doctorEmail: doctor.user?.email || null,
    }));

    res.json({ data: enrichedData, page: Number(page), total });
  } catch (err) {
    next(err);
  }
};

const doctor = async (req, res, next) => {
  try {
    const doctor = await Doctor.findById(req.params.doctorId)
      .populate({ path: "user", select: "userName email" })
      .lean();

    if (!doctor) return res.status(404).json({ message: "Doctor not found" });
    res.json({ data: doctor });
  } catch (err) {
    next(err);
  }
};



const doctorAvailability = async (req, res, next) => {
  try {
    const { doctorId } = req.params;
    const { start, days, tz } = req.query;

    const result = await getWeeklyAvailability({
      doctorId,
      startISO: start || new Date().toISOString(),
      days: days ? Number(days) : 7,
      tzOverride: tz,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  topDoctors,
  doctor,
  doctorSignUp,
  doctorAvailability,
  getMyDoctorId,
};
