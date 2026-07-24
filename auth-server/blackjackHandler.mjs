// blackjackHandler.mjs

export const blackjackRooms = {};

// ==========================================
// 1. 核心演算法
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
  while (score > 21 && aces > 0) {
    score -= 10;
    aces -= 1;
  }
  return score;
}

// ✨ 針對不同玩家，客製化過濾暗牌
function getSafeRoomState(room, username) {
  const safeRoom = JSON.parse(JSON.stringify(room));
  delete safeRoom.shoe;
  
  if (safeRoom.status === 'playing') {
    // 隱藏莊家第二張牌
    if (safeRoom.dealer && safeRoom.dealer.hand.length >= 2) {
      safeRoom.dealer.hand[1] = { isHidden: true };
      safeRoom.dealer.score = calculateScore([safeRoom.dealer.hand[0]]); 
    }
    // ✨ 隱藏其他閒家的第二張(含)以後的牌
    safeRoom.players.forEach(p => {
      if (p.name !== username && p.hand.length > 0) {
        p.hand = p.hand.map((card, idx) => idx === 0 ? card : { isHidden: true });
        p.score = calculateScore([p.hand[0]]);
      }
    });
  }
  return safeRoom;
}

// 共用的廣播函數
function broadcastToRoom(roomId, eventType, wss) {
  const room = blackjackRooms[roomId];
  if (!room) return;
  const playerNames = room.players.map(p => p.name);
  wss.clients.forEach(client => {
    if (client.readyState === 1 && client._username && playerNames.includes(client._username)) {
      // 每個 client 收到屬於自己的安全封包
      const safeRoom = getSafeRoomState(room, client._username);
      client.send(JSON.stringify({ type: eventType, data: { room: safeRoom } }));
    }
  });
}

// ==========================================
// 2. 回合推進與結算邏輯
// ==========================================
function advanceTurn(roomId, wss) {
  const room = blackjackRooms[roomId];
  if (!room) return;

  room.currentPlayerIndex += 1;

  // ✨ 如果這局的玩家是「莊家」，直接跳過他的閒家回合
  while (room.currentPlayerIndex < room.players.length && room.players[room.currentPlayerIndex].name === room.dealerName) {
    room.currentPlayerIndex++;
  }

  if (room.currentPlayerIndex >= room.players.length) {
    room.status = 'showdown';
    room.turn = 'dealer';
    
    // 莊家補牌
    while (room.dealer.score < 17) {
      room.dealer.hand.push(room.shoe.pop());
      room.dealer.score = calculateScore(room.dealer.hand);
    }

    // ✨ 結算邏輯 (加入玩家當莊的籌碼轉移)
    let dealerProfit = 0; 
    const isDealerBJ = room.dealer.score === 21 && room.dealer.hand.length === 2;

    room.players.forEach(player => {
      if (player.name === room.dealerName) return; // 莊家不參與一般結算
      
      const pScore = player.score;
      const dScore = room.dealer.score;
      const bet = player.currentBet;
      const isPlayerBJ = pScore === 21 && player.hand.length === 2;

      if (pScore > 21) {
        player.result = '爆牌 (Bust)';
        player.scoreChange = -bet;
        dealerProfit += bet; // 莊家贏錢
      } else if (isPlayerBJ && !isDealerBJ) {
        player.result = 'Blackjack! 贏 1.5 倍';
        player.chips += bet + (bet * 1.5);
        player.scoreChange = bet * 1.5;
        dealerProfit -= (bet * 1.5); // 莊家賠錢
      } else if (dScore > 21) {
        player.result = '莊家爆牌，你贏了！';
        player.chips += (bet * 2); 
        player.scoreChange = bet;
        dealerProfit -= bet;
      } else if (pScore > dScore) {
        player.result = '贏了！';
        player.chips += (bet * 2);
        player.scoreChange = bet;
        dealerProfit -= bet;
      } else if (pScore === dScore) {
        player.result = '平手 (Push)';
        player.chips += bet;
        player.scoreChange = 0;
      } else {
        player.result = '莊家獲勝';
        player.scoreChange = -bet;
        dealerProfit += bet;
      }
    });

    // 結算玩家莊家的籌碼
    const dealerPlayer = room.players.find(p => p.name === room.dealerName);
    if (dealerPlayer) {
      dealerPlayer.chips += dealerProfit;
      dealerPlayer.scoreChange = dealerProfit;
      dealerPlayer.result = dealerProfit >= 0 ? `當莊贏了 ${dealerProfit}` : `當莊輸了 ${Math.abs(dealerProfit)}`;
    }

    broadcastToRoom(roomId, 'BJ_SHOWDOWN', wss);

    setTimeout(() => {
      if (blackjackRooms[roomId]) {
        blackjackRooms[roomId].status = 'waiting';
        // ✨ 如果是輪流當莊，切換下一個莊家
        if (blackjackRooms[roomId].settings.rotateDealer) {
          blackjackRooms[roomId].dealerIndex = (blackjackRooms[roomId].dealerIndex + 1) % blackjackRooms[roomId].players.length;
          blackjackRooms[roomId].dealerName = blackjackRooms[roomId].players[blackjackRooms[roomId].dealerIndex].name;
        }
        blackjackRooms[roomId].players.forEach(p => {
          p.hand = []; p.score = 0; p.currentBet = 0; p.result = null; p.scoreChange = 0; p.status = 'waiting';
        });
        blackjackRooms[roomId].dealer = { hand: [], score: 0 };
        broadcastToRoom(roomId, 'BJ_ROUND_ENDED', wss);
      }
    }, 4000);

  } else {
    room.turn = room.players[room.currentPlayerIndex].name;
    if (room.players[room.currentPlayerIndex].score === 21) {
      advanceTurn(roomId, wss);
    } else {
      broadcastToRoom(roomId, 'BJ_GAME_UPDATE', wss);
    }
  }
}

