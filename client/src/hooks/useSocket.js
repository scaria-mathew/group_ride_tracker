import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

/**
 * Custom hook to manage a single Socket.IO connection lifecycle.
 * React 18 strict mode may mount components twice in development;
 * this hook ensures clean connection and disconnection without leaks.
 */
export function useSocket(serverUrl = window.location.origin) {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // In dev mode with Vite proxy, connecting to origin will be proxied to server
    const socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log(`[Socket] Connected with ID: ${socket.id}`);
      setIsConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected: ${reason}`);
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error(`[Socket] Connection error:`, err.message);
    });

    // Cleanup: disconnect socket when component unmounts
    return () => {
      console.log('[Socket] Cleaning up socket connection...');
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [serverUrl]);

  return {
    socket: socketRef.current,
    isConnected
  };
}
