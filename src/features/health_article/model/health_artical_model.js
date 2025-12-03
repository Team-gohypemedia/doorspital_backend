const mongoose = require("mongoose");
const healthArticleSchema = new mongoose.Schema({

    image: {
        type: String,
        require: true,
    },

    title: {
        type: String,
        require: true,
    },

    date: {
        type: String,
        require: true,
    },

    time: {
        type: String,
        require: true,
    },

    description: {
        type: String,
        require: true,
    }


});

module.exports = mongoose.model("healthArticle", healthArticleSchema);
