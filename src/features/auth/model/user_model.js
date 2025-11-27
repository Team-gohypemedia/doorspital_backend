const mongoose = require("mongoose");
const { email, required } = require("node-input-validator/cjs/rules");

const userSchema = new mongoose.Schema(
  {
    userName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["user", "doctor", "admin"],
      default: "user",
      index: true,
    },
    phoneNumber: {
      type: String,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other", "prefer_not_to_say"],
      default: "prefer_not_to_say",
    },
    dateOfBirth: {
      type: Date,
    },
    heightCm: {
      type: Number,
      min: 0,
    },
    weightKg: {
      type: Number,
      min: 0,
    },
    bloodType: {
      type: String,
    },
    preferredLanguage: {
      type: String,
    },
    location: {
      type: String,
    },
    allergies: {
      type: [String],
      default: [],
    },
    emergencyContact: {
      name: String,
      phone: String,
      relation: String,
    },
    bio: {
      type: String,
      maxlength: 500,
    },
    avatarUrl: {
      type: String,
    },
    documents: [
      {
        _id: false,
        documentId: {
          type: mongoose.Schema.Types.ObjectId,
          default: () => new mongoose.Types.ObjectId(),
        },
        type: { type: String },
        filename: { type: String, required: true },
        path: { type: String, required: true },
        mimetype: String,
        size: Number,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    reset_otp: {
      type: String,
    },
    reset_otp_expires: {
      type: String,
    },
    profileUpdatedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
