import { useEffect, useRef, useCallback, useState } from 'react';

export default function useGameSocket(url, eventHandlers = {}) {
  const ws = useRef(null);
  const handlersRef = useRef(eventHandlers);
  const [currentWord, setCurrentWord] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [isPainter, setIsPainter] = useState(false);
  const [players, setPlayers] = useState([]);

  // 更新 handler 引用
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

        switch (type) {
          case 'GAME_ROOM_CREATED':
          case 'GAME_JOINED':
            setRoomId(data.roomId);
            setPlayerId(data.playerId);
            setIsPainter(data.isPainter);
            setPlayers(data.players);
            if (data.word) setCurrentWord(data.word);//詞語
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

          // useGameSocket.jsx 增加分数更新处理
          case 'GAME_GUESS_RESULT':
            setPlayers(prev => prev.map(player => {
              const newScore = data.scoreUpdate[player.id];
              return newScore ? {...player, score: newScore} : player;
            }));
            handlersRef.current['GUESS_RESULT']?.(data);
            break;

          case 'GAME_NEW_ROUND':
            setPlayers(data.players);
            setIsPainter(data.painterId === playerId);
            if (data.word) setCurrentWord(data.word);
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

  const createRoom = () => send('GAME_CREATE_ROOM');
  const joinRoom = (roomId) => send('GAME_JOIN_ROOM', { roomId });
  const sendDrawData = (path) => send('GAME_DRAW_DATA', { path });
  const submitGuess = (guess) => send('GAME_SUBMIT_GUESS', { guess });

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
      currentWord,//詞語
    },
  };
}