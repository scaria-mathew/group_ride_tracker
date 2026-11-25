import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook to monitor device GPS position using navigator.geolocation.watchPosition.
 * Throttles updates according to intervalMs (default 4000ms per project brief).
 * Cleans up watchPosition properly on unmount.
 */
export function useGeolocation({ enabled = false, onLocationUpdate, intervalMs = 4000 }) {
  const [currentPosition, setCurrentPosition] = useState(null);
  const [error, setError] = useState(null);
  const lastSentTimeRef = useRef(0);
  const onLocationUpdateRef = useRef(onLocationUpdate);

  // Keep callback reference current
  useEffect(() => {
    onLocationUpdateRef.current = onLocationUpdate;
  }, [onLocationUpdate]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 1000
    };

    let watchId = null;

    const handleSuccess = (position) => {
      const now = Date.now();
      const posData = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speed: position.coords.speed,
        heading: position.coords.heading,
        sentAt: new Date(position.timestamp || now).toISOString()
      };

      setCurrentPosition(posData);
      setError(null);

      // Throttle updates to the specified interval
      if (now - lastSentTimeRef.current >= intervalMs) {
        lastSentTimeRef.current = now;
        if (onLocationUpdateRef.current) {
          onLocationUpdateRef.current(posData);
        }
      }
    };

    const handleError = (err) => {
      let message = 'Unable to retrieve location';
      switch (err.code) {
        case err.PERMISSION_DENIED:
          message = 'Location permission denied. Please allow GPS access in your browser.';
          break;
        case err.POSITION_UNAVAILABLE:
          message = 'GPS position unavailable. Make sure location services are enabled.';
          break;
        case err.TIMEOUT:
          message = 'GPS request timed out.';
          break;
        default:
          message = err.message || message;
      }
      setError(message);
    };

    try {
      watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, geoOptions);
    } catch (e) {
      setError(`Geolocation error: ${e.message}`);
    }

    // Cleanup watcher when disabled or on unmount
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [enabled, intervalMs]);

  return {
    currentPosition,
    error
  };
}
