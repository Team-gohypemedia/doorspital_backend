const SystemSetting = require("../model/system_setting_model");

const getSettings = async (req, res) => {
    try {
        const settings = await SystemSetting.find({});
        // Convert array to object for easier frontend consumption if needed, 
        // but for now returning list as per admin controller requirement
        return res.status(200).json({ success: true, data: settings });
    } catch (err) {
        console.error("Get settings error:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const updateSetting = async (req, res) => {
    try {
        const { key, value } = req.body;

        if (!key || value === undefined) {
            return res.status(400).json({ success: false, message: "Key and value are required" });
        }

        const setting = await SystemSetting.findOneAndUpdate(
            { key },
            { value },
            { new: true, upsert: true } // Create if not exists
        );

        return res.status(200).json({ success: true, message: "Setting updated", data: setting });
    } catch (err) {
        console.error("Update setting error:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const seedDefaultSettings = async () => {
    const defaults = [
        { key: "slotDuration", value: 30, description: "Duration of each appointment slot in minutes", category: "booking" },
        { key: "cancellationPolicy", value: "24h notice", description: "Policy for cancelling appointments", category: "booking" },
        { key: "refundWindow", value: "7 days", description: "Time window for refunds", category: "payment" },
        { key: "platformFee", value: "10%", description: "Platform fee percentage", category: "payment" },
        { key: "taxSettings", value: "GST 18%", description: "Tax configuration", category: "payment" },
    ];

    for (const setting of defaults) {
        await SystemSetting.findOneAndUpdate(
            { key: setting.key },
            { ...setting },
            { upsert: true }
        );
    }
    console.log("Default settings seeded");
};

module.exports = {
    getSettings,
    updateSetting,
    seedDefaultSettings,
};
