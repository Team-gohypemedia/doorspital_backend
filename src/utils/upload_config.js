const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Create subdirectories for different file types
const doctorVerificationDir = path.join(uploadsDir, "doctor-verification");
if (!fs.existsSync(doctorVerificationDir)) {
  fs.mkdirSync(doctorVerificationDir, { recursive: true });
}
const patientDocumentDir = path.join(uploadsDir, "patient-documents");
if (!fs.existsSync(patientDocumentDir)) {
  fs.mkdirSync(patientDocumentDir, { recursive: true });
}
const pharmacyProductsDir = path.join(uploadsDir, "pharmacy-products");
if (!fs.existsSync(pharmacyProductsDir)) {
  fs.mkdirSync(pharmacyProductsDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, doctorVerificationDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: timestamp-random-originalname
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  },
});

// File filter function
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedMimes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/svg+xml",
    "application/pdf",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only JPG, PNG, SVG, and PDF files are allowed."
      ),
      false
    );
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
});

const patientDocumentStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, patientDocumentDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  },
});

const patientDocumentUpload = multer({
  storage: patientDocumentStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const pharmacyProductStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, pharmacyProductsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  },
});

const pharmacyProductUpload = multer({
  storage: pharmacyProductStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

// Middleware for doctor verification uploads
// Handles multiple file fields
const doctorVerificationUpload = upload.fields([
  { name: "mbbsCertificate", maxCount: 1 },
  { name: "mdMsBdsCertificate", maxCount: 1 },
  { name: "registrationCertificate", maxCount: 1 },
  { name: "governmentId", maxCount: 1 },
  { name: "selfie", maxCount: 1 },
]);

module.exports = {
  doctorVerificationUpload,
  upload,
  patientDocumentUpload,
  pharmacyProductUpload,
};




