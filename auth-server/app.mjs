import express from 'express';
import { WebSocketServer } from 'ws';
import { handleNiuNiuMessage, niuniuRooms, cleanupNiuNiuConnection } from './niuniuHandler.mjs';
import { handleBlackjackMessage, blackjackRooms, cleanupBlackjackConnection } from './blackjackHandler.mjs';
import { handleLoveLetterMessage, loveletterRooms, cleanupLoveLetterConnection } from './loveletterHandler.mjs';
import { handleMatch3Message, match3Rooms, cleanupMatch3Connection } from './match3Handler.mjs';
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

// ✨ 1. 全新分類大題庫 (每個類別皆嚴選 30+ 詞彙)
const GAME_WORD_BANKS = {
  anime: [
    '哆啦A夢', '皮卡丘', '漩渦鳴人', '蒙其D魯夫', '孫悟空', '炭治郎', '禰豆子', '江戶川柯南', '胖虎', '初音未來',
    '艾連葉卡', '埼玉', '里維兵長', '奇犽', '酷拉皮卡', '喬巴', '索隆', '香吉士', '魯路修', '坂田銀時',
    '神樂', '灰原哀', '毛利小五郎', '宇智波佐助', '旗木卡卡西', '櫻桃小丸子', '野原新之助', '蠟筆小新', '史萊姆', '哥布林', '美少女戰士', '進擊的巨人'
  ],
  idioms: [
    '畫蛇添足', '守株待兔', '亡羊補牢', '掩耳盜鈴', '拔苗助長', '刻舟求劍', '狐假虎威', '井底之蛙', '盲人摸象', '狐朋狗友',
    '狼吞虎嚥', '雞飛狗跳', '龍飛鳳舞', '虎頭蛇尾', '牛頭馬面', '狗急跳牆', '畫龍點睛', '濫竽充數', '掩人耳目', '驚弓之鳥',
    '破釜沉舟', '望梅止渴', '指鹿為馬', '螳臂當車', '鷸蚌相爭', '坐井觀天', '對牛彈琴', '班門弄斧', '畫餅充飢', '打草驚蛇'
  ],
  daily: [
    '牙刷', '吹風機', '衛生紙', '馬桶', '蓮蓬頭', '冰箱', '微波爐', '電視', '遙控器', '沙發',
    '床', '枕頭', '棉被', '衣櫃', '衣架', '襪子', '鞋子', '鑰匙', '錢包', '手機',
    '充電線', '行動電源', '筆記本', '原子筆', '橡皮擦', '水壺', '剪刀', '膠水', '垃圾桶', '掃把', '拖把', '菜刀'
  ],
  bizarre: [
    '鼻屎', '腳臭', '狐臭', '禿頭', '假牙', '蟑螂', '鼻涕', '馬桶刷', '嘔吐物', '內褲',
    '貞子', '外星人', '殭屍', '木乃伊', '骷髏', '大便', '尿布', '屁股', '腋毛', '鼻毛',
    '青春痘', '雙下巴', '啤酒肚', '假髮', '飛碟', '變種人', '毒藥', '詛咒', '魔法陣', '吸血鬼', '狼人', '喪屍'
  ],
  movies: [
    '哈利波特', '鋼鐵人', '蜘蛛人', '蝙蝠俠', '超人', '美國隊長', '綠巨人浩克', '黑寡婦', '神力女超人', '冰雪奇緣',
    '獅子王', '玩具總動員', '復仇者聯盟', '星際大戰', '變形金剛', '哥吉拉', '金剛', '侏羅紀公園', '鐵達尼號', '阿凡達',
    '駭客任務', '魔戒', '神鬼奇航', '玩命關頭', '奇異博士', '死侍', '猛毒', '小丑', '黑豹', '蟻人', '魷魚遊戲'
  ],
  games: [
    '超級瑪利歐', '薩爾達傳說', '寶可夢', '英雄聯盟', '傳說對決', '絕地求生', '跑跑卡丁車', '楓之谷', '麥塊', '動物森友會',
    '原神', '崩壞星穹鐵道', '怪物彈珠', '遊戲王', 'AmongUs', '糖豆人', '俄羅斯方塊', '貪吃蛇', '踩地雷', '鬥陣特攻',
    '特戰英豪', '世紀帝國', '星海爭霸', '魔獸世界', '暗黑破壞神', '最終幻想', '惡靈古堡', '戰神', '刺客教條', '瑪利歐賽車'
  ],
  people: [
    '警察', '消防員', '醫生', '護士', '老師', '學生', '廚師', '司機', '飛行員', '空服員',
    '歌手', '演員', '畫家', '作家', '工程師', '律師', '法官', '總統', '國王', '皇后',
    '公主', '王子', '小偷', '強盜', '忍者', '武士', '乞丐', '魔術師', '小丑', '太空人', '運動員', '裁判'
  ],
  politics: [
    '孫中山', '蔣中正', '毛澤東', '林肯', '華盛頓', '拿破崙', '希特勒', '邱吉爾', '伊莉莎白女王', '甘地',
    '曼德拉', '歐巴馬', '川普', '拜登', '普丁', '金正恩', '蔡英文', '馬英九', '陳水扁', '賴清德',
    '韓國瑜', '柯文哲', '蘇貞昌', '郭台銘', '習近平', '安倍晉三', '麥克阿瑟', '克林頓', '希拉蕊', '柴契爾夫人'
  ]
};

