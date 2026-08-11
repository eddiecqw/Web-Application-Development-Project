import React, { useState, useEffect } from 'react';

export default function GameLobby({ onCreateRoom, onJoinRoom }) {
  const [roomIdInput, setRoomIdInput] = useState('');
  const [hasTimeLimit, setHasTimeLimit] = useState(false);
  const [timeLimit, setTimeLimit] = useState(60);
  const [availableRooms, setAvailableRooms] = useState([]);

  const fetchRooms = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:53840';
      const response = await fetch(`${apiUrl}/api/rooms`);
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

  return (
    // ✨ 只保留卡片本身，最大寬度 450px，達到完美的手機自適應
    <div style={{ width: '100%', maxWidth: '450px', background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)', borderRadius: '24px', padding: '30px 20px', boxShadow: '0 15px 35px rgba(253, 160, 133, 0.4)', textAlign: 'center', boxSizing: 'border-box' }}>
      
      <h2 style={{ color: '#ea580c', margin: '0 0 20px 0', fontSize: '1.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', textShadow: '1px 1px 2px rgba(0,0,0,0.1)' }}>
        <span style={{ fontSize: '2.2rem' }}>🎨</span> 你畫我猜
      </h2>
      
      {/* ⚙️ 創建房間設定 */}
      <div style={{ background: '#fffbeb', padding: '20px', borderRadius: '16px', textAlign: 'left', border: '1px solid #fde68a', marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 15px 0', color: '#b45309', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>☀️ 創建專屬房間</h4>
        
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: '#78350f', fontWeight: 'bold' }}>
          <input 
            type="checkbox" 
            checked={hasTimeLimit} 
            onChange={(e) => setHasTimeLimit(e.target.checked)} 
            style={{ width: '18px', height: '18px', accentColor: '#f59e0b' }}
          />
          開啟答題時間限制
        </label>
        
        {hasTimeLimit && (
          <div style={{ marginTop: '15px', display: 'flex', alignItems: 'center', gap: '10px', color: '#78350f', fontWeight: 'bold' }}>
            <span>每題時間 (秒):</span>
            <input 
              type="number" 
              min="10" max="300"
              value={timeLimit}
              onChange={(e) => setTimeLimit(Number(e.target.value))}
              style={{ width: '70px', padding: '6px 10px', borderRadius: '8px', border: '1px solid #fcd34d', outline: 'none', background: '#fff' }}
            />
          </div>
        )}

        <button 
          style={{ width: '100%', marginTop: '20px', padding: '12px', borderRadius: '12px', background: 'linear-gradient(to right, #f59e0b, #ea580c)', color: 'white', fontWeight: 'bold', fontSize: '1.1rem', border: 'none', cursor: 'pointer', boxShadow: '0 4px 10px rgba(234, 88, 12, 0.3)', transition: 'transform 0.1s' }}
          onMouseDown={e => e.currentTarget.style.transform='scale(0.97)'}
          onMouseUp={e => e.currentTarget.style.transform='scale(1)'}
          onClick={() => onCreateRoom({ hasTimeLimit, timeLimit })}
        >
          🚀 創建房間
        </button>
      </div>

      {/* 📋 公開房間列表 */}
      <div style={{ textAlign: 'left', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h4 style={{ margin: 0, color: '#b45309', fontSize: '1.1rem' }}>🌐 尋找派對</h4>
          <button onClick={fetchRooms} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', fontWeight: 'bold', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
            🔄 刷新
          </button>
        </div>
        
        {availableRooms.length === 0 ? (
          <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', textAlign: 'center', color: '#94a3b8', border: '1px dashed #cbd5e1', fontSize: '0.9rem' }}>
            目前沒有活躍的房間<br/>自己當主揪創建一個吧！
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '220px', overflowY: 'auto', paddingRight: '5px' }}>
            {availableRooms.map((room) => (
              <div key={room.roomId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', background: '#fff', border: '1px solid #fed7aa', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                <div>
                  <strong style={{ fontSize: '1.1rem', color: '#ea580c' }}>房間 {room.roomId}</strong>
                  <div style={{ fontSize: '0.8rem', color: '#78350f', marginTop: '4px', opacity: 0.8 }}>
                    👥 {room.playerCount} 人 {room.hasTimeLimit && `| ⏱️ ${room.timeLimit}s`}
                  </div>
                </div>
                <button 
                  onClick={() => onJoinRoom(room.roomId)}
                  style={{ padding: '8px 16px', background: '#38bdf8', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 6px rgba(56, 189, 248, 0.3)' }}
                >
                  加入
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ⌨️ 手動加入 */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <input
          type="text"
          placeholder="輸入私人房間 ID"
          value={roomIdInput}
          onChange={(e) => setRoomIdInput(e.target.value)}
          style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #ccc', outline: 'none', fontSize: '0.95rem' }}
        />
        <button 
          onClick={() => onJoinRoom(roomIdInput)}
          style={{ padding: '0 20px', borderRadius: '12px', background: '#64748b', color: 'white', fontWeight: 'bold', border: 'none', cursor: 'pointer', fontSize: '0.95rem' }}
        >
          進入
        </button>
      </div>
    </div>
  );
}