const { Validator } = require("node-input-validator");
const crypto = require("crypto");
const usermodel = require("../../model/user_model");
const { sendEmail } = require("../../../../services/send_mail");

const forgotPasswordSendOtp = async (req, res) => {
    try {
        const body = req.body || {};
        console.log(body);

        const v = new Validator(body, {
            email: "required",
        });


        const matched = await v.validate();

        if (!matched) {
            return res
                .status(422)
                .json({ success: false, message: "Validation error", errors: v.errors });
        }

        const { email } = body;

        const user = await usermodel.findOne({ email: email });

        if (!user) {
            return res
                .status(401)
                .json({ success: false, message: "User Does not exists" });
        }

        // Generate a 6-digit OTP
        const otp = String(crypto.randomInt(100000, 1000000));

        // Store OTP and expiry (15 minutes)
        user.reset_otp = otp;
        user.reset_otp_expires = new Date(Date.now() + 5 * 60 * 1000);

        await user.save();

        await sendEmail(
            email,
            "Your Password Reset OTP",
            `Your OTP for resetting password is: ${otp}\n\nThis OTP will expire in 15 minutes.`
        );

        return res.status(200).json({
            success: true,
            message: "OTP sent to the registered email address",
        });
    } catch (error) {
        console.error("Forgot password (send OTP) error:", error);
        return res
            .status(500)
            .json({ success: false, message: "Internal server error" });
    }
};

module.exports = { forgotPasswordSendOtp };
