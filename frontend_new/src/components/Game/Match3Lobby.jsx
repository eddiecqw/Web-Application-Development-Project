import React, { useState, useEffect } from 'react';

export default function Match3Lobby({ onCreateRoom, onJoinRoom, onBack, username }) {
  const [joinId, setJoinId] = useState('');
  const [nickname, setNickname] = useState(username ? username.split('@')[0] : '');
  const [availableRooms, setAvailableRooms] = useState([]);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const baseUrl = (import.meta.env.VITE_WS_URL || 'ws://localhost:53840/ws').replace('ws://', 'http://').replace('wss://', 'https://').replace('/ws', '');
        const response = await fetch(`${baseUrl}/api/match3-rooms`);
        const data = await response.json();
        if (data.success) setAvailableRooms(data.rooms);
      } catch (error) {}
    };
    fetchRooms();
    const interval = setInterval(fetchRooms, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(15px)', padding: '2rem 25px', borderRadius: '20px', boxShadow: '0 15px 35px rgba(0,0,0,0.2)', width: '100%', maxWidth: '400px', textAlign: 'center', color: '#1e293b', border: '2px solid rgba(255,255,255,0.5)', position: 'relative' }}>
      
      {onBack && <button onClick={onBack} style={{ position: 'absolute', top: '15px', left: '15px', background: 'rgba(255,255,255,0.4)', color: '#0f766e', border: 'none', padding: '6px 12px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>← 返回</button>}

      <h1 style={{ color: '#fff', textShadow: '0 2px 5px rgba(0,0,0,0.3)', margin: '20px 0 10px 0' }}>🍉 夏日消消樂</h1>
      <p style={{ color: '#f8fafc', fontWeight: 'bold', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>準備好挑戰最高分了嗎？</p>

      <div style={{ background: 'rgba(255,255,255,0.5)', padding: '15px', borderRadius: '15px', marginBottom: '15px' }}>
        <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="你的暱稱..." style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 'bold', outline: 'none' }} />
        <button onClick={() => onCreateRoom(nickname || '遊客')} style={{ width: '100%', padding: '12px', marginTop: '10px', background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem', boxShadow: '0 4px 10px rgba(14, 165, 233, 0.4)' }}>
          ➕ 建立房間
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
        <input type="text" placeholder="輸入房號" value={joinId} onChange={(e) => setJoinId(e.target.value.toUpperCase())} style={{ padding: '10px', borderRadius: '10px', border: 'none', flex: 1, textAlign: 'center', fontWeight: 'bold', outline: 'none' }} />
        <button onClick={() => joinId && onJoinRoom(joinId, nickname || '遊客')} style={{ padding: '10px 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>加入</button>
      </div>

      <div style={{ textAlign: 'left', background: 'rgba(255,255,255,0.4)', padding: '10px', borderRadius: '15px' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#0f172a' }}>🏠 活躍房間</h4>
        {availableRooms.length === 0 ? <div style={{ fontSize: '0.85rem', color: '#475569', textAlign: 'center' }}>目前沒有房間</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto' }}>
            {availableRooms.map(room => (
              <div key={room.roomId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '8px 12px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <span style={{ fontWeight: 'bold', color: '#0284c7' }}>房號: {room.roomId}</span>
                <button onClick={() => onJoinRoom(room.roomId, nickname || '遊客')} style={{ padding: '6px 12px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>加入</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}