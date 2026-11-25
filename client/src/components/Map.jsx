import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './Map.css';

/**
 * Creates custom Leaflet divIcon with vehicle-specific icons and name labels.
 * Viva note: divIcon avoids broken asset URLs and renders responsive SVGs with badges.
 */
function createVehicleIcon(member, isSelf = false) {
  const isBike = member.vehicleType === 'bike';
  const isCar = member.vehicleType === 'car';
  const vehicleClass = isBike ? 'marker-bike' : isCar ? 'marker-car' : 'marker-passenger';
  
  // Bike SVG or Car SVG
  const iconSvg = isBike
    ? `<svg class="marker-icon-svg" viewBox="0 0 24 24"><path d="M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm14-8.5c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zM10.8 10.5l2.4-3.8c.4-.6 1-1 1.8-1h4v2h-3.4l-1.6 2.6 1.8 1.8c.4.4.9.6 1.4.6h3.6v2h-3.6c-.9 0-1.8-.4-2.4-1l-1.7-1.7-1.9 3.2H8.8l2-4.2z"/></svg>`
    : `<svg class="marker-icon-svg" viewBox="0 0 24 24"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>`;

  const html = `
    <div class="custom-marker ${isSelf ? 'marker-self' : ''}">
      <div class="marker-label">${member.displayName || 'Rider'}${isSelf ? ' (You)' : ''}</div>
      <div class="marker-icon-wrapper ${vehicleClass}">
        ${iconSvg}
      </div>
    </div>
  `;

  return L.divIcon({
    className: 'custom-div-icon',
    html,
    iconSize: [40, 56],
    iconAnchor: [20, 56],
    popupAnchor: [0, -50]
  });
}

// Controller component to center map on user coordinates
function MapRecenterController({ center, autoFollow }) {
  const map = useMap();
  useEffect(() => {
    if (center && autoFollow) {
      map.panTo(center, { animate: true });
    }
  }, [center, autoFollow, map]);
  return null;
}

export function Map({ members = [], currentUserId, selfPosition }) {
  // Default fallback center (Bangalore / general coordinate or selfPosition)
  const defaultCenter = selfPosition
    ? [selfPosition.lat, selfPosition.lng]
    : [12.9716, 77.5946];

  const [autoFollow, setAutoFollow] = React.useState(true);

  return (
    <div className="map-wrapper">
      <MapContainer
        center={defaultCenter}
        zoom={16}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {selfPosition && (
          <MapRecenterController
            center={[selfPosition.lat, selfPosition.lng]}
            autoFollow={autoFollow}
          />
        )}

        {/* Render markers for each member in the room */}
        {members.map((member) => {
          if (!member.lat || !member.lng) return null;
          const isSelf = member.userId === currentUserId;

          return (
            <Marker
              key={member.userId}
              position={[member.lat, member.lng]}
              icon={createVehicleIcon(member, isSelf)}
            >
              <Popup>
                <div style={{ fontSize: '13px' }}>
                  <strong>{member.displayName}</strong> {isSelf && '(You)'}
                  <br />
                  <span>Vehicle: {member.vehicleType || 'Passenger'}</span>
                  <br />
                  {member.speed !== null && member.speed !== undefined && (
                    <span>Speed: {(member.speed * 3.6).toFixed(1)} km/h<br /></span>
                  )}
                  <span>Last update: {new Date(member.receivedAt || Date.now()).toLocaleTimeString()}</span>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {selfPosition && (
        <button
          className="map-recenter-btn"
          onClick={() => setAutoFollow(true)}
          title="Recenter map on your position"
        >
          🎯 Recenter
        </button>
      )}
    </div>
  );
}
