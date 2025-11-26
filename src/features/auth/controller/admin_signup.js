const { Validator } = require("node-input-validator");
const User = require("../model/user_model");
const bcrypt = require("bcryptjs");

/**
 * POST /api/admin/sign-up
 * Create an admin user
 * Note: In production, you might want to restrict this or use a special secret key
 */
const adminSignUp = async (req, res) => {
  try {
    const v = new Validator(req.body || {}, {
      userName: "required",
      email: "required|email",
      password: "required|minLength:6",
    });

    const matched = await v.validate();

    if (!matched) {
      return res.status(422).json({
        success: false,
        message: "Validation error",
        errors: v.errors,
      });
    }

    const { email, userName, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Hash password
    const hash = bcrypt.hashSync(password, 10);

    // Create admin user
    const adminUser = await User.create({
      email: email,
      userName: userName,
      password: hash,
      role: "admin",
    });

    // Remove password from response
    const userResponse = adminUser.toObject();
    delete userResponse.password;

    return res.status(201).json({
      success: true,
      message: "Admin user created successfully",
      data: {
        userId: adminUser._id,
        email: adminUser.email,
        userName: adminUser.userName,
        role: adminUser.role,
      },
    });
  } catch (error) {
    console.error("Admin signup error:", error);
    
    // Handle duplicate email error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = { adminSignUp };