// ✨ 處理玩家離開房間與「房主繼承」
function handlePlayerLeave(roomId, username, wss) {
  const room = blackjackRooms[roomId];
  if (!room) return;

  room.players = room.players.filter(p => p.name !== username);

  if (room.players.length === 0) {
    delete blackjackRooms[roomId];
    return;
  }

  // ✨ 房主繼承給下一個人
  if (room.owner === username) {
    room.owner = room.players[0].name; 
  }

  if (room.status === 'playing') {
    if (room.dealerName === username) {
      // 莊家逃跑了，強制結束本局
      wss.clients.forEach(c => {
        if (c.readyState === 1 && c._bjRoomId === roomId) {
          c.send(JSON.stringify({ type: 'BJ_ERROR', data: { message: '莊家逃跑了，本局強制結束！' } }));
        }
      });
      room.status = 'waiting';
      room.players.forEach(p => { p.hand = []; p.score = 0; p.currentBet = 0; p.result = null; p.scoreChange = 0; });
      broadcastToRoom(roomId, 'BJ_ROUND_ENDED', wss);
      return;
    }
    if (room.turn === username) {
      advanceTurn(roomId, wss);
      return;
    }
  }
  broadcastToRoom(roomId, 'BJ_PLAYER_JOINED', wss);
}

// ==========================================
// 3. 路由處理器
// ==========================================
export function handleBlackjackMessage(ws, type, data, wss, callbacks) {
  const { roomId, username } = data;

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
        deckCount: data.deckCount || 4,
        rotateDealer: data.rotateDealer || false // ✨ 新增輪流做莊設定
      };

      blackjackRooms[newRoomId] = {
        id: newRoomId,
        owner: username,
        status: 'waiting', 
        settings: settings,
        shoe: [],
        dealerIndex: 0,
        dealerName: settings.rotateDealer ? username : 'System',
        dealer: { hand: [], score: 0 },
        players: [{ name: username, chips: 1000, hand: [], score: 0, currentBet: 0, result: null, scoreChange: 0, status: 'waiting' }]
      };

      ws.send(JSON.stringify({
        type: 'BJ_ROOM_CREATED',
        data: { roomId: newRoomId, room: getSafeRoomState(blackjackRooms[newRoomId], username) }
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
        room.players.push({ name: username, chips: 1000, hand: [], score: 0, currentBet: 0, result: null, scoreChange: 0, status: 'waiting' });
      }
      broadcastToRoom(roomId, 'BJ_PLAYER_JOINED', wss);
      break;
    }

    case 'BJ_START_GAME': {
      const room = blackjackRooms[roomId];
      if (!room || room.owner !== username) return;

      // ✨ 如果開啟輪流做莊，檢查人數
      if (room.settings.rotateDealer && room.players.length < 2) {
        return ws.send(JSON.stringify({ type: 'BJ_ERROR', data: { message: '輪流做莊模式至少需要 2 名玩家！' } }));
      }

      room.status = 'playing'; 
      room.shoe = createShoe(room.settings.deckCount);
      
      // 更新本局莊家
      if (room.settings.rotateDealer) {
        room.dealerName = room.players[room.dealerIndex % room.players.length].name;
      } else {
        room.dealerName = 'System';
      }

      room.players.forEach(player => {
        if (player.name === room.dealerName) {
          player.status = 'dealer';
          player.hand = [];
        } else {
          player.chips -= room.settings.baseBet; 
          player.currentBet = room.settings.baseBet;
          player.result = null;
          player.scoreChange = 0;
          player.hand = [room.shoe.pop(), room.shoe.pop()];
          player.score = calculateScore(player.hand);
          player.status = 'playing';
        }
      });

      room.dealer = { hand: [room.shoe.pop(), room.shoe.pop()] };
      room.dealer.score = calculateScore(room.dealer.hand);

      room.currentPlayerIndex = -1; // 初始化
      advanceTurn(roomId, wss); // 自動跳到第一個閒家
      
      broadcastToRoom(roomId, 'BJ_GAME_STARTED', wss);
      break;
    }

    case 'BJ_HIT': {
      const room = blackjackRooms[roomId];
      if (!room || room.status !== 'playing' || room.turn !== username) return;

      const player = room.players[room.currentPlayerIndex];
      player.hand.push(room.shoe.pop());
      player.score = calculateScore(player.hand);

      if (player.score >= 21) advanceTurn(roomId, wss);
      else broadcastToRoom(roomId, 'BJ_GAME_UPDATE', wss);
      break;
    }

    case 'BJ_STAND': {
      const room = blackjackRooms[roomId];
      if (!room || room.status !== 'playing' || room.turn !== username) return;
      advanceTurn(roomId, wss);
      break;
    }

    case 'BJ_SEND_EMOJI': {
      const room = blackjackRooms[roomId];
      if (!room) return;
      const playerNames = room.players.map(p => p.name);
      wss.clients.forEach(client => {
        if (client.readyState === 1 && client._username && playerNames.includes(client._username)) {
          client.send(JSON.stringify({ type: 'BJ_SHOW_EMOJI', data: { username: username, emoji: data.emoji } }));
        }
      });
      break;
    }

    case 'BJ_LEAVE_ROOM': {
      delete ws._bjRoomId;
      handlePlayerLeave(roomId, username, wss);
      break;
    }
  }
}

export function cleanupBlackjackConnection(username, roomId, wss) {
  if (!roomId) return;
  delete wss._bjRoomId;
  handlePlayerLeave(roomId, username, wss);
}