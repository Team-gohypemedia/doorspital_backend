const { Validator } = require("node-input-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const usermodel = require("../../model/user_model");

const resetPassword = async (req, res) => {
  try {
    const body = req.body || {};
    console.log(body);

    const v = new Validator(body, {
      reset_token: "required",
      password: "required",
      confirm_password: "required",
    });

    const matched = await v.validate();

    if (!matched) {
      return res
        .status(422)
        .json({ success: false, message: "Validation error", errors: v.errors });
    }

    const { reset_token, password } = body;

    let decoded;
    try {
      decoded = jwt.verify(reset_token, process.env.JWT_SECRET);
    } catch (err) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid or expired reset token" });
    }

    const user = await usermodel.findById(decoded.id);

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User Does not exists" });
    }

    // Hash and set new password
    const hashed = await bcrypt.hash(password, 10);
    user.password = hashed;

    // Clear any pending OTP fields if present
    user.reset_otp = undefined;
    user.reset_otp_expires = undefined;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

module.exports = { resetPassword };
