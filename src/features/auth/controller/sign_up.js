const {Validator} = require("node-input-validator");
const usermodel = require("../model/user_model");
const bcrypt = require("bcryptjs")

const signUp = async (req, res) => {
    try {
        const v = new Validator(req.body || {}, {
            userName: "required",
            email: "required",
            password: "required",
        });

        matched = await v.validate();


        if (!matched) {
            return res.status(422).json({ message: "validation error", success: false, errors: v.errors });
        }

        const { email, userName, password } = req.body;

        const user = await usermodel.findOne({ email: email });

    

        if (user) {
            return res.status(400).json({ success: false, message: "User Already Exists" });

        }
        const hash = bcrypt.hashSync(password, 10);

        const userData = usermodel({
            email: email,
            userName: userName,
            password: hash,

        });

        const savedUser = await userData.save();

        return res.status(200).json({ success: true, message: "User created successfully", data: savedUser });
    } catch (error) {
        console.error("Signup error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

module.exports = { signUp };
