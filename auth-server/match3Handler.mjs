import { v4 as uuidv4 } from 'uuid';

export const match3Rooms = {};

function broadcastToRoom(wsServer, roomId) {
  const room = match3Rooms[roomId];
  if (!room) return;
  const message = JSON.stringify([{ type: 'M3_ROOM_UPDATE', data: { room } }]);
  wsServer.clients.forEach((client) => {
    if (client._m3RoomId === roomId && client.readyState === 1) {
      client.send(message);
    }
  });
}

export function handleMatch3Message(connection, type, data, wsServer, callbacks) {
  const { username, roomId, board, score } = data;

  switch (type) {
    case 'M3_CREATE_ROOM': {
      const newRoomId = uuidv4().slice(0, 6).toUpperCase();
      match3Rooms[newRoomId] = {
        id: newRoomId,
        owner: username,
        status: 'playing', // 目前是無盡模式，創房即開始
        players: [{ name: username, nickname: data.nickname || username.split('@')[0], score: 0, board: null }]
      };
      connection._m3RoomId = newRoomId;
      connection.send(JSON.stringify([{ type: 'M3_ROOM_CREATED', data: { room: match3Rooms[newRoomId] } }]));
      if (callbacks?.onRoomCreated) callbacks.onRoomCreated(newRoomId, '夏日消消樂');
      break;
    }

    case 'M3_JOIN_ROOM': {
      const room = match3Rooms[roomId];
      if (!room) return connection.send(JSON.stringify([{ type: 'M3_ERROR', data: { message: '房間不存在或已解散' } }]));
      
      const existingPlayer = room.players.find(p => p.name === username);
      if (!existingPlayer) {
        // 全新玩家，加入房間
        room.players.push({ name: username, nickname: data.nickname || username.split('@')[0], score: 0, board: null, isOnline: true });
      } else {
        // 老玩家斷線重連，標記為上線 (保留之前的分數與排版)
        existingPlayer.isOnline = true;
      }
      
      connection._m3RoomId = roomId;
      broadcastToRoom(wsServer, roomId);
      break;
    }

    case 'M3_SYNC_STATE': {
      // 接收前端傳來的新分數與棋盤陣列，並同步給房間內所有人
      const room = match3Rooms[roomId];
      if (room) {
        const player = room.players.find(p => p.name === username);
        if (player) {
          player.score = score;
          player.board = board;
          broadcastToRoom(wsServer, roomId);
        }
      }
      break;
    }

    case 'M3_LEAVE_ROOM': {
      const room = match3Rooms[roomId];
      if (room) {
          // 玩家主動點擊「離開房間」，徹底刪除他的資料
          room.players = room.players.filter(p => p.name !== username);
          if (room.players.length === 0) {
              delete match3Rooms[roomId];
          } else if (room.owner === username) {
              room.owner = room.players[0].name; // 轉移房主
          }
          broadcastToRoom(wsServer, roomId);
      }
      delete connection._m3RoomId;
      break;
    }
  }
}

export function cleanupMatch3Connection(username, roomId, wsServer) {
  if (!roomId || !match3Rooms[roomId]) return;
  const room = match3Rooms[roomId];
  const player = room.players.find(p => p.name === username);
  
  if (player) {
      // 意外斷線 (如 F5 刷新、關閉網頁)，只標記離線，保留心血分數！
      player.isOnline = false; 
  }

  // 只有當「所有玩家」都離線時，才解散房間回收記憶體
  if (room.players.every(p => !p.isOnline)) {
      delete match3Rooms[roomId]; 
  } else {
      if (room.owner === username) {
          const nextOwner = room.players.find(p => p.isOnline);
          if (nextOwner) room.owner = nextOwner.name;
      }
      broadcastToRoom(wsServer, roomId);
  }
}