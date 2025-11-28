const mongoose = require("mongoose");

const chatRoomSchema = new mongoose.Schema(
  {
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
      unique: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
      index: true,
    },
    doctorUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    lastMessage: {
      text: { type: String },
      sentBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      sentAt: { type: Date },
    },
    patientUnreadCount: { type: Number, default: 0 },
    doctorUnreadCount: { type: Number, default: 0 },
    patientLastSeenAt: { type: Date },
    doctorLastSeenAt: { type: Date },
  },
  { timestamps: true }
);

chatRoomSchema.index({ patient: 1, doctor: 1 });

module.exports = mongoose.model("ChatRoom", chatRoomSchema);




