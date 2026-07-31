import React, { useState, useEffect } from 'react';

export default function BlackjackLobby({ onCreateRoom, onJoinRoom, onBack, username }) {
  const [joinId, setJoinId] = useState('');
  
  // 👤 暱稱狀態 (預設帶入 Email 前綴)
  const [nickname, setNickname] = useState(username ? username.split('@')[0] : '');
  
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

  const handleCreate = () => {
    onCreateRoom({ 
      ...settings, 
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
      background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)', 
      padding: '2rem 25px 25px 25px', 
      borderRadius: '15px', 
      boxShadow: '0 15px 35px rgba(0,0,0,0.5)', 
      width: '100%', 
      maxWidth: '450px', 
      textAlign: 'center', 
      color: '#f8fafc', 
      border: '1px solid #334155',
      position: 'relative', 
      margin: 'auto',
      display: 'flex',
      flexDirection: 'column'
    }}>
      
      {/* 🔙 左上角返回按鈕 */}
      {onBack && (
        <button 
          onClick={onBack}
          style={{ 
            position: 'absolute', top: '15px', left: '15px', padding: '0', 
            background: 'transparent', color: '#93c5fd', border: 'none', 
            fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem',
            display: 'flex', alignItems: 'center', gap: '4px',
            transition: 'color 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.color = '#fff'}
          onMouseOut={(e) => e.currentTarget.style.color = '#93c5fd'}
        >
          ← 返回
        </button>
      )}

      {/* 標題區 */}
      <h1 style={{ color: '#ffd700', margin: '15px 0 5px 0', textShadow: '0 2px 4px rgba(0,0,0,0.5)', fontSize: '1.8rem' }}>🎰 21點 VIP大廳</h1>
      <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '20px', fontStyle: 'italic' }}>挑戰 21 點，運氣與策略的頂級對決。</p>
      
      {/* 👤 暱稱設定區塊 */}
      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 15px', borderRadius: '10px', marginBottom: '15px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ color: '#93c5fd', fontSize: '0.85rem', marginBottom: '8px', fontWeight: 'bold', textAlign: 'left' }}>👤 你的 VIP 稱號 (暱稱)：</div>
        <input 
          type="text" 
          value={nickname} 
          onChange={(e) => setNickname(e.target.value)}
          placeholder="輸入名稱..."
          style={{ 
            width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #475569', 
            background: 'rgba(0,0,0,0.4)', color: '#fcd34d', fontWeight: 'bold', 
            textAlign: 'center', boxSizing: 'border-box', outline: 'none' 
          }} 
        />
      </div>

      {/* ⚙️ 創建區塊 */}
      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px', marginBottom: '15px', textAlign: 'left', border: '1px solid rgba(255,255,255,0.1)' }}>
        <h3 style={{ margin: '0 0 12px 0', color: '#e2e8f0', fontSize: '1.1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>⚙️ 創建新賭桌</h3>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <label style={{ fontWeight: 'bold', color: '#cbd5e1', fontSize: '0.9rem' }}>👑 莊家模式：</label>
          <select value={settings.rotateDealer} onChange={e => setSettings({...settings, rotateDealer: e.target.value === 'true'})} style={{ padding: '4px 8px', borderRadius: '4px', background: '#334155', color: 'white', border: 'none', fontSize: '0.9rem' }}>
            <option value={false}>系統當莊 (單人可玩)</option>
            <option value={true}>玩家輪流做莊 (最少2人)</option>
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <label style={{ fontWeight: 'bold', color: '#cbd5e1', fontSize: '0.9rem' }}>⏱️ 思考時間：</label>
          <select value={settings.timeLimit} onChange={e => setSettings({...settings, timeLimit: Number(e.target.value)})} style={{ padding: '4px 8px', borderRadius: '4px', background: '#334155', color: 'white', border: 'none', fontSize: '0.9rem' }}>
            <option value={10}>極速 (10秒)</option>
            <option value={15}>標準 (15秒)</option>
            <option value={30}>思考 (30秒)</option>
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <label style={{ fontWeight: 'bold', color: '#cbd5e1', fontSize: '0.9rem' }}>💰 房間底注：</label>
          <select value={settings.baseBet} onChange={e => setSettings({...settings, baseBet: Number(e.target.value)})} style={{ padding: '4px 8px', borderRadius: '4px', background: '#334155', color: 'white', border: 'none', fontSize: '0.9rem' }}>
            <option value={10}>平民桌 (10點)</option>
            <option value={50}>標準桌 (50點)</option>
            <option value={500}>豪客桌 (500點)</option>
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <label style={{ fontWeight: 'bold', color: '#cbd5e1', fontSize: '0.9rem' }}>🃏 牌靴設定：</label>
          <select value={settings.deckCount} onChange={e => setSettings({...settings, deckCount: Number(e.target.value)})} style={{ padding: '4px 8px', borderRadius: '4px', background: '#334155', color: 'white', border: 'none', fontSize: '0.9rem' }}>
            <option value={1}>單副牌</option>
            <option value={4}>4 副牌</option>
            <option value={6}>6 副牌</option>
          </select>
        </div>
        <button onClick={handleCreate} style={{ width: '100%', padding: '10px', background: 'linear-gradient(to bottom, #fbc02d, #f57f17)', color: '#3e2723', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem', boxShadow: '0 4px 8px rgba(0,0,0,0.3)' }}>
          ➕ 建立並進入房間
        </button>
      </div>

      {/* 加入房間區塊 */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '20px' }}>
        <input type="text" placeholder="輸入 6 碼房間號..." value={joinId} onChange={(e) => setJoinId(e.target.value.toUpperCase())} style={{ padding: '10px', borderRadius: '8px', border: 'none', flex: 1, textTransform: 'uppercase', background: '#334155', color: 'white', outline: 'none' }} />
        <button onClick={() => joinId && handleJoin(joinId)} style={{ padding: '10px 20px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>加入</button>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '15px 0' }}></div>

      {/* 房間列表 */}
      <div style={{ textAlign: 'left' }}>
        <h3 style={{ margin: '0 0 12px 0', color: '#e2e8f0', fontSize: '1.1rem' }}>🏠 尋找公開賭桌</h3>
        {availableRooms.length === 0 ? (
          <p style={{ color: '#64748b', textAlign: 'center', background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px', fontSize: '0.9rem' }}>目前沒有公開的房間，自己開一桌吧！</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '5px' }}>
            {availableRooms.map(room => (
              <div key={room.roomId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.08)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div style={{ fontWeight: 'bold', color: '#00e676', fontSize: '1rem' }}>房間: {room.roomId}</div>
                  <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '4px' }}>底注 {room.baseBet} | {room.timeLimit}秒 | {room.playerCount} 人</div>
                </div>
                <button 
                  onClick={() => handleJoin(room.roomId)} disabled={room.status !== 'waiting'}
                  style={{ padding: '6px 14px', background: room.status === 'waiting' ? '#4caf50' : '#64748b', color: 'white', border: 'none', borderRadius: '6px', cursor: room.status === 'waiting' ? 'pointer' : 'not-allowed', fontWeight: 'bold', fontSize: '0.9rem' }}
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