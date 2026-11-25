import mongoose from 'mongoose';
import { config } from './config.js';

/**
 * Connect to MongoDB database using Mongoose
 */
export async function connectDB() {
  try {
    const conn = await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 5000 // Timeout quickly in dev if no MongoDB instance is running
    });
    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[MongoDB] Connection error: ${error.message}`);
    console.warn('[MongoDB] Server is running in memory/local mode until MongoDB Atlas URI is set in .env');
    if (config.nodeEnv === 'production') {
      process.exit(1);
    }
  }
}

mongoose.connection.on('disconnected', () => {
  console.warn('[MongoDB] Disconnected from database');
});

mongoose.connection.on('error', (err) => {
  console.error('[MongoDB] Runtime error:', err.message);
});
