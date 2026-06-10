import React, { useState } from 'react';

export default function GameLobby({ onCreateRoom, onJoinRoom }) {
  const [roomIdInput, setRoomIdInput] = useState('');

  return (
    <div className="game-lobby">
      <h2>🎨 你画我猜游戏大厅</h2>
      <div className="lobby-actions">
        <button 
          className="lobby-button create-btn"
          onClick={onCreateRoom}
        >
          创建新房间
        </button>
        
        <div className="join-section">
          <input
            type="text"
            placeholder="输入房间ID"
            value={roomIdInput}
            onChange={(e) => setRoomIdInput(e.target.value)}
            className="room-id-input"
          />
          <button
            className="lobby-button join-btn"
            onClick={() => onJoinRoom(roomIdInput)}
          >
            加入房间
          </button>
        </div>
      </div>
    </div>
  );
}