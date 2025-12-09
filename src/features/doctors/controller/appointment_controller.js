const { Validator } = require("node-input-validator");
const mongoose = require("mongoose");
const Appointment = require("../model/appointment_model");
const Doctor = require("../model/doctor_model");
const DoctorVerification = require("../model/doctor_verification_model");
const { getWeeklyAvailability } = require("../services/availabilityService");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
dayjs.extend(utc);
dayjs.extend(timezone);
const Notification = require("../../notifications/model/notification_model");

/**
 * Resolve the doctor document associated with the authenticated user.
 * Accepts optional doctorId from params/query/body to support explicit selection.
 * Throws an Error with statusCode for consistent error handling.
 */
const resolveDoctorContext = async (req, explicitDoctorId) => {
  const candidateId =
    explicitDoctorId ||
    req.params?.doctorId ||
    req.query?.doctorId ||
    req.body?.doctorId;

  let doctorDoc = null;
  let verificationRecord = null;

  if (candidateId) {
    if (!mongoose.Types.ObjectId.isValid(candidateId)) {
      const error = new Error("Invalid doctorId format");
      error.statusCode = 400;
      throw error;
    }
    doctorDoc = await Doctor.findById(candidateId);
    if (!doctorDoc) {
      const error = new Error("Doctor not found");
      error.statusCode = 404;
      throw error;
    }
  }

  // PRIMARY METHOD: Find doctor by authenticated user ID (most reliable)
  // This works because Doctor model has user: { type: ObjectId, ref: "User" }
  if (!doctorDoc && req.user?._id) {
    doctorDoc = await Doctor.findOne({ user: req.user._id });
  }

  // SECONDARY METHOD: Try to find verification record tied to the authenticated user's email
  if (req.user?.email) {
    const verificationFilter = {
      "personalDetails.email": req.user.email,
    };
    if (doctorDoc) {
      verificationFilter.doctor = doctorDoc._id;
    }
    verificationRecord = await DoctorVerification.findOne(verificationFilter).populate(
      "doctor"
    );
    if (!doctorDoc && verificationRecord?.doctor) {
      doctorDoc = verificationRecord.doctor;
    }
  }

  if (!doctorDoc) {
    const error = new Error(
      "Doctor profile not found for this account. Please complete verification or provide a valid doctorId."
    );
    error.statusCode = 404;
    throw error;
  }

  // Try to find verification record if not already found
  if (!verificationRecord && req.user?.email) {
    verificationRecord = await DoctorVerification.findOne({
      doctor: doctorDoc._id,
      "personalDetails.email": req.user.email,
    });
  }

  // If no verification record found, try to find any verification for this doctor
  if (!verificationRecord) {
    verificationRecord = await DoctorVerification.findOne({
      doctor: doctorDoc._id,
    }).sort({ createdAt: -1 }); // Get the most recent verification
  }

  // For now, allow access even without verification record (for development/testing)
  // In production, you might want to require verification
  // if (!verificationRecord) {
  //   const error = new Error(
  //     "You are not authorized to access this doctor dashboard. Please sign in with the doctor account linked to this profile."
  //   );
  //   error.statusCode = 403;
  //   throw error;
  // }

  // Only check verification status if verification record exists
  if (verificationRecord && verificationRecord.status !== "approved") {
    const error = new Error(
      "Doctor verification is not approved yet. Dashboard APIs are available only after approval."
    );
    error.statusCode = 403;
    throw error;
  }

  return { doctor: doctorDoc, verification: verificationRecord };
};

/**
 * GET /api/appointments/doctors/available
 * Search for available doctors on a specific date
 * Query params: date (YYYY-MM-DD), specialization, city
 */
