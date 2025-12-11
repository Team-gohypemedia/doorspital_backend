const mongoose = require("mongoose");

const productImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    filename: { type: String, required: true },
    mimetype: String,
    size: Number,
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, unique: true, sparse: true, trim: true },
    description: { type: String, trim: true },
    category: { type: String, trim: true, index: true },
    brand: { type: String, trim: true },
    dosageForm: { type: String, trim: true },
    strength: { type: String, trim: true },
    tags: [{ type: String, trim: true }],
    price: { type: Number, required: true, min: 0 },
    mrp: { type: Number, min: 0 },
    discountPercent: { type: Number, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    images: [productImageSchema],
    isPrescriptionRequired: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["draft", "active", "inactive"],
      default: "active",
    },
    isDeleted: { type: Boolean, default: false },
    pharmacy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pharmacy",
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

productSchema.index({ name: "text", description: "text", brand: "text" });

module.exports = mongoose.model("PharmacyProduct", productSchema);






