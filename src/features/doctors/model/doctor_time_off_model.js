const mongoose = require("mongoose");

const doctorTimeOffSchema = new mongoose.Schema(
  {
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true, index: true },
    start:  { type: Date, required: true },  // UTC
    end:    { type: Date, required: true },  // UTC
    reason: String
  },
  { timestamps: true }
);

doctorTimeOffSchema.index({ doctor: 1, start: 1, end: 1 });
module.exports = mongoose.model("DoctorTimeOff", doctorTimeOffSchema);
