const mongoose = require('mongoose');

/**
 * Connect to MongoDB using Mongoose
 * @param {string} uri - MongoDB connection string
 */
const connectDB = async () => {
  try {
    // Trim quotes if present and get connection string
    const mongoUri = (process.env.MONGODB || '').trim().replace(/^["']|["']$/g, '');
    
    if (!mongoUri) {
      throw new Error('MONGODB connection string is not defined in environment variables');
    }
    
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1); // Stop the app if connection fails
  }
};

module.exports = connectDB;
