const { Validator } = require("node-input-validator");
const ChatRoom = require("../model/chat_room_model");
const ChatMessage = require("../model/chat_message_model");
const Appointment = require("../../doctors/model/appointment_model");
const Doctor = require("../../doctors/model/doctor_model");
const Notification = require("../../notifications/model/notification_model");

const ROOM_STATUSES_ALLOWED = ["confirmed", "completed"];

const getDoctorProfileForUser = async (userId) => {
  return Doctor.findOne({ user: userId });
};

const ensureMembership = (room, userId) => {
  const isPatient = room.patient.toString() === userId.toString();
  const isDoctor = room.doctorUser.toString() === userId.toString();

  if (!isPatient && !isDoctor) {
    const err = new Error("You are not allowed to access this chat");
    err.statusCode = 403;
    throw err;
  }

  return { isPatient, isDoctor };
};

const createOrGetRoom = async (req, res) => {
  try {
    const validator = new Validator(req.body || {}, {
      appointmentId: "required",
    });

    const matched = await validator.validate();
    if (!matched) {
      return res.status(422).json({
        success: false,
        message: "Validation error",
        errors: validator.errors,
      });
    }

    const { appointmentId } = req.body;

    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res
        .status(404)
        .json({ success: false, message: "Appointment not found" });
    }

    if (!ROOM_STATUSES_ALLOWED.includes(appointment.status)) {
      return res.status(400).json({
        success: false,
        message: "Chat is available only for confirmed/completed appointments",
      });
    }

    const doctorProfile = await Doctor.findById(appointment.doctor);

    if (!doctorProfile || !doctorProfile.user) {
      return res.status(400).json({
        success: false,
        message: "Doctor account is not linked properly",
      });
    }

    const requestingUserId = req.user._id.toString();
    const isPatient = appointment.patient.toString() === requestingUserId;
    const isDoctor = doctorProfile.user.toString() === requestingUserId;

    if (!isPatient && !isDoctor) {
      return res.status(403).json({
        success: false,
        message: "You are not part of this appointment",
      });
    }

    let room = await ChatRoom.findOne({ appointment: appointment._id })
      .populate("appointment")
      .populate("patient", "userName email avatarUrl")
      .populate("doctorUser", "userName email avatarUrl role")
      .populate({
        path: "doctor",
        select: "specialization city",
      });

    if (!room) {
      room = await ChatRoom.create({
        appointment: appointment._id,
        patient: appointment.patient,
        doctor: appointment.doctor,
        doctorUser: doctorProfile.user,
        patientLastSeenAt: new Date(),
        doctorLastSeenAt: new Date(),
      });

      await room.populate([
        { path: "appointment" },
        { path: "patient", select: "userName email avatarUrl" },
        { path: "doctorUser", select: "userName email avatarUrl role" },
        { path: "doctor", select: "specialization city" },
      ]);
    }

    return res.json({
      success: true,
      data: room,
    });
  } catch (error) {
    console.error("Create room error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to create chat room",
    });
  }
};

const listRooms = async (req, res) => {
  try {
    const userId = req.user._id;
    const doctorProfile = await getDoctorProfileForUser(userId);

    const filter = doctorProfile
      ? { doctorUser: userId }
      : { patient: userId };

    const rooms = await ChatRoom.find(filter)
      .sort({ updatedAt: -1 })
      .populate("appointment")
      .populate("patient", "userName email avatarUrl")
      .populate("doctorUser", "userName email avatarUrl role")
      .populate({
        path: "doctor",
        select: "specialization city experienceYears",
      });

    res.json({ success: true, data: rooms });
  } catch (error) {
    console.error("List rooms error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to load conversations",
    });
  }
};

const getMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { cursor, limit = 30 } = req.query;

    const room = await ChatRoom.findById(roomId);
    if (!room) {
      return res
        .status(404)
        .json({ success: false, message: "Chat room not found" });
    }

    ensureMembership(room, req.user._id);

    const query = { room: roomId };
    if (cursor) {
      query._id = { $lt: cursor };
    }

    const messages = await ChatMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .populate("sender", "userName email avatarUrl");

    res.json({
      success: true,
      data: messages,
      nextCursor: messages.length ? messages[messages.length - 1]._id : null,
    });
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to load messages",
    });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { roomId } = req.params;
    const validator = new Validator(req.body || {}, {
      body: "required",
    });
    const matched = await validator.validate();
    if (!matched) {
      return res.status(422).json({
        success: false,
        message: "Validation error",
        errors: validator.errors,
      });
    }

    const room = await ChatRoom.findById(roomId);
    if (!room) {
      return res
        .status(404)
        .json({ success: false, message: "Chat room not found" });
    }

    const membership = ensureMembership(room, req.user._id);

    const message = await ChatMessage.create({
      room: room._id,
      sender: req.user._id,
      body: req.body.body,
    });

    const now = new Date();
    room.lastMessage = {
      text: req.body.body,
      sentBy: req.user._id,
      sentAt: now,
    };

    if (membership.isPatient) {
      room.doctorUnreadCount += 1;
    } else if (membership.isDoctor) {
      room.patientUnreadCount += 1;
    }

    room.updatedAt = now;
    await room.save();

    // Notify recipient (best effort)
    try {
      const recipientId = membership.isPatient ? room.doctorUser : room.patient;
      await Notification.create({
        user: recipientId,
        title: "New chat message",
        body: req.body.body.slice(0, 120),
        type: "chat",
        data: {
          roomId: room._id,
          appointmentId: room.appointment,
          sender: req.user._id,
        },
      });
    } catch (notifyErr) {
      console.error("Chat notification error:", notifyErr.message);
    }

    const hydratedMessage = await message.populate(
      "sender",
      "userName email avatarUrl"
    );

    res.status(201).json({
      success: true,
      data: hydratedMessage,
    });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to send message",
    });
  }
};

const markRoomRead = async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await ChatRoom.findById(roomId);

    if (!room) {
      return res
        .status(404)
        .json({ success: false, message: "Chat room not found" });
    }

    const membership = ensureMembership(room, req.user._id);
    const now = new Date();

    if (membership.isPatient) {
      room.patientUnreadCount = 0;
      room.patientLastSeenAt = now;
    } else if (membership.isDoctor) {
      room.doctorUnreadCount = 0;
      room.doctorLastSeenAt = now;
    }

    await room.save();
    res.json({ success: true });
  } catch (error) {
    console.error("Mark room read error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to update read status",
    });
  }
};

module.exports = {
  createOrGetRoom,
  listRooms,
  getMessages,
  sendMessage,
  markRoomRead,
};

