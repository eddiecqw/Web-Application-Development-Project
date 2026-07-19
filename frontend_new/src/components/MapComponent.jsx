import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// 🛠️ Bug 修復：增加 onError 屬性，將錯誤傳回給用戶介面
function LocationTracker({ onPositionUpdate, onError }) {
  const map = useMap();
  const watchIdRef = useRef(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      onError('Geolocation is not supported by your browser');
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000, // 增加超時時間，手機 GPS 定位較慢
      maximumAge: 0,
    };

    const success = (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      onPositionUpdate([latitude, longitude], accuracy);
      map.flyTo([latitude, longitude], map.getZoom());
    };

    const error = (err) => {
      console.warn(`ERROR(${err.code}): ${err.message}`);
      onError(err.message === "User denied Geolocation" ? "Please allow location access in your browser settings." : err.message);
    };

    watchIdRef.current = navigator.geolocation.watchPosition(success, error, options);

    return () => {
      navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [map, onPositionUpdate, onError]);

  return null;
}

const MapComponent = () => {
  const [position, setPosition] = useState([22.3193, 114.1694]);
  const [accuracy, setAccuracy] = useState(null);
  const [error, setError] = useState(null);
  const [otherUsers, setOtherUsers] = useState({});
  const socketRef = useRef(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const username = storedUser ? JSON.parse(storedUser).email : 'unknown';

    const wsUrl = (window.location.protocol === 'https:' ? 'wss:' : 'ws:') +
                  '//' + window.location.host + '/ws' +
                  '?username=' + encodeURIComponent(username);

    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

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

    return () => socket.close();
  }, []);

  const handlePositionUpdate = (newPos, acc) => {
    setError(null); // 成功獲取位置則清除錯誤
    setPosition(newPos);
    setAccuracy(acc);

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'USER_POSITION_UPDATE',
          data: { latitude: newPos[0], longitude: newPos[1] },
        })
      );
    }
  };

  return (
    <div className="map-container" style={{ position: 'relative', height: '100vh', width: '100vw' }}>
      {/* 📱 手機端自適應：使用絕對定位與半透明背景，確保不會干擾地圖拖曳 */}
      <div style={{
        position: 'absolute', top: '10px', left: '10px', zIndex: 1000,
        backgroundColor: 'rgba(255, 255, 255, 0.9)', padding: '10px',
        borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
        maxWidth: 'calc(100% - 20px)'
      }}>
        <Link to="/" style={{ textDecoration: 'none', color: '#007bff', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
          ← Back to Chat
        </Link>
        <div style={{ fontSize: '14px' }}>
          {error ? (
            <div style={{ color: 'red', fontWeight: 'bold' }}>⚠️ {error}</div>
          ) : (
            <>
              <div>Lat: {position[0].toFixed(5)} | Lng: {position[1].toFixed(5)}</div>
              {accuracy && <div style={{ color: 'gray', fontSize: '12px' }}>Accuracy: {Math.round(accuracy)}m</div>}
            </>
          )}
        </div>
      </div>

      <MapContainer
        center={position}
        zoom={16}
        style={{ height: '100%', width: '100%', zIndex: 1 }}
        zoomControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={position} icon={DefaultIcon}>
          <Popup>Your Position</Popup>
        </Marker>
        {Object.entries(otherUsers).map(([username, coords]) => (
          <Marker key={username} position={coords} icon={DefaultIcon}>
            <Popup>{username}'s Location</Popup>
          </Marker>
        ))}
        <LocationTracker onPositionUpdate={handlePositionUpdate} onError={setError} />
      </MapContainer>
    </div>
  );
};

export default MapComponent;