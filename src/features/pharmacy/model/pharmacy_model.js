const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    line1: { type: String },
    line2: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
  },
  { _id: false }
);

const pharmacySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    ownerName: {
      type: String,
      required: true,
    },
    whatsappNumber: {
      type: String,
    },
    storeName: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    drugLicenseNumber: {
      type: String,
      required: true,
    },
    licenseAuthority: {
      type: String,
      required: true,
    },
    licenseExpiryDate: {
      type: Date,
      required: true,
    },
    gstNumber: String,
    panNumber: String,
    pharmacyType: {
      type: String,
    },
    address: {
      type: addressSchema,
    },
    status: {
      type: String,
      enum: ["pending", "active", "suspended"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Pharmacy", pharmacySchema);
