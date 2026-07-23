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

// 輔助：找出最大的一張牌
function getHighestCard(hand) {
  if (!hand || hand.length === 0) return null;
  return hand.reduce((max, card) => {
    if (card.numValue > max.numValue) return card;
    if (card.numValue === max.numValue && card.suitValue > max.suitValue) return card;
    return max;
  }, hand[0]);
}

// 輔助：比較兩副牌的大小 (回傳 true 代表 handA 贏)
function compareHands(handA, resultA, handB, resultB) {
  if (!resultA || !resultB) return false;
  if (resultA.weight > resultB.weight) return true;
  if (resultA.weight < resultB.weight) return false;
  const highA = getHighestCard(handA);
  const highB = getHighestCard(handB);
  if (!highA || !highB) return false;
  if (highA.numValue > highB.numValue) return true;
  if (highA.numValue < highB.numValue) return false;
  return highA.suitValue > highB.suitValue;
}

// 輔助：取得牌型倍率
function getMultiplier(weight) {
  if (weight >= 800) return 5; // 五花牛、四炸、五小牛
  if (weight === 100) return 4; // 牛牛
  if (weight === 90) return 3;  // 牛九
  if (weight >= 70) return 2;   // 牛七、牛八
  return 1;                     // 無牛 ~ 牛六
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
      // 1. 先清理舊房間
      for (const id in niuniuRooms) {
        if (niuniuRooms[id].owner === username) delete niuniuRooms[id];
      }

      // 2. 🌟 關鍵修復：必須先「宣告並產生」 newRoomId 與 timeLimit
      const newRoomId = Math.random().toString(36).substring(2, 8);
      const timeLimit = data.timeLimit || 60;

      // 3. 🌟 等 newRoomId 產生後，才能把它綁定到 ws 身上
      ws._niuniuRoomId = newRoomId;

      // 4. 建立房間資料
      niuniuRooms[newRoomId] = {
        id: newRoomId,
        owner: username,
        players: [{ name: username, isReady: false, hand: [], result: null, chips: 1000, scoreChange: 0 }],
        status: 'waiting', 
        timeLimit: timeLimit,
        dealer: username 
      };

      ws.send(JSON.stringify({
        type: 'NIUNIU_ROOM_CREATED',
        data: { roomId: newRoomId, room: niuniuRooms[newRoomId] }
      }));

      // 5. 呼叫回調通知聊天室
      if (callbacks && callbacks.onRoomCreated) {
        callbacks.onRoomCreated(newRoomId);
      }
      break;
    }

    case 'NIUNIU_JOIN_ROOM': {
      const room = niuniuRooms[roomId];
      
      // 1. 先確認房間到底存不存在
      if (!room) {
        return ws.send(JSON.stringify({ type: 'NIUNIU_ERROR', data: { message: '房間不存在' } }));
      }
      
      // 2. 確認存在後，再把房間 ID 綁定到連線上
      ws._niuniuRoomId = roomId;

      // 3. 確認房間狀態是否允許加入
      if (room.status !== 'waiting') {
        return ws.send(JSON.stringify({ type: 'NIUNIU_ERROR', data: { message: '遊戲已經開始，無法加入' } }));
      }

      // 4. 檢查玩家是否已經在房間內，不在的話就把他加進去
      if (!room.players.some(p => p.name === username)) {
        room.players.push({ name: username, isReady: false, hand: [], result: null, chips: 1000, scoreChange: 0 });
      }

      // 5. 廣播給房間所有人：有新玩家加入
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
        player.result = data.manualResult || { type: '無牛', weight: 0 };
        player.isReady = true;

        // 檢查是否所有人都已經提交 (ready)
        const allReady = room.players.every(p => p.isReady);
        
        broadcastToRoom(roomId, {
          type: 'NIUNIU_PLAYER_SUBMITTED',
          data: { username: player.name, allReady, room } 
        });

        // 如果全部提交完畢，進入攤牌階段
        // 如果全部提交完畢，進入攤牌階段與算分
        if (allReady) {
          const dealer = room.players.find(p => p.name === room.dealer);
          const baseBet = 10; // 底注 10
          
          // 重置所有人這局的得分變化
          room.players.forEach(p => p.scoreChange = 0);

          if (dealer) {
            room.players.forEach(p => {
              if (p.name !== dealer.name) { // 閒家跟庄家比
                const isDealerWin = compareHands(dealer.hand, dealer.result, p.hand, p.result);
                const winnerResult = isDealerWin ? dealer.result : p.result;
                const multiplier = getMultiplier(winnerResult.weight);
                const amount = baseBet * multiplier;

                if (isDealerWin) {
                  dealer.scoreChange += amount;
                  dealer.chips += amount;
                  p.scoreChange -= amount;
                  p.chips -= amount;
                } else {
                  dealer.scoreChange -= amount;
                  dealer.chips -= amount;
                  p.scoreChange += amount;
                  p.chips += amount;
                }
              }
            });
          }

          room.status = 'showdown';
          broadcastToRoom(roomId, {
            type: 'NIUNIU_SHOWDOWN',
            data: { room }
          });
          
          setTimeout(() => {
            room.status = 'waiting';
            room.players.forEach(p => { p.isReady = false; p.scoreChange = 0; }); // 清空當局變化
            broadcastToRoom(roomId, {
              type: 'NIUNIU_ROUND_ENDED',
              data: { room }
            });
          }, 10000); 
        }
      }
      break;
    }

    // ✨ 新增：離開房間事件
    case 'NIUNIU_LEAVE_ROOM': {
      const room = niuniuRooms[roomId];
      delete ws._niuniuRoomId;
      if (!room) return;

      if (room.owner === username) {
        // 房主離開，直接解散房間
        delete niuniuRooms[roomId];
        broadcastToRoom(roomId, { type: 'NIUNIU_ERROR', data: { message: '房主已離開，房間解散' } });
      } else {
        // 閒家離開，將他從列表中移除
        room.players = room.players.filter(p => p.name !== username);
        broadcastToRoom(roomId, { type: 'NIUNIU_PLAYER_JOINED', data: { room } });
      }
      break;
    }

    // ✨ 新增：處理玩家發送表情
    case 'NIUNIU_SEND_EMOJI': {
      const room = niuniuRooms[roomId];
      if (!room) return;
      
      // 直接廣播給房間所有人 (包含發送者自己)
      broadcastToRoom(roomId, {
        type: 'NIUNIU_SHOW_EMOJI',
        data: { username, emoji: data.emoji }
      });
      break;
    }

  }
}

// ✨ 修改清理函數，接收 roomId 參數，只清理該連線確實存在的房間
export function cleanupNiuNiuConnection(username, roomId, wss) {
  if (!roomId) return; // 如果這條斷開的連線根本沒進房間（例如聊天室舊連線），就直接忽略！

  const room = niuniuRooms[roomId];
  if (!room) return;

  if (room.owner === username) {
    // 房主斷線，通知其他人並解散
    const playerNames = room.players.map(p => p.name);
    wss.clients.forEach(client => {
      if (client.readyState === 1 && client._username && playerNames.includes(client._username)) {
        client.send(JSON.stringify({ type: 'NIUNIU_ERROR', data: { message: '房主已斷線，房間解散' } }));
      }
    });
    delete niuniuRooms[roomId];
  } else {
    // 閒家斷線，直接移除
    room.players = room.players.filter(p => p.name !== username);
    
    // 廣播給其他人他離開了，更新房間狀態
    const playerNames = room.players.map(p => p.name);
    wss.clients.forEach(client => {
      if (client.readyState === 1 && client._username && playerNames.includes(client._username)) {
        client.send(JSON.stringify({ type: 'NIUNIU_PLAYER_JOINED', data: { room } }));
      }
    });
  }
}