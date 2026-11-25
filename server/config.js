import dotenv from 'dotenv';
dotenv.config();

/**
 * Application configuration and constants
 * BCA Project Viva note: Centralizing constants here allows easy adjustment
 * for testing (e.g. evaluating 2s vs 5s vs 10s location intervals).
 */
export const config = {
  port: process.env.PORT || 5000,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/group_ride_tracker',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  nodeEnv: process.env.NODE_ENV || 'development',

  // Location update interval in milliseconds (default 4 seconds as per brief)
  locationUpdateIntervalMs: 4000,

  // Stale member timeout in milliseconds (30 seconds without updates = stale marker)
  staleMemberTimeoutMs: 30000,

  // Alert thresholds
  alerts: {
    // Stopped threshold: speed below 1.5 m/s for 3 minutes (180,000 ms)
    stoppedSpeedThresholdMps: 1.5,
    stoppedDurationMs: 3 * 60 * 1000,

    // Fell behind threshold: distance above 500m for 60 seconds (60,000 ms)
    behindDistanceThresholdMeters: 500,
    behindDurationMs: 60 * 1000
  }
};