const searchAvailableDoctors = async (req, res) => {
  try {
    const { date, specialization, city } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date parameter is required (format: YYYY-MM-DD)",
      });
    }

    // Validate date format
    const selectedDate = dayjs(date);
    if (!selectedDate.isValid()) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Use YYYY-MM-DD",
      });
    }

    // Ensure date is in YYYY-MM-DD format for matching
    const dateStr = selectedDate.format("YYYY-MM-DD");
    console.log("Search date (formatted):", dateStr, "Original:", date);

    // Build filter for doctors
    const doctorFilter = { isActive: true };
    if (specialization) doctorFilter.specialization = specialization;
    if (city) doctorFilter.city = city;

    // Get all active doctors matching criteria
    const doctors = await Doctor.find(doctorFilter).populate("user", "userName").lean();

    // Get verified doctors only
    const verifiedDoctorIds = await DoctorVerification.distinct("doctor", {
      status: "approved",
    });

    // Convert to strings for comparison
    const verifiedDoctorIdStrings = verifiedDoctorIds.map((id) => id.toString());

    console.log("Total doctors found:", doctors.length);
    console.log("Verified doctor IDs (strings):", verifiedDoctorIdStrings);
    console.log("All doctor IDs:", doctors.map(d => d._id.toString()));

    // Filter to only verified doctors
    const verifiedDoctors = doctors.filter((doc) =>
      verifiedDoctorIdStrings.includes(doc._id.toString())
    );

    console.log("Verified doctors after filter:", verifiedDoctors.length);
    if (verifiedDoctors.length === 0 && doctors.length > 0) {
      console.log("WARNING: No verified doctors found, but doctors exist. Check verification status.");
    }

    const dayOfWeek = selectedDate.day(); // 0 = Sunday, 6 = Saturday
    const results = [];

    // Check availability for each verified doctor
    for (const doctor of verifiedDoctors) {
      try {
        // Use the date string directly, ensuring it's in YYYY-MM-DD format
        const dateStr = selectedDate.format("YYYY-MM-DD");
        console.log(`Doctor ${doctor._id}: Checking availability for date: ${dateStr}`);

        // Use start of day in doctor's timezone to ensure correct date matching
        const doctorTz = doctor.timeZone || "Asia/Kolkata";
        // Create date in doctor's timezone at midnight, then format with timezone
        const dateInDoctorTz = dayjs.tz(dateStr, doctorTz).startOf("day");
        // Format as ISO string with timezone offset (e.g., "2025-11-24T00:00:00+05:30")
        const isoWithTz = dateInDoctorTz.format();
        console.log(`Doctor ${doctor._id}: Date ${dateStr} in ${doctorTz}:`, dateInDoctorTz.format("YYYY-MM-DD HH:mm:ss Z"));
        console.log(`Doctor ${doctor._id}: ISO with timezone:`, isoWithTz);

        const availability = await getWeeklyAvailability({
          doctorId: doctor._id,
          startISO: isoWithTz,
          days: 1,
          tzOverride: doctorTz,
        });

        console.log(`Doctor ${doctor._id}: Availability response days:`, availability.days.map(d => ({ date: d.date, slotsCount: d.slots?.length || 0 })));

        // Get slots for the selected date - try both formats
        let dayData = availability.days.find((d) => d.date === dateStr);
        if (!dayData) {
          // Try with the original date format
          dayData = availability.days.find((d) => d.date === date);
        }

        console.log(`Doctor ${doctor._id}: dayData found:`, !!dayData, "slots:", dayData?.slots?.length || 0);
        console.log(`Doctor ${doctor._id}: Looking for date: ${dateStr}, available dates:`, availability.days.map(d => d.date));

        if (dayData && dayData.slots) {
          const availableSlots = dayData.slots.filter((slot) => slot.available);
          console.log(`Doctor ${doctor._id}: available slots:`, availableSlots.length);

          if (availableSlots.length > 0) {
            results.push({
              doctor: {
                id: doctor._id,
                name: doctor.user?.userName || "Unknown Doctor",
                specialization: doctor.specialization,
                experienceYears: doctor.experienceYears,
                consultationFee: doctor.consultationFee,
                city: doctor.city,
              },
              date: dateStr,
              availableSlots: availableSlots.length,
              slots: availableSlots.map((slot) => ({
                startTime: slot.startUtc,
                label: slot.label,
                available: true,
              })),
            });
          } else {
            console.log(`Doctor ${doctor._id}: No available slots found (all booked or past)`);
          }
        } else {
          console.log(`Doctor ${doctor._id}: No dayData or slots for date ${dateStr}`);
          console.log(`Doctor ${doctor._id}: Available dates in response:`, availability.days.map(d => d.date));
        }
      } catch (err) {
        console.error(`Error checking availability for doctor ${doctor._id}:`, err);
        // Continue with next doctor
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        date,
        totalDoctors: results.length,
        doctors: results,
      },
    });
  } catch (error) {
    console.error("Search available doctors error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * POST /api/appointments/book
 * Book an appointment with a doctor
 * Requires authentication (patient must be logged in)
 */
const bookAppointment = async (req, res) => {
  try {
    const { doctorId, startTime, reason, mode } = req.body;
    const patientId = req.userId; // From auth middleware

    // Validate required fields
    const v = new Validator(
      {
        doctorId: doctorId || "",
        startTime: startTime || "",
        mode: mode || "online",
      },
      {
        doctorId: "required",
        startTime: "required",
        mode: "in:online,offline",
      }
    );

    const matched = await v.validate();
    if (!matched) {
      return res.status(422).json({
        success: false,
        message: "Validation error",
        errors: v.errors,
      });
    }

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid doctorId format",
      });
    }

    // Check if doctor exists and is verified
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    const verification = await DoctorVerification.findOne({
      doctor: doctorId,
      status: "approved",
    });

    if (!verification) {
      return res.status(403).json({
        success: false,
        message: "Cannot book appointment with unverified doctor",
      });
    }

    // Parse and validate start time
    const appointmentStart = dayjs(startTime);
    if (!appointmentStart.isValid()) {
      return res.status(400).json({
        success: false,
        message: "Invalid startTime format. Use ISO 8601 format.",
      });
    }

    // Check if appointment is in the past
    const now = dayjs();
    if (appointmentStart.isBefore(now)) {
      return res.status(400).json({
        success: false,
        message: `Cannot book appointment in the past. The requested time ${appointmentStart.format("YYYY-MM-DD HH:mm:ss")} is before the current time ${now.format("YYYY-MM-DD HH:mm:ss")}. Please use a startTime from the available slots.`,
      });
    }

    // Check if slot is available
    const availability = await getWeeklyAvailability({
      doctorId,
      startISO: appointmentStart.toISOString(),
      days: 1,
    });

    const dateStr = appointmentStart.format("YYYY-MM-DD");
    const dayData = availability.days.find((d) => d.date === dateStr);

    if (!dayData) {
      return res.status(400).json({
        success: false,
        message: "Doctor is not available on this date",
      });
    }

    // Find the exact slot
    const slot = dayData.slots.find(
      (s) => s.startUtc === appointmentStart.toISOString()
    );

    if (!slot) {
      return res.status(400).json({
        success: false,
        message: "Invalid time slot",
      });
    }

    if (!slot.available) {
      return res.status(409).json({
        success: false,
        message: "This time slot is no longer available",
      });
    }

    const slotDuration = slot.durationMinutes || 15;
    const appointmentEnd = appointmentStart.add(slotDuration, "minute");

    // Check for existing appointment at this time
    const existingAppointment = await Appointment.findOne({
      doctor: doctorId,
      startTime: appointmentStart.toDate(),
      status: { $in: ["pending", "confirmed"] },
    });

    if (existingAppointment) {
      return res.status(409).json({
        success: false,
        message: "This time slot is already booked",
      });
    }

    // Create appointment
    const appointment = await Appointment.create({
      patient: patientId,
      doctor: doctorId,
      startTime: appointmentStart.toDate(),
      endTime: appointmentEnd.toDate(),
      reason: reason || "",
      mode: mode || "online",
      status: "confirmed",
    });

    // Fire notification for the patient (best effort)
    try {
      await Notification.create({
        user: patientId,
        title: "Appointment confirmed",
        body: `Your appointment is scheduled on ${appointmentStart.format(
          "MMM D, YYYY [at] hh:mm A"
        )}.`,
        type: "appointment",
        data: {
          appointmentId: appointment._id,
          doctorId,
          startTime: appointment.startTime,
          endTime: appointment.endTime,
          mode: appointment.mode,
        },
      });
    } catch (notifyErr) {
      console.error("Failed to create notification for appointment:", notifyErr);
    }

    return res.status(201).json({
      success: true,
      message: "Appointment booked successfully",
      data: {
        appointmentId: appointment._id,
        doctorId: doctor._id,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        status: appointment.status,
      },
    });
  } catch (error) {
    console.error("Book appointment error:", error);

    // Handle duplicate appointment error
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This time slot is already booked",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/appointments/my-appointments
 * Get user's appointments (requires authentication)
 */
const getMyAppointments = async (req, res) => {
  try {
    const patientId = req.userId; // From auth middleware
    const { status, page = 1, limit = 10 } = req.query;

    const filter = { patient: patientId };
    if (status) {
      filter.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [appointments, total] = await Promise.all([
      Appointment.find(filter)
        .populate("doctor", "specialization city consultationFee")
        .sort({ startTime: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Appointment.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: appointments,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Get my appointments error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * PUT /api/appointments/:appointmentId/cancel
 * Cancel an appointment (requires authentication)
 */
const cancelAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const patientId = req.userId; // From auth middleware

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointmentId format",
      });
    }

    const appointment = await Appointment.findOne({
      _id: appointmentId,
      patient: patientId,
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    if (appointment.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Appointment is already cancelled",
      });
    }

    if (appointment.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel completed appointment",
      });
    }

    appointment.status = "cancelled";
    await appointment.save();

    return res.status(200).json({
      success: true,
      message: "Appointment cancelled successfully",
      data: {
        appointmentId: appointment._id,
        status: appointment.status,
      },
    });
  } catch (error) {
    console.error("Cancel appointment error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/doctors/dashboard/overview
 * Provides quick stats and upcoming appointment data for doctors
 */
const getDoctorDashboardOverview = async (req, res) => {
  try {
    const { doctor, verification } = await resolveDoctorContext(req);
    const now = dayjs();
    const startOfDay = now.startOf("day");
    const endOfDay = now.endOf("day");
    const startOfWeek = now.startOf("week");
    const startOfMonth = now.startOf("month");

    const [
      totalUpcoming,
      todayAppointmentsCount,
      completedThisWeek,
      cancelledThisMonth,
      patientIds,
      upcomingAppointments,
      recentAppointments,
    ] = await Promise.all([
      Appointment.countDocuments({
        doctor: doctor._id,
        startTime: { $gte: now.toDate() },
        status: { $in: ["pending", "confirmed"] },
      }),
      Appointment.countDocuments({
        doctor: doctor._id,
        startTime: {
          $gte: startOfDay.toDate(),
          $lte: endOfDay.toDate(),
        },
        status: { $in: ["pending", "confirmed"] },
      }),
      Appointment.countDocuments({
        doctor: doctor._id,
        startTime: {
          $gte: startOfWeek.toDate(),
          $lte: now.toDate(),
        },
        status: "completed",
      }),
      Appointment.countDocuments({
        doctor: doctor._id,
        startTime: {
          $gte: startOfMonth.toDate(),
          $lte: now.toDate(),
        },
        status: "cancelled",
      }),
      Appointment.distinct("patient", { doctor: doctor._id }),
      Appointment.find({
        doctor: doctor._id,
        startTime: { $gte: now.toDate() },
        status: { $in: ["pending", "confirmed"] },
      })
        .populate("patient", "userName email")
        .sort({ startTime: 1 })
        .limit(5)
        .lean(),
      Appointment.find({
        doctor: doctor._id,
      })
        .populate("patient", "userName email")
        .sort({ updatedAt: -1 })
        .limit(5)
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        doctor: {
          id: doctor._id,
          specialization: doctor.specialization,
          city: doctor.city,
          timeZone: doctor.timeZone,
          verificationStatus: verification?.status || "pending",
        },
        stats: {
          totalUpcoming,
          todayAppointments: todayAppointmentsCount,
          completedThisWeek,
          cancelledThisMonth,
          totalPatients: patientIds.length,
          nextAppointmentAt: upcomingAppointments[0]?.startTime || null,
        },
        upcomingAppointments: upcomingAppointments.map((appt) => ({
          appointmentId: appt._id,
          startTime: appt.startTime,
          endTime: appt.endTime,
          status: appt.status,
          mode: appt.mode,
          patient: {
            id: appt.patient?._id,
            name: appt.patient?.userName,
            email: appt.patient?.email,
          },
        })),
        recentActivity: recentAppointments.map((appt) => ({
          appointmentId: appt._id,
          status: appt.status,
          startTime: appt.startTime,
          updatedAt: appt.updatedAt,
          patient: {
            id: appt.patient?._id,
            name: appt.patient?.userName,
            email: appt.patient?.email,
          },
        })),
      },
    });
  } catch (error) {
    console.error("Doctor dashboard overview error:", error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/doctors/dashboard/appointments
 * List appointments for the authenticated doctor with filtering
 */
const getDoctorAppointments = async (req, res) => {
  try {
    const { doctor } = await resolveDoctorContext(req);
    console.log('🔍 Doctor found:', doctor._id, 'for user:', req.user?._id);

    const { status, range, date, page = 1, limit = 10 } = req.query;
    const filter = { doctor: doctor._id };
    const validStatuses = ["pending", "confirmed", "cancelled", "completed"];

    if (status) {
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Use one of: ${validStatuses.join(", ")}`,
        });
      }
      filter.status = status;
    }

    const now = dayjs();
    if (date) {
      const parsedDate = dayjs(date);
      if (!parsedDate.isValid()) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format. Use YYYY-MM-DD",
        });
      }
      filter.startTime = {
        $gte: parsedDate.startOf("day").toDate(),
        $lte: parsedDate.endOf("day").toDate(),
      };
    } else if (range === "today") {
      filter.startTime = {
        $gte: now.startOf("day").toDate(),
        $lte: now.endOf("day").toDate(),
      };
    } else if (range === "past") {
      filter.startTime = {
        $lt: now.toDate(),
      };
    } else if (range === "week") {
      filter.startTime = {
        $gte: now.startOf("week").toDate(),
        $lte: now.endOf("week").toDate(),
      };
    } else if (range === "month") {
      filter.startTime = {
        $gte: now.startOf("month").toDate(),
        $lte: now.endOf("month").toDate(),
      };
    } else if (range === "upcoming") {
      filter.startTime = {
        $gte: now.toDate(),
      };
    }
    // If no range is specified, don't filter by time - show all appointments

    const sortDirection =
      range === "past" ? -1 : range === "today" ? 1 : range === "upcoming" ? 1 : 1;

    const skip = (Number(page) - 1) * Number(limit);

    console.log('📋 Filter for appointments:', JSON.stringify(filter, null, 2));

    const [appointments, total] = await Promise.all([
      Appointment.find(filter)
        .populate("patient", "userName email")
        .sort({ startTime: sortDirection })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Appointment.countDocuments(filter),
    ]);

    console.log(`✅ Found ${appointments.length} appointments (total: ${total}) for doctor ${doctor._id}`);

    return res.status(200).json({
      success: true,
      data: appointments.map((appt) => ({
        appointmentId: appt._id,
        status: appt.status,
        mode: appt.mode,
        startTime: appt.startTime,
        endTime: appt.endTime,
        reason: appt.reason,
        patient: {
          id: appt.patient?._id,
          name: appt.patient?.userName,
          email: appt.patient?.email,
        },
      })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("❌ Get doctor appointments error:", error);
    console.error("Error details:", {
      message: error.message,
      statusCode: error.statusCode,
      stack: error.stack,
      user: req.user?._id,
      userEmail: req.user?.email,
    });

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

/**
 * GET /api/doctors/dashboard/patients
 * Returns unique patient list with stats for a doctor
 */
const getDoctorPatients = async (req, res) => {
  try {
    const { doctor } = await resolveDoctorContext(req);
    const { page = 1, limit = 10, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const regexFilters = [];

    if (search) {
      const regex = new RegExp(search, "i");
      regexFilters.push({ patientName: regex });
      regexFilters.push({ patientEmail: regex });
    }

    const basePipeline = [
      { $match: { doctor: doctor._id } },
      {
        $group: {
          _id: "$patient",
          totalAppointments: { $sum: 1 },
          lastAppointment: { $max: "$startTime" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "patient",
        },
      },
      {
        $unwind: {
          path: "$patient",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          patientName: "$patient.userName",
          patientEmail: "$patient.email",
        },
      },
    ];

    if (regexFilters.length > 0) {
      basePipeline.push({
        $match: {
          $or: regexFilters,
        },
      });
    }

    const dataPipeline = [
      ...basePipeline,
      { $sort: { lastAppointment: -1 } },
      { $skip: skip },
      { $limit: Number(limit) },
    ];

    const countPipeline = [
      ...basePipeline,
      { $count: "count" },
    ];

    const [patientsData, totalCountAgg] = await Promise.all([
      Appointment.aggregate(dataPipeline),
      Appointment.aggregate(countPipeline),
    ]);

    const total = totalCountAgg[0]?.count || 0;

    return res.status(200).json({
      success: true,
      data: patientsData.map((row) => ({
        patientId: row._id,
        name: row.patientName || "Unknown",
        email: row.patientEmail || "",
        totalAppointments: row.totalAppointments,
        lastAppointment: row.lastAppointment,
      })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Doctor patients list error:", error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * PUT /api/doctors/appointments/:appointmentId/status
 * Allows a doctor to update appointment status (completed / cancelled)
 */
const updateAppointmentStatusByDoctor = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { status } = req.body;
    const allowedStatuses = ["completed", "cancelled"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed values: ${allowedStatuses.join(", ")}`,
      });
    }

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointmentId format",
      });
    }

    const { doctor } = await resolveDoctorContext(req);

    const appointment = await Appointment.findOne({
      _id: appointmentId,
      doctor: doctor._id,
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    if (status === "completed" && dayjs(appointment.startTime).isAfter(dayjs())) {
      return res.status(400).json({
        success: false,
        message: "Cannot mark a future appointment as completed",
      });
    }

    if (appointment.status === status) {
      return res.status(200).json({
        success: true,
        message: `Appointment already marked as ${status}`,
        data: {
          appointmentId: appointment._id,
          status: appointment.status,
        },
      });
    }

    appointment.status = status;
    await appointment.save();

    return res.status(200).json({
      success: true,
      message: `Appointment marked as ${status}`,
      data: {
        appointmentId: appointment._id,
        status: appointment.status,
        updatedAt: appointment.updatedAt,
      },
    });
  } catch (error) {
    console.error("Doctor update appointment status error:", error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  searchAvailableDoctors,
  bookAppointment,
  getMyAppointments,
  cancelAppointment,
  getDoctorDashboardOverview,
  getDoctorAppointments,
  getDoctorPatients,
  updateAppointmentStatusByDoctor,
};

