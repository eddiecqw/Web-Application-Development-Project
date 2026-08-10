import express from 'express';
import { WebSocketServer } from 'ws';
import { handleNiuNiuMessage, niuniuRooms, cleanupNiuNiuConnection } from './niuniuHandler.mjs';
import { handleBlackjackMessage, blackjackRooms, cleanupBlackjackConnection } from './blackjackHandler.mjs';
import { handleLoveLetterMessage, loveletterRooms, cleanupLoveLetterConnection } from './loveletterHandler.mjs';
import cors from 'cors';
import { MongoClient, ServerApiVersion } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import http from 'http';
import url from 'url';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI;
const PORT = process.env.PORT || 53840;
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

const app = express();
app.use(
  cors({
    origin: ['https://localhost:5173','https://web-application-development-project-rfmutz8st.vercel.app',/^https:\/\/web-application-development-project.*\.vercel\.app$/,'https://happychat-eddie.vercel.app'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  })
);
app.use(express.json());

app.get('/test', (req, res) => {
  res.json({ status: 'ok' });
});

let db;
client
  .connect()
  .then(() => {
    console.log('✅ MongoDB Connected Successfully!');
    db = client.db('WebDemo');
  })
  .catch((err) => {
    console.error('❌ MongoDB Connection Failed:', err);
    process.exit(1);
  });

const server = http.createServer(app);
const wsServer = new WebSocketServer({ server });
const connections = {};
const gameRooms = {}; 
const GAME_WORDS = [
  '貓咪', '狗', '兔子', '獅子', '企鵝', '烏龜', '蝴蝶', '長頸鹿', '大象', '貓頭鷹', '鯊魚', '青蛙', '蛇', '蝸牛',
  '蘋果', '漢堡', '披薩', '壽司', '蛋糕', '西瓜', '香蕉', '甜甜圈', '熱狗', '薯條', '珍珠奶茶', '冰淇淋', '三明治',
  '手機', '電腦', '手錶', '剪刀', '吹風機', '牙刷', '椅子', '鍵盤', '麥克風', '燈泡', '電視', '沙發', '雨傘', '馬桶',
  '火車', '飛機', '腳踏車', '船', '汽車', '直升機', '火箭', '公車',
  '太陽', '月亮', '星星', '雲', '閃電', '樹', '花', '彩虹', '火山', '雪人', '鑽石', '鬼魂', '外星人'
];

app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, message: 'Missing email or password' });

  const existingUser = await db.collection('User').findOne({ email });
  if (existingUser) return res.status(409).json({ success: false, message: 'User already exists' });

  const hashedPassword = await bcrypt.hash(password, 10);
  await db.collection('User').insertOne({ email, password: hashedPassword });
  res.json({ success: true, message: 'User registered successfully' });
});

