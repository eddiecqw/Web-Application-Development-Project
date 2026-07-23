import { useEffect, useRef, useCallback, useState } from 'react';

export default function useBlackjackSocket(url, eventHandlers = {}) {
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
      console.log('🃏 Blackjack WebSocket connected');
      const savedRoomId = sessionStorage.getItem('bjRoomId');
      if (savedRoomId && event.target.readyState === WebSocket.OPEN) {
        event.target.send(JSON.stringify({ type: 'BJ_JOIN_ROOM', data: { roomId: savedRoomId } }));
      }
    };

    ws.current.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (Array.isArray(parsed) || !parsed.type?.startsWith('BJ_')) return;
        
        const { type, data } = parsed;
        console.log('📦 Blackjack 收到事件:', type); 

        switch (type) {
            // ✨ 新增這一個 case 來接收系統通知
          case 'BJ_NOTIFICATION':
            alert(data.message);
            break;

          case 'BJ_SHOW_EMOJI':
            handlersRef.current[type]?.(data);
            break;

          // 處理所有會改變房間狀態的事件
          case 'BJ_ROOM_CREATED':
          case 'BJ_PLAYER_JOINED':
          case 'BJ_GAME_STARTED':
          case 'BJ_GAME_UPDATE':  // 玩家要牌後更新
          case 'BJ_SHOWDOWN':     // 結算畫面
          case 'BJ_ROUND_ENDED':  // 準備下一局
            setRoomId(data.roomId || data.room?.id);
            setRoomData(data.room);
            if (data.roomId || data.room?.id) {
              sessionStorage.setItem('bjRoomId', data.roomId || data.room?.id);
            }
            handlersRef.current[type]?.(data);
            break;

          case 'BJ_ERROR':
            // 先彈出提示框顯示訊息
            alert(data.message);
            
            // ✨ 聰明的錯誤分類：只有當訊息包含這些「致命字眼」時，才把玩家踢回大廳
            const fatalErrors = ['不存在', '無法加入', '解散'];
            const isFatal = fatalErrors.some(keyword => data.message.includes(keyword));
            
            if (isFatal) {
              sessionStorage.removeItem('bjRoomId');
              setRoomId(null);
              setRoomData(null);
            }
            break;

          default:
            break;
        }
      } catch (e) {}
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

  const createRoom = useCallback((settings) => send('BJ_CREATE_ROOM', settings), [send]);  
  const joinRoom = useCallback((id) => send('BJ_JOIN_ROOM', { roomId: id }), [send]);
  const startGame = useCallback(() => send('BJ_START_GAME', { roomId }), [send, roomId]);
  
  // ✨ 新增玩家操作指令
  const hit = useCallback(() => send('BJ_HIT', { roomId }), [send, roomId]);
  const stand = useCallback(() => send('BJ_STAND', { roomId }), [send, roomId]);
  
  const sendEmoji = useCallback((emoji) => send('BJ_SEND_EMOJI', { roomId, emoji }), [send, roomId]);
  const leaveRoom = useCallback(() => {
    if (roomId) send('BJ_LEAVE_ROOM', { roomId });
    sessionStorage.removeItem('bjRoomId');
    setRoomId(null);
    setRoomData(null);
  }, [roomId, send]);

  return {
    send, createRoom, joinRoom, startGame, hit, stand, leaveRoom, sendEmoji,
    gameState: { roomId, roomData },
  };
}