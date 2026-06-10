import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { MongoClient, ServerApiVersion } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import http from 'http';
import url from 'url';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();


const uri =
  'mongodb+srv://1155192043:MHJ+cqw02260803@eddiewebdemos.hl10e.mongodb.net/?retryWrites=true&w=majority&appName=Eddiewebdemos';

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});


const app = express();
app.use(
  cors({
    //origin: 'http://localhost:5173',
    orgin:'*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    //credentials: true,
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

// ✅ Create HTTP + WebSocket Server
const server = http.createServer(app);
const wsServer = new WebSocketServer({ server });
const PORT = 53840;
const connections = {};
const gameRooms = {}; // { roomId: { players: [], painterId: string } }

// ✅ REST API: Register
app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ success: false, message: 'Missing email or password' });

  const existingUser = await db.collection('User').findOne({ email });
  if (existingUser)
    return res.status(409).json({ success: false, message: 'User already exists' });

  const hashedPassword = await bcrypt.hash(password, 10);
  await db.collection('User').insertOne({ email, password: hashedPassword });

  console.log('✅ Registration Success:', email);
  res.json({ success: true, message: 'User registered successfully' });
});

// ✅ REST API: Check Account
app.post('/api/auth/check-account', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Missing email' });

  try {
    const user = await db.collection('User').findOne({ email });
    res.json({ success: true, userExists: !!user });
  } catch (error) {
    console.error('❌ Error checking account:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ✅ REST API: Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt:', email);

    const user = await db.collection('User').findOne({ email });
    if (!user) {
      console.log('User not found:', email);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('Password mismatch for:', email);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    console.log('✅ Login success:', email);
    res.json({ success: true, message: 'Login successful', username: email });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ✅ WebSocket Handler
wsServer.on('connection', async (connection, request) => {
  const { username } = url.parse(request.url, true).query;
  const uuid = uuidv4();
  connections[uuid] = connection;

  console.log(`✅ WebSocket connected: ${username}`);
  connection._username = username;

  // Send last 8 messages from chat
  try {
    const messages = await db
      .collection('ChatMessages')
      .find()
      .sort({ timestamp: -1 })
      .limit(8)
      .toArray();

    connection.send(JSON.stringify(messages.reverse()));
  } catch (error) {
    console.error('❌ Error fetching messages:', error);
  }

  // ✅ Handle incoming messages
  connection.on('message', async (message) => {
    let parsed;
    try {
      parsed = JSON.parse(message.toString());
    } catch (err) {
      console.error('❌ Invalid JSON received:', message.toString());
      return;
    }

    const { type, data } = parsed;

    switch (type) {
      
      case 'CHAT_MESSAGE': {
        const newMessage = {
          sender: username,
          content: data.content,
          timestamp: new Date(),
          type: data.type || 'text',
          mimeType: data.mimeType || null,
          filename: data.filename || null,
        };

        try {
          await db.collection('ChatMessages').insertOne(newMessage);
        } catch (error) {
          console.error('❌ Error saving message to DB:', error);
        }

        Object.values(connections).forEach((conn) => {
          conn.send(JSON.stringify([newMessage]));
        });
        break;
      }
      
      case 'USER_POSITION_UPDATE': {
        const { latitude, longitude } = data;
        connection._location = { latitude, longitude, username };
      
        // 1. 廣播給其他人
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
      
        // 2. 回傳所有其他人的位置給當前用戶
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

      case 'GAME_CREATE_ROOM': {
        const roomId = uuidv4().slice(0, 6);
        const playerId = uuidv4();
        const keywords = ['太陽', '蘋果', '貓咪', '火車', '手機'];
        const word = keywords[Math.floor(Math.random() * keywords.length)];
        const player = {
          id: playerId,
          name: username,
          score: 0,
          isPainter: true,
        };
        console.log('🎯 roomId:', roomId);
        gameRooms[roomId] = {
          players: [player],
          painterId: playerId,
          word,
        };
      
        connection._roomId = roomId;
        connection._playerId = playerId;
      
        // ✅ 新增：发送系统消息到聊天室
        const systemMessage = {
          sender: 'System',
          content: `房间 ${roomId} 已创建，输入 /join ${roomId} 加入游戏`,
          timestamp: new Date(),
          type: 'system'
        };
      
        try {
          await db.collection('ChatMessages').insertOne(systemMessage);
        } catch (error) {
          console.error('❌ Error saving system message:', error);
        }
      
        // 广播系统消息给所有用户
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
        const player = {
          id: playerId,
          name: username,
          score: 0,
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

      // app.mjs 修改 GAME_SUBMIT_GUESS 处理
      case 'GAME_SUBMIT_GUESS': {
        const roomId = connection._roomId;
        if (!roomId) return;
        const room = gameRooms[roomId];
      
        const isCorrect = data.guess === room.word;
        let scoreUpdate = {};
      
        if (isCorrect) {
          // 更新分数
          const guesser = room.players.find(p => p.id === connection._playerId);
          if (guesser) {
            guesser.score += 100;
            scoreUpdate[guesser.id] = guesser.score;
          }
          const painter = room.players.find(p => p.id === room.painterId);
          if (painter) {
            painter.score += 50;
            scoreUpdate[painter.id] = painter.score;
          }
      
          // ✅ 選擇下一輪畫家（簡單輪流）
          const currentPainterIndex = room.players.findIndex(p => p.id === room.painterId);
          const nextPainterIndex = (currentPainterIndex + 1) % room.players.length;
          const nextPainter = room.players[nextPainterIndex];
          console.log("next painter is",nextPainter);
          // ✅ 更新畫家 ID
          room.painterId = nextPainter.id;
      
          // ✅ 重置玩家 isPainter 狀態
          room.players.forEach(p => p.isPainter = (p.id === room.painterId));
      
          // ✅ 新題目
          const keywords = ['太陽', '蘋果', '貓咪', '火車', '手機', '電腦', '冰淇淋'];
          const newWord = keywords[Math.floor(Math.random() * keywords.length)];
          room.word = newWord;
      
          // ✅ 廣播新一輪開始
          broadcastToRoom(roomId, {
            type: 'GAME_NEW_ROUND',
            data: {
              players: room.players,
              word: newWord,
              painterId: room.painterId,
            }
          });
        }
      
        // ✅ 廣播猜測結果
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

      default:
        console.log('❓ Unhandled message type:', type);
        console.log('📦 Full message:', parsed);
    }
  });

  // ✅ Handle disconnect
  connection.on('close', () => {
    console.log(`❌ ${username} disconnected`);
    const roomId = connection._roomId;
    const playerId = connection._playerId;

    if (roomId && gameRooms[roomId]) {
      gameRooms[roomId].players = gameRooms[roomId].players.filter(
        (player) => player.id !== playerId
      );
      broadcastToRoom(roomId, {
        type: 'GAME_PLAYER_UPDATE',
        data: { players: gameRooms[roomId].players },
      });

      // 删除空房间
      if (gameRooms[roomId].players.length === 0) {
        delete gameRooms[roomId];
      }
    }

    delete connections[uuid];
  });
});

// ✅ 广播函数
function broadcastToRoom(roomId, message) {
  Object.values(connections).forEach((conn) => {
    if (conn._roomId === roomId) {
      conn.send(JSON.stringify(message));
    }
  });
}

// ✅ Start Server
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});