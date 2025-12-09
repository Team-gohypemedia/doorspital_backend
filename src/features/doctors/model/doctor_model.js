const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    specialization: { type: String, required: true },
    experienceYears: Number,
    consultationFee: Number,
    city: { type: String },
    timeZone: { type: String, default: "Asia/Kolkata" },
    isActive: { type: Boolean, default: true },
    services: [{ type: String }],
  },
  { timestamps: true }
);

doctorSchema.index({ specialization: 1 });
doctorSchema.index({ city: 1 });

module.exports = mongoose.model("Doctor", doctorSchema);
