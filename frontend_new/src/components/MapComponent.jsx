import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import useWebSocket from 'react-use-websocket';

// ✨ 客製化 HTML Marker 生成器
const createCustomMarker = (name, isMe) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div style="
        background: ${isMe ? 'linear-gradient(135deg, #10b981, #047857)' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)'};
        color: white;
        padding: 6px 14px;
        border-radius: 20px;
        font-weight: bold;
        font-size: 0.85rem;
        box-shadow: 0 4px 10px rgba(0,0,0,0.4);
        border: 2px solid ${isMe ? '#a7f3d0' : '#bfdbfe'};
        white-space: nowrap;
        transform: translate(-50%, -100%);
        position: relative;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
      ">
        ${isMe ? '⭐ ' : '👤 '}${name.split('@')[0]}
        <div style="
          position: absolute;
          bottom: -6px;
          left: 50%;
          transform: translateX(-50%);
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 6px solid ${isMe ? '#047857' : '#1d4ed8'};
        "></div>
      </div>
    `,
    iconSize: [0, 0], 
    iconAnchor: [0, 0], 
  });
};

// ✨ 右下角「定位回到自己」的按鈕
function MapController({ position }) {
  const map = useMap();
  const centerToMe = () => {
    if (position) {
      map.flyTo(position, 16, { duration: 1.5 });
    }
  };

  return (
    <button 
      onClick={centerToMe}
      style={{
        position: 'absolute', bottom: '30px', right: '20px', zIndex: 1000,
        width: '50px', height: '50px', borderRadius: '25px',
        backgroundColor: 'rgba(255, 255, 255, 0.9)', border: 'none',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
        fontSize: '1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center',
        cursor: 'pointer', transition: 'transform 0.2s'
      }}
      onMouseOver={(e) => e.target.style.transform = 'scale(1.1)'}
      onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
    >
      📍
    </button>
  );
}

// ✨ 定位追蹤器
function LocationTracker({ onPositionUpdate, onError }) {
  const map = useMap();
  const watchIdRef = useRef(null);
  const hasCenteredRef = useRef(false);

  useEffect(() => {
    if (!navigator.geolocation) {
      onError('瀏覽器不支援地理位置功能');
      return;
    }

    const options = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

    const success = (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      onPositionUpdate([latitude, longitude], accuracy);
      
      if (!hasCenteredRef.current) {
        map.flyTo([latitude, longitude], 16);
        hasCenteredRef.current = true;
      }
    };

    const error = (err) => {
      onError(err.message === "User denied Geolocation" ? "請在瀏覽器設定中允許取用位置資訊" : "定位失敗，請確認 GPS 已開啟");
    };

    watchIdRef.current = navigator.geolocation.watchPosition(success, error, options);
    return () => navigator.geolocation.clearWatch(watchIdRef.current);
  }, [map, onPositionUpdate, onError]);

  return null;
}

const MapComponent = () => {
  const navigate = useNavigate();
  const [position, setPosition] = useState([22.3193, 114.1694]);
  const [accuracy, setAccuracy] = useState(null);
  const [error, setError] = useState(null);
  const [otherUsers, setOtherUsers] = useState({});
  
  // ✨ 1. 新增：主題狀態 (預設為 false = 明亮模式)
  const [isDarkMode, setIsDarkMode] = useState(false);

  const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
  const username = storedUser.email || 'unknown';
  const nickname = storedUser.nickname || username.split('@')[0];

  const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:53840/ws';
  const { sendJsonMessage, lastJsonMessage } = useWebSocket(WS_URL, {
    share: true,
    queryParams: { username },
  });

  useEffect(() => {
    if (!lastJsonMessage || Array.isArray(lastJsonMessage)) return;

    const { type, data } = lastJsonMessage;

    if (type === 'USER_POSITION') {
      setOtherUsers((prev) => ({ ...prev, [data.username]: [data.latitude, data.longitude] }));
    } else if (type === 'EXISTING_USER_POSITIONS') {
      const userMap = {};
      data.forEach((user) => { userMap[user.username] = [user.latitude, user.longitude]; });
      
      // 不要用 prev 保留舊資料！直接「完整替換」為伺服器給的最準確名單
      // 這樣只要 GPS 一更新，所有卡住的幽靈玩家就會瞬間被清空！
      setOtherUsers(userMap);
      
    } else if (type === 'USER_LEFT_MAP') {
      setOtherUsers((prev) => {
        const newUsers = { ...prev };
        delete newUsers[data.username];
        return newUsers;
      });
    }
  }, [lastJsonMessage]);

  useEffect(() => {
    return () => sendJsonMessage({ type: 'USER_LEFT_MAP' });
  }, [sendJsonMessage]);

  const handlePositionUpdate = (newPos, acc) => {
    setError(null);
    setPosition(newPos);
    setAccuracy(acc);

    sendJsonMessage({
      type: 'USER_POSITION_UPDATE',
      data: { latitude: newPos[0], longitude: newPos[1] },
    });
  };

  // ✨ 定義明暗主題的配色變數
  const themeColors = isDarkMode ? {
    bg: 'rgba(15, 23, 42, 0.85)',
    text: '#f8fafc',
    highlight: '#38bdf8',
    coordText: '#cbd5e1',
    playerText: '#a7f3d0',
    border: 'rgba(255,255,255,0.1)'
  } : {
    bg: 'rgba(255, 255, 255, 0.9)',
    text: '#1e293b',
    highlight: '#0284c7',
    coordText: '#475569',
    playerText: '#059669',
    border: 'rgba(0,0,0,0.1)'
  };

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100vw', backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc' }}>
      
      {/* 資訊面板 (根據主題動態變化) */}
      <div style={{
        position: 'absolute', top: '15px', left: '15px', zIndex: 1000,
        background: themeColors.bg, backdropFilter: 'blur(10px)', 
        padding: '15px 20px', borderRadius: '15px', border: `1px solid ${themeColors.border}`,
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)', color: themeColors.text,
        maxWidth: 'calc(100% - 100px)', /* 預留右上角按鈕的空間 */
        display: 'flex', flexDirection: 'column', gap: '10px',
        transition: 'all 0.3s ease'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', color: themeColors.highlight }}>🌏 探索地圖</h2>
          <button 
            onClick={() => navigate('/')} 
            style={{ padding: '6px 12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            ← 返回大廳
          </button>
        </div>
        
        <div style={{ fontSize: '0.9rem', color: themeColors.coordText }}>
          {error ? (
            <div style={{ color: '#ef4444', fontWeight: 'bold' }}>⚠️ {error}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div>📡 座標：{position[0].toFixed(4)}, {position[1].toFixed(4)}</div>
              {accuracy && <div style={{ opacity: 0.8, fontSize: '0.8rem' }}>精確度誤差：±{Math.round(accuracy)} 公尺</div>}
              <div style={{ color: themeColors.playerText, fontWeight: 'bold', marginTop: '4px' }}>👥 附近玩家：{Object.keys(otherUsers).length} 人</div>
            </div>
          )}
        </div>
      </div>

      {/* ✨ 2. 新增：右上角主題切換按鈕 (半透明線條 SVG 風格) */}
      <button 
        onClick={() => setIsDarkMode(!isDarkMode)}
        style={{
          position: 'absolute', top: '15px', right: '15px', zIndex: 1000,
          background: 'transparent', border: 'none', padding: 0,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          cursor: 'pointer', color: isDarkMode ? '#fcd34d' : '#f59e0b',
          transition: 'transform 0.3s ease, opacity 0.3s ease',
          /* 為圖示加上一點陰影，確保在任何底圖上都能看清楚 */
          filter: isDarkMode ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' : 'drop-shadow(0 2px 5px rgba(0,0,0,0.3))',
          opacity: 0.85 /* 預設半透明狀態 */
        }}
        onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.15)'; e.currentTarget.style.opacity = '1'; }}
        onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.opacity = '0.85'; }}
      >
        {isDarkMode ? (
          // 月亮 SVG (放大至 36x36)
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        ) : (
          // 太陽 SVG (放大至 36x36)
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
        )}
      </button>

      <MapContainer
        center={position}
        zoom={16}
        style={{ height: '100%', width: '100%', zIndex: 1 }}
        zoomControl={false}
      >
        {/* ✨ 3. 根據主題動態切換底圖 (加上 key 強制 Leaflet 重新渲染圖層) */}
        <TileLayer 
          key={isDarkMode ? 'dark' : 'light'}
          url={isDarkMode 
            ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" 
            : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          } 
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        />
        
        <Marker position={position} icon={createCustomMarker(nickname, true)} />
        
        {Object.entries(otherUsers).map(([uname, coords]) => (
          <Marker key={uname} position={coords} icon={createCustomMarker(uname, false)} />
        ))}
        
        <LocationTracker onPositionUpdate={handlePositionUpdate} onError={setError} />
        <MapController position={position} />
      </MapContainer>
    </div>
  );
};

export default MapComponent;