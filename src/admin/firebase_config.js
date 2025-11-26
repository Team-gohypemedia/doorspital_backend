// firebaseAdmin.js
const admin = require('firebase-admin');
const serviceAccount = require('./doorspitals-firebase-adminsdk-fbsvc-e5f29f2bb1.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
