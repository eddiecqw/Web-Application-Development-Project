// blackjackHandler.mjs

// 儲存所有 21 點房間的狀態
export const blackjackRooms = {};

export function handleBlackjackMessage(ws, type, data, wss, callbacks) {
  const { roomId, username } = data;

  const broadcastToRoom = (id, payload) => {
    const room = blackjackRooms[id];
    if (!room) return;
    const playerNames = room.players.map(p => p.name);
    wss.clients.forEach(client => {
      if (client.readyState === 1 && client._username && playerNames.includes(client._username)) {
        client.send(JSON.stringify(payload));
      }
    });
  };

  switch (type) {
    // ✨ 新增：開始遊戲邏輯
    case 'BJ_START_GAME': {
      const room = blackjackRooms[roomId];
      // 確保房間存在，且只有房主能按開始
      if (!room || room.owner !== username) return;

      room.status = 'playing'; // 改變狀態
      
      // ⚠️ 下一階段我們才會在這裡加入「發牌引擎」
      
      broadcastToRoom(roomId, {
        type: 'BJ_GAME_STARTED',
        data: { room }
      });
      break;
    }
    
    case 'BJ_CREATE_ROOM': {
      // 1. 清理舊房間
      for (const id in blackjackRooms) {
        if (blackjackRooms[id].owner === username) delete blackjackRooms[id];
      }

      // 2. 產生房間 ID (轉大寫看起來更像賭場代碼)
      const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      ws._bjRoomId = newRoomId;

      // 3. 接收大廳的自訂設定 (若無則使用預設值)
      const settings = {
        timeLimit: data.timeLimit || 15,   // 預設 15 秒
        baseBet: data.baseBet || 10,       // 預設底注 10
        deckCount: data.deckCount || 4     // 預設 4 副牌
      };

      // 4. 初始化房間狀態
      blackjackRooms[newRoomId] = {
        id: newRoomId,
        owner: username,
        status: 'waiting', // waiting, betting, playing, dealerTurn, showdown
        settings: settings,
        dealer: { hand: [], score: 0 },
        players: [{ 
          name: username, 
          chips: 1000, 
          hand: [], 
          score: 0, 
          currentBet: 0, 
          status: 'waiting' // waiting, ready, hit, stand, bust
        }]
      };

      ws.send(JSON.stringify({
        type: 'BJ_ROOM_CREATED',
        data: { roomId: newRoomId, room: blackjackRooms[newRoomId] }
      }));

      // 5. 通知全域聊天室
      if (callbacks && callbacks.onRoomCreated) {
        callbacks.onRoomCreated(newRoomId, '21點 (Blackjack)');
      }
      break;
    }

    case 'BJ_JOIN_ROOM': {
      const room = blackjackRooms[roomId];
      if (!room) return ws.send(JSON.stringify({ type: 'BJ_ERROR', data: { message: '房間不存在' } }));
      if (room.status !== 'waiting') return ws.send(JSON.stringify({ type: 'BJ_ERROR', data: { message: '遊戲進行中，無法加入' } }));
      
      ws._bjRoomId = roomId;

      if (!room.players.some(p => p.name === username)) {
        room.players.push({ 
          name: username, chips: 1000, hand: [], score: 0, currentBet: 0, status: 'waiting' 
        });
      }

      broadcastToRoom(roomId, { type: 'BJ_PLAYER_JOINED', data: { room } });
      break;
    }

    case 'BJ_LEAVE_ROOM': {
      const room = blackjackRooms[roomId];
      delete ws._bjRoomId;
      if (!room) return;

      if (room.owner === username) {
        delete blackjackRooms[roomId];
        broadcastToRoom(roomId, { type: 'BJ_ERROR', data: { message: '房主已離開，房間解散' } });
      } else {
        room.players = room.players.filter(p => p.name !== username);
        broadcastToRoom(roomId, { type: 'BJ_PLAYER_JOINED', data: { room } });
      }
      break;
    }
  }
}

// 斷線清理函數
export function cleanupBlackjackConnection(username, roomId, wss) {
  if (!roomId) return;
  const room = blackjackRooms[roomId];
  if (!room) return;

  if (room.owner === username) {
    const playerNames = room.players.map(p => p.name);
    wss.clients.forEach(client => {
      if (client.readyState === 1 && client._username && playerNames.includes(client._username)) {
        client.send(JSON.stringify({ type: 'BJ_ERROR', data: { message: '房主已斷線，房間解散' } }));
      }
    });
    delete blackjackRooms[roomId];
  } else {
    room.players = room.players.filter(p => p.name !== username);
    const playerNames = room.players.map(p => p.name);
    wss.clients.forEach(client => {
      if (client.readyState === 1 && client._username && playerNames.includes(client._username)) {
        client.send(JSON.stringify({ type: 'BJ_PLAYER_JOINED', data: { room } }));
      }
    });
  }
}