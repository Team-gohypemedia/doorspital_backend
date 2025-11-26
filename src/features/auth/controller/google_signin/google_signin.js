
const admin = require('../../../../admin/firebase_config');
const jwt = require('jsonwebtoken');
const usermodel = require('../../model/user_model');

// POST /api/auth/google
const googleSign= async (req, res) => {
  try {
    const { idToken } = req.body || {};
    if (!idToken) {
      return res.status(400).json({ success: false, message: 'Missing idToken' });
    }

    // 1) Verify Firebase ID token
    const decoded = await admin.auth().verifyIdToken(idToken);
    const { uid, email, name, picture, email_verified } = decoded;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email not present in Google account' });
    }

    // 2) Upsert user in DB
    let user = await usermodel.findOne({ email });
    if (!user) {
      user = await usermodel.create({
        email,
        name: name || '',
        googleUid: uid,
        avatar: picture || '',
        emailVerified: !!email_verified,
        provider: 'google',
      });
    } else {
      const updates = {};
      if (!user.googleUid) updates.googleUid = uid;
      if (name && user.name !== name) updates.name = name;
      if (picture && user.avatar !== picture) updates.avatar = picture;
      if (email_verified && !user.emailVerified) updates.emailVerified = true;
      if (Object.keys(updates).length) {
        await usermodel.updateOne({ _id: user._id }, { $set: updates });
      }
    }

    // 3) Issue your JWT
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ success: false, message: 'JWT secret not configured' });
    }

    const token = jwt.sign(
      { id: String(user._id), email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({ success: true, message: 'Signed in with Google', token });
  } catch (err) {
    console.error('Google sign-in error:', err);
    return res.status(401).json({ success: false, message: 'Invalid or expired Google token' });
  }
}

module.exports = {googleSign};
