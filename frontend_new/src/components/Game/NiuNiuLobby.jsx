import React, { useState, useEffect } from 'react';

export default function NiuNiuLobby({ onCreateRoom, onJoinRoom }) {
  const [roomIdInput, setRoomIdInput] = useState('');
  const [timeLimit, setTimeLimit] = useState(30);
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

  // 每 3 秒刷新一次房間列表
  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      textAlign: 'center', padding: '2rem', background: '#1a4f2c', 
      borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', 
      width: '100%', maxWidth: '800px', margin: '2rem auto', color: 'white', border: '4px solid #4a2e15',
      display: 'flex', flexDirection: 'column', gap: '2rem'
    }}>
      
      <div>
        <h2 style={{ color: '#ffd700', fontSize: '2rem', margin: '0 0 0.5rem 0', textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
          🃏 撲克鬥牛 (NiuNiu)
        </h2>
        <p style={{ color: '#ccc', margin: 0 }}>理牌、算牛、比大小，挑戰你的心算速度！</p>
      </div>
      
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'center' }}>
        
        {/* 左側：創建房間區塊 */}
        <div style={{ flex: '1 1 300px', background: 'rgba(255,255,255,0.1)', padding: '1.5rem', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '1.2rem' }}>建立新賭局</h3>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
            <label htmlFor="timeLimit">思考時間：</label>
            <select 
              id="timeLimit" value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))}
              style={{ padding: '8px', borderRadius: '4px', border: 'none', fontWeight: 'bold' }}
            >
              <option value={15}>15 秒 (極速)</option>
              <option value={30}>30 秒 (標準)</option>
              <option value={60}>60 秒 (新手)</option>
              <option value={999}>無限制</option>
            </select>
          </div>

          <button 
            onClick={() => onCreateRoom({ timeLimit })}
            style={{ width: '100%', padding: '12px', background: 'linear-gradient(to bottom, #fbc02d, #f57f17)', color: '#3e2723', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}
          >
            ➕ 創建房間
          </button>
        </div>

        {/* 右側：房間列表與加入區塊 */}
        <div style={{ flex: '1 1 300px', background: 'rgba(255,255,255,0.1)', padding: '1.5rem', borderRadius: '8px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '1.2rem' }}>加入好友賭局</h3>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <input
              type="text" placeholder="輸入 6 碼房間號" value={roomIdInput} onChange={(e) => setRoomIdInput(e.target.value)}
              style={{ flex: 1, padding: '10px', borderRadius: '6px', border: 'none', fontSize: '1rem', textAlign: 'center' }} maxLength={6}
            />
            <button 
              onClick={() => { if(roomIdInput.trim()) onJoinRoom(roomIdInput.trim()) }}
              style={{ padding: '10px 20px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              加入
            </button>
          </div>

          <div style={{ flex: 1, background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '10px', overflowY: 'auto', maxHeight: '200px' }}>
            {rooms.length === 0 ? (
              <div style={{ color: '#aaa', padding: '20px 0' }}>目前沒有活躍的賭局</div>
            ) : (
              rooms.map(room => (
                <div key={room.roomId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.9)', color: '#333', padding: '10px', borderRadius: '6px', marginBottom: '8px' }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 'bold', color: '#2e7d32' }}>房號: {room.roomId}</div>
                    <div style={{ fontSize: '0.85rem', color: '#666' }}>玩家: {room.playerCount} 人 | {room.timeLimit === 999 ? '無限時' : `${room.timeLimit}秒`}</div>
                  </div>
                  <button 
                    onClick={() => onJoinRoom(room.roomId)}
                    disabled={room.status !== 'waiting'}
                    style={{ padding: '6px 12px', background: room.status === 'waiting' ? '#4CAF50' : '#9e9e9e', color: 'white', border: 'none', borderRadius: '4px', cursor: room.status === 'waiting' ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}
                  >
                    {room.status === 'waiting' ? '加入' : '進行中'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}