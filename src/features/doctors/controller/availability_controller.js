const { Validator } = require("node-input-validator");
const mongoose = require("mongoose");
const DoctorAvailability = require("../model/doctor_availability_model");
const Doctor = require("../model/doctor_model");
const DoctorVerification = require("../model/doctor_verification_model");
const { getWeeklyAvailability } = require("../services/availabilityService");

/**
 * POST /api/doctors/:doctorId/availability
 * Set doctor's weekly availability schedule
 * Only verified doctors can set availability
 */
const setAvailability = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { availability } = req.body; // Array of availability rules

    console.log("Setting availability for doctorId:", doctorId);

    // Validate doctorId
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid doctorId format",
        hint: "doctorId must be a valid MongoDB ObjectId (24-character hex string)",
        received: doctorId,
      });
    }

    // Check if doctor exists
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      // Check if any doctors exist at all
      const totalDoctors = await Doctor.countDocuments();
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
        hint: `No doctor found with ID: ${doctorId}. Total doctors in database: ${totalDoctors}`,
        suggestion: "Use GET /api/doctors/top to see all available doctors and their IDs",
      });
    }

    // Check if doctor is verified
    const verification = await DoctorVerification.findOne({
      doctor: doctorId,
      status: "approved",
    });

    if (!verification) {
      return res.status(403).json({
        success: false,
        message: "Only verified doctors can set availability. Please complete verification first.",
      });
    }

    // Validate availability array
    if (!Array.isArray(availability) || availability.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Availability array is required",
      });
    }

    // Validate each availability rule
    for (const rule of availability) {
      // Basic validation
      const v = new Validator(rule, {
        dayOfWeek: "required|integer|min:0|max:6",
        startTime: "required",
        endTime: "required",
        slotDurationMinutes: "integer|min:5|max:60",
      });

      let matched = false;
      try {
        matched = await v.validate();
      } catch (validatorErr) {
        console.error('Validator threw exception:', validatorErr);
        return res.status(422).json({
          success: false,
          message: 'Validation library error',
          error: validatorErr && validatorErr.message ? validatorErr.message : String(validatorErr),
        });
      }

      if (!matched) {
        return res.status(422).json({
          success: false,
          message: 'Validation error',
          errors: v.errors,
        });
      }

      // Manual regex validation for time format (HH:MM)
      const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(rule.startTime)) {
        return res.status(422).json({
          success: false,
          message: "startTime must be in HH:MM format (24-hour)",
          errors: {
            startTime: {
              message: "Invalid time format. Use HH:MM (e.g., 09:00, 17:30)",
            },
          },
        });
      }

      if (!timeRegex.test(rule.endTime)) {
        return res.status(422).json({
          success: false,
          message: "endTime must be in HH:MM format (24-hour)",
          errors: {
            endTime: {
              message: "Invalid time format. Use HH:MM (e.g., 09:00, 17:30)",
            },
          },
        });
      }

      // Validate time range
      const [startH, startM] = rule.startTime.split(":").map(Number);
      const [endH, endM] = rule.endTime.split(":").map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      if (endMinutes <= startMinutes) {
        return res.status(400).json({
          success: false,
          message: `End time must be after start time for day ${rule.dayOfWeek}`,
        });
      }
    }

    // Delete existing availability for this doctor
    await DoctorAvailability.deleteMany({ doctor: doctorId });

    // Create new availability rules
    const availabilityRules = availability.map((rule) => ({
      doctor: doctorId,
      dayOfWeek: rule.dayOfWeek,
      startTime: rule.startTime,
      endTime: rule.endTime,
      slotDurationMinutes: rule.slotDurationMinutes || 15,
      isActive: rule.isActive !== undefined ? rule.isActive : true,
    }));

    const created = await DoctorAvailability.insertMany(availabilityRules);

    return res.status(201).json({
      success: true,
      message: "Availability set successfully",
      data: {
        doctorId,
        availability: created,
      },
    });
  } catch (error) {
    console.error("Set availability error:", error);

    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate availability rule. Each day can only have one schedule.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/doctors/:doctorId/availability
 * Get doctor's availability schedule
 */
const getAvailability = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { start, days, tz } = req.query;

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid doctorId format",
      });
    }

    const result = await getWeeklyAvailability({
      doctorId,
      startISO: start || new Date().toISOString(),
      days: days ? Number(days) : 7,
      tzOverride: tz,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Get availability error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

module.exports = {
  setAvailability,
  getAvailability,
};

