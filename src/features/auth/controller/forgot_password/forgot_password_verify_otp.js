const { Validator } = require("node-input-validator");
const jwt = require("jsonwebtoken");
const usermodel = require("../../model/user_model");

const forgotPasswordVerifyOtp = async (req, res) => {
  try {
    const body = req.body || {};
    console.log(body);

    const v = new Validator(body, {
      email: "required",
      otp: "required",
    });

    const matched = await v.validate();

    if (!matched) {
      return res
        .status(422)
        .json({ success: false, message: "Validation error", errors: v.errors });
    }

    const { email, otp } = body;

    const user = await usermodel.findOne({ email: email });

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User Does not exists" });
    }

    // Check OTP presence
    if (!user.reset_otp || !user.reset_otp_expires) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    // Check OTP match
    if (String(user.reset_otp) !== String(otp)) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    // Check expiry
    if (new Date(user.reset_otp_expires).getTime() < Date.now()) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    // Clear OTP fields
    user.reset_otp = undefined;
    user.reset_otp_expires = undefined;
    await user.save();

    // Issue short-lived reset token
    const reset_token = jwt.sign(
      {
        id: user._id.toString(),
        purpose: "password_reset",
      },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    return res.status(200).json({
      success: true,
      message: "OTP verified",
      reset_token,
    });
  } catch (error) {
    console.error("Forgot password (verify OTP) error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

module.exports = { forgotPasswordVerifyOtp };
