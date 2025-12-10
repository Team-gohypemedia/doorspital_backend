const { Validator } = require("node-input-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../../auth/model/user_model");
const Pharmacy = require("../model/pharmacy_model");

const pharmacySignUp = async (req, res) => {
  try {
    const validator = new Validator(req.body || {}, {
      ownerName: "required",
      storeName: "required",
      email: "required|email",
      phoneNumber: "required",
      password: "required|minLength:6",
      drugLicenseNumber: "required",
      licenseAuthority: "required",
      licenseExpiryDate: "required",
      pharmacyType: "required",
      "address.line1": "required",
      "address.city": "required",
      "address.state": "required",
      "address.pincode": "required",
    });

    const matched = await validator.validate();
    if (!matched) {
      return res.status(422).json({
        success: false,
        message: "Validation failed",
        errors: validator.errors,
      });
    }

    const {
      ownerName,
      storeName,
      email,
      phoneNumber,
      whatsappNumber,
      password,
      drugLicenseNumber,
      licenseAuthority,
      licenseExpiryDate,
      gstNumber,
      panNumber,
      pharmacyType,
      address,
    } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "User already exists" });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    const user = await User.create({
      userName: storeName || ownerName,
      email,
      password: hashedPassword,
      role: "pharmacy",
      phoneNumber,
    });

    const pharmacy = await Pharmacy.create({
      user: user._id,
      ownerName,
      storeName,
      phoneNumber,
      whatsappNumber,
      drugLicenseNumber,
      licenseAuthority,
      licenseExpiryDate: new Date(licenseExpiryDate),
      gstNumber,
      panNumber,
      pharmacyType,
      address,
    });

    return res.status(201).json({
      success: true,
      message: "Pharmacy account created successfully",
      data: {
        user: {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
        },
        pharmacy: {
          id: pharmacy._id.toString(),
          status: pharmacy.status,
        },
      },
    });
  } catch (error) {
    console.error("Pharmacy signup error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const pharmacySignIn = async (req, res) => {
  try {
    const validator = new Validator(req.body || {}, {
      email: "required|email",
      password: "required",
    });

    const matched = await validator.validate();
    if (!matched) {
      return res.status(422).json({
        success: false,
        message: "Validation failed",
        errors: validator.errors,
      });
    }

    const { email, password } = req.body;
    const user = await User.findOne({ email, role: "pharmacy" });
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const payload = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });

    const pharmacy = await Pharmacy.findOne({ user: user._id }).lean();
    const responseUser = {
      id: user._id.toString(),
      email: user.email,
      userName: user.userName,
      role: user.role,
    };

    if (pharmacy) {
      responseUser.pharmacyId = pharmacy._id.toString();
    }

    return res.status(200).json({
      success: true,
      message: "Pharmacy signed in",
      token,
      user: responseUser,
      pharmacy,
    });
  } catch (error) {
    console.error("Pharmacy signin error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  pharmacySignUp,
  pharmacySignIn,
};
