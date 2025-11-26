const nodemailer = require("nodemailer");

const sendEmail = async (to, subject, text) => {
  try {
    // Configure transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,   // your Gmail or SMTP username
        pass: process.env.SMTP_PASS,   // your Gmail or SMTP app password
      },
    });

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: to,
      subject: subject,
      text: text,
    };

    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully to:", to);

    return true;
  } catch (error) {
    console.error("Email sending error:", error);
    return false;
  }
};

module.exports = { sendEmail };
