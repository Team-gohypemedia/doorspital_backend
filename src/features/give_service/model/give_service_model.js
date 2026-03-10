const mongoose = require("mongoose");

const giveServiceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    mobileNumber: {
        type: String,
        required: true,
    },
    profession: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ["pending", "contacted"],
        default: "pending",
    },
}, { timestamps: true });

module.exports = mongoose.model("GiveService", giveServiceSchema);
