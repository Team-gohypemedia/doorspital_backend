const Doctor = require("../model/doctor_model");
const User = require("../../auth/model/user_model");
const { Validator } = require("node-input-validator");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { sendEmail } = require("../../../services/send_mail");
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
    let user = await User.findOne({ email: email });
    if (user) {
      if (user.isVerified) {
        return res.status(400).json({
          success: false,
          message: "User with this email already exists",
        });
      }

      // If user exists but not verified, update OTP and resend
      const otp = String(crypto.randomInt(100000, 1000000));
      const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      user.verificationOtp = otp;
      user.verificationOtpExpires = otpExpires;
      // Update other fields if needed, e.g. name if changed
      if (name) user.userName = name;
      if (password) user.password = bcrypt.hashSync(password, 10);
      await user.save();

      // Send OTP Email
      const emailSent = await sendEmail(
        email,
        "Verify Your Doctor Account",
        `Your OTP for account verification is: ${otp}\n\nThis OTP will expire in 15 minutes.`
      );

      if (!emailSent) {
        return res.status(500).json({
          success: false,
          message: "Failed to send OTP email. Please try again later.",
        });
      }

      return res.status(200).json({
        success: true,
        message: "OTP resent to email. Please verify to complete registration.",
        data: {
          email: user.email,
          requiresOtp: true
        },
      });
    }

    // Hash password
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Generate a 6-digit OTP
    const otp = String(crypto.randomInt(100000, 1000000));
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Create user account for authentication
    user = await User.create({
      userName: name || email,
      email: email,
      password: hashedPassword,
      role: "doctor",
      isVerified: false,
      verificationOtp: otp,
      verificationOtpExpires: otpExpires,
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

    // Send OTP Email
    const emailSent = await sendEmail(
      email,
      "Verify Your Doctor Account",
      `Your OTP for account verification is: ${otp}\n\nThis OTP will expire in 15 minutes.`
    );

    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP email. Please try again later or contact support.",
      });
    }

    // Respond
    res.status(201).json({
      success: true,
      message: "OTP sent to email. Please verify to complete registration.",
      data: {
        email: user.email,
        requiresOtp: true
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

    const { specialization, city, service, page = 1, limit = 10 } = req.query;
    const filter = { isActive: true };
    if (specialization) filter.specialization = specialization;
    if (city) filter.city = city;
    if (service) filter.services = { $in: [service] };

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

const verifyDoctorSignup = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const v = new Validator(req.body, {
      email: "required|email",
      otp: "required|string|minLength:6|maxLength:6",
    });

    const matched = await v.validate();
    if (!matched) {
      return res.status(422).json({
        success: false,
        message: "Validation failed",
        errors: v.errors,
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, message: "User already verified" });
    }

    if (user.verificationOtp !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    if (user.verificationOtpExpires < new Date()) {
      return res.status(400).json({ success: false, message: "OTP expired" });
    }

    // Mark as verified and clear OTP
    user.isVerified = true;
    user.verificationOtp = undefined;
    user.verificationOtpExpires = undefined;
    await user.save();

    // Fetch doctor details to return consistent response
    const doctor = await Doctor.findOne({ user: user._id });

    res.status(200).json({
      success: true,
      message: "Verification successful. You can now login.",
      data: {
        doctorId: doctor?._id,
        userId: user._id,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("Doctor verification error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const updateServices = async (req, res) => {
  try {
    const userId = req.user._id;
    const { services } = req.body;

    if (!Array.isArray(services)) {
      return res.status(400).json({ success: false, message: "Services must be an array" });
    }

    const doctor = await Doctor.findOneAndUpdate(
      { user: userId },
      { services },
      { new: true }
    );

    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor profile not found" });
    }

    res.status(200).json({ success: true, message: "Services updated successfully", data: doctor });
  } catch (err) {
    console.error("Update services error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      specialization,
      experienceYears,
      consultationFee,
      city,
      about,
      qualification
    } = req.body;

    const updateData = {};
    if (specialization) updateData.specialization = specialization;
    if (experienceYears) updateData.experienceYears = experienceYears;
    if (consultationFee) updateData.consultationFee = consultationFee;
    if (city) updateData.city = city;
    if (about !== undefined) updateData.about = about;
    if (qualification !== undefined) updateData.qualification = qualification;

    const doctor = await Doctor.findOneAndUpdate(
      { user: userId },
      updateData,
      { new: true }
    );

    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor profile not found" });
    }

    res.status(200).json({ success: true, message: "Profile updated successfully", data: doctor });
  } catch (err) {
    console.error("Update doctor profile error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  topDoctors,
  doctor,
  doctorSignUp,
  doctorAvailability,
  getMyDoctorId,
  verifyDoctorSignup,
  updateServices,
  updateProfile,
};
