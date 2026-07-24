import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import {Cursor} from './components/Cursor';
import { Login } from './components/Login';
import Register from './components/Register';
import DrawGuessPage from './pages/DrawGuessPage';
import NiuNiuPage from './pages/NiuNiuPage';
import BlackjackPage from './pages/BlackjackPage';
import { Home } from './components/ChatRoom'; 
import MapComponent from './components/MapComponent';
import './App.css';

const App = () => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  // ✨ 新增狀態：控制遊客橫幅是否顯示
  const [showGuestBanner, setShowGuestBanner] = useState(true);

  const handleGuestUpgrade = () => {
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/register'; 
  };

  return (
    <BrowserRouter>
      {/* ✨ 改良版：低調、較窄、且帶有關閉按鈕的橫幅 */}
      {user?.isGuest && showGuestBanner && (
        <div style={{
          background: 'rgba(0, 0, 0, 0.75)', // 半透明低調黑
          backdropFilter: 'blur(4px)',
          color: '#eee', 
          textAlign: 'center', 
          padding: '6px 40px 6px 15px', // 右側留 40px 的空間給關閉按鈕
          position: 'fixed', top: 0, left: 0, width: '100%', zIndex: 9999,
          fontSize: '0.85rem', display: 'flex', justifyContent: 'center', 
          alignItems: 'center', gap: '10px', flexWrap: 'wrap',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          <span>⚠️ 遊客模式 ({user.email})，退出後記錄將清除。</span>
          <button
            onClick={handleGuestUpgrade}
            style={{ 
              padding: '4px 10px', background: '#ff9800', color: 'white', 
              border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer',
              fontSize: '0.8rem', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
          >
            註冊保留帳號
          </button>
          
          {/* ✨ 關閉按鈕 */}
          <button
            onClick={() => setShowGuestBanner(false)}
            style={{
              position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
              background: 'transparent', border: 'none', color: '#999', 
              fontSize: '1.2rem', cursor: 'pointer', padding: '0 5px',
              transition: 'color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.color = 'white'}
            onMouseOut={(e) => e.target.style.color = '#999'}
          >
            ✖
          </button>
        </div>
      )}

      {/* ✨ 橫幅關閉時，動態將 paddingTop 歸零，並加上平滑過渡動畫 */}
      <div style={{ paddingTop: (user?.isGuest && showGuestBanner) ? '38px' : '0', minHeight: '100vh', transition: 'padding-top 0.3s ease-in-out' }}>
        <Routes>
          <Route 
            path="/login" 
            element={!user ? <Login onLogin={setUser} /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="/register" 
            element={!user ? <Register /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="/" 
            element={user ? <Home username={user.email} onLogout={() => setUser(null)} /> : <Navigate to="/login" replace />} 
          />
          <Route element={user ? <NiuNiuPage user={user} /> : <Navigate to="/login" />} path="/niuniu" />
          <Route 
            path="/blackjack" 
            element={user ? <BlackjackPage user={user} /> : <Navigate to="/login" replace />} 
          />
          <Route 
            path="/map" 
            element={user ? <MapComponent /> : <Navigate to="/login" replace />} 
          />    
          <Route 
            path="/draw-guess" 
            element={user ? <DrawGuessPage user={user} /> : <Navigate to="/login" replace />} 
          />  
        </Routes>
      </div>
    </BrowserRouter>
  );
};

export default App;