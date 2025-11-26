const mongoose = require("mongoose");
const { Validator } = require("node-input-validator");
const User = require("../../auth/model/user_model");

const sanitizeUser = (userDoc) => {
  if (!userDoc) return null;
  const user = userDoc.toObject ? userDoc.toObject() : userDoc;
  delete user.password;
  delete user.reset_otp;
  delete user.reset_otp_expires;
  delete user.__v;
  return user;
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const payload = req.body || {};
    const validator = new Validator(payload, {
      userName: "string",
      phoneNumber: "string",
      gender: "in:male,female,other,prefer_not_to_say",
      dateOfBirth: "dateISO",
      heightCm: "numeric",
      weightKg: "numeric",
      bloodType: "string",
      preferredLanguage: "string",
      location: "string",
      allergies: "array",
      bio: "string",
      "emergencyContact.name": "string",
      "emergencyContact.phone": "string",
      "emergencyContact.relation": "string",
    });

    const matched = await validator.validate();
    if (!matched) {
      return res.status(422).json({
        success: false,
        message: "Validation error",
        errors: validator.errors,
      });
    }

    const allowedFields = [
      "userName",
      "phoneNumber",
      "gender",
      "dateOfBirth",
      "heightCm",
      "weightKg",
      "bloodType",
      "preferredLanguage",
      "location",
      "bio",
    ];

    const update = {};
    allowedFields.forEach((field) => {
      if (payload[field] !== undefined) update[field] = payload[field];
    });

    if (payload.allergies !== undefined) {
      update.allergies = Array.isArray(payload.allergies)
        ? payload.allergies
        : String(payload.allergies)
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
    }

    if (payload.emergencyContact) {
      update.emergencyContact = {
        name: payload.emergencyContact.name || "",
        phone: payload.emergencyContact.phone || "",
        relation: payload.emergencyContact.relation || "",
      };
    }

    if (payload.dateOfBirth) {
      update.dateOfBirth = new Date(payload.dateOfBirth);
    }

    update.profileUpdatedAt = new Date();

    const user = await User.findByIdAndUpdate(req.userId, update, {
      new: true,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated",
      data: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const uploadIdentityDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Document file is required",
      });
    }

    const { documentType } = req.body || {};
    if (!documentType) {
      return res.status(422).json({
        success: false,
        message: "documentType is required",
      });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const documentPayload = {
      documentId: new mongoose.Types.ObjectId(),
      type: documentType,
      filename: req.file.filename,
      path: req.file.path,
      mimetype: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date(),
    };

    user.documents.push(documentPayload);
    await user.save();

    const savedDoc =
      user.documents[user.documents.length - 1] || documentPayload;

    return res.status(201).json({
      success: true,
      message: "Document uploaded successfully",
      data: {
        documentId: savedDoc.documentId,
        type: savedDoc.type,
        filename: savedDoc.filename,
        mimetype: savedDoc.mimetype,
        size: savedDoc.size,
        uploadedAt: savedDoc.uploadedAt,
        path: savedDoc.path,
      },
    });
  } catch (error) {
    console.error("Upload identity document error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  uploadIdentityDocument,
};

