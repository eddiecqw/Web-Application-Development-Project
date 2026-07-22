// niuniuHandler.mjs

// 儲存所有鬥牛房間的狀態
export const niuniuRooms = {};

// ==========================================
// 1. 核心演算法：洗牌與牌型判斷
// ==========================================
function createDeck() {
  const suits = ['♠', '♥', '♣', '♦'];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  let newDeck = [];
  
  for (let suit of suits) {
    for (let rank of ranks) {
      let value = isNaN(rank) ? (rank === 'A' ? 1 : 10) : parseInt(rank);
      let numValue = isNaN(rank) ? (rank === 'A' ? 1 : (rank === 'J' ? 11 : (rank === 'Q' ? 12 : 13))) : parseInt(rank);
      let suitValue = suit === '♠' ? 4 : (suit === '♥' ? 3 : (suit === '♣' ? 2 : 1));
      let color = (suit === '♥' || suit === '♦') ? 'red' : 'black';
      
      newDeck.push({ suit, rank, value, numValue, suitValue, color });
    }
  }
  
  // Fisher-Yates 洗牌
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
}

// 用於後端自動驗證牌型大小 (防止前端作弊)
function evaluateHand(hand) {
  const isFiveSmall = hand.every(c => c.value < 5) && hand.reduce((sum, c) => sum + c.value, 0) <= 10;
  if (isFiveSmall) return { type: '五小牛', weight: 1000 };

  const rankCounts = {};
  hand.forEach(c => rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1);
  if (Object.values(rankCounts).includes(4)) return { type: '四炸', weight: 900 };

  const isFiveFlower = hand.every(c => ['J', 'Q', 'K'].includes(c.rank));
  if (isFiveFlower) return { type: '五花牛', weight: 800 };

  let maxNiu = 0;
  let hasNiu = false;
  
  for (let i = 0; i < hand.length - 2; i++) {
    for (let j = i + 1; j < hand.length - 1; j++) {
      for (let k = j + 1; k < hand.length; k++) {
        if ((hand[i].value + hand[j].value + hand[k].value) % 10 === 0) {
          hasNiu = true;
          const remaining = hand.filter((_, idx) => idx !== i && idx !== j && idx !== k);
          const niuValue = (remaining[0].value + remaining[1].value) % 10;
          const currentNiu = niuValue === 0 ? 10 : niuValue;
          if (currentNiu > maxNiu) maxNiu = currentNiu;
        }
      }
    }
  }

  if (hasNiu) return { type: maxNiu === 10 ? '鬥牛 (牛牛)' : `牛${maxNiu}`, weight: maxNiu * 10 };
  return { type: '無牛', weight: 0 };
}

// ==========================================
// 2. 路由處理器 (導流所有鬥牛相關的 WebSocket 請求)
// ==========================================
export function handleNiuNiuMessage(ws, type, data, wss, callbacks) {
  const { roomId, username } = data;

  // 廣播函數：只傳送給同一個房間的玩家
  const broadcastToRoom = (id, payload) => {
    const room = niuniuRooms[id];
    if (!room) return;
    
    // 找出房間內所有玩家的名字
    const playerNames = room.players.map(p => p.name);
    
    wss.clients.forEach(client => {
      // 假設你的 ws 實例有綁定 username (根據你的設定)
      // 若 client 的 username 在房間列表內，就發送訊息
      if (client.readyState === 1 && client._username && playerNames.includes(client._username)) {
        client.send(JSON.stringify(payload));
      }
    });
  };

  switch (type) {
    case 'NIUNIU_CREATE_ROOM': {
      // 產生 6 碼隨機房號
      const newRoomId = Math.random().toString(36).substring(2, 8);
      const timeLimit = data.timeLimit || 60; // 取得前端傳來的時間限制，預設 60 秒

      niuniuRooms[newRoomId] = {
        id: newRoomId,
        owner: username,
        players: [{ name: username, isReady: false, hand: [], result: null }],
        status: 'waiting', // waiting, playing, showdown
        timeLimit: timeLimit,
        dealer: username // 預設房主為庄家
      };

      ws.send(JSON.stringify({
        type: 'NIUNIU_ROOM_CREATED',
        data: { roomId: newRoomId, room: niuniuRooms[newRoomId] }
      }));

      if (callbacks && callbacks.onRoomCreated) {
        callbacks.onRoomCreated(newRoomId);
      }
      break;
    }

    case 'NIUNIU_JOIN_ROOM': {
      const room = niuniuRooms[roomId];
      if (!room) {
        return ws.send(JSON.stringify({ type: 'NIUNIU_ERROR', data: { message: '房間不存在' } }));
      }
      if (room.status !== 'waiting') {
        return ws.send(JSON.stringify({ type: 'NIUNIU_ERROR', data: { message: '遊戲已經開始，無法加入' } }));
      }

      // 檢查是否已在房間內
      if (!room.players.some(p => p.name === username)) {
        room.players.push({ name: username, isReady: false, hand: [], result: null });
      }

      // 廣播給房間所有人：有新玩家加入
      broadcastToRoom(roomId, {
        type: 'NIUNIU_PLAYER_JOINED',
        data: { room }
      });
      break;
    }

    case 'NIUNIU_START_GAME': {
      const room = niuniuRooms[roomId];
      if (!room || room.owner !== username) return;

      room.status = 'playing';
      const deck = createDeck();

      // 為每個玩家發 5 張牌
      room.players.forEach(player => {
        player.hand = deck.splice(0, 5);
        player.result = null; // 重置上一局結果
      });

      // 廣播發牌結果 (注意：為了安全，通常會把別人的牌隱藏，但為了簡化前端，我們先全發)
      broadcastToRoom(roomId, {
        type: 'NIUNIU_GAME_STARTED',
        data: { room }
      });
      break;
    }

    case 'NIUNIU_SUBMIT_HAND': {
      // 玩家理牌完畢，提交結果
      const room = niuniuRooms[roomId];
      if (!room) return;

      const player = room.players.find(p => p.name === username);
      if (player) {
        // 後端嚴格驗證 (防作弊機制)
        // 為了安全，我們直接用後端的 evaluateHand 計算玩家的最高權重
        player.result = evaluateHand(player.hand);
        player.isReady = true;

        // 檢查是否所有人都已經提交 (ready)
        const allReady = room.players.every(p => p.isReady);
        
        broadcastToRoom(roomId, {
          type: 'NIUNIU_PLAYER_SUBMITTED',
          data: { username: player.name, allReady, room } 
        });

        // 如果全部提交完畢，進入攤牌階段
        if (allReady) {
          room.status = 'showdown';
          broadcastToRoom(roomId, {
            type: 'NIUNIU_SHOWDOWN',
            data: { room }
          });
          
          // 局數結束後，重置準備狀態回到 waiting
          setTimeout(() => {
            room.status = 'waiting';
            room.players.forEach(p => p.isReady = false);
            broadcastToRoom(roomId, {
              type: 'NIUNIU_ROUND_ENDED',
              data: { room }
            });
          }, 10000); // 給大家 10 秒看結果
        }
      }
      break;
    }
  }
}