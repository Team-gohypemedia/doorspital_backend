const nodemailer = require("nodemailer");

const sendEmail = async (to, subject, text) => {
  try {
    // Configure transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT, // 587
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: process.env.MAIL_FROM, // Sender address from env
      to: to,
      subject: subject,
      text: text,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.response);
    return true;
  } catch (error) {
    console.error("Email sending error details:", JSON.stringify(error, null, 2));
    console.error("Full Error Object:", error);
    return false;
  }
};

module.exports = { sendEmail };
