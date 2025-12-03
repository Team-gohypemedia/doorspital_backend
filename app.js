const express = require("express");
const app = express();
require('dotenv').config();
const db = require("./src/utils/connect_db");
const router = require('./src/routes/app_routes');
const bodyParser = require("body-parser");

db();

// CORS configuration for Flutter Web
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*'); // Allow all origins (for development)
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
const path = require("path");
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api", router);

app.listen(process.env.PORT, async () => {
  console.log(`App is running on port ${process.env.PORT}`)
})