// firebaseAdmin.js
const admin = require('firebase-admin');

let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (err) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT env var as JSON:', err.message);
    serviceAccount = null;
  }
} else {
  try {
    // only require the file when present locally
    serviceAccount = require('./doorspitals-firebase-adminsdk-fbsvc-e5f29f2bb1.json');
  } catch (err) {
    console.warn('Firebase service account file not found; set FIREBASE_SERVICE_ACCOUNT in environment for production.');
    serviceAccount = null;
  }
}

if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} else {
  // initializeApp without explicit credentials will use GOOGLE_APPLICATION_CREDENTIALS or default creds
  try {
    admin.initializeApp();
  } catch (err) {
    console.error('Failed to initialize Firebase admin SDK:', err.message);
    throw err;
  }
}

module.exports = admin;
