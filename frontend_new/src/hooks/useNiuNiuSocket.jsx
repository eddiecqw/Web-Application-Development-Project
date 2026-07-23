import { useEffect, useRef, useCallback, useState } from 'react';

export default function useNiuNiuSocket(url, eventHandlers = {}) {
  const ws = useRef(null);
  const handlersRef = useRef(eventHandlers);

  const [roomId, setRoomId] = useState(null);
  const [roomData, setRoomData] = useState(null);

  useEffect(() => {
    handlersRef.current = eventHandlers;
  }, [eventHandlers]);

  useEffect(() => {
    ws.current = new WebSocket(url);

    ws.current.onopen = (event) => {
      console.log('🃏 NiuNiu WebSocket connected');
      const savedRoomId = sessionStorage.getItem('niuniuRoomId');
      // ✨ 修復 CONNECTING 報錯：直接使用觸發 event 的目標 socket 發送，確保狀態一定是 OPEN
      const currentSocket = event.target;
      if (savedRoomId && currentSocket.readyState === WebSocket.OPEN) {
        currentSocket.send(JSON.stringify({ type: 'NIUNIU_JOIN_ROOM', data: { roomId: savedRoomId } }));
      }
    };

    ws.current.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        
        // ✨ 修復 undefined 轟炸：如果收到的訊息是陣列(聊天紀錄)，或是 type 不是鬥牛事件，直接忽略！
        if (Array.isArray(parsed) || !parsed.type?.startsWith('NIUNIU_')) return;

        const { type, data } = parsed;
        console.log('📦 NiuNiu 收到事件:', type); 

        switch (type) {
          case 'NIUNIU_ROOM_CREATED':
          case 'NIUNIU_PLAYER_JOINED':
          case 'NIUNIU_GAME_STARTED':
          case 'NIUNIU_PLAYER_SUBMITTED':
          case 'NIUNIU_SHOWDOWN':
          case 'NIUNIU_ROUND_ENDED':
            setRoomId(data.roomId || data.room?.id);
            setRoomData(data.room);
            if (data.roomId || data.room?.id) {
              sessionStorage.setItem('niuniuRoomId', data.roomId || data.room?.id);
            }
            handlersRef.current[type]?.(data);
            break;

          case 'NIUNIU_ERROR':
            alert(data.message);
            sessionStorage.removeItem('niuniuRoomId');
            break;

          default:
            break;
        }
      } catch (e) {
        // 忽略 JSON parse error
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

  const createRoom = useCallback((settings) => send('NIUNIU_CREATE_ROOM', settings), [send]);  
  const joinRoom = useCallback((id) => send('NIUNIU_JOIN_ROOM', { roomId: id }), [send]);
  // ✨ 加上防護罩：如果傳進來的是 React 點擊事件 (帶有 nativeEvent)，就忽略它，避免 JSON 崩潰
  const startGame = useCallback((payload) => {
    const safeData = (payload && !payload.nativeEvent) ? payload : {};
    send('NIUNIU_START_GAME', { roomId, ...safeData });
  }, [send, roomId]);

  const submitHand = useCallback((payload) => {
    const safeData = (payload && !payload.nativeEvent) ? payload : {};
    send('NIUNIU_SUBMIT_HAND', { roomId, ...safeData });
  }, [send, roomId]);
  
  const leaveRoom = useCallback(() => {
    sessionStorage.removeItem('niuniuRoomId');
    setRoomId(null);
    setRoomData(null);
  }, []);

  return {
    send, createRoom, joinRoom, startGame, submitHand, leaveRoom,
    gameState: { roomId, roomData },
  };
}