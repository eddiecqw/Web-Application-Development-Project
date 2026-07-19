import React, { useState, useEffect } from 'react';

export default function GameLobby({ onCreateRoom, onJoinRoom }) {
  const [roomIdInput, setRoomIdInput] = useState('');
  const [hasTimeLimit, setHasTimeLimit] = useState(false);
  const [timeLimit, setTimeLimit] = useState(60);
  
  // 📋 新增：儲存從後端抓取的房間列表
  const [availableRooms, setAvailableRooms] = useState([]);

  // 📡 抓取房間資料的函數
  const fetchRooms = async () => {
    try {
      const response = await fetch('/api/rooms');
      const data = await response.json();
      if (data.success) {
        setAvailableRooms(data.rooms);
      }
    } catch (error) {
      console.error('無法獲取房間列表:', error);
    }
  };

  // 🔄 組件掛載時抓取一次，並設定每 5 秒自動更新
  useEffect(() => {
    fetchRooms();
    const intervalId = setInterval(fetchRooms, 5000);
    return () => clearInterval(intervalId); // 離開組件時清除計時器
  }, []);

  return (
    <div className="game-lobby">
      <h2>🎨 你画我猜游戏大厅</h2>
      
      {/* ⚙️ 自訂房間設定 */}
      <div style={{ margin: '15px 0', padding: '15px', background: '#f5f5f5', borderRadius: '8px', textAlign: 'left' }}>
        <h4 style={{ marginTop: 0 }}>⚙️ 創建房間設定</h4>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            checked={hasTimeLimit} 
            onChange={(e) => setHasTimeLimit(e.target.checked)} 
            style={{ width: '20px', height: '20px' }}
          />
          開啟答題時間限制
        </label>
        
        {hasTimeLimit && (
          <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>每題時間 (秒):</span>
            <input 
              type="number" 
              min="10" max="300"
              value={timeLimit}
              onChange={(e) => setTimeLimit(Number(e.target.value))}
              style={{ width: '80px', padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>
        )}

        <button 
          className="lobby-button create-btn"
          style={{ width: '100%', marginTop: '15px' }}
          onClick={() => onCreateRoom({ hasTimeLimit, timeLimit })}
        >
          創建專屬房間
        </button>
      </div>

      <hr style={{ border: '1px solid #ddd', margin: '20px 0' }} />

      {/* 📋 公開房間列表 (Room Discovery) */}
      <div style={{ textAlign: 'left', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0 }}>🌐 公開房間列表</h4>
          <button onClick={fetchRooms} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#007bff' }}>
            🔄 重新整理
          </button>
        </div>
        
        {availableRooms.length === 0 ? (
          <p style={{ color: '#888', textAlign: 'center', marginTop: '15px' }}>目前沒有活躍的房間，趕快創建一個吧！</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
            {availableRooms.map((room) => (
              <div key={room.roomId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: '#fff', border: '1px solid #ddd', borderRadius: '8px' }}>
                <div>
                  <strong style={{ fontSize: '1.1rem', color: '#333' }}>房間 {room.roomId}</strong>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '4px' }}>
                    👥 玩家人數: {room.playerCount} 人 
                    {room.hasTimeLimit && ` | ⏱️ 限時 ${room.timeLimit}s`}
                  </div>
                </div>
                <button 
                  onClick={() => onJoinRoom(room.roomId)}
                  style={{ padding: '8px 16px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  加入
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <hr style={{ border: '1px solid #ddd', margin: '20px 0' }} />

      {/* ⌨️ 手動加入區塊 (保留給私人房間使用) */}
      <div className="join-section">
        <input
          type="text"
          placeholder="手動輸入私人房間ID"
          value={roomIdInput}
          onChange={(e) => setRoomIdInput(e.target.value)}
          className="room-id-input"
        />
        <button className="lobby-button join-btn" onClick={() => onJoinRoom(roomIdInput)}>
          加入
        </button>
      </div>
    </div>
  );
}