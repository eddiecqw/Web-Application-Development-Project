// blackjackHandler.mjs

// 儲存所有 21 點房間的狀態
export const blackjackRooms = {};

// ==========================================
// 1. 核心演算法：多副牌洗牌與 21 點計分
// ==========================================

// 建立牌靴 (支援多副牌)
function createShoe(deckCount) {
  const suits = ['♠', '♥', '♣', '♦'];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  let shoe = [];

  for (let d = 0; d < deckCount; d++) {
    for (let suit of suits) {
      for (let rank of ranks) {
        // A 預設為 11 點，JQK 為 10 點
        let value = (rank === 'A') ? 11 : (['J', 'Q', 'K'].includes(rank) ? 10 : parseInt(rank));
        let color = (suit === '♥' || suit === '♦') ? 'red' : 'black';
        shoe.push({ suit, rank, value, color });
      }
    }
  }

  // Fisher-Yates 演算法完美洗牌
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return shoe;
}

// 計算 21 點分數 (完美處理 Ace 變牌邏輯)
function calculateScore(hand) {
  let score = 0;
  let aces = 0;

  for (let card of hand) {
    if (!card || card.isHidden) continue; // 略過蓋著的暗牌
    score += card.value;
    if (card.rank === 'A') aces += 1;
  }

  // 如果分數超過 21 且手中有 A，就把 A 從 11 點扣回 1 點 (扣 10 分)
  while (score > 21 && aces > 0) {
    score -= 10;
    aces -= 1;
  }
  return score;
}

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

      room.status = 'playing'; 
      
      // 1. 根據大廳設定，生成牌靴
      room.shoe = createShoe(room.settings.deckCount);

      // 2. 為每個閒家扣除底注，並發兩張牌
      room.players.forEach(player => {
        player.chips -= room.settings.baseBet; // 自動下注
        player.currentBet = room.settings.baseBet;
        player.hand = [room.shoe.pop(), room.shoe.pop()];
        player.score = calculateScore(player.hand);
        player.status = 'playing'; // 玩家狀態
      });

      // 3. 為莊家發兩張牌
      room.dealer = {
        hand: [room.shoe.pop(), room.shoe.pop()],
        status: 'playing'
      };
      // 莊家真實的總分 (後端自己留著)
      room.dealer.score = calculateScore(room.dealer.hand);

      // 4. 設定當前回合的玩家 (從莊家左手邊第一個閒家開始)
      room.currentPlayerIndex = 0;
      room.turn = room.players[0].name;

      // 🔒 5. 防作弊處理：過濾掉莊家的第二張暗牌，再傳給前端
      const safeRoom = JSON.parse(JSON.stringify(room));
      delete safeRoom.shoe; // 沒必要把幾百張牌全傳給前端佔用頻寬
      
      // 把莊家第二張牌變成隱藏卡
      safeRoom.dealer.hand[1] = { isHidden: true };
      // 莊家顯示分數只計算第一張明牌
      safeRoom.dealer.score = calculateScore([safeRoom.dealer.hand[0]]); 

      broadcastToRoom(roomId, {
        type: 'BJ_GAME_STARTED',
        data: { room: safeRoom }
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