import React, { useState, useEffect } from 'react';

export default function BlackjackLobby({ onCreateRoom, onJoinRoom }) {
  const [joinId, setJoinId] = useState('');
  const [availableRooms, setAvailableRooms] = useState([]);
  const [settings, setSettings] = useState({ timeLimit: 15, baseBet: 10, deckCount: 4, rotateDealer: false });

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const baseUrl = (import.meta.env.VITE_WS_URL || 'ws://localhost:53840/ws')
          .replace('ws://', 'http://').replace('wss://', 'https://').replace('/ws', '');
        const response = await fetch(`${baseUrl}/api/blackjack-rooms`);
        const data = await response.json();
        if (data.success) setAvailableRooms(data.rooms);
      } catch (error) {
        console.error('無法取得 21 點房間列表', error);
      }
    };

    fetchRooms();
    const interval = setInterval(fetchRooms, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ background: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '100%', maxWidth: '500px', textAlign: 'center' }}>
      <h1 style={{ color: '#1a4f2c', margin: '0 0 20px 0' }}>🎰 21點 Blackjack 大廳</h1>
      
      <div style={{ background: '#f3f4f6', padding: '15px', borderRadius: '8px', marginBottom: '20px', textAlign: 'left' }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>⚙️ 創建新房間</h3>
        
        {/* ✨ 新增輪流做莊設定 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <label style={{ fontWeight: 'bold' }}>👑 莊家模式：</label>
          <select value={settings.rotateDealer} onChange={e => setSettings({...settings, rotateDealer: e.target.value === 'true'})} style={{ padding: '4px 8px', borderRadius: '4px' }}>
            <option value={false}>系統當莊 (單人可玩)</option>
            <option value={true}>玩家輪流做莊 (最少2人)</option>
          </select>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <label style={{ fontWeight: 'bold' }}>⏱️ 思考時間：</label>
          <select value={settings.timeLimit} onChange={e => setSettings({...settings, timeLimit: Number(e.target.value)})} style={{ padding: '4px 8px', borderRadius: '4px' }}>
            <option value={10}>極速 (10秒)</option>
            <option value={15}>標準 (15秒)</option>
            <option value={30}>思考 (30秒)</option>
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <label style={{ fontWeight: 'bold' }}>💰 房間底注：</label>
          <select value={settings.baseBet} onChange={e => setSettings({...settings, baseBet: Number(e.target.value)})} style={{ padding: '4px 8px', borderRadius: '4px' }}>
            <option value={10}>平民桌 (10點)</option>
            <option value={50}>標準桌 (50點)</option>
            <option value={500}>豪客桌 (500點)</option>
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
          <label style={{ fontWeight: 'bold' }}>🃏 牌靴設定：</label>
          <select value={settings.deckCount} onChange={e => setSettings({...settings, deckCount: Number(e.target.value)})} style={{ padding: '4px 8px', borderRadius: '4px' }}>
            <option value={1}>單副牌</option>
            <option value={4}>4 副牌</option>
            <option value={6}>6 副牌</option>
          </select>
        </div>
        <button onClick={() => onCreateRoom(settings)} style={{ width: '100%', padding: '10px', background: 'linear-gradient(to bottom, #fbc02d, #f57f17)', color: '#3e2723', border: 'none', borderRadius: '25px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1.1rem' }}>
          ➕ 建立並進入房間
        </button>
      </div>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
        <input type="text" placeholder="輸入房間號..." value={joinId} onChange={(e) => setJoinId(e.target.value.toUpperCase())} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc', flex: 1, textTransform: 'uppercase' }} />
        <button onClick={() => joinId && onJoinRoom(joinId)} style={{ padding: '10px 20px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>加入</button>
      </div>

      <div style={{ borderTop: '2px dashed #ccc', margin: '20px 0' }}></div>

      <div style={{ textAlign: 'left' }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>🏠 尋找賭桌</h3>
        {availableRooms.length === 0 ? (
          <p style={{ color: '#888', textAlign: 'center' }}>目前沒有公開的房間，自己開一桌吧！</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
            {availableRooms.map(room => (
              <div key={room.roomId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fa', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}>
                <div>
                  <div style={{ fontWeight: 'bold', color: '#1a4f2c' }}>房間: {room.roomId}</div>
                  <div style={{ fontSize: '0.85rem', color: '#666' }}>底注 {room.baseBet} | {room.timeLimit}秒 | {room.playerCount} 人</div>
                </div>
                <button 
                  onClick={() => onJoinRoom(room.roomId)} disabled={room.status !== 'waiting'}
                  style={{ padding: '6px 12px', background: room.status === 'waiting' ? '#4caf50' : '#9e9e9e', color: 'white', border: 'none', borderRadius: '4px', cursor: room.status === 'waiting' ? 'pointer' : 'not-allowed' }}
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