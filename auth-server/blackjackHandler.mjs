// blackjackHandler.mjs

// 儲存所有 21 點房間的狀態
export const blackjackRooms = {};

// ==========================================
// 1. 核心演算法：多副牌洗牌與 21 點計分
// ==========================================

function createShoe(deckCount) {
  const suits = ['♠', '♥', '♣', '♦'];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  let shoe = [];

  for (let d = 0; d < deckCount; d++) {
    for (let suit of suits) {
      for (let rank of ranks) {
        let value = (rank === 'A') ? 11 : (['J', 'Q', 'K'].includes(rank) ? 10 : parseInt(rank));
        let color = (suit === '♥' || suit === '♦') ? 'red' : 'black';
        shoe.push({ suit, rank, value, color });
      }
    }
  }

  // Fisher-Yates 洗牌
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return shoe;
}

function calculateScore(hand) {
  let score = 0;
  let aces = 0;

  for (let card of hand) {
    if (!card || card.isHidden) continue;
    score += card.value;
    if (card.rank === 'A') aces += 1;
  }

  // A 的彈性計分：如果爆牌且有 A，就把 A 從 11 點當成 1 點
  while (score > 21 && aces > 0) {
    score -= 10;
    aces -= 1;
  }
  return score;
}

// 輔助函數：取得安全的房間狀態 (隱藏莊家暗牌與剩餘牌靴)
function getSafeRoomState(room) {
  const safeRoom = JSON.parse(JSON.stringify(room));
  delete safeRoom.shoe; // 節省頻寬，防作弊
  
  // 如果還在玩家回合，必須隱藏莊家第二張牌
  if (safeRoom.status === 'playing' && safeRoom.dealer && safeRoom.dealer.hand.length >= 2) {
    safeRoom.dealer.hand[1] = { isHidden: true };
    safeRoom.dealer.score = calculateScore([safeRoom.dealer.hand[0]]); // 莊家分數只顯示明牌
  }
  return safeRoom;
}

