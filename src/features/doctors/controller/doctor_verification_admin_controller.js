const { Validator } = require("node-input-validator");
const mongoose = require("mongoose");
const DoctorVerification = require("../model/doctor_verification_model");
const Doctor = require("../model/doctor_model");

/**
 * PUT /api/admin/doctors/verification/:verificationId/approve
 * Approve a doctor verification request
 */
const approveVerification = async (req, res) => {
  try {
    const { verificationId } = req.params;
    const adminId = req.userId; // Admin user ID from auth middleware

    // Validate verificationId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(verificationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid verificationId format. Please provide a valid verification ID.",
      });
    }

    const verification = await DoctorVerification.findById(verificationId);

    if (!verification) {
      return res.status(404).json({
        success: false,
        message: "Verification not found",
      });
    }

    if (verification.status === "approved") {
      return res.status(400).json({
        success: false,
        message: "Verification is already approved",
      });
    }

    // Update verification status
    verification.status = "approved";
    verification.reviewedBy = adminId;
    verification.reviewedAt = new Date();
    await verification.save();

    // Optionally update doctor profile with verified information
    await Doctor.findByIdAndUpdate(verification.doctor, {
      isActive: true,
      // You can add more fields from verification to doctor profile
    });

    return res.status(200).json({
      success: true,
      message: "Verification approved successfully",
      data: {
        verificationId: verification._id,
        status: verification.status,
      },
    });
  } catch (error) {
    console.error("Approve verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * PUT /api/admin/doctors/verification/:verificationId/reject
 * Reject a doctor verification request
 */
const rejectVerification = async (req, res) => {
  try {
    const { verificationId } = req.params;
    const { rejectionReason, adminNotes } = req.body;
    const adminId = req.userId; // Admin user ID from auth middleware

    // Validate verificationId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(verificationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid verificationId format. Please provide a valid verification ID.",
      });
    }

    const v = new Validator(
      {
        rejectionReason: rejectionReason || "",
      },
      {
        rejectionReason: "required",
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

    const verification = await DoctorVerification.findById(verificationId);

    if (!verification) {
      return res.status(404).json({
        success: false,
        message: "Verification not found",
      });
    }

    if (verification.status === "rejected") {
      return res.status(400).json({
        success: false,
        message: "Verification is already rejected",
      });
    }

    // Update verification status
    verification.status = "rejected";
    verification.reviewedBy = adminId;
    verification.reviewedAt = new Date();
    verification.rejectionReason = rejectionReason;
    if (adminNotes) {
      verification.adminNotes = adminNotes;
    }
    await verification.save();

    return res.status(200).json({
      success: true,
      message: "Verification rejected",
      data: {
        verificationId: verification._id,
        status: verification.status,
        rejectionReason: verification.rejectionReason,
      },
    });
  } catch (error) {
    console.error("Reject verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * PUT /api/admin/doctors/verification/:verificationId/status
 * Update verification status (under_review, approved, rejected)
 */
const updateVerificationStatus = async (req, res) => {
  try {
    const { verificationId } = req.params;
    const { status, rejectionReason, adminNotes } = req.body;
    const adminId = req.userId; // Admin user ID from auth middleware

    // Validate verificationId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(verificationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid verificationId format. Please provide a valid verification ID.",
      });
    }

    const v = new Validator(
      {
        status: status || "",
      },
      {
        status: "required|in:pending,under_review,approved,rejected",
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

    const verification = await DoctorVerification.findById(verificationId);

    if (!verification) {
      return res.status(404).json({
        success: false,
        message: "Verification not found",
      });
    }

    verification.status = status;
    verification.reviewedBy = adminId;
    verification.reviewedAt = new Date();

    if (status === "rejected" && rejectionReason) {
      verification.rejectionReason = rejectionReason;
    }

    if (adminNotes) {
      verification.adminNotes = adminNotes;
    }

    await verification.save();

    // If approved, activate the doctor
    if (status === "approved") {
      await Doctor.findByIdAndUpdate(verification.doctor, {
        isActive: true,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Verification status updated successfully",
      data: {
        verificationId: verification._id,
        status: verification.status,
      },
    });
  } catch (error) {
    console.error("Update verification status error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/admin/doctors/verification/:verificationId
 * Get full verification details (for admin review)
 */
const getVerificationDetails = async (req, res) => {
  try {
    const { verificationId } = req.params;

    // Validate verificationId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(verificationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid verificationId format. Please provide a valid verification ID.",
      });
    }

    const verification = await DoctorVerification.findById(verificationId)
      .populate("doctor", "specialization city timeZone")
      .populate("reviewedBy", "userName email")
      .lean();

    if (!verification) {
      return res.status(404).json({
        success: false,
        message: "Verification not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: verification,
    });
  } catch (error) {
    console.error("Get verification details error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  approveVerification,
  rejectVerification,
  updateVerificationStatus,
  getVerificationDetails,
};

