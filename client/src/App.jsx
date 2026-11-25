import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from './hooks/useSocket.js';
import { useGeolocation } from './hooks/useGeolocation.js';
import { Map } from './components/Map.jsx';
import './theme.css';
import './App.css';

export function App() {
  // Stored identity or initial state
  const [displayName, setDisplayName] = useState(() => localStorage.getItem('grt_name') || '');
  const [vehicleType, setVehicleType] = useState(() => localStorage.getItem('grt_vehicle') || 'bike');
  const [roomId, setRoomId] = useState('prototype-room');
  const [userId] = useState(() => {
    let id = localStorage.getItem('grt_user_id');
    if (!id) {
      id = 'user_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('grt_user_id', id);
    }
    return id;
  });

  const [isJoined, setIsJoined] = useState(false);
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [membersMap, setMembersMap] = useState({});

  const { socket, isConnected } = useSocket();

  // Handle incoming real-time location updates from other members
  useEffect(() => {
    if (!socket) return;

    const handleLocationUpdate = (data) => {
      setMembersMap((prev) => ({
        ...prev,
        [data.userId]: {
          ...data,
          lastSeen: Date.now()
        }
      }));
    };

    const handleMemberLeft = (data) => {
      setMembersMap((prev) => {
        const updated = { ...prev };
        delete updated[data.userId];
        return updated;
      });
    };

    socket.on('location:update', handleLocationUpdate);
    socket.on('member:left', handleMemberLeft);

    return () => {
      socket.off('location:update', handleLocationUpdate);
      socket.off('member:left', handleMemberLeft);
    };
  }, [socket]);

  // Callback to emit real GPS position over Socket.IO
  const handleLocationEmit = useCallback((pos) => {
    if (!socket || !isJoined) return;

    const payload = {
      lat: pos.lat,
      lng: pos.lng,
      accuracy: pos.accuracy,
      speed: pos.speed,
      heading: pos.heading,
      sentAt: pos.sentAt
    };

    socket.emit('location:update', payload);

    // Update local map view immediately
    setMembersMap((prev) => ({
      ...prev,
      [userId]: {
        userId,
        displayName: displayName || 'You',
        vehicleType,
        lat: pos.lat,
        lng: pos.lng,
        speed: pos.speed,
        receivedAt: new Date().toISOString(),
        lastSeen: Date.now()
      }
    }));
  }, [socket, isJoined, userId, displayName, vehicleType]);

  // Hook to watch GPS
  const { currentPosition, error: geoError } = useGeolocation({
    enabled: isJoined && isSharingLocation && !isSimulating,
    onLocationUpdate: handleLocationEmit,
    intervalMs: 4000
  });

  // Simulation mode for desktop / stationary testing
  const simIntervalRef = useRef(null);
  useEffect(() => {
    if (!isJoined || !isSimulating) {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
      return;
    }

    // Default starting point (e.g., MG Road, Bangalore: 12.9750, 77.6090)
    let simLat = currentPosition?.lat || 12.9750;
    let simLng = currentPosition?.lng || 77.6090;

    simIntervalRef.current = setInterval(() => {
      // Simulate slight northward movement at ~30 km/h
      simLat += 0.00018 + (Math.random() - 0.5) * 0.00005;
      simLng += 0.00012 + (Math.random() - 0.5) * 0.00005;

      const simPos = {
        lat: simLat,
        lng: simLng,
        accuracy: 8,
        speed: 8.5, // ~30 km/h
        heading: 45,
        sentAt: new Date().toISOString()
      };

      handleLocationEmit(simPos);
    }, 4000);

    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, [isJoined, isSimulating, handleLocationEmit, currentPosition]);

  // Handle joining tracking room
  const handleJoin = (e) => {
    e.preventDefault();
    if (!displayName.trim()) return;

    localStorage.setItem('grt_name', displayName);
    localStorage.setItem('grt_vehicle', vehicleType);

    if (socket && isConnected) {
      socket.emit('room:join', {
        roomId,
        userId,
        displayName,
        vehicleType
      });
    }

    setIsJoined(true);
  };

  // Convert members map to array
  const memberList = Object.values(membersMap);
  const selfMember = membersMap[userId];

  return (
    <div className="prototype-container">
      {/* Top Header */}
      <header className="prototype-header">
        <div className="header-title-group">
          <h1>Group Ride Tracker</h1>
          <span className="header-subtitle">M1 Prototype &bull; Room: {roomId}</span>
        </div>

        <div className="header-badges">
          <span className={`badge ${isConnected ? 'badge-connected' : 'badge-disconnected'}`}>
            <span className="status-dot"></span>
            {isConnected ? 'Server Connected' : 'Disconnected'}
          </span>

          {isJoined && (isSharingLocation || isSimulating) && (
            <span className="badge badge-sharing">
              📡 Sharing GPS
            </span>
          )}
        </div>
      </header>

      {/* Screen 1: Join Room Setup Form */}
      {!isJoined ? (
        <div className="setup-overlay">
          <form className="setup-card" onSubmit={handleJoin}>
            <h2>Join Prototype Ride</h2>
            <p>Enter your rider details to connect to the live tracking map.</p>

            <div className="form-group">
              <label htmlFor="displayName">Your Name</label>
              <input
                id="displayName"
                type="text"
                className="form-input"
                placeholder="e.g. Alex, Rahul, Rider 1"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="vehicleType">Vehicle Type</label>
              <select
                id="vehicleType"
                className="form-select"
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
              >
                <option value="bike">🏍️ Motorcycle / Bike</option>
                <option value="car">🚗 Car / Four Wheeler</option>
                <option value="passenger">🧍 Passenger (No vehicle)</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="roomId">Ride Room Code</label>
              <input
                id="roomId"
                type="text"
                className="form-input"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Join Live Map
            </button>
          </form>
        </div>
      ) : (
        /* Screen 2: Real-time Live Tracking Map */
        <div className="tracking-view">
          {/* Floating Controls Banner */}
          <div className="floating-controls">
            <div className="floating-card">
              <div className="controls-actions">
                {/* Real GPS Toggle */}
                <button
                  className={`btn ${isSharingLocation ? 'btn-danger' : 'btn-success'}`}
                  onClick={() => {
                    if (isSimulating) setIsSimulating(false);
                    setIsSharingLocation(!isSharingLocation);
                  }}
                >
                  {isSharingLocation ? '⏹️ Stop GPS Sharing' : '📍 Share Real GPS'}
                </button>

                {/* Simulated GPS movement for testing */}
                <button
                  className={`btn ${isSimulating ? 'btn-danger' : 'btn-secondary'}`}
                  onClick={() => {
                    if (isSharingLocation) setIsSharingLocation(false);
                    setIsSimulating(!isSimulating);
                  }}
                  title="Simulates moving along a route every 4 seconds"
                >
                  {isSimulating ? '⏹️ Stop Simulation' : '🧪 Simulate Movement'}
                </button>
              </div>

              {geoError && (
                <div className="error-banner">
                  ⚠️ {geoError}
                </div>
              )}
            </div>
          </div>

          {/* Leaflet Map */}
          <div className="map-container-area">
            <Map
              members={memberList}
              currentUserId={userId}
              selfPosition={selfMember ? { lat: selfMember.lat, lng: selfMember.lng } : null}
            />
          </div>

          {/* Bottom Members Drawer */}
          <div className="members-drawer">
            <div className="members-drawer-header">
              <h3>Group Vehicles ({memberList.length})</h3>
            </div>
            <div className="members-grid">
              {memberList.length === 0 ? (
                <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                  No vehicle coordinates received yet. Tap "Share Real GPS" or "Simulate Movement".
                </span>
              ) : (
                memberList.map((m) => (
                  <div key={m.userId} className="member-chip">
                    <span className="member-chip-icon">
                      {m.vehicleType === 'bike' ? '🏍️' : m.vehicleType === 'car' ? '🚗' : '🧍'}
                    </span>
                    <span className="member-chip-name">
                      {m.displayName} {m.userId === userId && '(You)'}
                    </span>
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      {m.speed ? `${(m.speed * 3.6).toFixed(0)} km/h` : 'idle'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default App;
