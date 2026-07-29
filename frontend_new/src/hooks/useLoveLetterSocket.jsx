import { useEffect, useRef, useCallback, useState } from 'react';

export default function useLoveLetterSocket(url, eventHandlers = {}) {
  const ws = useRef(null);
  const handlersRef = useRef(eventHandlers);

  const [roomId, setRoomId] = useState(null);
  const [roomData, setRoomData] = useState(null);
  // ✨ 專屬狀態：用來暫存神父偷看的「私密資訊」
  const [privateInfo, setPrivateInfo] = useState(null); 
  // （男爵專用）
  const [baronReveal, setBaronReveal] = useState(null);
  useEffect(() => {
    handlersRef.current = eventHandlers;
  }, [eventHandlers]);

  useEffect(() => {
    ws.current = new WebSocket(url);

    ws.current.onopen = (event) => {
      console.log('💌 LoveLetter WebSocket connected');
      const savedRoomId = sessionStorage.getItem('llRoomId');
      const currentSocket = event.target;
      if (savedRoomId && currentSocket.readyState === WebSocket.OPEN) {
        currentSocket.send(JSON.stringify({ type: 'LL_JOIN_ROOM', data: { roomId: savedRoomId } }));
      }
    };

    ws.current.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        
        // ✨ 防護罩：過濾掉聊天室陣列與非情書事件
        if (Array.isArray(parsed) || !parsed.type?.startsWith('LL_')) return;

        const { type, data } = parsed;
        console.log('📦 LoveLetter 收到事件:', type); 

        switch (type) {
          case 'LL_SHOW_EMOJI':
            handlersRef.current[type]?.(data);
            break;
            
          case 'LL_ROOM_CREATED':
          case 'LL_PLAYER_JOINED':
          case 'LL_GAME_STARTED':
          case 'LL_GAME_UPDATE':
          case 'LL_SHOWDOWN':
          case 'LL_ROUND_ENDED':
          case 'LL_GAME_OVER':
            setRoomId(data.roomId || data.room?.id);
            setRoomData(data.room);
            // 每次遊戲狀態更新時，清空私密資訊，避免殘留
            if (type === 'LL_ROUND_ENDED' || type === 'LL_GAME_STARTED') {
               setPrivateInfo(null);
            }
            if (data.roomId || data.room?.id) {
              sessionStorage.setItem('llRoomId', data.roomId || data.room?.id);
            }
            handlersRef.current[type]?.(data);
            break;

          // ✨ 特殊事件：只有自己會收到的私密資訊 (神父發動)
          case 'LL_PRIVATE_INFO':
            setPrivateInfo(data); // 存入狀態供 UI 顯示
            handlersRef.current[type]?.(data);
            break;
          
          // ✨ 新增：男爵對決接收
          case 'LL_BARON_REVEAL':
            setBaronReveal(data);
            handlersRef.current[type]?.(data);
            break;

          case 'LL_ERROR':
            alert(data.message);
            const fatalErrors = ['不存在', '無法加入', '逃跑'];
            const isFatal = fatalErrors.some(keyword => data.message.includes(keyword));
            
            if (isFatal) {
              sessionStorage.removeItem('llRoomId');
              setRoomId(null);
              setRoomData(null);
            }
            break;

          default:
            break;
        }
      } catch (e) {
        // 忽略解析錯誤
      }
    };

    return () => {
      if (ws.current?.readyState === WebSocket.OPEN) ws.current.close();
    };
  }, [url]);

  const send = useCallback((type, data = {}) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type, data }));
    }
  }, []);

  const createRoom = useCallback((settings) => send('LL_CREATE_ROOM', settings), [send]);  
  // ✨ 修改 joinRoom 讓它接收 nickname
  const joinRoom = useCallback((id, nickname) => send('LL_JOIN_ROOM', { roomId: id, nickname }), [send]);  
  const startGame = useCallback(() => send('LL_START_GAME', { roomId }), [send, roomId]);
  // ✨ 新增：發送重新開始指令
  const restartGame = useCallback(() => send('LL_RESTART_GAME', { roomId }), [send, roomId]);
  const sendEmoji = useCallback((emoji) => send('LL_SEND_EMOJI', { roomId, emoji }), [send, roomId]);
  
  // ✨ 核心出牌方法：必須包含 牌的值、目標對象(可為空)、猜測數字(衛兵專用)
  const playCard = useCallback((cardValue, targetName = null, guessValue = null) => {
    send('LL_PLAY_CARD', { roomId, cardValue, targetName, guessValue });
  }, [send, roomId]);

  const leaveRoom = useCallback(() => {
    send('LL_LEAVE_ROOM', { roomId }); 
    sessionStorage.removeItem('llRoomId');
    setRoomId(null);
    setRoomData(null);
    setPrivateInfo(null);
  }, [send, roomId]);

  // 提供一個清除私密資訊的方法供前端 UI 使用 (例如點擊關閉視窗)
  const clearPrivateInfo = useCallback(() => setPrivateInfo(null), []);

  return {
    send, createRoom, joinRoom, startGame, restartGame, playCard, leaveRoom, sendEmoji, clearPrivateInfo,
    gameState: { roomId, roomData, privateInfo, baronReveal }, // ✨ 加上 baronReveal
  };
}