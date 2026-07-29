// loveletterHandler.mjs

export const loveletterRooms = {};

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

function createDeck() {
  let deck = [];
  CARD_DEFINITIONS.forEach(def => {
    for (let i = 0; i < def.count; i++) deck.push({ value: def.value, name: def.name });
  });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// ✨ 修復 1：安全視角加入 deckCount，解決前端 0 張牌的問題
function getSafeRoomState(room, username) {
  const safeRoom = JSON.parse(JSON.stringify(room));
  safeRoom.deckCount = safeRoom.deck ? safeRoom.deck.length : 0; 
  delete safeRoom.deck;
  delete safeRoom.removedCard;

  if (safeRoom.status === 'playing') {
    safeRoom.players.forEach(p => {
      if (p.name !== username && p.isAlive) {
        p.hand = p.hand.map(() => ({ isHidden: true }));
      }
    });
  }
  return safeRoom;
}

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

// ✨ 修復 3：平手時，計算個人棄牌堆總點數的邏輯
function checkRoundEnd(roomId, wss, actionLog) {
  const room = loveletterRooms[roomId];
  const alivePlayers = room.players.filter(p => p.isAlive);
  
  let roundOver = false;
  let winners = [];

  if (alivePlayers.length === 1) {
    roundOver = true;
    winners = [alivePlayers[0]];
    actionLog += ` ➔ 只剩【${winners[0].name.split('@')[0]}】存活，贏得本局！`;
  } 
  else if (room.deck.length === 0) {
    roundOver = true;
    let maxVal = -1;
    alivePlayers.forEach(p => { if (p.hand[0].value > maxVal) maxVal = p.hand[0].value; });
    
    let tiedPlayers = alivePlayers.filter(p => p.hand[0].value === maxVal);

    if (tiedPlayers.length > 1) {
      // 發生平手，結算個人棄牌堆總和
      tiedPlayers.forEach(p => {
        p.discardSum = p.discarded.reduce((sum, card) => sum + card.value, 0);
      });
      let maxDiscardSum = -1;
      tiedPlayers.forEach(p => { if (p.discardSum > maxDiscardSum) maxDiscardSum = p.discardSum; });
      winners = tiedPlayers.filter(p => p.discardSum === maxDiscardSum);
      actionLog += ` ➔ 牌庫耗盡！最大點數同為 ${maxVal}，比對棄牌總和後，【${winners.map(w => w.name.split('@')[0]).join(', ')}】獲勝！`;
    } else {
      winners = tiedPlayers;
      actionLog += ` ➔ 牌庫耗盡！【${winners[0].name.split('@')[0]}】以最大點數 ${maxVal} 獲勝！`;
    }
  }

  if (roundOver) {
    room.status = 'showdown';
    room.actionLog = actionLog;
    winners.forEach(w => {
      const p = room.players.find(player => player.name === w.name);
      if (p) p.tokens += 1;
    });

    broadcastToRoom(roomId, 'LL_SHOWDOWN', wss);
    const gameWinner = room.players.find(p => p.tokens >= room.settings.winTokens);
    
    setTimeout(() => {
      if (loveletterRooms[roomId]) {
        if (gameWinner) {
          loveletterRooms[roomId].status = 'game_over';
          loveletterRooms[roomId].winner = gameWinner.name;
          broadcastToRoom(roomId, 'LL_GAME_OVER', wss);
        } else {
          loveletterRooms[roomId].status = 'waiting';
          loveletterRooms[roomId].players.forEach(p => {
            p.hand = []; p.discarded = []; p.isAlive = true; p.isProtected = false;
          });
          broadcastToRoom(roomId, 'LL_ROUND_ENDED', wss);
        }
      }
    }, 5000);
    return true;
  }
  return false; 
}

function advanceTurn(roomId, wss, actionLog) {
  const room = loveletterRooms[roomId];
  if (!room) return;
  room.actionLog = actionLog;
  if (checkRoundEnd(roomId, wss, actionLog)) return;

  do {
    room.turnIndex = (room.turnIndex + 1) % room.players.length;
  } while (!room.players[room.turnIndex].isAlive);

  const nextPlayer = room.players[room.turnIndex];
  room.turn = nextPlayer.name;
  nextPlayer.isProtected = false;
  
  if (room.deck.length > 0) nextPlayer.hand.push(room.deck.pop());
  broadcastToRoom(roomId, 'LL_GAME_UPDATE', wss);
}

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
        id: newRoomId, owner: username, status: 'waiting', 
        settings: { winTokens: data.winTokens || 4 },
        deck: [], removedCard: null, turnIndex: 0, turn: null, actionLog: '', winner: null,
        // ✨ 新增 nickname 欄位
        players: [{ name: username, nickname: data.nickname || username.split('@')[0], tokens: 0, hand: [], discarded: [], isAlive: true, isProtected: false }]
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
        // ✨ 新增 nickname 欄位
        room.players.push({ name: username, nickname: data.nickname || username.split('@')[0], tokens: 0, hand: [], discarded: [], isAlive: true, isProtected: false });
      }
      broadcastToRoom(roomId, 'LL_PLAYER_JOINED', wss);
      break;
    }

    case 'LL_START_GAME': {
      const room = loveletterRooms[roomId];
      if (!room || room.owner !== username || room.players.length < 2) return;
      room.status = 'playing';
      room.deck = createDeck();
      room.removedCard = room.deck.pop(); 
      room.players.forEach(p => {
        p.hand = [room.deck.pop()]; p.discarded = []; p.isAlive = true; p.isProtected = false;
      });
      room.turnIndex = Math.floor(Math.random() * room.players.length);
      room.turn = room.players[room.turnIndex].name;
      room.actionLog = '遊戲開始！';
      room.players[room.turnIndex].hand.push(room.deck.pop());
      broadcastToRoom(roomId, 'LL_GAME_STARTED', wss);
      break;
    }

    case 'LL_RESTART_GAME': {
      const room = loveletterRooms[roomId];
      if (!room || room.owner !== username) return; // 只有房主能重新開始

      room.status = 'waiting';
      room.winner = null;
      room.actionLog = '準備開始新的一局...';
      room.deck = [];
      room.removedCard = null;
      
      room.players.forEach(p => {
        p.tokens = 0; // 好感度歸零
        p.hand = [];
        p.discarded = [];
        p.isAlive = true;
        p.isProtected = false;
      });

      broadcastToRoom(roomId, 'LL_ROUND_ENDED', wss); // 廣播讓前端回到等待畫面
      break;
    }

    case 'LL_PLAY_CARD': {
      const room = loveletterRooms[roomId];
      if (!room || room.status !== 'playing' || room.turn !== username) return;
      const player = room.players[room.turnIndex];
      const { cardValue, targetName, guessValue } = data;

      const cardIndex = player.hand.findIndex(c => c.value === cardValue);
      if (cardIndex === -1) return;

      const hasCountess = player.hand.some(c => c.value === 7);
      const hasKingOrPrince = player.hand.some(c => c.value === 5 || c.value === 6);
      if (hasCountess && hasKingOrPrince && cardValue !== 7) {
        return ws.send(JSON.stringify({ type: 'LL_ERROR', data: { message: '必須強制打出伯爵夫人！' } }));
      }

      const playedCard = player.hand.splice(cardIndex, 1)[0];
      player.discarded.push(playedCard); // ✨ 加入到玩家個人的棄牌堆

      const targetPlayer = targetName ? room.players.find(p => p.name === targetName) : null;
      let actionLog = `【${username.split('@')[0]}】打出了 [${playedCard.name}]`;

      if (targetPlayer && targetPlayer.isProtected && cardValue !== 5) {
        actionLog += `，但目標受侍女保護，無事發生。`;
      } 
      else {
        switch (cardValue) {
          case 1:
            if (targetPlayer && guessValue) {
              actionLog += `，猜測【${targetName.split('@')[0]}】是 [${CARD_DEFINITIONS.find(c=>c.value===guessValue).name}]`;
              if (targetPlayer.hand[0].value === guessValue) {
                targetPlayer.isAlive = false;
                actionLog += ` ➔ 猜中了！目標出局！`;
              } else actionLog += ` ➔ 猜錯了。`;
            }
            break;
          case 2:
            if (targetPlayer) {
              actionLog += `，偷看了【${targetName.split('@')[0]}】的手牌。`;
              ws.send(JSON.stringify({ type: 'LL_PRIVATE_INFO', data: { targetName, hand: targetPlayer.hand } }));
            }
            break;
          case 3:
            if (targetPlayer) {
              const myCard = player.hand[0];
              const targetCard = targetPlayer.hand[0];
              actionLog += `，與【${targetName.split('@')[0]}】秘密對決`;
              if (myCard.value > targetCard.value) { targetPlayer.isAlive = false; actionLog += ` ➔ 贏了！目標出局。`; } 
              else if (myCard.value < targetCard.value) { player.isAlive = false; actionLog += ` ➔ 輸了！自己出局。`; } 
              else actionLog += ` ➔ 平手，無事發生。`;
              
              // ✨ 發送男爵對決的私密牌面資訊給當事雙方
              const baronData = { playerA: username, cardA: myCard, playerB: targetName, cardB: targetCard };
              wss.clients.forEach(client => {
                if (client.readyState === 1 && client._llRoomId === roomId) {
                  if (client._username === username || client._username === targetName) {
                    client.send(JSON.stringify({ type: 'LL_BARON_REVEAL', data: baronData }));
                  }
                }
              });
            }
            break;
          case 4:
            player.isProtected = true; actionLog += `，獲得一回合的保護盾🛡️。`;
            break;
          case 5:
            if (targetPlayer) {
              actionLog += `，強迫【${targetName.split('@')[0]}】棄牌`;
              const discarded = targetPlayer.hand.pop();
              targetPlayer.discarded.push(discarded); // ✨ 王子逼迫丟棄的牌，也算入該玩家的棄牌堆
              if (discarded.value === 8) {
                targetPlayer.isAlive = false; actionLog += ` ➔ 目標棄掉了公主，直接出局！`;
              } else {
                const newCard = room.deck.length > 0 ? room.deck.pop() : room.removedCard;
                targetPlayer.hand.push(newCard);
                actionLog += ` ➔ 目標重新抽了一張牌。`;
              }
            }
            break;
          case 6:
            if (targetPlayer) {
              const temp = player.hand[0]; player.hand[0] = targetPlayer.hand[0]; targetPlayer.hand[0] = temp;
              actionLog += `，與【${targetName.split('@')[0]}】交換了手牌！`;
            }
            break;
          case 7:
            actionLog += `，什麼都沒做。`;
            break;
          case 8:
            player.isAlive = false; actionLog += `，主動丟棄了公主！自己出局。`;
            break;
        }
      }
      room.status = 'resolving'; // 將房間鎖死，前端無法出牌
      room.actionLog = actionLog;
      broadcastToRoom(roomId, 'LL_GAME_UPDATE', wss);

      setTimeout(() => {
        if (loveletterRooms[roomId]) {
          loveletterRooms[roomId].status = 'playing'; // 解除鎖定
          advanceTurn(roomId, wss, actionLog);        // 推進回合並發牌
        }
      }, 3500); // 完美給予前端 3.5 秒的動畫播放時間
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

// ✨ 修復 2：精準傳送帶有 message 的強制結束錯誤給所有人
function handleLLPlayerLeave(roomId, username, wss) {
  const room = loveletterRooms[roomId];
  if (!room) return;

  room.players = room.players.filter(p => p.name !== username);
  if (room.players.length === 0) { delete loveletterRooms[roomId]; return; }
  if (room.owner === username) room.owner = room.players[0].name;

  if (room.status === 'playing') {
    room.status = 'waiting';
    room.players.forEach(p => { p.hand = []; p.discarded = []; p.isAlive = true; });
    
    // 生成正確格式的錯誤封包，讓前端能顯示彈窗
    const errorData = JSON.stringify({ 
      type: 'LL_ERROR', 
      data: { message: `玩家 ${username.split('@')[0]} 中途離開，本局強制結束！` } 
    });
    
    wss.clients.forEach(c => {
      if (c.readyState === 1 && c._llRoomId === roomId) {
        c.send(errorData);
      }
    });
    
    broadcastToRoom(roomId, 'LL_ROUND_ENDED', wss);
  } else {
    broadcastToRoom(roomId, 'LL_PLAYER_JOINED', wss);
  }
}

export function cleanupLoveLetterConnection(username, roomId, wss) {
  if (!roomId) return;
  handleLLPlayerLeave(roomId, username, wss);
}