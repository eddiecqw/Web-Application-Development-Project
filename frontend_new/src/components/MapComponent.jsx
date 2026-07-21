import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import useWebSocket from 'react-use-websocket'; // 🌟 引入共享 WebSocket 套件

const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

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
      timeout: 10000, 
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
  
  // 🌟 從 localStorage 取得 username
  const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
  const username = storedUser.email || 'unknown';

  // 🌟 使用與 ChatRoom 完全相同的 WebSocket 連線設定 (share: true 是關鍵)
  const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:53840/ws';
  const { sendJsonMessage, lastJsonMessage } = useWebSocket(WS_URL, {
    share: true,
    queryParams: { username },
  });

  // 🌟 處理接收到的地理位置訊息
  useEffect(() => {
    // 忽略陣列類型的系統訊息
    if (!lastJsonMessage || Array.isArray(lastJsonMessage)) return;

    const { type, data } = lastJsonMessage;

    if (type === 'USER_POSITION') {
      setOtherUsers((prev) => ({
        ...prev,
        [data.username]: [data.latitude, data.longitude],
      }));
    } else if (type === 'EXISTING_USER_POSITIONS') {
      const userMap = {};
      data.forEach((user) => {
        userMap[user.username] = [user.latitude, user.longitude];
      });
      setOtherUsers((prev) => ({ ...prev, ...userMap }));
    } else if (type === 'USER_LEFT_MAP') {
      // 🌟 當有人離開地圖時，移除他的大頭針
      setOtherUsers((prev) => {
        const newUsers = { ...prev };
        delete newUsers[data.username];
        return newUsers;
      });
    }
  }, [lastJsonMessage]);

  // 🌟 組件卸載(離開頁面)時，通知後端「我離開地圖了」
  useEffect(() => {
    return () => {
      sendJsonMessage({ type: 'USER_LEFT_MAP' });
    };
  }, [sendJsonMessage]);

  const handlePositionUpdate = (newPos, acc) => {
    setError(null);
    setPosition(newPos);
    setAccuracy(acc);

    // 🌟 透過共享的 WebSocket 發送位置
    sendJsonMessage({
      type: 'USER_POSITION_UPDATE',
      data: { latitude: newPos[0], longitude: newPos[1] },
    });
  };

  return (
    <div className="map-container" style={{ position: 'relative', height: '100vh', width: '100vw' }}>
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
        {Object.entries(otherUsers).map(([uname, coords]) => (
          <Marker key={uname} position={coords} icon={DefaultIcon}>
            <Popup>{uname}'s Location</Popup>
          </Marker>
        ))}
        <LocationTracker onPositionUpdate={handlePositionUpdate} onError={setError} />
      </MapContainer>
    </div>
  );
};

export default MapComponent;