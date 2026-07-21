import { useEffect, useRef, useCallback, useState } from 'react';

export default function useGameSocket(url, eventHandlers = {}) {
  const ws = useRef(null);
  const handlersRef = useRef(eventHandlers);
  
  const playerIdRef = useRef(null);

  const [currentWord, setCurrentWord] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [isPainter, setIsPainter] = useState(false);
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    handlersRef.current = eventHandlers;
  }, [eventHandlers]);

  useEffect(() => {
    ws.current = new WebSocket(url);

    ws.current.onopen = () => {
      console.log('🎮 Game WebSocket connected');
      
      // ✨ 核心修復：斷線重連自動歸隊機制
      // 網頁重新整理後，WebSocket 重新連線的第一時間，去檢查 sessionStorage
      const savedRoomId = sessionStorage.getItem('drawGuessRoomId');
      if (savedRoomId) {
        console.log(`🔄 發現歷史房間紀錄 ${savedRoomId}，自動重新加入...`);
        ws.current.send(JSON.stringify({ type: 'GAME_JOIN_ROOM', data: { roomId: savedRoomId } }));
      }
    };

    ws.current.onmessage = (event) => {
      try {
        const { type, data } = JSON.parse(event.data);
        console.log('📦 WebSocket 收到事件:', type, data); 

        switch (type) {
          case 'GAME_ROOM_CREATED':
          case 'GAME_JOINED':
            setRoomId(data.roomId);
            setPlayerId(data.playerId);
            playerIdRef.current = data.playerId; 
            setIsPainter(data.isPainter);
            setPlayers(data.players);
            if (data.word) setCurrentWord(data.word);
            
            // ✨ 當成功進入房間時，把房間號碼記在瀏覽器中
            sessionStorage.setItem('drawGuessRoomId', data.roomId);
            break;

          case 'GAME_PLAYER_UPDATE':
            setPlayers(data.players);
            break;

          case 'GAME_DRAW_DATA':
            handlersRef.current['DRAW_DATA_RECEIVED']?.(data);
            break;

          case 'GAME_GUESS':
            handlersRef.current['GUESS_RECEIVED']?.(data);
            break;

          case 'GAME_ERROR':
            alert(data.message);
            // 如果房間已經被解散，清除無效的紀錄
            sessionStorage.removeItem('drawGuessRoomId'); 
            break;

          case 'GAME_GUESS_RESULT':
            setPlayers(prev => prev.map(player => {
              const newScore = data.scoreUpdate[player.id];
              return newScore ? { ...player, score: newScore } : player;
            }));
            handlersRef.current['GUESS_RESULT']?.(data);
            break;

          case 'GAME_NEW_ROUND':
            setPlayers(data.players);
            setIsPainter(data.painterId === playerIdRef.current); 
            if (data.word) setCurrentWord(data.word); 
            setTimeout(() => {
              handlersRef.current['GAME_NEW_ROUND']?.(data); 
            }, 50);
            break;

          default:
            console.warn('Unhandled message type:', type);
            break;
        }
      } catch (e) {
        console.error('WebSocket message parse error:', e);
      }
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.close();
      }
    };
  }, [url]);

  const send = useCallback((type, data = {}) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type, data }));
    }
  }, []);

  const createRoom = useCallback((settings) => send('GAME_CREATE_ROOM', settings), [send]);  
  const joinRoom = useCallback((roomId) => send('GAME_JOIN_ROOM', { roomId }), [send]);
  const sendDrawData = useCallback((path) => send('GAME_DRAW_DATA', { path }), [send]);
  const submitGuess = useCallback((guess) => send('GAME_SUBMIT_GUESS', { guess }), [send]);
  
  // ✨ 新增：提供一個正常離開房間的方法
  const leaveRoom = useCallback(() => {
    sessionStorage.removeItem('drawGuessRoomId');
    setRoomId(null); // 清空狀態返回大廳
    // 你可以考慮在這裡發送一個離開房間的 socket 事件給後端
  }, []);

  return {
    send,
    createRoom,
    joinRoom,
    sendDrawData,
    submitGuess,
    leaveRoom, // 導出這個方法
    gameState: {
      roomId,
      playerId,
      isPainter,
      players,
      currentWord,
    },
  };
}