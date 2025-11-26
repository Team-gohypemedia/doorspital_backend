const mongoose = require("mongoose");

const doctorVerificationSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
      index: true,
    },
    
    // 1️⃣ Personal Details
    personalDetails: {
      fullName: { type: String, required: true },
      email: { type: String, required: true },
      phoneNumber: { type: String, required: true },
      medicalSpecialization: { type: String, required: true },
      yearsOfExperience: { type: Number, required: true },
      clinicHospitalName: { type: String, required: true },
      clinicAddress: { type: String, required: true },
      state: { type: String, required: true },
      city: { type: String, required: true },
    },

    // 2️⃣ Qualifications
    qualifications: {
      mbbsCertificate: {
        filename: { type: String, required: true },
        path: { type: String, required: true },
        mimetype: { type: String },
        size: { type: Number },
      },
      mdMsBdsCertificate: {
        filename: { type: String },
        path: { type: String },
        mimetype: { type: String },
        size: { type: Number },
      },
    },

    // 3️⃣ Registration Details
    registration: {
      registrationNumber: { type: String, required: true },
      councilName: {
        type: String,
        required: true,
        enum: ["MCI", "State Council"],
      },
      issueDate: { type: Date, required: true },
      registrationCertificate: {
        filename: { type: String, required: true },
        path: { type: String, required: true },
        mimetype: { type: String },
        size: { type: Number },
      },
    },

    // 4️⃣ Identity Verification
    identity: {
      documentType: {
        type: String,
        required: true,
        enum: ["Aadhaar Card", "PAN Card", "Passport", "Driving License"],
      },
      governmentId: {
        filename: { type: String, required: true },
        path: { type: String, required: true },
        mimetype: { type: String },
        size: { type: Number },
      },
    },

    // 5️⃣ Selfie Verification
    selfieVerification: {
      selfie: {
        filename: { type: String, required: true },
        path: { type: String, required: true },
        mimetype: { type: String },
        size: { type: Number },
      },
    },

    // Verification Status
    status: {
      type: String,
      enum: ["pending", "under_review", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    
    // Admin review fields
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: { type: Date },
    rejectionReason: { type: String },
    adminNotes: { type: String },
  },
  { timestamps: true }
);

// Indexes for efficient queries
doctorVerificationSchema.index({ doctor: 1, status: 1 });
doctorVerificationSchema.index({ "personalDetails.email": 1 });
doctorVerificationSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("DoctorVerification", doctorVerificationSchema);




