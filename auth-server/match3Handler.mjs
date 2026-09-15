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
        room.players.push({ name: username, nickname: data.nickname || username.split('@')[0], score: 0, board: null });
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
      cleanupMatch3Connection(username, roomId, wsServer);
      delete connection._m3RoomId;
      break;
    }
  }
}

export function cleanupMatch3Connection(username, roomId, wsServer) {
  if (!roomId || !match3Rooms[roomId]) return;
  const room = match3Rooms[roomId];
  room.players = room.players.filter(p => p.name !== username);
  
  if (room.players.length === 0) {
    delete match3Rooms[roomId]; // 沒人就解散房間
  } else if (room.owner === username) {
    room.owner = room.players[0].name; // 轉移房主
    broadcastToRoom(wsServer, roomId);
  } else {
    broadcastToRoom(wsServer, roomId);
  }
}