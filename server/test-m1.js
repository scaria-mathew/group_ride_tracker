import { server } from './index.js';
import { io as ClientIO } from '../client/node_modules/socket.io-client/build/esm/index.js';
import http from 'http';
import { config } from './config.js';

async function runM1Test() {
  console.log('[Test M1] Starting automated test for Milestone 1...');

  // 1. Test HTTP Health Check
  await new Promise((resolve, reject) => {
    http.get(`http://localhost:${config.port}/api/health`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.status === 'ok') {
            console.log('✓ Health check endpoint responded with status: ok');
            resolve();
          } else {
            reject(new Error(`Unexpected health check response: ${data}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });

  // 2. Test Socket.IO Real-time Location Sharing
  await new Promise((resolve, reject) => {
    const socket = ClientIO(`http://localhost:${config.port}`, {
      transports: ['websocket']
    });

    socket.on('connect', () => {
      console.log('✓ Socket.IO client connected successfully');

      socket.emit('room:join', {
        roomId: 'test-room',
        userId: 'test-rider-1',
        displayName: 'Test Rider',
        vehicleType: 'bike'
      });

      // Give 200ms to join room, then emit location update
      setTimeout(() => {
        socket.emit('location:update', {
          lat: 12.9716,
          lng: 77.5946,
          accuracy: 5,
          speed: 11.2,
          sentAt: new Date().toISOString()
        });
      }, 200);
    });

    socket.on('location:update', (data) => {
      if (data.userId === 'test-rider-1' && data.lat === 12.9716 && data.lng === 77.5946) {
        console.log(`✓ Real-time location:update received on client: ${data.displayName} @ [${data.lat}, ${data.lng}]`);
        console.log(`✓ Server-stamped receivedAt: ${data.receivedAt}`);
        socket.disconnect();
        resolve();
      }
    });

    socket.on('connect_error', (err) => {
      reject(err);
    });

    setTimeout(() => {
      reject(new Error('Timeout waiting for location:update socket event'));
    }, 5000);
  });

  console.log('[Test M1] All Milestone 1 prototype tests passed successfully!');
  server.close(() => {
    process.exit(0);
  });
}

// Give server 1 second to bind to port before running tests
setTimeout(runM1Test, 1000);
