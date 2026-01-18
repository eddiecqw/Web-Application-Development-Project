import React from 'react';

export default function PlayerList({ players, currentUserId }) {
  return (
    <div className="player-list">
      <h3>玩家列表 ({players.length})</h3>
      <ul>
        {players.map(player => (
          <li 
            key={player.id}
            className={player.id === currentUserId ? 'current-user' : ''}
          >
            <span className="player-name">{player.name}</span>
            <span className="player-score">🎯 {player.score}</span>
            {player.isPainter && <span className="painter-badge">🎨</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}