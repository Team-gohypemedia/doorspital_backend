const { Validator } = require("node-input-validator");
const bcrypt = require("bcryptjs");             // or: const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const usermodel = require("../model/user_model");
const Doctor = require("../../doctors/model/doctor_model");

const signIn = async (req, res) => {
    try {
     

     const body =req.body || 
     {} ;

     console.log(body);
     
        const v = new Validator(
            body,
            {
                email: "required",
                password: "required",
            }
        );

        const matched = await v.validate();

        if (!matched) {
            return res.status(422).json({ success: false, message: "Validation error", errors: v.errors });
        }

    console.log(body);

           const { email, password } = body;

        const user = await usermodel.findOne({ email: email }); 

        if (!user) {
            return res.status(401).json({ success: false, message: "User Does not exists" });
        }

        // Compare password
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) {
            return res.status(401).json({ success: false, message: "Invalid Password" });
        }

        // Create JWT (set your own claims/expiry as needed)
        const payload = {
            id: user._id.toString(),
            email: user.email,
            role: user.role || "user",
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: "7d",
        });

        // If user is a doctor, fetch and include doctor ID
        let responseUser = {
            id: user._id.toString(),
            email: user.email,
            userName: user.userName,
            role: user.role || "user",
        };

        if (user.role === "doctor") {
            const doctor = await Doctor.findOne({ user: user._id }).select("_id").lean();
            if (doctor) {
                responseUser.doctorId = doctor._id.toString();
            }
        }

        return res.status(200).json({
            success: true,
            message: "Signed in",
            token,
            user: responseUser
         
        });
    } catch (error) {
        console.error("Signin error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

module.exports = { signIn };
