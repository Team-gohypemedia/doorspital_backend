const HealthArticle = require("../model/health_artical_model");
const { Validator } = require("node-input-validator");

/**
 * POST /api/health-articles
 * Body: { image, title, date, time }
 */
const createHealthArticle = async (req, res) => {
  try {
    // ✅ Validation
    const v = new Validator(req.body || {}, {
      image: "required",
      title: "required",
      date: "required",
      time: "required",
    });

    const matched = await v.validate();
    if (!matched) {
      return res.status(422).json({
        success: false,
        message: "Validation error",
        errors: v.errors,
      });
    }

    const { image, title, date, time } = req.body;

    // ✅ Create article
    const article = await HealthArticle.create({ image, title, date, time });

    return res.status(201).json({
      success: true,
      message: "Health article created successfully",
      data: article,
    });
  } catch (error) {
    console.error("Error creating health article:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

module.exports = { createHealthArticle };
