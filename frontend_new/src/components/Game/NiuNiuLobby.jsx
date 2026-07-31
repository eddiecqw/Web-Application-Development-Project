import React, { useState, useEffect } from 'react';

export default function NiuNiuLobby({ onCreateRoom, onJoinRoom, onBack, username }) {
  const [roomIdInput, setRoomIdInput] = useState('');
  
  // 👤 暱稱狀態 (預設帶入 Email 前綴)
  const [nickname, setNickname] = useState(username ? username.split('@')[0] : '');
  
  const [timeLimit, setTimeLimit] = useState(30);
  const [rotateDealer, setRotateDealer] = useState(false);
  const [rooms, setRooms] = useState([]);

  const fetchRooms = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:53840';
      const res = await fetch(`${baseUrl}/api/niuniu-rooms`);
      const data = await res.json();
      if (data.success) {
        setRooms(data.rooms);
      }
    } catch (error) {
      console.error('獲取房間失敗:', error);
    }
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleCreate = () => {
    onCreateRoom({ 
      timeLimit, 
      rotateDealer, 
      nickname: nickname.trim() || '無名氏' 
    });
  };

  const handleJoin = (id) => {
    if (id.trim()) {
      onJoinRoom(id.trim(), nickname.trim() || '無名氏');
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(145deg, #1b4d2e 0%, #0d2617 100%)', 
      padding: '2rem 25px 25px 25px', 
      borderRadius: '15px', 
      boxShadow: '0 15px 35px rgba(0,0,0,0.6)', 
      width: '100%', 
      maxWidth: '450px', 
      margin: 'auto', 
      color: '#f8fafc', 
      border: '1px solid #2e6930',
      display: 'flex', 
      flexDirection: 'column', 
      position: 'relative'
    }}>
      
      {/* 🔙 左上角返回按鈕 */}
      {onBack && (
        <button 
          onClick={onBack}
          style={{ 
            position: 'absolute', top: '15px', left: '15px', padding: '0', 
            background: 'transparent', color: '#a7f3d0', border: 'none', 
            fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem',
            display: 'flex', alignItems: 'center', gap: '4px',
            transition: 'color 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.color = '#fff'}
          onMouseOut={(e) => e.currentTarget.style.color = '#a7f3d0'}
        >
          ← 返回
        </button>
      )}

      {/* 標題區 */}
      <h1 style={{ color: '#ffd700', margin: '15px 0 5px 0', textShadow: '0 2px 4px rgba(0,0,0,0.8)', fontSize: '1.8rem' }}>
        🃏 撲克鬥牛 (NiuNiu)
      </h1>
      <p style={{ color: '#d1d5db', fontSize: '0.85rem', marginBottom: '20px', fontStyle: 'italic' }}>理牌、算牛、比大小，挑戰你的心算速度！</p>
      
      {/* 👤 暱稱設定區塊 */}
      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 15px', borderRadius: '10px', marginBottom: '15px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ color: '#a7f3d0', fontSize: '0.85rem', marginBottom: '8px', fontWeight: 'bold', textAlign: 'left' }}>👤 你的牌桌稱號 (暱稱)：</div>
        <input 
          type="text" 
          value={nickname} 
          onChange={(e) => setNickname(e.target.value)}
          placeholder="輸入名稱..."
          style={{ 
            width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #14532d', 
            background: 'rgba(0,0,0,0.4)', color: '#fcd34d', fontWeight: 'bold', 
            textAlign: 'center', boxSizing: 'border-box', outline: 'none' 
          }} 
        />
      </div>

      {/* ⚙️ 創建房間區塊 */}
      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px', marginBottom: '15px', textAlign: 'left', border: '1px solid rgba(255,255,255,0.1)' }}>
        <h3 style={{ margin: '0 0 12px 0', color: '#e2e8f0', fontSize: '1.1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>⚙️ 建立新賭局</h3>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <label htmlFor="timeLimit" style={{ fontWeight: 'bold', color: '#a7f3d0', fontSize: '0.9rem' }}>⏱️ 思考時間：</label>
          <select 
            id="timeLimit" value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))}
            style={{ padding: '4px 8px', borderRadius: '4px', background: '#064e3b', color: 'white', border: '1px solid #14532d', fontWeight: 'bold', fontSize: '0.9rem' }}
          >
            <option value={15}>15 秒 (極速)</option>
            <option value={30}>30 秒 (標準)</option>
            <option value={60}>60 秒 (新手)</option>
            <option value={999}>無限制</option>
          </select>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <label style={{ fontWeight: 'bold', color: '#a7f3d0', fontSize: '0.9rem' }}>👑 莊家模式：</label>
          <select 
            value={rotateDealer} 
            onChange={e => setRotateDealer(e.target.value === 'true')} 
            style={{ padding: '4px 8px', borderRadius: '4px', background: '#064e3b', color: 'white', border: '1px solid #14532d', fontWeight: 'bold', fontSize: '0.9rem' }}
          >
            <option value={false}>房主固定連莊</option>
            <option value={true}>玩家輪流做莊 (最少2人)</option>
          </select>
        </div>

        <button 
          onClick={handleCreate}
          style={{ width: '100%', padding: '10px', background: 'linear-gradient(to bottom, #fbc02d, #f57f17)', color: '#3e2723', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 8px rgba(0,0,0,0.4)' }}
        >
          ➕ 創建房間
        </button>
      </div>

      {/* 🚪 加入房間區塊 */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '20px' }}>
        <input
          type="text" placeholder="輸入 6 碼房間號..." value={roomIdInput} onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
          style={{ padding: '10px', borderRadius: '8px', border: '1px solid #14532d', flex: 1, textTransform: 'uppercase', background: 'rgba(0,0,0,0.3)', color: 'white', outline: 'none' }} maxLength={6}
        />
        <button 
          onClick={() => handleJoin(roomIdInput)}
          style={{ padding: '10px 20px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}
        >
          加入
        </button>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '15px 0' }}></div>

      {/* 🏠 房間列表區塊 */}
      <div style={{ textAlign: 'left' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: '1.1rem' }}>🏠 活躍賭局</h3>
          <button onClick={fetchRooms} style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: '0.85rem' }}>🔄 刷新</button>
        </div>
        
        {rooms.length === 0 ? (
          <div style={{ color: '#9ca3af', textAlign: 'center', background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px', fontSize: '0.9rem' }}>目前沒有活躍的賭局</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '5px' }}>
            {rooms.map(room => (
              <div key={room.roomId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.08)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div style={{ fontWeight: 'bold', color: '#a7f3d0', fontSize: '1rem' }}>房號: {room.roomId}</div>
                  <div style={{ fontSize: '0.8rem', color: '#d1d5db', marginTop: '4px' }}>玩家: {room.playerCount} 人 | {room.timeLimit === 999 ? '無限時' : `${room.timeLimit}秒`}</div>
                </div>
                <button 
                  onClick={() => handleJoin(room.roomId)}
                  disabled={room.status !== 'waiting'}
                  style={{ padding: '6px 14px', background: room.status === 'waiting' ? '#2e7d32' : '#4b5563', color: 'white', border: 'none', borderRadius: '6px', cursor: room.status === 'waiting' ? 'pointer' : 'not-allowed', fontWeight: 'bold', fontSize: '0.9rem' }}
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