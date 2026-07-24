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
  // 網頁載入的第一瞬間，就去讀取 localStorage，確保重整不會登出
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  // ✨ 遊客點擊註冊的處理邏輯：清除遊客資料並導向註冊頁面
  const handleGuestUpgrade = () => {
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/register'; 
  };

  return (
    <BrowserRouter>
      {/* ✨ 遊客模式醒目提示橫幅 (Fixed在畫面最頂端) */}
      {user?.isGuest && (
        <div style={{
          background: 'linear-gradient(to right, #00ccff, #36f485)',
          color: 'white', textAlign: 'center', padding: '3px 15px',
          position: 'fixed', top: 0, left: 0, width: '100%', zIndex: 9999,
          boxShadow: '0 2px 10px rgba(0,0,0,0.2)', fontWeight: 'bold', fontSize: '0.95rem',
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1px', flexWrap: 'wrap'
        }}>
          <span>⚠️ 提醒：您目前使用遊客模式 ({user.email})，退出後籌碼與記錄將會永遠消失。</span>
          <button
            onClick={handleGuestUpgrade}
            style={{ 
              padding: '3px 10px', background: 'white', color: '#f44336', 
              border: 'none', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
          >
            👉 立即註冊以保留帳號
          </button>
        </div>
      )}

      {/* ✨ 為了不讓 Fixed 橫幅擋住原本的畫面，當遊客模式時將整個路由容器往下推 */}
      <div style={{ paddingTop: user?.isGuest ? '50px' : '0', minHeight: '100vh' }}>
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