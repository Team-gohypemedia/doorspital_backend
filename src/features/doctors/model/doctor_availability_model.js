const mongoose = require("mongoose");

const doctorAvailabilitySchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
      index: true,
    },
    dayOfWeek: {
      type: Number,
      required: true,
      min: 0, // Sunday
      max: 6, // Saturday
    },
    startTime: {
      type: String,
      required: true,
      match: /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, // HH:MM format
    },
    endTime: {
      type: String,
      required: true,
      match: /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, // HH:MM format
    },
    slotDurationMinutes: {
      type: Number,
      default: 15,
      min: 5,
      max: 60,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Ensure one availability rule per day per doctor
doctorAvailabilitySchema.index({ doctor: 1, dayOfWeek: 1 }, { unique: true });

module.exports = mongoose.model("DoctorAvailability", doctorAvailabilitySchema);



