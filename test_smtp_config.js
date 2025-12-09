require("dotenv").config();
const { sendEmail } = require("./src/services/send_mail");

(async () => {
    console.log("Testing SMTP Configuration...");
    console.log("Host:", process.env.SMTP_HOST);
    console.log("Port:", process.env.SMTP_PORT);
    console.log("User:", process.env.SMTP_USER);
    console.log("From:", process.env.MAIL_FROM);

    const success = await sendEmail(
        "ravindranathjha76@gmail.com", // Sending to the same address as verification
        "Test Email from Doorspitals",
        "This is a test email to verify Brevo SMTP configuration."
    );

    if (success) {
        console.log("✅ Test email sent successfully!");
    } else {
        console.error("❌ Failed to send test email.");
    }
})();