app.post('/api/auth/check-account', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Missing email' });
  try {
    const user = await db.collection('User').findOne({ email });
    res.json({ success: true, userExists: !!user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await db.collection('User').findOne({ email });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    res.json({ success: true, message: 'Login successful', username: email });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.get('/api/rooms', (req, res) => {
  try {
    const rooms = Object.keys(gameRooms).map(roomId => {
      return { roomId, playerCount: gameRooms[roomId].players.length, hasTimeLimit: gameRooms[roomId].hasTimeLimit || false, timeLimit: gameRooms[roomId].timeLimit || 60 };
    });
    res.json({ success: true, rooms });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.get('/api/niuniu-rooms', (req, res) => {
  try {
    const rooms = Object.values(niuniuRooms).map(room => ({ roomId: room.id, playerCount: room.players.length, timeLimit: room.settings ? room.settings.timeLimit : 30, status: room.status, owner: room.owner }));
    res.json({ success: true, rooms });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.get('/api/blackjack-rooms', (req, res) => {
  try {
    const rooms = Object.values(blackjackRooms).map(room => ({ roomId: room.id, playerCount: room.players.length, timeLimit: room.settings.timeLimit, baseBet: room.settings.baseBet, status: room.status, owner: room.owner }));
    res.json({ success: true, rooms });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.get('/api/loveletter-rooms', (req, res) => {
  try {
    const rooms = Object.values(loveletterRooms).map(room => ({ roomId: room.id, playerCount: room.players.length, winTokens: room.settings.winTokens, status: room.status, owner: room.owner }));
    res.json({ success: true, rooms });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

function broadcastSystemStatus() {
  const totalOnline = Object.keys(connections).length;
  const mapUsers = Object.values(connections).filter(conn => conn._location).length;
  
  const statusMsg = JSON.stringify([{ type: 'SYSTEM_STATUS', data: { online: totalOnline, map: mapUsers } }]);
  Object.values(connections).forEach((conn) => {
    if (conn.readyState === 1) conn.send(statusMsg);
  });
}

wsServer.on('connection', async (connection, request) => {
  const { username } = url.parse(request.url, true).query;
  
  const existingUuid = Object.keys(connections).find((key) => connections[key]._username === username);

  if (existingUuid) {
    connections[existingUuid].send(JSON.stringify([{ type: 'system', content: '⚠️ 您的帳號已在其他裝置或分頁登入，此連線即將中斷。' }]));
    connections[existingUuid].close(1008, 'Logged in from another device');
    delete connections[existingUuid];
  }

  const uuid = uuidv4();
  connections[uuid] = connection;
  connection._username = username;

  try {
    // 因為系統與遊客訊息不再存入 MongoDB，初始載入將只會是最純淨的會員交流紀錄！
    // ✨ 核心修復 1：過濾掉舊版寫入的 system 訊息與 guest_ 開頭的遊客訊息
    const messages = await db.collection('ChatMessages')
      .find({
        type: { $ne: 'system' },           // 不撈取系統訊息
        sender: { $not: /^guest_/i }       // 不撈取遊客訊息
      })
      .sort({ timestamp: -1 })
      .limit(20)
      .toArray();
    connection.send(JSON.stringify({ type: 'INITIAL_HISTORY', data: messages.reverse() }));
  } catch (error) {}
  
  setTimeout(() => {
    broadcastSystemStatus();
  }, 100);

  connection.on('message', async (message) => {
    let parsed;
    try { parsed = JSON.parse(message.toString()); } catch (err) { return; }

    const { type, data } = parsed;
    
    // 遊戲房間建立
    if (type && type.startsWith('NIUNIU_')) {
      data.username = connection._username || data.username; 
      const callbacks = {
        onRoomCreated: async (newRoomId) => {
          const systemMessage = { sender: 'System', content: `🃏 撲克鬥牛房間 [${newRoomId}] 已創建，快來加入挑戰吧！`, timestamp: new Date(), type: 'system', channel: 'system' };
          // 🛑 核心修改：系統廣播閱後即焚，不再寫入 DB
          Object.values(connections).forEach((conn) => { if(conn.readyState === 1) conn.send(JSON.stringify([systemMessage])); });
        }
      };
      handleNiuNiuMessage(connection, type, data, wsServer, callbacks);
      return; 
    }

    if (type && type.startsWith('BJ_')) {
      data.username = connection._username || data.username; 
      const callbacks = {
        onRoomCreated: async (newRoomId, gameName) => {
          const systemMessage = { sender: 'System', content: `🃏 ${gameName} 房間 [${newRoomId}] 已創建，快來加入挑戰吧！`, timestamp: new Date(), type: 'system', channel: 'system' };
          // 🛑 核心修改：系統廣播閱後即焚，不再寫入 DB
          Object.values(connections).forEach((conn) => { if(conn.readyState === 1) conn.send(JSON.stringify([systemMessage])); });
        }
      };
      handleBlackjackMessage(connection, type, data, wsServer, callbacks);
      return; 
    }

    if (type && type.startsWith('LL_')) {
      data.username = connection._username || data.username; 
      const callbacks = {
        onRoomCreated: async (newRoomId, gameName) => {
          const systemMessage = { sender: 'System', content: `💌 ${gameName} 房間 [${newRoomId}] 已創建，快來拆開情書吧！`, timestamp: new Date(), type: 'system', channel: 'system' };
          // 🛑 核心修改：系統廣播閱後即焚，不再寫入 DB
          Object.values(connections).forEach((conn) => { if(conn.readyState === 1) conn.send(JSON.stringify([systemMessage])); });
        }
      };
      handleLoveLetterMessage(connection, type, data, wsServer, callbacks);
      return; 
    }

    switch (type) {
      
      case 'LOAD_MORE_MESSAGES': {
        const skip = data.skip || 0;
        const limit = data.limit || 50;
        try {
          // ✨ 核心修復 2：載入更多時，也要套用相同的過濾規則
          const moreMsgs = await db.collection('ChatMessages')
            .find({
              type: { $ne: 'system' },
              sender: { $not: /^guest_/i }
            })
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();
          connection.send(JSON.stringify({ type: 'MORE_HISTORY', data: moreMsgs.reverse() }));
        } catch (error) { console.error('❌ Error fetching history:', error); }
        break;
      }

      // ✨ 聊天系統全面升級
      case 'CHAT_MESSAGE': {
        const isGuest = /^guest_/i.test(username); // 判斷是否為遊客
        const channel = data.roomId ? 'room' : 'world';

        const newMessage = {
          id: uuidv4(), // 提供一個獨立ID，避免 MongoDB 未建立時 React 缺少 key
          sender: username,
          content: data.content,
          timestamp: new Date(),
          type: data.type || 'text',
          mimeType: data.mimeType || null,
          filename: data.filename || null,
          replyTo: data.replyTo || null,
          isGuest: isGuest,
          channel: channel
        };

        // 🛑 核心修改：只有「註冊會員」且「在世界大廳發言」的訊息，才永久保留在 MongoDB！
        if (!isGuest && channel === 'world') {
          try {
            await db.collection('ChatMessages').insertOne(newMessage);
          } catch (error) {}
        }

        // 空間隔離廣播：如果是房間訊息就只傳給房間，不然就傳給所有人
        if (channel === 'room') {
          broadcastToRoom(data.roomId, [newMessage]);
        } else {
          Object.values(connections).forEach((conn) => {
            if (conn.readyState === 1) conn.send(JSON.stringify([newMessage]));
          });
        }
        break;
      }
      
      case 'USER_POSITION_UPDATE': {
        const { latitude, longitude } = data;
        connection._location = { latitude, longitude, username };
        broadcastSystemStatus();

        Object.values(connections).forEach((conn) => {
          if (conn !== connection && conn.readyState === 1) {
            conn.send(JSON.stringify({ type: 'USER_POSITION', data: { username, latitude, longitude } }));
          }
        });
      
        const others = Object.values(connections).filter((conn) => conn !== connection && conn._location).map((conn) => ({ username: conn._username, latitude: conn._location.latitude, longitude: conn._location.longitude }));
        if (others.length > 0) {
          connection.send(JSON.stringify({ type: 'EXISTING_USER_POSITIONS', data: others }));
        }
        break;
      }

      case 'USER_LEFT_MAP': {
        delete connection._location;
        broadcastSystemStatus(); 
        
        Object.values(connections).forEach((conn) => {
          if (conn !== connection && conn.readyState === 1) {
            conn.send(JSON.stringify({ type: 'USER_LEFT_MAP', data: { username } }));
          }
        });
        break;
      }

      case 'GAME_CREATE_ROOM': {
        const roomId = uuidv4().slice(0, 6);
        const playerId = uuidv4();
        const word = GAME_WORDS[Math.floor(Math.random() * GAME_WORDS.length)];
        const player = { id: playerId, name: username, score: 0, isPainter: true };
        const hasTimeLimit = data.hasTimeLimit || false;
        const timeLimit = data.timeLimit || 60;
        
        gameRooms[roomId] = { players: [player], painterId: playerId, word, hasTimeLimit, timeLimit, scoreHistory: { [username]: 0 } };
        connection._roomId = roomId;
        connection._playerId = playerId;
      
        const systemMessage = { sender: 'System', content: `房間 ${roomId} 已創建，輸入 /join ${roomId} 加入遊戲`, timestamp: new Date(), type: 'system', channel: 'system' };
        
        // 🛑 核心修改：系統廣播閱後即焚，不再寫入 DB
        Object.values(connections).forEach((conn) => { conn.send(JSON.stringify([systemMessage])); });
      
        connection.send(JSON.stringify({ type: 'GAME_ROOM_CREATED', data: { roomId, players: gameRooms[roomId].players, isPainter: true, playerId, word, hasTimeLimit, timeLimit } }));
        break;
      }

      case 'GAME_JOIN_ROOM': {
        const { roomId } = data;
        const room = gameRooms[roomId];
        if (!room) { return connection.send(JSON.stringify({ type: 'GAME_ERROR', data: { message: '房间不存在' } })); }

        const playerId = uuidv4();
        const previousScore = room.scoreHistory[username] || 0;
        const player = { id: playerId, name: username, score: previousScore, isPainter: false };

        room.players.push(player);
        connection._roomId = roomId;
        connection._playerId = playerId;

        connection.send(JSON.stringify({ type: 'GAME_JOINED', data: { roomId, players: room.players, isPainter: false, playerId, hasTimeLimit: room.hasTimeLimit, timeLimit: room.timeLimit } }));
        broadcastToRoom(roomId, { type: 'GAME_PLAYER_UPDATE', data: { players: room.players } });
        break;
      }

      case 'GAME_DRAW_DATA': {
        const roomId = connection._roomId;
        if (!roomId) return;
        broadcastToRoom(roomId, { type: 'GAME_DRAW_DATA', data: { path: data.path } });
        break;
      }

      case 'GAME_SUBMIT_GUESS': {
        const roomId = connection._roomId;
        if (!roomId) return;
        const room = gameRooms[roomId];
        const isCorrect = data.guess === room.word;
        let scoreUpdate = {};
      
        if (isCorrect) {
          const guesser = room.players.find(p => p.id === connection._playerId);
          if (guesser) { guesser.score += 100; scoreUpdate[guesser.id] = guesser.score; room.scoreHistory[guesser.name] = guesser.score; }
          const painter = room.players.find(p => p.id === room.painterId);
          if (painter) { painter.score += 50; scoreUpdate[painter.id] = painter.score; room.scoreHistory[painter.name] = painter.score; }
      
          const currentPainterIndex = room.players.findIndex(p => p.id === room.painterId);
          const nextPainterIndex = (currentPainterIndex + 1) % room.players.length;
          const nextPainter = room.players[nextPainterIndex];
          
          room.painterId = nextPainter.id;
          room.players.forEach(p => p.isPainter = (p.id === room.painterId));
          room.word = GAME_WORDS[Math.floor(Math.random() * GAME_WORDS.length)];
      
          broadcastToRoom(roomId, { type: 'GAME_NEW_ROUND', data: { players: room.players, word: room.word, painterId: room.painterId, hasTimeLimit: room.hasTimeLimit, timeLimit: room.timeLimit } });
        }
      
        broadcastToRoom(roomId, { type: 'GAME_GUESS_RESULT', data: { playerName: username, guess: data.guess, isCorrect, scoreUpdate, correctWord: isCorrect ? room.word : null } });
        break;
      }
    }
  });

  connection.on('close', () => {
    if (connection._username) {
      cleanupNiuNiuConnection(connection._username, connection._niuniuRoomId, wsServer);
      cleanupBlackjackConnection(connection._username, connection._bjRoomId, wsServer);
      cleanupLoveLetterConnection(connection._username, connection._llRoomId, wsServer);
    }

    if (connection._location) {
      const leftUsername = connection._username;
      Object.values(connections).forEach((conn) => {
        if (conn !== connection && conn.readyState === 1) {
          conn.send(JSON.stringify({ type: 'USER_LEFT_MAP', data: { username: leftUsername } }));
        }
      });
      delete connection._location;
    }

    const roomId = connection._roomId;
    const playerId = connection._playerId;

    if (roomId && gameRooms[roomId]) {
      const room = gameRooms[roomId];
      room.players = room.players.filter((player) => player.id !== playerId);

      if (room.players.length === 0) {
        delete gameRooms[roomId];
      } else {
        if (room.painterId === playerId) {
          room.painterId = room.players[0].id;
          room.players.forEach(p => p.isPainter = (p.id === room.painterId));
          broadcastToRoom(roomId, { type: 'GAME_NEW_ROUND', data: { players: room.players, word: room.word, painterId: room.painterId, hasTimeLimit: room.hasTimeLimit, timeLimit: room.timeLimit } });
        } else {
          broadcastToRoom(roomId, { type: 'GAME_PLAYER_UPDATE', data: { players: room.players } });
        }
      }
    }
    delete connections[uuid]; 
    broadcastSystemStatus();
  });
});

function broadcastToRoom(roomId, message) {
  Object.values(connections).forEach((conn) => {
    if (conn._roomId === roomId) {
      conn.send(JSON.stringify(message));
    }
  });
}

server.listen(PORT, '0.0.0.0',() => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});