import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// 修復 Leaflet Marker 圖標
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// ✅ 自訂地理位置追蹤組件
function LocationTracker({ onPositionUpdate }) {
  const map = useMap();
  const watchIdRef = useRef(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      console.error('Geolocation not supported');
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0,
    };

    const success = (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      onPositionUpdate([latitude, longitude], accuracy);
      map.flyTo([latitude, longitude], map.getZoom());
    };

    const error = (err) => {
      console.warn(`ERROR(${err.code}): ${err.message}`);
    };

    watchIdRef.current = navigator.geolocation.watchPosition(success, error, options);

    return () => {
      navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [map, onPositionUpdate]);

  return null;
}

// ✅ 主組件
const MapComponent = () => {
  const [position, setPosition] = useState([22.3193, 114.1694]);
  const [accuracy, setAccuracy] = useState(null);
  const [error, setError] = useState(null);
  const [otherUsers, setOtherUsers] = useState({});

  const socketRef = useRef(null);

  useEffect(() => {
    const username = localStorage.getItem('user');
    const socket = new WebSocket(`ws://localhost:53840?username=${username}`);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log('✅ WebSocket connected');
    };

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (Array.isArray(msg)) return; 

      const { type, data } = msg;

      if (type === 'USER_POSITION') {
        setOtherUsers((prev) => ({
          ...prev,
          [data.username]: [data.latitude, data.longitude],
        }));
      }
      if (type === 'EXISTING_USER_POSITIONS') {
        const userMap = {};
        data.forEach((user) => {
          userMap[user.username] = [user.latitude, user.longitude];
        });
        setOtherUsers((prev) => ({ ...prev, ...userMap }));
      }
    };

    socket.onclose = () => {
      console.log('❌ WebSocket disconnected');
    };

    return () => socket.close();
  }, []);

  const handlePositionUpdate = (newPos, acc) => {
    setPosition(newPos);
    setAccuracy(acc);

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'USER_POSITION_UPDATE',
          data: {
            latitude: newPos[0],
            longitude: newPos[1],
          },
        })
      );
    }
  };

  return (
    <div className="map-container">
      <div className="map-controls">
        <Link to="/" className="control-button">
          ← Back to Chat
        </Link>
        <div className="position-info">
          {error ? (
            <div className="error-message">⚠️ {error}</div>
          ) : (
            <>
              <div>Latitude: {position[0].toFixed(6)}</div>
              <div>Longitude: {position[1].toFixed(6)}</div>
              {accuracy && <div>Accuracy: {Math.round(accuracy)} meters</div>}
            </>
          )}
        </div>
      </div>

      <MapContainer
        center={position}
        zoom={16}
        style={{ height: 'calc(100vh - 60px)', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* 自己的位置 */}
        <Marker position={position} icon={DefaultIcon}>
          <Popup>
            Your Position <br />
            {position[0].toFixed(6)}, {position[1].toFixed(6)}
          </Popup>
        </Marker>

        {/* 其他用戶 */}
        {Object.entries(otherUsers).map(([username, coords]) => (
          <Marker key={username} position={coords} icon={DefaultIcon}>
            <Popup>
              {username}'s Location <br />
              {coords[0].toFixed(6)}, {coords[1].toFixed(6)}
            </Popup>
          </Marker>
        ))}

        <LocationTracker onPositionUpdate={handlePositionUpdate} />
      </MapContainer>
    </div>
  );
};

export default MapComponent;