// ✨ 2. 輔助函數：根據所選類別隨機抽題
function getRandomWordFromCategories(categories) {
  let pool = [];
  if (!categories || categories.length === 0 || categories.includes('all')) {
    Object.values(GAME_WORD_BANKS).forEach(arr => pool.push(...arr));
  } else {
    categories.forEach(cat => {
      if (GAME_WORD_BANKS[cat]) pool.push(...GAME_WORD_BANKS[cat]);
    });
  }
  if (pool.length === 0) pool = GAME_WORD_BANKS.daily; // 防呆機制
  return pool[Math.floor(Math.random() * pool.length)];
}

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

app.get('/api/match3-rooms', (req, res) => {
  try {
    const rooms = Object.values(match3Rooms).map(room => ({ 
      roomId: room.id, playerCount: room.players.length, status: room.status, owner: room.owner 
    }));
    res.json({ success: true, rooms });
  } catch (error) { res.status(500).json({ success: false }); }
});

function broadcastSystemStatus() {
  const totalOnline = Object.keys(connections).length;
  const mapUsers = Object.values(connections).filter(conn => conn._location).length;
  
  const inGameUsers = Object.values(connections).filter(conn => 
    conn._roomId || conn._niuniuRoomId || conn._bjRoomId || conn._llRoomId || conn._match3 || conn._m3RoomId
  ).length;
  
  const statusMsg = JSON.stringify([{ 
    type: 'SYSTEM_STATUS', 
    data: { online: totalOnline, map: mapUsers, inGame: inGameUsers } 
  }]);
  
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
          const systemMessage = { sender: 'System', content: `🃏 撲克鬥牛房間 [${newRoomId}] 已創建，快來加入挑戰吧！`, timestamp: new Date(), type: 'system', channel: 'system', gameType: 'niuniu', gameRoomId: newRoomId };
          Object.values(connections).forEach((conn) => { if(conn.readyState === 1) conn.send(JSON.stringify([systemMessage])); });
        }
      };
      handleNiuNiuMessage(connection, type, data, wsServer, callbacks);
      if (['NIUNIU_CREATE_ROOM', 'NIUNIU_JOIN_ROOM', 'NIUNIU_LEAVE_ROOM'].includes(type)) setTimeout(broadcastSystemStatus, 50);
      return; 
    }

    if (type && type.startsWith('BJ_')) {
      data.username = connection._username || data.username; 
      const callbacks = {
        onRoomCreated: async (newRoomId, gameName) => {
          const systemMessage = { sender: 'System', content: `🃏 ${gameName} 房間 [${newRoomId}] 已創建，快來加入挑戰吧！`, timestamp: new Date(), type: 'system', channel: 'system', gameType: 'blackjack', gameRoomId: newRoomId };
          Object.values(connections).forEach((conn) => { if(conn.readyState === 1) conn.send(JSON.stringify([systemMessage])); });
        }
      };
      handleBlackjackMessage(connection, type, data, wsServer, callbacks);
      if (['BJ_CREATE_ROOM', 'BJ_JOIN_ROOM', 'BJ_LEAVE_ROOM'].includes(type)) setTimeout(broadcastSystemStatus, 50);
      return; 
    }

    if (type && type.startsWith('LL_')) {
      data.username = connection._username || data.username; 
      const callbacks = {
        onRoomCreated: async (newRoomId, gameName) => {
          const systemMessage = { sender: 'System', content: `💌 ${gameName} 房間 [${newRoomId}] 已創建，快來拆開情書吧！`, timestamp: new Date(), type: 'system', channel: 'system', gameType: 'loveletter', gameRoomId: newRoomId };
          Object.values(connections).forEach((conn) => { if(conn.readyState === 1) conn.send(JSON.stringify([systemMessage])); });
        }
      };
      handleLoveLetterMessage(connection, type, data, wsServer, callbacks);
      if (['LL_CREATE_ROOM', 'LL_JOIN_ROOM', 'LL_LEAVE_ROOM'].includes(type)) setTimeout(broadcastSystemStatus, 50);
      return; 
    }
    if (type && type.startsWith('M3_')) {
      data.username = connection._username || data.username; 
      const callbacks = {
        onRoomCreated: async (newRoomId, gameName) => {
          const systemMessage = { sender: 'System', content: `🍉 ${gameName} 房間 [${newRoomId}] 已開放，快來挑戰高分！`, timestamp: new Date(), type: 'system', channel: 'system', gameType: 'match3', gameRoomId: newRoomId };
          Object.values(connections).forEach((conn) => { if(conn.readyState === 1) conn.send(JSON.stringify([systemMessage])); });
        }
      };
      handleMatch3Message(connection, type, data, wsServer, callbacks);
      if (['M3_CREATE_ROOM', 'M3_JOIN_ROOM', 'M3_LEAVE_ROOM'].includes(type)) setTimeout(broadcastSystemStatus, 50);
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
        
        // ✨ 解析使用者選擇的題庫，並生成第一題
        const selectedCategories = data.categories || ['all'];
        const word = getRandomWordFromCategories(selectedCategories);
        
        const player = { id: playerId, name: username, score: 0, isPainter: true };
        const hasTimeLimit = data.hasTimeLimit || false;
        const timeLimit = data.timeLimit || 60;
        
        // 將 categories 存入房間狀態中
        gameRooms[roomId] = { players: [player], painterId: playerId, word, hasTimeLimit, timeLimit, categories: selectedCategories, scoreHistory: { [username]: 0 } };
        connection._roomId = roomId;
        connection._playerId = playerId;
      
        const systemMessage = { sender: 'System', content: `🎨 你畫我猜房間 [${roomId}] 已創建，快來大展身手吧！`, timestamp: new Date(), type: 'system', channel: 'system', gameType: 'draw-guess', gameRoomId: roomId };
        Object.values(connections).forEach((conn) => { conn.send(JSON.stringify([systemMessage])); });
      
        // 回傳新增的 categories
        connection.send(JSON.stringify({ type: 'GAME_ROOM_CREATED', data: { roomId, players: gameRooms[roomId].players, isPainter: true, playerId, word, hasTimeLimit, timeLimit, categories: selectedCategories } }));
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

        // 回傳新增的 categories
        connection.send(JSON.stringify({ type: 'GAME_JOINED', data: { roomId, players: room.players, isPainter: false, playerId, hasTimeLimit: room.hasTimeLimit, timeLimit: room.timeLimit, categories: room.categories } }));
        broadcastToRoom(roomId, { type: 'GAME_PLAYER_UPDATE', data: { players: room.players } });
        break;
      }

      case 'GAME_DRAW_DATA': {
        const roomId = connection._roomId;
        if (!roomId) return;
        Object.values(connections).forEach((conn) => {
          if (conn._roomId === roomId && conn !== connection && conn.readyState === 1) {
            conn.send(JSON.stringify({ type: 'GAME_DRAW_DATA', data: { path: data.path } }));
          }
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
          if (guesser) { guesser.score += 100; scoreUpdate[guesser.id] = guesser.score; room.scoreHistory[guesser.name] = guesser.score; }
          const painter = room.players.find(p => p.id === room.painterId);
          if (painter) { painter.score += 50; scoreUpdate[painter.id] = painter.score; room.scoreHistory[painter.name] = painter.score; }
      
          const currentPainterIndex = room.players.findIndex(p => p.id === room.painterId);
          const nextPainterIndex = (currentPainterIndex + 1) % room.players.length;
          const nextPainter = room.players[nextPainterIndex];
          
          room.painterId = nextPainter.id;
          room.players.forEach(p => p.isPainter = (p.id === room.painterId));
          
          // ✨ 核心修復：從該房間專屬的題庫中抽取下一題
          room.word = getRandomWordFromCategories(room.categories);
      
          // 回傳新增的 categories
          broadcastToRoom(roomId, { type: 'GAME_NEW_ROUND', data: { players: room.players, word: room.word, painterId: room.painterId, hasTimeLimit: room.hasTimeLimit, timeLimit: room.timeLimit, categories: room.categories } });
        }
      
        broadcastToRoom(roomId, { type: 'GAME_GUESS_RESULT', data: { playerName: username, guess: data.guess, isCorrect, scoreUpdate, correctWord: isCorrect ? room.word : null } });
        break;
      }
      // ✨ 新增：消消樂玩家狀態追蹤
      case 'MATCH3_JOIN': {
        connection._match3 = true;
        broadcastSystemStatus();
        break;
      }
      case 'MATCH3_LEAVE': {
        delete connection._match3;
        broadcastSystemStatus();
        break;
      }
    }
  });

  connection.on('close', () => {
    if (connection._username) {
      cleanupNiuNiuConnection(connection._username, connection._niuniuRoomId, wsServer);
      cleanupBlackjackConnection(connection._username, connection._bjRoomId, wsServer);
      cleanupLoveLetterConnection(connection._username, connection._llRoomId, wsServer);
      cleanupMatch3Connection(connection._username, connection._m3RoomId, wsServer);
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