const SupportTicket = require("../model/support_ticket_model");
const mongoose = require("mongoose");

const createTicket = async (req, res) => {
    try {
        const { subject, message, priority } = req.body;
        const userId = req.userId;

        if (!subject || !message) {
            return res.status(400).json({ success: false, message: "Subject and message are required" });
        }

        const ticket = await SupportTicket.create({
            user: userId,
            subject,
            message,
            priority: priority || "medium",
        });

        return res.status(201).json({ success: true, data: ticket });
    } catch (err) {
        console.error("Create ticket error:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const getMyTickets = async (req, res) => {
    try {
        const userId = req.userId;
        const tickets = await SupportTicket.find({ user: userId }).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, data: tickets });
    } catch (err) {
        console.error("Get my tickets error:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const getAllTickets = async (req, res) => {
    try {
        const page = Math.max(Number(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
        const skip = (page - 1) * limit;
        const status = req.query.status;

        const filter = {};
        if (status) filter.status = status;

        const [tickets, total] = await Promise.all([
            SupportTicket.find(filter)
                .populate("user", "userName email")
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 }),
            SupportTicket.countDocuments(filter),
        ]);

        return res.status(200).json({
            success: true,
            data: tickets,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    } catch (err) {
        console.error("Get all tickets error:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const updateTicketStatus = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { status, adminResponse } = req.body;

        if (!mongoose.Types.ObjectId.isValid(ticketId)) {
            return res.status(400).json({ success: false, message: "Invalid ticketId" });
        }

        const updateData = {};
        if (status) updateData.status = status;
        if (adminResponse) updateData.adminResponse = adminResponse;
        if (status === "resolved" || status === "closed") {
            updateData.resolvedAt = new Date();
        }

        const ticket = await SupportTicket.findByIdAndUpdate(ticketId, updateData, { new: true });
        if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });

        return res.status(200).json({ success: true, message: "Ticket updated", data: ticket });
    } catch (err) {
        console.error("Update ticket status error:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

module.exports = {
    createTicket,
    getMyTickets,
    getAllTickets,
    updateTicketStatus,
};
