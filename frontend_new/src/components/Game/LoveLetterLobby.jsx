import React, { useState, useEffect } from 'react';

export default function LoveLetterLobby({ onCreateRoom, onJoinRoom, onBack }) {
  const [joinId, setJoinId] = useState('');
  const [availableRooms, setAvailableRooms] = useState([]);
  
  // 情書特有的設定：贏得幾局(幾個好感指示物)才算最終勝利
  const [settings, setSettings] = useState({ winTokens: 4 });

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const baseUrl = (import.meta.env.VITE_WS_URL || 'ws://localhost:53840/ws')
          .replace('ws://', 'http://').replace('wss://', 'https://').replace('/ws', '');
        const response = await fetch(`${baseUrl}/api/loveletter-rooms`);
        const data = await response.json();
        if (data.success) setAvailableRooms(data.rooms);
      } catch (error) {
        console.error('無法取得 情書 房間列表', error);
      }
    };

    fetchRooms();
    const interval = setInterval(fetchRooms, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ 
      // ✨ 勃根地酒紅暗色漸層背景 (宮廷浪漫風)
      background: 'linear-gradient(145deg, #4a1515 0%, #1a0505 100%)', 
      padding: '3rem 30px 30px 30px', borderRadius: '15px', 
      boxShadow: '0 15px 35px rgba(0,0,0,0.6)', width: '100%', maxWidth: '500px', 
      textAlign: 'center', color: '#f8fafc', border: '1px solid #5a1a1a',
      position: 'relative', margin: 'auto'
    }}>
      
      {/* 內建左上角返回按鈕 */}
      {onBack && (
        <button 
          onClick={onBack}
          style={{ 
            position: 'absolute', top: '15px', left: '15px', padding: '8px 16px', 
            background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', 
            borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
            transition: 'all 0.2s', backdropFilter: 'blur(4px)'
          }}
          onMouseOver={(e) => { e.target.style.background = '#dc3545'; e.target.style.border = '1px solid #dc3545'; }}
          onMouseOut={(e) => { e.target.style.background = 'rgba(255,255,255,0.1)'; e.target.style.border = '1px solid rgba(255,255,255,0.3)'; }}
        >
          ← 返回
        </button>
      )}

      <h1 style={{ color: '#ffd700', margin: '0 0 5px 0', textShadow: '0 2px 4px rgba(0,0,0,0.8)', fontFamily: 'serif' }}>💌 情書 (Love Letter)</h1>
      <p style={{ color: '#d1d5db', fontSize: '0.9rem', marginBottom: '25px', fontStyle: 'italic' }}>推演、心機與運氣，將你的情書送達公主手中。</p>
      
      {/* 創建區塊：半透明深紅 */}
      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px', marginBottom: '20px', textAlign: 'left', border: '1px solid rgba(255,255,255,0.1)' }}>
        <h3 style={{ margin: '0 0 15px 0', color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>📜 展開新對局</h3>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <label style={{ fontWeight: 'bold', color: '#fca5a5' }}>🏆 勝利條件 (好感度)：</label>
          <select value={settings.winTokens} onChange={e => setSettings({ winTokens: Number(e.target.value) })} style={{ padding: '6px 10px', borderRadius: '4px', background: '#3f1111', color: 'white', border: '1px solid #7f1d1d', fontWeight: 'bold' }}>
            <option value={3}>3 個 (快速局)</option>
            <option value={4}>4 個 (標準局)</option>
            <option value={5}>5 個 (長線局)</option>
          </select>
        </div>
        
        <button onClick={() => onCreateRoom(settings)} style={{ width: '100%', padding: '12px', background: 'linear-gradient(to bottom, #d4af37, #aa8529)', color: '#2a1a00', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1.1rem', boxShadow: '0 4px 10px rgba(0,0,0,0.4)', transition: 'transform 0.1s' }} onMouseDown={e => e.target.style.transform = 'scale(0.98)'} onMouseUp={e => e.target.style.transform = 'scale(1)'}>
          ➕ 建立宮廷房間
        </button>
      </div>

      {/* 加入房間區塊 */}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
        <input type="text" placeholder="輸入 6 碼房間號..." value={joinId} onChange={(e) => setJoinId(e.target.value.toUpperCase())} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #7f1d1d', flex: 1, textTransform: 'uppercase', background: 'rgba(0,0,0,0.3)', color: 'white' }} />
        <button onClick={() => joinId && onJoinRoom(joinId)} style={{ padding: '10px 25px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1.1rem', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>加入</button>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '20px 0' }}></div>

      {/* 房間列表 */}
      <div style={{ textAlign: 'left' }}>
        <h3 style={{ margin: '0 0 15px 0', color: '#e2e8f0' }}>🏰 尋找宮廷對局</h3>
        {availableRooms.length === 0 ? (
          <p style={{ color: '#9ca3af', textAlign: 'center', background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '8px' }}>宮廷內目前空無一人，發起邀請吧！</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto', paddingRight: '5px' }}>
            {availableRooms.map(room => (
              <div key={room.roomId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.08)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div style={{ fontWeight: 'bold', color: '#fca5a5', fontSize: '1.1rem' }}>房間: {room.roomId}</div>
                  <div style={{ fontSize: '0.85rem', color: '#d1d5db', marginTop: '4px' }}>目標 {room.winTokens} 個指示物 | {room.playerCount} 人</div>
                </div>
                <button 
                  onClick={() => onJoinRoom(room.roomId)} disabled={room.status !== 'waiting'}
                  style={{ padding: '8px 16px', background: room.status === 'waiting' ? '#b91c1c' : '#4b5563', color: 'white', border: 'none', borderRadius: '6px', cursor: room.status === 'waiting' ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}
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