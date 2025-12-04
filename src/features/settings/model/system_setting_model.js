const mongoose = require("mongoose");

const systemSettingSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        value: {
            type: mongoose.Schema.Types.Mixed, // Can be string, number, object, etc.
            required: true,
        },
        description: {
            type: String,
        },
        category: {
            type: String,
            enum: ["general", "payment", "booking", "notification"],
            default: "general",
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("SystemSetting", systemSettingSchema);