// ==========================================
// 2. 路由處理器 (導流所有 21 點 WebSocket 請求)
// ==========================================
export function handleBlackjackMessage(ws, type, data, wss, callbacks) {
  const { roomId, username } = data;

  const broadcastToRoom = (id, eventType) => {
    const room = blackjackRooms[id];
    if (!room) return;
    const safeRoom = getSafeRoomState(room);
    const playerNames = room.players.map(p => p.name);
    
    wss.clients.forEach(client => {
      if (client.readyState === 1 && client._username && playerNames.includes(client._username)) {
        client.send(JSON.stringify({ type: eventType, data: { room: safeRoom } }));
      }
    });
  };

  // 處理換下一位玩家或莊家回合
  const nextTurn = (room) => {
    room.currentPlayerIndex += 1;
    
    // 如果所有玩家都行動完畢，進入莊家回合與結算
    if (room.currentPlayerIndex >= room.players.length) {
      room.status = 'showdown';
      room.turn = 'dealer';
      
      // 莊家強制規則：未滿 17 點必須要牌
      while (room.dealer.score < 17) {
        room.dealer.hand.push(room.shoe.pop());
        room.dealer.score = calculateScore(room.dealer.hand);
      }

      // 結算所有玩家輸贏
      room.players.forEach(player => {
        const pScore = player.score;
        const dScore = room.dealer.score;
        const bet = player.currentBet;
        
        // 判斷玩家是否起手 Blackjack (21點且只有兩張牌)
        const isPlayerBJ = pScore === 21 && player.hand.length === 2;
        const isDealerBJ = dScore === 21 && room.dealer.hand.length === 2;

        if (pScore > 21) {
          player.result = '爆牌 (Bust)';
          player.scoreChange = -bet; // 已在開局扣除，這裡只做 UI 顯示
        } else if (isPlayerBJ && !isDealerBJ) {
          player.result = 'Blackjack! 贏 1.5 倍';
          const winAmount = bet + (bet * 1.5);
          player.chips += winAmount; 
          player.scoreChange = bet * 1.5;
        } else if (dScore > 21) {
          player.result = '莊家爆牌，你贏了！';
          player.chips += (bet * 2); 
          player.scoreChange = bet;
        } else if (pScore > dScore) {
          player.result = '贏了！';
          player.chips += (bet * 2);
          player.scoreChange = bet;
        } else if (pScore === dScore) {
          player.result = '平手 (Push)';
          player.chips += bet; // 退回本金
          player.scoreChange = 0;
        } else {
          player.result = '莊家獲勝';
          player.scoreChange = -bet;
        }
      });

      broadcastToRoom(roomId, 'BJ_SHOWDOWN');

      // 8秒後重置房間狀態，準備下一局
      setTimeout(() => {
        if (blackjackRooms[roomId]) {
          blackjackRooms[roomId].status = 'waiting';
          blackjackRooms[roomId].players.forEach(p => {
            p.hand = []; p.score = 0; p.currentBet = 0; p.result = null; p.scoreChange = 0;
          });
          blackjackRooms[roomId].dealer = { hand: [], score: 0 };
          broadcastToRoom(roomId, 'BJ_ROUND_ENDED');
        }
      }, 8000);

    } else {
      // 換下一位閒家
      room.turn = room.players[room.currentPlayerIndex].name;
      
      // 如果該玩家起手就 21 點 (Blackjack)，自動跳過他的回合
      if (room.players[room.currentPlayerIndex].score === 21) {
        nextTurn(room);
      } else {
        broadcastToRoom(roomId, 'BJ_GAME_UPDATE');
      }
    }
  };


  switch (type) {
    case 'BJ_CREATE_ROOM': {
      for (const id in blackjackRooms) {
        if (blackjackRooms[id].owner === username) delete blackjackRooms[id];
      }
      const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      ws._bjRoomId = newRoomId;

      const settings = {
        timeLimit: data.timeLimit || 15,
        baseBet: data.baseBet || 10,
        deckCount: data.deckCount || 4
      };

      blackjackRooms[newRoomId] = {
        id: newRoomId,
        owner: username,
        status: 'waiting', 
        settings: settings,
        shoe: [],
        dealer: { hand: [], score: 0 },
        players: [{ name: username, chips: 1000, hand: [], score: 0, currentBet: 0, result: null, scoreChange: 0 }]
      };

      ws.send(JSON.stringify({
        type: 'BJ_ROOM_CREATED',
        data: { roomId: newRoomId, room: getSafeRoomState(blackjackRooms[newRoomId]) }
      }));

      if (callbacks && callbacks.onRoomCreated) callbacks.onRoomCreated(newRoomId, '21點 (Blackjack)');
      break;
    }

    case 'BJ_JOIN_ROOM': {
      const room = blackjackRooms[roomId];
      if (!room) return ws.send(JSON.stringify({ type: 'BJ_ERROR', data: { message: '房間不存在' } }));
      if (room.status !== 'waiting') return ws.send(JSON.stringify({ type: 'BJ_ERROR', data: { message: '遊戲進行中，無法加入' } }));
      ws._bjRoomId = roomId;
      if (!room.players.some(p => p.name === username)) {
        room.players.push({ name: username, chips: 1000, hand: [], score: 0, currentBet: 0, result: null, scoreChange: 0 });
      }
      broadcastToRoom(roomId, 'BJ_PLAYER_JOINED');
      break;
    }

    case 'BJ_START_GAME': {
      const room = blackjackRooms[roomId];
      if (!room || room.owner !== username) return;

      room.status = 'playing'; 
      room.shoe = createShoe(room.settings.deckCount);

      room.players.forEach(player => {
        player.chips -= room.settings.baseBet; 
        player.currentBet = room.settings.baseBet;
        player.result = null;
        player.scoreChange = 0;
        player.hand = [room.shoe.pop(), room.shoe.pop()];
        player.score = calculateScore(player.hand);
      });

      room.dealer = { hand: [room.shoe.pop(), room.shoe.pop()] };
      room.dealer.score = calculateScore(room.dealer.hand);

      room.currentPlayerIndex = 0;
      room.turn = room.players[0].name;

      // 如果第一個人天生 21 點，自動換下一位
      if (room.players[0].score === 21) {
        nextTurn(room);
      } else {
        broadcastToRoom(roomId, 'BJ_GAME_STARTED');
      }
      break;
    }

    // ✨ 玩家選擇：要牌 (Hit)
    case 'BJ_HIT': {
      const room = blackjackRooms[roomId];
      if (!room || room.status !== 'playing' || room.turn !== username) return;

      const player = room.players[room.currentPlayerIndex];
      player.hand.push(room.shoe.pop());
      player.score = calculateScore(player.hand);

      if (player.score >= 21) {
        // 如果爆牌或剛好 21 點，強制結束他的回合，換下一個人
        nextTurn(room); 
      } else {
        broadcastToRoom(roomId, 'BJ_GAME_UPDATE');
      }
      break;
    }

    // ✨ 玩家選擇：停牌 (Stand)
    case 'BJ_STAND': {
      const room = blackjackRooms[roomId];
      if (!room || room.status !== 'playing' || room.turn !== username) return;
      
      nextTurn(room); // 直接換下一位
      break;
    }

    case 'BJ_SEND_EMOJI': {
      const room = blackjackRooms[roomId];
      if (!room) return;
      
      // 繞過預設的廣播機制，自訂表情的專屬封包
      const playerNames = room.players.map(p => p.name);
      wss.clients.forEach(client => {
        if (client.readyState === 1 && client._username && playerNames.includes(client._username)) {
          client.send(JSON.stringify({
            type: 'BJ_SHOW_EMOJI',
            data: { username: username, emoji: data.emoji } // ✨ 確保名字跟表情確實送出
          }));
        }
      });
      break;
    }

    case 'BJ_LEAVE_ROOM': {
      const room = blackjackRooms[roomId];
      delete ws._bjRoomId;
      if (!room) return;

      if (room.owner === username) {
        delete blackjackRooms[roomId];
        broadcastToRoom(roomId, 'BJ_ERROR'); // 通知房間解散
      } else {
        room.players = room.players.filter(p => p.name !== username);
        // 若該玩家輪到一半離開，強制換下一人
        if (room.status === 'playing' && room.turn === username) nextTurn(room);
        else broadcastToRoom(roomId, 'BJ_PLAYER_JOINED');
      }
      break;
    }
  }
}

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
    if (room.status === 'playing' && room.turn === username) {
      // 若該玩家輪到一半離開，強制換下一人
      room.currentPlayerIndex += 1;
      if (room.currentPlayerIndex >= room.players.length) {
        room.status = 'showdown';
        room.turn = 'dealer';
        // 簡化處理，直接結算
      } else {
        room.turn = room.players[room.currentPlayerIndex].name;
      }
    }
    const safeRoom = getSafeRoomState(room);
    const playerNames = room.players.map(p => p.name);
    wss.clients.forEach(client => {
      if (client.readyState === 1 && client._username && playerNames.includes(client._username)) {
        client.send(JSON.stringify({ type: 'BJ_PLAYER_JOINED', data: { room: safeRoom } }));
      }
    });
  }
}