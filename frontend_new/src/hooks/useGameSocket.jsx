import { useEffect, useRef, useCallback, useState } from 'react';

export default function useGameSocket(url, eventHandlers = {}) {
  const ws = useRef(null);
  const handlersRef = useRef(eventHandlers);
  
  // 關鍵：儲存玩家的真實 ID 供 WebSocket 回呼函數使用
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
    };

    ws.current.onmessage = (event) => {
      try {
        const { type, data } = JSON.parse(event.data);
        console.log('📦 WebSocket 收到事件:', type, data); // Debug 追蹤用

        switch (type) {
          case 'GAME_ROOM_CREATED':
          case 'GAME_JOINED':
            setRoomId(data.roomId);
            setPlayerId(data.playerId);
            playerIdRef.current = data.playerId; // 同步 ID
            setIsPainter(data.isPainter);
            setPlayers(data.players);
            if (data.word) setCurrentWord(data.word);
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
            setIsPainter(data.painterId === playerIdRef.current); // 準確切換畫家
            if (data.word) setCurrentWord(data.word); // 準確更新題庫
            handlersRef.current['GAME_NEW_ROUND']?.(data); // 觸發畫板清空
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

  // 使用 useCallback 包裝，防止 DrawGuessPage 不斷重新渲染
  const send = useCallback((type, data = {}) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type, data }));
    }
  }, []);

  const createRoom = useCallback(() => send('GAME_CREATE_ROOM'), [send]);
  const joinRoom = useCallback((roomId) => send('GAME_JOIN_ROOM', { roomId }), [send]);
  const sendDrawData = useCallback((path) => send('GAME_DRAW_DATA', { path }), [send]);
  const submitGuess = useCallback((guess) => send('GAME_SUBMIT_GUESS', { guess }), [send]);

  return {
    send,
    createRoom,
    joinRoom,
    sendDrawData,
    submitGuess,
    gameState: {
      roomId,
      playerId,
      isPainter,
      players,
      currentWord,
    },
  };
}