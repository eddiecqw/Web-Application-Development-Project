// loveletterHandler.mjs

export const loveletterRooms = {};

// ==========================================
// 1. 核心卡牌與遊戲演算法
// ==========================================

// 16張標準情書卡牌庫
const CARD_DEFINITIONS = [
  { value: 1, name: '衛兵', count: 5 },
  { value: 2, name: '神父', count: 2 },
  { value: 3, name: '男爵', count: 2 },
  { value: 4, name: '侍女', count: 2 },
  { value: 5, name: '王子', count: 2 },
  { value: 6, name: '國王', count: 1 },
  { value: 7, name: '伯爵夫人', count: 1 },
  { value: 8, name: '公主', count: 1 }
];

// 建立並洗牌
function createDeck() {
  let deck = [];
  CARD_DEFINITIONS.forEach(def => {
    for (let i = 0; i < def.count; i++) {
      deck.push({ value: def.value, name: def.name });
    }
  });
  
  // Fisher-Yates 洗牌
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// 防作弊機制：過濾視角 (只傳送玩家該看的資訊)
function getSafeRoomState(room, username) {
  const safeRoom = JSON.parse(JSON.stringify(room));
  
  // 隱藏牌庫與神秘暗牌
  delete safeRoom.deck;
  delete safeRoom.removedCard;

  if (safeRoom.status === 'playing') {
    safeRoom.players.forEach(p => {
      // 如果不是自己，且對方還活著，隱藏其手牌
      if (p.name !== username && p.isAlive) {
        p.hand = p.hand.map(() => ({ isHidden: true }));
      }
      // 如果對方已出局，可以顯示他最後持有的牌 (攤牌)
    });
  }
  return safeRoom;
}

// 廣播給房間所有人
function broadcastToRoom(roomId, eventType, wss) {
  const room = loveletterRooms[roomId];
  if (!room) return;
  const playerNames = room.players.map(p => p.name);
  wss.clients.forEach(client => {
    if (client.readyState === 1 && client._username && playerNames.includes(client._username)) {
      const safeRoom = getSafeRoomState(room, client._username);
      client.send(JSON.stringify({ type: eventType, data: { room: safeRoom } }));
    }
  });
}

// ==========================================
// 2. 回合推進與結算邏輯
// ==========================================

// 檢查是否達到回合結束條件
function checkRoundEnd(roomId, wss, actionLog) {
  const room = loveletterRooms[roomId];
  const alivePlayers = room.players.filter(p => p.isAlive);
  
  let roundOver = false;
  let winners = [];

  // 條件 1：只剩一名玩家存活
  if (alivePlayers.length === 1) {
    roundOver = true;
    winners = [alivePlayers[0]];
    actionLog += ` ➔ 只剩【${winners[0].name.split('@')[0]}】存活，贏得本局！`;
  } 
  // 條件 2：牌庫抽乾了，比手牌大小
  else if (room.deck.length === 0) {
    roundOver = true;
    let maxVal = -1;
    alivePlayers.forEach(p => {
      if (p.hand[0].value > maxVal) maxVal = p.hand[0].value;
    });
    winners = alivePlayers.filter(p => p.hand[0].value === maxVal);
    actionLog += ` ➔ 牌庫耗盡！【${winners.map(w => w.name.split('@')[0]).join(', ')}】以最大點數 ${maxVal} 獲勝！`;
  }

  if (roundOver) {
    room.status = 'showdown';
    room.actionLog = actionLog;
    
    // 發送好感指示物
    winners.forEach(w => {
      const p = room.players.find(player => player.name === w.name);
      if (p) p.tokens += 1;
    });

    broadcastToRoom(roomId, 'LL_SHOWDOWN', wss);

    // 檢查是否有人贏得整場遊戲 (通常是 4 個 Token)
    const gameWinner = room.players.find(p => p.tokens >= room.settings.winTokens);
    
    setTimeout(() => {
      if (loveletterRooms[roomId]) {
        if (gameWinner) {
          loveletterRooms[roomId].status = 'game_over';
          loveletterRooms[roomId].winner = gameWinner.name;
          broadcastToRoom(roomId, 'LL_GAME_OVER', wss);
        } else {
          // 重置準備下一局
          loveletterRooms[roomId].status = 'waiting';
          loveletterRooms[roomId].players.forEach(p => {
            p.hand = []; p.isAlive = true; p.isProtected = false;
          });
          loveletterRooms[roomId].discardPile = [];
          broadcastToRoom(roomId, 'LL_ROUND_ENDED', wss);
        }
      }
    }, 5000);
    return true; // 回合結束
  }
  return false; // 回合繼續
}

// 推進到下一個活著的玩家
function advanceTurn(roomId, wss, actionLog) {
  const room = loveletterRooms[roomId];
  if (!room) return;

  room.actionLog = actionLog;
  
  if (checkRoundEnd(roomId, wss, actionLog)) return;

  // 找下一個活著的玩家
  do {
    room.turnIndex = (room.turnIndex + 1) % room.players.length;
  } while (!room.players[room.turnIndex].isAlive);

  const nextPlayer = room.players[room.turnIndex];
  room.turn = nextPlayer.name;
  
  // 輪到該玩家，解除侍女保護
  nextPlayer.isProtected = false;
  
  // 抽牌 (如果牌庫有牌)
  if (room.deck.length > 0) {
    nextPlayer.hand.push(room.deck.pop());
  }

  broadcastToRoom(roomId, 'LL_GAME_UPDATE', wss);
}


// ==========================================
// 3. 路由處理器 (WebSocket Handler)
// ==========================================

export function handleLoveLetterMessage(ws, type, data, wss, callbacks) {
  const { roomId, username } = data;

  switch (type) {
    case 'LL_CREATE_ROOM': {
      for (const id in loveletterRooms) {
        if (loveletterRooms[id].owner === username) delete loveletterRooms[id];
      }
      const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      ws._llRoomId = newRoomId;

      loveletterRooms[newRoomId] = {
        id: newRoomId,
        owner: username,
        status: 'waiting', 
        settings: { winTokens: data.winTokens || 4 },
        deck: [], discardPile: [], removedCard: null,
        turnIndex: 0, turn: null, actionLog: '', winner: null,
        players: [{ name: username, tokens: 0, hand: [], isAlive: true, isProtected: false }]
      };

      ws.send(JSON.stringify({ type: 'LL_ROOM_CREATED', data: { roomId: newRoomId, room: loveletterRooms[newRoomId] } }));
      if (callbacks && callbacks.onRoomCreated) callbacks.onRoomCreated(newRoomId, '情書 (Love Letter)');
      break;
    }

    case 'LL_JOIN_ROOM': {
      const room = loveletterRooms[roomId];
      if (!room) return ws.send(JSON.stringify({ type: 'LL_ERROR', data: { message: '房間不存在' } }));
      if (room.status !== 'waiting') return ws.send(JSON.stringify({ type: 'LL_ERROR', data: { message: '遊戲進行中，無法加入' } }));
      ws._llRoomId = roomId;
      
      if (!room.players.some(p => p.name === username)) {
        room.players.push({ name: username, tokens: 0, hand: [], isAlive: true, isProtected: false });
      }
      broadcastToRoom(roomId, 'LL_PLAYER_JOINED', wss);
      break;
    }

    case 'LL_START_GAME': {
      const room = loveletterRooms[roomId];
      if (!room || room.owner !== username || room.players.length < 2) return;

      room.status = 'playing';
      room.deck = createDeck();
      room.discardPile = [];
      room.removedCard = room.deck.pop(); // 開局暗置一張

      // 所有人發 1 張牌
      room.players.forEach(p => {
        p.hand = [room.deck.pop()];
        p.isAlive = true;
        p.isProtected = false;
      });

      // 隨機決定起始玩家
      room.turnIndex = Math.floor(Math.random() * room.players.length);
      room.turn = room.players[room.turnIndex].name;
      room.actionLog = '遊戲開始！';
      
      // 起始玩家多抽 1 張
      room.players[room.turnIndex].hand.push(room.deck.pop());

      broadcastToRoom(roomId, 'LL_GAME_STARTED', wss);
      break;
    }

    case 'LL_PLAY_CARD': {
      const room = loveletterRooms[roomId];
      if (!room || room.status !== 'playing' || room.turn !== username) return;

      const player = room.players[room.turnIndex];
      const { cardValue, targetName, guessValue } = data;

      // 1. 檢查是否真的持有這張牌
      const cardIndex = player.hand.findIndex(c => c.value === cardValue);
      if (cardIndex === -1) return;

      // 2. 🚨 伯爵夫人強制出牌檢查
      const hasCountess = player.hand.some(c => c.value === 7);
      const hasKingOrPrince = player.hand.some(c => c.value === 5 || c.value === 6);
      if (hasCountess && hasKingOrPrince && cardValue !== 7) {
        return ws.send(JSON.stringify({ type: 'LL_ERROR', data: { message: '同時持有伯爵夫人與國王/王子時，必須強制打出伯爵夫人！' } }));
      }

      // 3. 取出牌並放入棄牌堆
      const playedCard = player.hand.splice(cardIndex, 1)[0];
      room.discardPile.push({ ...playedCard, playedBy: username });
      
      const targetPlayer = targetName ? room.players.find(p => p.name === targetName) : null;
      let actionLog = `【${username.split('@')[0]}】打出了 [${playedCard.name}]`;

      // 4. 執行卡牌效果 (卡牌裁決引擎)
      if (targetPlayer && targetPlayer.isProtected && cardValue !== 5) {
        // 如果目標被侍女保護 (除了王子可以指定自己外，通常免疫)
        actionLog += `，但目標受侍女保護，無事發生。`;
      } 
      else {
        switch (cardValue) {
          case 1: // 衛兵
            if (targetPlayer && guessValue) {
              actionLog += `，猜測【${targetName.split('@')[0]}】是 [${CARD_DEFINITIONS.find(c=>c.value===guessValue).name}]`;
              if (targetPlayer.hand[0].value === guessValue) {
                targetPlayer.isAlive = false;
                actionLog += ` ➔ 猜中了！目標出局！`;
              } else {
                actionLog += ` ➔ 猜錯了。`;
              }
            }
            break;

          case 2: // 神父 (私密傳訊)
            if (targetPlayer) {
              actionLog += `，偷看了【${targetName.split('@')[0]}】的手牌。`;
              ws.send(JSON.stringify({ type: 'LL_PRIVATE_INFO', data: { targetName, hand: targetPlayer.hand } }));
            }
            break;

          case 3: // 男爵
            if (targetPlayer) {
              const myCard = player.hand[0].value;
              const targetCard = targetPlayer.hand[0].value;
              actionLog += `，與【${targetName.split('@')[0]}】秘密對決`;
              if (myCard > targetCard) {
                targetPlayer.isAlive = false;
                actionLog += ` ➔ 贏了！目標出局。`;
              } else if (myCard < targetCard) {
                player.isAlive = false;
                actionLog += ` ➔ 輸了！自己出局。`;
              } else {
                actionLog += ` ➔ 平手，無事發生。`;
              }
            }
            break;

          case 4: // 侍女
            player.isProtected = true;
            actionLog += `，獲得一回合的保護盾🛡️。`;
            break;

          case 5: // 王子
            if (targetPlayer) {
              actionLog += `，強迫【${targetName.split('@')[0]}】棄牌`;
              const discarded = targetPlayer.hand.pop();
              room.discardPile.push({ ...discarded, playedBy: targetName }); // 棄牌公開
              
              if (discarded.value === 8) {
                targetPlayer.isAlive = false;
                actionLog += ` ➔ 目標棄掉了公主，直接出局！`;
              } else {
                // 重新抽牌 (如果沒牌了，抽暗置的神秘牌)
                const newCard = room.deck.length > 0 ? room.deck.pop() : room.removedCard;
                targetPlayer.hand.push(newCard);
                actionLog += ` ➔ 目標重新抽了一張牌。`;
              }
            }
            break;

          case 6: // 國王
            if (targetPlayer) {
              const temp = player.hand[0];
              player.hand[0] = targetPlayer.hand[0];
              targetPlayer.hand[0] = temp;
              actionLog += `，與【${targetName.split('@')[0]}】交換了手牌！`;
            }
            break;

          case 7: // 伯爵夫人
            actionLog += `，什麼都沒做。`;
            break;

          case 8: // 公主
            player.isAlive = false;
            actionLog += `，竟然主動丟棄了公主！自己出局。`;
            break;
        }
      }

      // 結算完畢，推動回合
      advanceTurn(roomId, wss, actionLog);
      break;
    }

    case 'LL_SEND_EMOJI': {
      const room = loveletterRooms[roomId];
      if (!room) return;
      const playerNames = room.players.map(p => p.name);
      wss.clients.forEach(client => {
        if (client.readyState === 1 && client._username && playerNames.includes(client._username)) {
          client.send(JSON.stringify({ type: 'LL_SHOW_EMOJI', data: { username, emoji: data.emoji } }));
        }
      });
      break;
    }

    case 'LL_LEAVE_ROOM': {
      delete ws._llRoomId;
      handleLLPlayerLeave(roomId, username, wss);
      break;
    }
  }
}

// 處理玩家離開
function handleLLPlayerLeave(roomId, username, wss) {
  const room = loveletterRooms[roomId];
  if (!room) return;

  room.players = room.players.filter(p => p.name !== username);

  if (room.players.length === 0) {
    delete loveletterRooms[roomId];
    return;
  }
  if (room.owner === username) room.owner = room.players[0].name;

  if (room.status === 'playing') {
    // 遊戲中有人逃跑，強制結束防卡死
    room.status = 'waiting';
    room.players.forEach(p => { p.hand = []; p.isAlive = true; });
    broadcastToRoom(roomId, 'LL_ERROR', wss); // 通知前端顯示警告
    broadcastToRoom(roomId, 'LL_ROUND_ENDED', wss);
  } else {
    broadcastToRoom(roomId, 'LL_PLAYER_JOINED', wss);
  }
}

export function cleanupLoveLetterConnection(username, roomId, wss) {
  if (!roomId) return;
  handleLLPlayerLeave(roomId, username, wss);
}