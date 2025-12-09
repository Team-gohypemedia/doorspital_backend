const { Validator } = require("node-input-validator");
const mongoose = require("mongoose");
const DoctorVerification = require("../model/doctor_verification_model");
const Doctor = require("../model/doctor_model");

/**
 * POST /api/doctors/verification/submit
 * Submit doctor verification documents and information
 */
const submitVerification = async (req, res) => {
  try {
    // Check if files were uploaded
    if (!req.files) {
      return res.status(400).json({
        success: false,
        message: "Files are required",
      });
    }

    const {
      // Personal Details
      fullName,
      email,
      phoneNumber,
      medicalSpecialization,
      yearsOfExperience,
      clinicHospitalName,
      clinicAddress,
      state,
      city,
      // Registration Details
      registrationNumber,
      councilName,
      issueDate,
      // Identity
      documentType,
      // Doctor ID
      doctorId,
    } = req.body;

    // Validate required fields
    const v = new Validator(
      {
        doctorId: doctorId || "",
        fullName: fullName || "",
        email: email || "",
        phoneNumber: phoneNumber || "",
        medicalSpecialization: medicalSpecialization || "",
        yearsOfExperience: yearsOfExperience || "",
        clinicHospitalName: clinicHospitalName || "",
        clinicAddress: clinicAddress || "",
        state: state || "",
        city: city || "",
        registrationNumber: registrationNumber || "",
        councilName: councilName || "",
        issueDate: issueDate || "",
        documentType: documentType || "",
      },
      {
        doctorId: "required",
        fullName: "required",
        email: "required|email",
        phoneNumber: "required",
        medicalSpecialization: "required",
        yearsOfExperience: "required|integer",
        clinicHospitalName: "required",
        clinicAddress: "required",
        state: "required",
        city: "required",
        registrationNumber: "required",
        councilName: "required|in:MCI,State Council",
        issueDate: "required",
        documentType:
          "required|in:Aadhaar Card,PAN Card,Passport,Driving License",
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

    // Validate required files
    if (!req.files.mbbsCertificate || req.files.mbbsCertificate.length === 0) {
      return res.status(400).json({
        success: false,
        message: "MBBS Certificate is required",
      });
    }

    if (
      !req.files.registrationCertificate ||
      req.files.registrationCertificate.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Registration Certificate is required",
      });
    }

    if (!req.files.governmentId || req.files.governmentId.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Government ID is required",
      });
    }

    if (!req.files.selfie || req.files.selfie.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Selfie verification is required",
      });
    }

    // Validate doctorId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid doctorId format. Please provide a valid doctor ID.",
      });
    }

    // Check if doctor exists
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    // Check if verification already exists
    const existingVerification = await DoctorVerification.findOne({
      doctor: doctorId,
      status: { $in: ["pending", "under_review"] },
    });

    if (existingVerification) {
      return res.status(400).json({
        success: false,
        message: "Verification request already exists and is pending review",
      });
    }

    // Prepare file data
    const mbbsFile = req.files.mbbsCertificate[0];
    const mdMsBdsFile = req.files.mdMsBdsCertificate
      ? req.files.mdMsBdsCertificate[0]
      : null;
    const registrationFile = req.files.registrationCertificate[0];
    const governmentIdFile = req.files.governmentId[0];
    const selfieFile = req.files.selfie[0];

    // Create verification record
    const verificationData = {
      doctor: doctorId,
      personalDetails: {
        fullName,
        email,
        phoneNumber,
        medicalSpecialization,
        yearsOfExperience: parseInt(yearsOfExperience),
        clinicHospitalName,
        clinicAddress,
        state,
        city,
      },
      qualifications: {
        mbbsCertificate: {
          filename: mbbsFile.filename,
          path: mbbsFile.path,
          mimetype: mbbsFile.mimetype,
          size: mbbsFile.size,
        },
        ...(mdMsBdsFile && {
          mdMsBdsCertificate: {
            filename: mdMsBdsFile.filename,
            path: mdMsBdsFile.path,
            mimetype: mdMsBdsFile.mimetype,
            size: mdMsBdsFile.size,
          },
        }),
      },
      registration: {
        registrationNumber,
        councilName,
        issueDate: new Date(issueDate),
        registrationCertificate: {
          filename: registrationFile.filename,
          path: registrationFile.path,
          mimetype: registrationFile.mimetype,
          size: registrationFile.size,
        },
      },
      identity: {
        documentType,
        governmentId: {
          filename: governmentIdFile.filename,
          path: governmentIdFile.path,
          mimetype: governmentIdFile.mimetype,
          size: governmentIdFile.size,
        },
      },
      selfieVerification: {
        selfie: {
          filename: selfieFile.filename,
          path: selfieFile.path,
          mimetype: selfieFile.mimetype,
          size: selfieFile.size,
        },
      },
      status: "pending",
    };

    const verification = await DoctorVerification.create(verificationData);

    return res.status(201).json({
      success: true,
      message: "Verification submitted successfully",
      data: {
        verificationId: verification._id,
        status: verification.status,
      },
    });
  } catch (error) {
    console.error("Doctor verification submission error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * GET /api/doctors/verification/:doctorId
 * Get verification status for a doctor
 */
const getVerificationStatus = async (req, res) => {
  try {
    const { doctorId } = req.params;

    // Validate doctorId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid doctorId format. Please provide a valid doctor ID.",
      });
    }

    const verification = await DoctorVerification.findOne({
      doctor: doctorId,
    })
      .populate("doctor", "specialization city")
      .populate("reviewedBy", "userName email")
      .select("-__v")
      .lean();

    if (!verification) {
      return res.status(200).json({
        success: true, // It's a successful lookup, just no data found
        data: null,
        message: "Verification not found",
      });
    }

    // Remove file paths from response for security
    const sanitizedVerification = {
      ...verification,
      qualifications: {
        ...verification.qualifications,
        mbbsCertificate: {
          filename: verification.qualifications.mbbsCertificate.filename,
          mimetype: verification.qualifications.mbbsCertificate.mimetype,
        },
        ...(verification.qualifications.mdMsBdsCertificate && {
          mdMsBdsCertificate: {
            filename:
              verification.qualifications.mdMsBdsCertificate.filename,
            mimetype:
              verification.qualifications.mdMsBdsCertificate.mimetype,
          },
        }),
      },
      registration: {
        ...verification.registration,
        registrationCertificate: {
          filename: verification.registration.registrationCertificate.filename,
          mimetype: verification.registration.registrationCertificate.mimetype,
        },
      },
      identity: {
        ...verification.identity,
        governmentId: {
          filename: verification.identity.governmentId.filename,
          mimetype: verification.identity.governmentId.mimetype,
        },
      },
      selfieVerification: {
        selfie: {
          filename: verification.selfieVerification.selfie.filename,
          mimetype: verification.selfieVerification.selfie.mimetype,
        },
      },
    };

    return res.status(200).json({
      success: true,
      data: sanitizedVerification,
    });
  } catch (error) {
    console.error("Get verification status error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/doctors/verification
 * Get all verification requests (for admin)
 * Query params: status, page, limit
 */
const getAllVerifications = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const filter = {};
    if (status) {
      filter.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [verifications, total] = await Promise.all([
      DoctorVerification.find(filter)
        .populate("doctor", "specialization city")
        .populate("reviewedBy", "userName email")
        .select("-__v")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      DoctorVerification.countDocuments(filter),
    ]);

    // Sanitize file paths
    const sanitizedVerifications = verifications.map((v) => ({
      ...v,
      qualifications: {
        mbbsCertificate: {
          filename: v.qualifications.mbbsCertificate.filename,
        },
      },
      registration: {
        registrationNumber: v.registration.registrationNumber,
        councilName: v.registration.councilName,
        issueDate: v.registration.issueDate,
      },
      identity: {
        documentType: v.identity.documentType,
      },
      status: v.status,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    }));

    return res.status(200).json({
      success: true,
      data: sanitizedVerifications,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Get all verifications error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  submitVerification,
  getVerificationStatus,
  getAllVerifications,
};

