const mongoose = require("mongoose");

const supportTicketSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        subject: {
            type: String,
            required: true,
            trim: true,
        },
        message: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ["open", "in_progress", "resolved", "closed"],
            default: "open",
        },
        priority: {
            type: String,
            enum: ["low", "medium", "high"],
            default: "medium",
        },
        adminResponse: {
            type: String,
        },
        resolvedAt: {
            type: Date,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("SupportTicket", supportTicketSchema);
