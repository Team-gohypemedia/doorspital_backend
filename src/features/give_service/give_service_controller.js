const GiveService = require("./model/give_service_model");

exports.submitRequest = async (req, res) => {
    try {
        const { name, mobileNumber, profession } = req.body;

        if (!name || !mobileNumber || !profession) {
            return res.status(400).json({ success: false, message: "Name, Mobile Number, and Profession are required" });
        }

        const newRequest = new GiveService({ name, mobileNumber, profession });
        await newRequest.save();

        res.status(201).json({ success: true, message: "Service request submitted successfully", data: newRequest });
    } catch (error) {
        console.error("Error submitting give service request:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

exports.getAllRequests = async (req, res) => {
    try {
        const requests = await GiveService.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: requests });
    } catch (error) {
        console.error("Error fetching give service requests:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};
