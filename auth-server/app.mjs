import express from 'express';
import { WebSocketServer } from 'ws';
// ✨ 將 cleanupNiuNiuConnection 也引入進來
import { handleNiuNiuMessage, niuniuRooms, cleanupNiuNiuConnection } from './niuniuHandler.mjs';
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
    origin: ['https://localhost:5173','https://web-application-development-project-rfmutz8st.vercel.app',/^https:\/\/web-application-development-project.*\.vercel\.app$/],
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
      return {
        roomId,
        playerCount: gameRooms[roomId].players.length,
        hasTimeLimit: gameRooms[roomId].hasTimeLimit || false,
        timeLimit: gameRooms[roomId].timeLimit || 60
      };
    });
    res.json({ success: true, rooms });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

//新增牛牛專屬apiget
app.get('/api/niuniu-rooms', (req, res) => {
  try {
    const rooms = Object.values(niuniuRooms).map(room => ({
      roomId: room.id,
      playerCount: room.players.length,
      timeLimit: room.timeLimit,
      status: room.status,
      owner: room.owner
    }));
    res.json({ success: true, rooms });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

function broadcastSystemStatus() {
  const totalOnline = Object.keys(connections).length;
  const mapUsers = Object.values(connections).filter(conn => conn._location).length;
  
  const statusMsg = JSON.stringify([{
    type: 'SYSTEM_STATUS',
    data: { online: totalOnline, map: mapUsers }
  }]);
  
  Object.values(connections).forEach((conn) => {
    if (conn.readyState === 1) conn.send(statusMsg);
  });
}

wsServer.on('connection', async (connection, request) => {
  const { username } = url.parse(request.url, true).query;
  
  const existingUuid = Object.keys(connections).find(
    (key) => connections[key]._username === username
  );

  if (existingUuid) {
    connections[existingUuid].send(
      JSON.stringify([{
        type: 'system',
        content: '⚠️ 您的帳號已在其他裝置或分頁登入，此連線即將中斷。'
      }])
    );
    connections[existingUuid].close(1008, 'Logged in from another device');
    delete connections[existingUuid];
  }

  const uuid = uuidv4();
  connections[uuid] = connection;
  connection._username = username;

  try {
    const messages = await db
      .collection('ChatMessages')
      .find()
      .sort({ timestamp: -1 })
      .limit(20) 
      .toArray();

    connection.send(JSON.stringify(messages.reverse()));
  } catch (error) {}

  broadcastSystemStatus();

  connection.on('message', async (message) => {
    let parsed;
    try {
      parsed = JSON.parse(message.toString());
    } catch (err) {
      return;
    }

    const { type, data } = parsed;
    if (type && type.startsWith('NIUNIU_')) {
      data.username = connection._username || data.username; 

      // ✨ 定義回調函數，當房間建立時寫入 MongoDB 並廣播聊天室
      const callbacks = {
        onRoomCreated: async (newRoomId) => {
          const systemMessage = {
            sender: 'System',
            content: `🃏 撲克鬥牛房間 [${newRoomId}] 已創建，快來加入挑戰吧！`,
            timestamp: new Date(),
            type: 'system'
          };
          try {
            await db.collection('ChatMessages').insertOne(systemMessage);
          } catch (error) {}

          Object.values(connections).forEach((conn) => {
            if(conn.readyState === 1) conn.send(JSON.stringify([systemMessage]));
          });
        }
      };

      // ✨ 將 callbacks 傳給 handler
      handleNiuNiuMessage(connection, type, data, wsServer, callbacks);
      return; 
    }
    switch (type) {
      
      case 'LOAD_MORE_MESSAGES': {
        const skip = data.skip || 0;
        const limit = data.limit || 50;
        try {
          const moreMsgs = await db.collection('ChatMessages')
            .find()
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();
            
          connection.send(JSON.stringify({
            type: 'MORE_HISTORY',
            data: moreMsgs.reverse()
          }));
        } catch (error) {
          console.error('❌ Error fetching history:', error);
        }
        break;
      }

      case 'CHAT_MESSAGE': {
        const newMessage = {
          sender: username,
          content: data.content,
          timestamp: new Date(),
          type: data.type || 'text',
          mimeType: data.mimeType || null,
          filename: data.filename || null,
          // ✨ 關鍵修復：接住前端傳來的回覆資訊，並存進 MongoDB
          replyTo: data.replyTo || null, 
        };

        try {
          await db.collection('ChatMessages').insertOne(newMessage);
        } catch (error) {}

        Object.values(connections).forEach((conn) => {
          conn.send(JSON.stringify([newMessage]));
        });
        break;
      }
      
      case 'USER_POSITION_UPDATE': {
        const { latitude, longitude } = data;
        connection._location = { latitude, longitude, username };
      
        broadcastSystemStatus();

        Object.values(connections).forEach((conn) => {
          if (conn !== connection && conn.readyState === 1) {
            conn.send(
              JSON.stringify({
                type: 'USER_POSITION',
                data: {
                  username,
                  latitude,
                  longitude,
                },
              })
            );
          }
        });
      
        const others = Object.values(connections)
          .filter((conn) => conn !== connection && conn._location)
          .map((conn) => ({
            username: conn._username,
            latitude: conn._location.latitude,
            longitude: conn._location.longitude,
          }));
      
        if (others.length > 0) {
          connection.send(
            JSON.stringify({
              type: 'EXISTING_USER_POSITIONS',
              data: others,
            })
          );
        }
        break;
      }

      case 'USER_LEFT_MAP': {
        delete connection._location;
        broadcastSystemStatus(); 
        
        Object.values(connections).forEach((conn) => {
          if (conn !== connection && conn.readyState === 1) {
            conn.send(
              JSON.stringify({
                type: 'USER_LEFT_MAP',
                data: { username }
              })
            );
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
        
        gameRooms[roomId] = {
          players: [player],
          painterId: playerId,
          word,
          hasTimeLimit, 
          timeLimit,    
          scoreHistory: { [username]: 0 } 
        };
      
        connection._roomId = roomId;
        connection._playerId = playerId;
      
        const systemMessage = {
          sender: 'System',
          content: `房间 ${roomId} 已创建，输入 /join ${roomId} 加入游戏`,
          timestamp: new Date(),
          type: 'system'
        };
      
        try {
          await db.collection('ChatMessages').insertOne(systemMessage);
        } catch (error) {}
      
        Object.values(connections).forEach((conn) => {
          conn.send(JSON.stringify([systemMessage]));
        });
      
        connection.send(
          JSON.stringify({
            type: 'GAME_ROOM_CREATED',
            data: {
              roomId,
              players: gameRooms[roomId].players,
              isPainter: true,
              playerId,
              word,
              hasTimeLimit, 
              timeLimit
            },
          })
        );
        break;
      }

      case 'GAME_JOIN_ROOM': {
        const { roomId } = data;
        const room = gameRooms[roomId];
        if (!room) {
          return connection.send(
            JSON.stringify({
              type: 'GAME_ERROR',
              data: { message: '房间不存在' },
            })
          );
        }

        const playerId = uuidv4();
        // ✨ 新增：去檔案庫檢查這個玩家之前有沒有分數，沒有的話就是 0
        const previousScore = room.scoreHistory[username] || 0;
        const player = {
          id: playerId,
          name: username,
          score: previousScore, // ✨ 恢復歷史分數
          isPainter: false,
        };

        room.players.push(player);
        connection._roomId = roomId;
        connection._playerId = playerId;

        connection.send(
          JSON.stringify({
            type: 'GAME_JOINED',
            data: {
              roomId,
              players: room.players,
              isPainter: false,
              playerId,
              hasTimeLimit: room.hasTimeLimit,
              timeLimit: room.timeLimit
            },
          })
        );

        broadcastToRoom(roomId, {
          type: 'GAME_PLAYER_UPDATE',
          data: { players: room.players },
        });
        break;
      }

      case 'GAME_DRAW_DATA': {
        const roomId = connection._roomId;
        if (!roomId) return;
        broadcastToRoom(roomId, {
          type: 'GAME_DRAW_DATA',
          data: { path: data.path } 
        });
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
          if (guesser) {
            guesser.score += 100;
            scoreUpdate[guesser.id] = guesser.score;
            room.scoreHistory[guesser.name] = guesser.score;// ✨ 同步更新到檔案庫
          }
          const painter = room.players.find(p => p.id === room.painterId);
          if (painter) {
            painter.score += 50;
            scoreUpdate[painter.id] = painter.score;
            room.scoreHistory[painter.name] = painter.score; // ✨ 同步更新到檔案庫
          }
      
          const currentPainterIndex = room.players.findIndex(p => p.id === room.painterId);
          const nextPainterIndex = (currentPainterIndex + 1) % room.players.length;
          const nextPainter = room.players[nextPainterIndex];
          
          room.painterId = nextPainter.id;
          room.players.forEach(p => p.isPainter = (p.id === room.painterId));
          room.word = GAME_WORDS[Math.floor(Math.random() * GAME_WORDS.length)];
      
          broadcastToRoom(roomId, {
            type: 'GAME_NEW_ROUND',
            data: {
              players: room.players,
              word: room.word,
              painterId: room.painterId,
              hasTimeLimit: room.hasTimeLimit,
              timeLimit: room.timeLimit
            }
          });
        }
      
        broadcastToRoom(roomId, {
          type: 'GAME_GUESS_RESULT',
          data: {
            playerName: username,
            guess: data.guess,
            isCorrect,
            scoreUpdate,
            correctWord: isCorrect ? room.word : null
          }
        });
        break;
      }
    }
  });

  connection.on('close', () => {
    if (connection._username) {
      cleanupNiuNiuConnection(connection._username, connection._niuniuRoomId, wsServer);
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
          
          broadcastToRoom(roomId, {
            type: 'GAME_NEW_ROUND',
            data: {
              players: room.players,
              word: room.word,
              painterId: room.painterId,
              hasTimeLimit: room.hasTimeLimit,
              timeLimit: room.timeLimit
            },
          });
        } else {
          broadcastToRoom(roomId, {
            type: 'GAME_PLAYER_UPDATE',
            data: { players: room.players },
          });
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