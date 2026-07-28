import React, { useState, useEffect } from 'react';

export default function LoveLetterLobby({ onCreateRoom, onJoinRoom, onBack, username }) {
  const [roomIdInput, setRoomIdInput] = useState('');
  
  // 暱稱狀態 (預設帶入 Email 前綴)
  const [nickname, setNickname] = useState(username ? username.split('@')[0] : '');
  
  // 情書專屬設定
  const [winTokens, setWinTokens] = useState(4);
  const [availableRooms, setAvailableRooms] = useState([]);

  // 📡 抓取情書房間資料
  const fetchRooms = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:53840';
      const response = await fetch(`${apiUrl}/api/loveletter-rooms`);
      const data = await response.json();
      if (data.success) {
        setAvailableRooms(data.rooms);
      }
    } catch (error) {
      console.error('無法獲取房間列表:', error);
    }
  };

  useEffect(() => {
    fetchRooms();
    const intervalId = setInterval(fetchRooms, 5000);
    return () => clearInterval(intervalId); 
  }, []);

  const handleCreate = () => {
    onCreateRoom({ winTokens, nickname: nickname.trim() || '無名氏' });
  };

  const handleJoin = (id) => {
    if (id.trim()) {
      onJoinRoom(id.trim(), nickname.trim() || '無名氏');
    }
  };

  return (
    <div style={{ 
      background: 'linear-gradient(145deg, #4a1515 0%, #1a0505 100%)', 
      padding: '2rem 25px 25px 25px', // 稍微縮小外框 padding
      borderRadius: '15px', 
      boxShadow: '0 15px 35px rgba(0,0,0,0.6)', 
      width: '100%', 
      maxWidth: '450px', // 稍微收窄，讓畫面更精緻
      textAlign: 'center', 
      color: '#f8fafc', 
      border: '1px solid #5a1a1a',
      position: 'relative', 
      margin: 'auto'
    }}>
      
      {/* 🔙 左上角返回按鈕 (極簡透明版) */}
      {onBack && (
        <button 
          onClick={onBack}
          style={{ 
            position: 'absolute', top: '15px', left: '15px', padding: '0', 
            background: 'transparent', color: '#fca5a5', border: 'none', 
            fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem',
            display: 'flex', alignItems: 'center', gap: '4px',
            transition: 'color 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.color = '#fff'}
          onMouseOut={(e) => e.currentTarget.style.color = '#fca5a5'}
        >
          ← 返回
        </button>
      )}

      {/* 標題區 */}
      <h1 style={{ color: '#ffd700', margin: '15px 0 5px 0', textShadow: '0 2px 4px rgba(0,0,0,0.8)', fontFamily: 'serif', fontSize: '1.8rem' }}>💌 情書 (Love Letter)</h1>
      <p style={{ color: '#d1d5db', fontSize: '0.85rem', marginBottom: '20px', fontStyle: 'italic' }}>推演、心機與運氣，將你的情書送達公主手中。</p>
      
      {/* 👤 暱稱設定區塊 */}
      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 15px', borderRadius: '10px', marginBottom: '15px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ color: '#fca5a5', fontSize: '0.85rem', marginBottom: '8px', fontWeight: 'bold', textAlign: 'left' }}>👤 你的宮廷稱號 (暱稱)：</div>
        <input 
          type="text" 
          value={nickname} 
          onChange={(e) => setNickname(e.target.value)}
          placeholder="輸入名稱..."
          style={{ 
            width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #7f1d1d', 
            background: 'rgba(0,0,0,0.4)', color: '#fcd34d', fontWeight: 'bold', 
            textAlign: 'center', boxSizing: 'border-box', outline: 'none' 
          }} 
        />
      </div>

      {/* 📜 創建區塊 */}
      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px', marginBottom: '15px', textAlign: 'left', border: '1px solid rgba(255,255,255,0.1)' }}>
        <h3 style={{ margin: '0 0 12px 0', color: '#e2e8f0', fontSize: '1.1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>📜 展開新對局</h3>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <label style={{ fontWeight: 'bold', color: '#fca5a5', fontSize: '0.9rem' }}>🏆 勝利條件：</label>
          <select value={winTokens} onChange={e => setWinTokens(Number(e.target.value))} style={{ padding: '4px 8px', borderRadius: '4px', background: '#3f1111', color: 'white', border: '1px solid #7f1d1d', fontWeight: 'bold', fontSize: '0.9rem' }}>
            <option value={3}>3 個 (快速局)</option>
            <option value={4}>4 個 (標準局)</option>
            <option value={5}>5 個 (長線局)</option>
          </select>
        </div>
        
        <button onClick={handleCreate} style={{ width: '100%', padding: '10px', background: 'linear-gradient(to bottom, #d4af37, #aa8529)', color: '#2a1a00', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem', boxShadow: '0 4px 8px rgba(0,0,0,0.4)', transition: 'transform 0.1s' }} onMouseDown={e => e.target.style.transform = 'scale(0.98)'} onMouseUp={e => e.target.style.transform = 'scale(1)'}>
          ➕ 建立宮廷房間
        </button>
      </div>

      {/* 🚪 加入房間區塊 */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '20px' }}>
        <input 
          type="text" 
          placeholder="輸入 6 碼房間號..." 
          value={roomIdInput} 
          onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())} 
          style={{ padding: '10px', borderRadius: '8px', border: '1px solid #7f1d1d', flex: 1, textTransform: 'uppercase', background: 'rgba(0,0,0,0.3)', color: 'white', outline: 'none' }} 
        />
        <button onClick={() => handleJoin(roomIdInput)} style={{ padding: '10px 20px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
          加入
        </button>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '15px 0' }}></div>

      {/* 🏰 房間列表 */}
      <div style={{ textAlign: 'left' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: '1.1rem' }}>🏰 尋找宮廷對局</h3>
          <button onClick={fetchRooms} style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: '0.85rem' }}>🔄 刷新</button>
        </div>
        
        {availableRooms.length === 0 ? (
          <p style={{ color: '#9ca3af', textAlign: 'center', background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px', fontSize: '0.9rem' }}>宮廷內目前空無一人，發起邀請吧！</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '5px' }}>
            {availableRooms.map(room => (
              <div key={room.roomId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.08)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div style={{ fontWeight: 'bold', color: '#fca5a5', fontSize: '1rem' }}>房間: {room.roomId}</div>
                  <div style={{ fontSize: '0.8rem', color: '#d1d5db', marginTop: '4px' }}>目標 {room.winTokens} 個指示物 | {room.playerCount} 人</div>
                </div>
                <button 
                  onClick={() => handleJoin(room.roomId)} 
                  disabled={room.status !== 'waiting'}
                  style={{ padding: '6px 14px', background: room.status === 'waiting' ? '#b91c1c' : '#4b5563', color: 'white', border: 'none', borderRadius: '6px', cursor: room.status === 'waiting' ? 'pointer' : 'not-allowed', fontWeight: 'bold', fontSize: '0.9rem' }}
                >
                  {room.status === 'waiting' ? '加入' : '進行中'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      
    </div>
  );
}