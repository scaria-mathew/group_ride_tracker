import { LocationPoint } from '../models/LocationPoint.js';

/**
 * Socket.IO handler for real-time location tracking and room management.
 * BCA Project Viva Note: We use Socket.IO rooms to isolate location broadcasts
 * so members only receive location data for their own group/ride.
 */
export function registerLocationHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Join a tracking room (e.g., prototype-room or group room)
    socket.on('room:join', (data) => {
      const { roomId = 'prototype-room', userId, displayName = 'Anonymous', vehicleType = 'bike' } = data || {};
      
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.userId = userId || socket.id;
      socket.data.displayName = displayName;
      socket.data.vehicleType = vehicleType;

      console.log(`[Socket] ${displayName} (${socket.id}) joined room: ${roomId}`);

      // Notify others in the room
      socket.to(roomId).emit('member:joined', {
        userId: socket.data.userId,
        displayName,
        vehicleType,
        joinedAt: new Date().toISOString()
      });
    });

    // Handle incoming real-time location update
    socket.on('location:update', async (data) => {
      try {
        const { lat, lng, accuracy, speed, heading, sentAt, rideId } = data || {};

        // Validation: lat and lng must be valid numbers
        if (typeof lat !== 'number' || typeof lng !== 'number') {
          return;
        }

        const roomId = socket.data.roomId || 'prototype-room';
        const receivedAt = new Date().toISOString();

        const locationPayload = {
          userId: socket.data.userId || socket.id,
          displayName: socket.data.displayName || 'Rider',
          vehicleType: socket.data.vehicleType || 'bike',
          lat,
          lng,
          accuracy: accuracy ?? null,
          speed: speed ?? null,
          heading: heading ?? null,
          sentAt: sentAt || receivedAt,
          receivedAt
        };

        // Broadcast to all clients in the room (including or excluding sender)
        // We broadcast to everyone in the room so all phones update their map
        io.to(roomId).emit('location:update', locationPayload);

        // If active rideId is provided and valid, persist to MongoDB
        if (rideId && socket.data.userId) {
          try {
            await LocationPoint.create({
              rideId,
              userId: socket.data.userId,
              lat,
              lng,
              accuracy,
              speed,
              heading,
              recordedAt: sentAt ? new Date(sentAt) : new Date(),
              receivedAt: new Date(receivedAt)
            });
          } catch (dbErr) {
            // Non-blocking log if DB insertion fails (e.g. during standalone tests)
            console.error('[Socket] Failed to save location point:', dbErr.message);
          }
        }
      } catch (err) {
        console.error('[Socket] Error processing location:update:', err.message);
      }
    });

    // Handle client disconnect
    socket.on('disconnect', (reason) => {
      const roomId = socket.data.roomId;
      const userId = socket.data.userId || socket.id;
      const displayName = socket.data.displayName || 'Member';

      if (roomId) {
        socket.to(roomId).emit('member:left', {
          userId,
          displayName,
          leftAt: new Date().toISOString()
        });
      }
      console.log(`[Socket] Client disconnected: ${socket.id} (${reason})`);
    });
  });
}
