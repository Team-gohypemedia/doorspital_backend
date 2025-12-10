const Pharmacy = require("../model/pharmacy_model");

const getPharmacyProfile = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findOne({ user: req.user._id }).lean();
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: "Pharmacy profile not found" });
    }
    return res.json({ success: true, data: pharmacy });
  } catch (error) {
    console.error("Get pharmacy profile error:", error);
    return res.status(500).json({ success: false, message: "Unable to fetch profile" });
  }
};

const updatePharmacyProfile = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findOne({ user: req.user._id });
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: "Pharmacy profile not found" });
    }

    const updatableFields = [
      "ownerName",
      "storeName",
      "phoneNumber",
      "whatsappNumber",
      "drugLicenseNumber",
      "licenseAuthority",
      "licenseExpiryDate",
      "gstNumber",
      "panNumber",
      "pharmacyType",
      "status",
    ];

    updatableFields.forEach((field) => {
      if (typeof req.body[field] !== "undefined") {
        pharmacy[field] = req.body[field];
      }
    });

    if (req.body.address) {
      pharmacy.address = {
        ...pharmacy.address?.toObject?.(),
        ...req.body.address,
      };
    }

    await pharmacy.save();

    return res.json({
      success: true,
      message: "Profile updated",
      data: pharmacy,
    });
  } catch (error) {
    console.error("Update pharmacy profile error:", error);
    return res.status(500).json({ success: false, message: "Unable to update profile" });
  }
};

module.exports = {
  getPharmacyProfile,
  updatePharmacyProfile,
};
